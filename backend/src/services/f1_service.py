"""
F1 Service - Completely refactored with proper error handling and rate limiting
"""

import aiohttp
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json

logger = logging.getLogger(__name__)

class F1Service:
    def __init__(self):
        self.base_url = "https://api.openf1.org/v1"
        self.session: Optional[aiohttp.ClientSession] = None
        self.cache: Dict[str, Dict] = {}
        self.cache_ttl = 60  # 1 minute cache
        
        # Simple rate limiting
        self.last_request_time = 0
        self.min_request_interval = 0.5  # 500ms between requests
        
        # Health tracking
        self.consecutive_failures = 0
        self.max_failures = 5
        self.is_healthy = True
        
    async def initialize(self):
        """Initialize the HTTP client session"""
        connector = aiohttp.TCPConnector(
            limit=10,
            limit_per_host=5,
            ttl_dns_cache=300,
            use_dns_cache=True,
        )
        
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': 'F1-Dashboard/1.0 (Educational)',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate'
            }
        )
        logger.info("F1Service initialized successfully")

    async def close(self):
        """Close the HTTP client session"""
        if self.session:
            await self.session.close()
            logger.info("F1Service closed")

    def _get_cache_key(self, endpoint: str, params: Dict = None) -> str:
        """Generate cache key"""
        params_str = json.dumps(params or {}, sort_keys=True)
        return f"{endpoint}_{hash(params_str)}"

    def _is_cache_valid(self, cache_entry: Dict) -> bool:
        """Check if cache entry is still valid"""
        cache_age = datetime.now() - cache_entry['timestamp']
        return cache_age < timedelta(seconds=self.cache_ttl)

    async def _wait_for_rate_limit(self):
        """Simple rate limiting"""
        current_time = datetime.now().timestamp()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.min_request_interval:
            wait_time = self.min_request_interval - time_since_last
            await asyncio.sleep(wait_time)
        
        self.last_request_time = datetime.now().timestamp()

    async def _make_request(self, endpoint: str, params: Dict = None) -> List[Dict]:
        """Make HTTP request with proper error handling"""
        if not self.session:
            await self.initialize()

        # Check cache first
        cache_key = self._get_cache_key(endpoint, params)
        if cache_key in self.cache and self._is_cache_valid(self.cache[cache_key]):
            logger.debug(f"Cache hit for {endpoint}")
            return self.cache[cache_key]['data']

        # Rate limiting
        await self._wait_for_rate_limit()

        url = f"{self.base_url}/{endpoint}"
        
        try:
            logger.debug(f"Making request to {url} with params {params}")
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Ensure data is a list
                    if not isinstance(data, list):
                        data = [data] if data else []
                    
                    # Cache successful response
                    self.cache[cache_key] = {
                        'data': data,
                        'timestamp': datetime.now()
                    }
                    
                    # Reset failure counter
                    self.consecutive_failures = 0
                    self.is_healthy = True
                    
                    logger.debug(f"Success: {endpoint} returned {len(data)} items")
                    return data
                    
                elif response.status == 429:
                    # Rate limited - wait and return cached data if available
                    logger.warning(f"Rate limited on {endpoint}")
                    await asyncio.sleep(5)  # Wait 5 seconds
                    
                    if cache_key in self.cache:
                        logger.info("Returning cached data due to rate limit")
                        return self.cache[cache_key]['data']
                    return []
                    
                elif response.status == 404:
                    # Not found - this is normal for some endpoints
                    logger.debug(f"404 for {endpoint} - no data available")
                    return []
                    
                else:
                    logger.error(f"HTTP {response.status} for {endpoint}")
                    self.consecutive_failures += 1
                    
                    # Return cached data if available
                    if cache_key in self.cache:
                        return self.cache[cache_key]['data']
                    return []
                    
        except asyncio.TimeoutError:
            logger.error(f"Timeout for {endpoint}")
            self.consecutive_failures += 1
            # Return cached data if available
            if cache_key in self.cache:
                return self.cache[cache_key]['data']
            return []
            
        except Exception as e:
            logger.error(f"Request error for {endpoint}: {e}")
            self.consecutive_failures += 1
            # Return cached data if available
            if cache_key in self.cache:
                return self.cache[cache_key]['data']
            return []
        
        finally:
            # Mark as unhealthy if too many failures
            if self.consecutive_failures >= self.max_failures:
                self.is_healthy = False

    async def get_current_session(self) -> Optional[Dict]:
        """Get current session - simplified approach"""
        try:
            # Try to get latest session
            sessions = await self._make_request("sessions", {"session_key": "latest"})
            if sessions:
                session = sessions[0]
                logger.info(f"Found session: {session.get('session_name')} at {session.get('circuit_short_name')}")
                return session
            
            # Fallback: get recent sessions and find the latest
            sessions = await self._make_request("sessions", {"year": datetime.now().year})
            if sessions:
                # Sort by date and get the most recent
                sorted_sessions = sorted(sessions, key=lambda x: x.get('date_start', ''), reverse=True)
                latest = sorted_sessions[0]
                logger.info(f"Fallback session: {latest.get('session_name')} at {latest.get('circuit_short_name')}")
                return latest
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting current session: {e}")
            return None

    async def get_drivers(self, session_key: str) -> List[Dict]:
        """Get drivers for a session"""
        try:
            drivers = await self._make_request("drivers", {"session_key": session_key})
            logger.info(f"Found {len(drivers)} drivers for session {session_key}")
            return drivers
        except Exception as e:
            logger.error(f"Error getting drivers: {e}")
            return []

    async def get_positions(self, session_key: str) -> List[Dict]:
        """Get current positions"""
        try:
            positions = await self._make_request("position", {"session_key": session_key})
            logger.debug(f"Found {len(positions)} position entries")
            return positions
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []

    async def get_intervals(self, session_key: str) -> List[Dict]:
        """Get interval data"""
        try:
            intervals = await self._make_request("intervals", {"session_key": session_key})
            logger.debug(f"Found {len(intervals)} interval entries")
            return intervals
        except Exception as e:
            logger.error(f"Error getting intervals: {e}")
            return []

    async def get_laps(self, session_key: str) -> List[Dict]:
        """Get lap data"""
        try:
            laps = await self._make_request("laps", {"session_key": session_key})
            logger.debug(f"Found {len(laps)} lap entries")
            return laps
        except Exception as e:
            logger.error(f"Error getting laps: {e}")
            return []

    async def get_stints(self, session_key: str) -> List[Dict]:
        """Get stint data"""
        try:
            stints = await self._make_request("stints", {"session_key": session_key})
            logger.debug(f"Found {len(stints)} stint entries")
            return stints
        except Exception as e:
            logger.error(f"Error getting stints: {e}")
            return []

    async def get_pit_data(self, session_key: str) -> List[Dict]:
        """Get pit stop data"""
        try:
            pit_data = await self._make_request("pit", {"session_key": session_key})
            logger.debug(f"Found {len(pit_data)} pit entries")
            return pit_data
        except Exception as e:
            logger.error(f"Error getting pit data: {e}")
            return []

    async def get_locations(self, session_key: str) -> List[Dict]:
        """Get car locations - limit to recent data"""
        try:
            # Only get last 30 seconds to avoid huge responses
            cutoff_time = (datetime.utcnow() - timedelta(seconds=30)).isoformat() + "Z"
            params = {
                "session_key": session_key,
                "date": f">={cutoff_time}"
            }
            locations = await self._make_request("location", params)
            logger.debug(f"Found {len(locations)} recent location entries")
            return locations
        except Exception as e:
            logger.error(f"Error getting locations: {e}")
            return []

    async def get_car_data(self, session_key: str, driver_number: Optional[int] = None) -> List[Dict]:
        """Get car telemetry data - limited to recent"""
        try:
            # Only get last 10 seconds to avoid rate limits
            cutoff_time = (datetime.utcnow() - timedelta(seconds=10)).isoformat() + "Z"
            params = {
                "session_key": session_key,
                "date": f">={cutoff_time}"
            }
            if driver_number:
                params["driver_number"] = driver_number
                
            car_data = await self._make_request("car_data", params)
            logger.debug(f"Found {len(car_data)} recent car data entries")
            return car_data
        except Exception as e:
            logger.error(f"Error getting car data: {e}")
            return []

    async def get_comprehensive_timing_data(self, session_key: str) -> Dict:
        """Get all timing data in one coordinated call"""
        try:
            logger.info(f"Getting comprehensive data for session {session_key}")
            
            # Get data sequentially to avoid overwhelming the API
            drivers = await self.get_drivers(session_key)
            if not drivers:
                return {'driverTimings': [], 'error': 'No drivers found'}
            
            await asyncio.sleep(0.2)  # Small delay
            positions = await self.get_positions(session_key)
            
            await asyncio.sleep(0.2)
            intervals = await self.get_intervals(session_key)
            
            await asyncio.sleep(0.2)
            laps = await self.get_laps(session_key)
            
            await asyncio.sleep(0.2)
            stints = await self.get_stints(session_key)
            
            await asyncio.sleep(0.2)
            pit_data = await self.get_pit_data(session_key)

            # Process into driver timings
            driver_timings = []
            
            for driver in drivers:
                driver_number = driver.get('driver_number')
                
                # Get latest data for this driver
                latest_position = self._get_latest_for_driver(positions, driver_number, 'date')
                latest_interval = self._get_latest_for_driver(intervals, driver_number, 'date')
                latest_lap = self._get_latest_for_driver(laps, driver_number, 'lap_number')
                current_stint = self._get_latest_for_driver(stints, driver_number, 'stint_number')
                
                # Count pit stops
                driver_pit_stops = [p for p in pit_data if p.get('driver_number') == driver_number]
                
                timing = {
                    'driver': driver,
                    'position': latest_position.get('position') if latest_position else None,
                    'lapTime': self._format_lap_time(latest_lap.get('lap_duration')) if latest_lap else '--:--.---',
                    'sector1': self._format_sector_time(latest_lap.get('duration_sector_1')) if latest_lap else '---.---',
                    'sector2': self._format_sector_time(latest_lap.get('duration_sector_2')) if latest_lap else '---.---',
                    'sector3': self._format_sector_time(latest_lap.get('duration_sector_3')) if latest_lap else '---.---',
                    'gap': self._format_gap(latest_interval.get('gap_to_leader')) if latest_interval else '--',
                    'interval': self._format_gap(latest_interval.get('interval')) if latest_interval else '--',
                    'lastLap': latest_lap.get('lap_number') if latest_lap else 0,
                    'tyreCompound': current_stint.get('compound') if current_stint else 'UNKNOWN',
                    'tyreAge': self._calculate_tyre_age(current_stint, latest_lap) if current_stint and latest_lap else 0,
                    'pitStops': len(driver_pit_stops)
                }
                
                driver_timings.append(timing)
            
            # Sort by position
            driver_timings.sort(key=lambda x: x.get('position') or 999)
            
            return {
                'driverTimings': driver_timings,
                'lastUpdate': datetime.utcnow().isoformat(),
                'sessionKey': session_key,
                'totalDrivers': len(drivers)
            }
            
        except Exception as e:
            logger.error(f"Error getting comprehensive timing data: {e}")
            return {'driverTimings': [], 'error': str(e)}

    def _get_latest_for_driver(self, data_list: List[Dict], driver_number: int, sort_key: str) -> Optional[Dict]:
        """Get the latest entry for a specific driver"""
        driver_data = [item for item in data_list if item.get('driver_number') == driver_number]
        if not driver_data:
            return None
        
        # Sort by the specified key (date or lap_number, etc.)
        sorted_data = sorted(driver_data, key=lambda x: x.get(sort_key, ''), reverse=True)
        return sorted_data[0]

    def _format_lap_time(self, seconds: Optional[float]) -> str:
        """Format lap time from seconds"""
        if not seconds or seconds <= 0:
            return '--:--.---'
        
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes}:{secs:06.3f}"

    def _format_sector_time(self, seconds: Optional[float]) -> str:
        """Format sector time"""
        if not seconds or seconds <= 0:
            return '---.---'
        return f"{seconds:.3f}"

    def _format_gap(self, gap: Optional[float]) -> str:
        """Format gap time"""
        if not gap:
            return '--'
        
        if gap < 60:
            return f"+{gap:.3f}"
        else:
            minutes = int(gap // 60)
            seconds = gap % 60
            return f"+{minutes}:{seconds:06.3f}"

    def _calculate_tyre_age(self, stint: Dict, latest_lap: Dict) -> int:
        """Calculate current tyre age"""
        if not stint or not latest_lap:
            return 0
        
        current_lap = latest_lap.get('lap_number', 0)
        stint_start = stint.get('lap_start', 0)
        age_at_start = stint.get('tyre_age_at_start', 0)
        
        return max(0, current_lap - stint_start + age_at_start)

    def get_health_status(self) -> Dict:
        """Get service health status"""
        return {
            'is_healthy': self.is_healthy,
            'consecutive_failures': self.consecutive_failures,
            'cache_entries': len(self.cache),
            'last_request': self.last_request_time
        }