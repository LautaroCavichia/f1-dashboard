"""
F1 Service - Fixed with proper rate limiting and error handling
"""

import aiohttp
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json
from asyncio import Semaphore

logger = logging.getLogger(__name__)

class F1Service:
    def __init__(self):
        self.base_url = "https://api.openf1.org/v1"
        self.session: Optional[aiohttp.ClientSession] = None
        self.cache: Dict[str, Dict] = {}
        self.cache_ttl = 30  # Increased cache time to 30 seconds
        
        # Rate limiting: OpenF1 allows ~200 requests per minute
        self.request_semaphore = Semaphore(5)  # Max 5 concurrent requests
        self.request_delay = 0.3  # 300ms between requests
        self.last_request_time = 0
        
        # Track rate limit status
        self.rate_limited_until = 0
        self.consecutive_failures = 0
        
    async def initialize(self):
        """Initialize the HTTP client session"""
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            headers={
                'User-Agent': 'F1-Dashboard/1.0',
                'Accept': 'application/json'
            }
        )
        logger.info("F1Service initialized with rate limiting")

    async def close(self):
        """Close the HTTP client session"""
        if self.session:
            await self.session.close()

    async def _wait_for_rate_limit(self):
        """Wait if we're currently rate limited"""
        if self.rate_limited_until > datetime.now().timestamp():
            wait_time = self.rate_limited_until - datetime.now().timestamp()
            logger.info(f"Rate limited, waiting {wait_time:.1f} seconds")
            await asyncio.sleep(wait_time)

    async def _make_request(self, endpoint: str, params: Dict = None) -> List[Dict]:
        """Make HTTP request with comprehensive rate limiting and error handling"""
        if not self.session:
            await self.initialize()

        # Create cache key
        cache_key = f"{endpoint}_{json.dumps(params or {}, sort_keys=True)}"
        
        # Check cache first
        if cache_key in self.cache:
            cache_entry = self.cache[cache_key]
            cache_age = datetime.now() - cache_entry['timestamp']
            if cache_age < timedelta(seconds=self.cache_ttl):
                return cache_entry['data']

        # Wait for rate limit
        await self._wait_for_rate_limit()

        # Use semaphore to limit concurrent requests
        async with self.request_semaphore:
            # Enforce delay between requests
            current_time = datetime.now().timestamp()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.request_delay:
                await asyncio.sleep(self.request_delay - time_since_last)
            
            self.last_request_time = datetime.now().timestamp()

            url = f"{self.base_url}/{endpoint}"
            
            try:
                async with self.session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Cache the result
                        self.cache[cache_key] = {
                            'data': data,
                            'timestamp': datetime.now()
                        }
                        
                        # Reset failure counter on success
                        self.consecutive_failures = 0
                        logger.debug(f"API success: {endpoint}")
                        return data
                        
                    elif response.status == 429:
                        # Rate limited
                        retry_after = int(response.headers.get('Retry-After', '60'))
                        self.rate_limited_until = datetime.now().timestamp() + retry_after
                        self.consecutive_failures += 1
                        
                        logger.warning(f"Rate limited for {retry_after}s. Endpoint: {endpoint}")
                        
                        # Return cached data if available
                        if cache_key in self.cache:
                            logger.info("Returning cached data due to rate limit")
                            return self.cache[cache_key]['data']
                        return []
                        
                    else:
                        logger.error(f"API request failed: {response.status} - {url}")
                        self.consecutive_failures += 1
                        
                        # Return cached data if available
                        if cache_key in self.cache:
                            return self.cache[cache_key]['data']
                        return []
                        
            except asyncio.TimeoutError:
                logger.error(f"Request timeout for {url}")
                self.consecutive_failures += 1
                # Return cached data if available
                if cache_key in self.cache:
                    return self.cache[cache_key]['data']
                return []
            except Exception as e:
                logger.error(f"Request error for {url}: {e}")
                self.consecutive_failures += 1
                # Return cached data if available
                if cache_key in self.cache:
                    return self.cache[cache_key]['data']
                return []

    async def get_current_session(self) -> Optional[Dict]:
        """Get current or latest session"""
        try:
            sessions = await self._make_request("sessions", {"session_key": "latest"})
            return sessions[0] if sessions else None
        except Exception as e:
            logger.error(f"Error getting current session: {e}")
            return None

    async def get_session_by_key(self, session_key: str) -> Optional[Dict]:
        """Get session by specific key"""
        try:
            sessions = await self._make_request("sessions", {"session_key": session_key})
            return sessions[0] if sessions else None
        except Exception as e:
            logger.error(f"Error getting session {session_key}: {e}")
            return None

    async def get_drivers(self, session_key: str) -> List[Dict]:
        """Get all drivers for a session"""
        try:
            return await self._make_request("drivers", {"session_key": session_key})
        except Exception as e:
            logger.error(f"Error getting drivers: {e}")
            return []

    async def get_car_data(self, session_key: str, driver_number: Optional[int] = None) -> List[Dict]:
        """Get car telemetry data - limited to recent data to avoid rate limits"""
        try:
            params = {"session_key": session_key}
            
            # Only get very recent data to reduce response size and avoid rate limits
            five_seconds_ago = (datetime.utcnow() - timedelta(seconds=5)).isoformat()
            params["date"] = f">={five_seconds_ago}"
            
            if driver_number:
                params["driver_number"] = driver_number
                
            return await self._make_request("car_data", params)
        except Exception as e:
            logger.error(f"Error getting car data: {e}")
            return []

    async def get_positions(self, session_key: str) -> List[Dict]:
        """Get current driver positions"""
        try:
            return await self._make_request("position", {"session_key": session_key})
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []

    async def get_locations(self, session_key: str) -> List[Dict]:
        """Get car locations on track - limited to very recent data"""
        try:
            params = {"session_key": session_key}
            
            # Only get last 5 seconds to avoid large responses
            five_seconds_ago = (datetime.utcnow() - timedelta(seconds=5)).isoformat()
            params["date"] = f">={five_seconds_ago}"
            
            return await self._make_request("location", params)
        except Exception as e:
            logger.error(f"Error getting locations: {e}")
            return []

    async def get_laps(self, session_key: str, driver_number: Optional[int] = None) -> List[Dict]:
        """Get lap timing data"""
        try:
            params = {"session_key": session_key}
            if driver_number:
                params["driver_number"] = driver_number
            return await self._make_request("laps", params)
        except Exception as e:
            logger.error(f"Error getting laps: {e}")
            return []

    async def get_pit_data(self, session_key: str) -> List[Dict]:
        """Get pit stop information"""
        try:
            return await self._make_request("pit", {"session_key": session_key})
        except Exception as e:
            logger.error(f"Error getting pit data: {e}")
            return []

    async def get_stints(self, session_key: str) -> List[Dict]:
        """Get tyre stint information"""
        try:
            return await self._make_request("stints", {"session_key": session_key})
        except Exception as e:
            logger.error(f"Error getting stints: {e}")
            return []

    async def get_intervals(self, session_key: str) -> List[Dict]:
        """Get interval/gap data"""
        try:
            return await self._make_request("intervals", {"session_key": session_key})
        except Exception as e:
            logger.error(f"Error getting intervals: {e}")
            return []

    async def get_weather(self, session_key: str) -> List[Dict]:
        """Get weather information"""
        try:
            return await self._make_request("weather", {"session_key": session_key})
        except Exception as e:
            logger.error(f"Error getting weather: {e}")
            return []

    async def get_live_timing_data(self, session_key: str) -> Dict:
        """Get comprehensive live timing data with staggered requests"""
        try:
            # Fetch data sequentially with delays to avoid rate limiting
            drivers = await self.get_drivers(session_key)
            if not drivers:
                return {'driverTimings': [], 'error': 'No drivers found'}
            
            await asyncio.sleep(0.5)  # Delay between requests
            
            positions = await self.get_positions(session_key)
            await asyncio.sleep(0.5)
            
            laps = await self.get_laps(session_key)
            await asyncio.sleep(0.5)
            
            intervals = await self.get_intervals(session_key)
            await asyncio.sleep(0.5)
            
            stints = await self.get_stints(session_key)
            await asyncio.sleep(0.5)
            
            pit_data = await self.get_pit_data(session_key)

            # Process driver timings
            driver_timings = []
            for driver in drivers:
                driver_number = driver.get('driver_number')
                
                latest_position = next(
                    (p for p in sorted(positions, key=lambda x: x.get('date', ''), reverse=True)
                     if p.get('driver_number') == driver_number),
                    None
                )
                
                latest_lap = next(
                    (l for l in sorted(laps, key=lambda x: x.get('lap_number', 0), reverse=True)
                     if l.get('driver_number') == driver_number),
                    None
                )
                
                latest_interval = next(
                    (i for i in sorted(intervals, key=lambda x: x.get('date', ''), reverse=True)
                     if i.get('driver_number') == driver_number),
                    None
                )
                
                current_stint = next(
                    (s for s in sorted(stints, key=lambda x: x.get('stint_number', 0), reverse=True)
                     if s.get('driver_number') == driver_number),
                    None
                )
                
                pit_stops = len([p for p in pit_data if p.get('driver_number') == driver_number])
                
                driver_timing = {
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
                    'pitStops': pit_stops
                }
                
                driver_timings.append(driver_timing)
            
            driver_timings.sort(key=lambda x: x.get('position') or 999)
            
            return {
                'driverTimings': driver_timings,
                'lastUpdate': datetime.utcnow().isoformat(),
                'sessionKey': session_key
            }
            
        except Exception as e:
            logger.error(f"Error getting live timing data: {e}")
            return {'driverTimings': [], 'error': str(e)}

    async def get_circuit_data(self, session_key: str) -> Dict:
        """Get circuit track data for visualization"""
        try:
            locations = await self.get_locations(session_key)
            
            if not locations:
                return {'trackPoints': [], 'bounds': None}
            
            track_points = []
            seen_points = set()
            
            for location in locations:
                point = (location.get('x'), location.get('y'))
                if point not in seen_points and point[0] is not None and point[1] is not None:
                    track_points.append({
                        'x': point[0],
                        'y': point[1],
                        'z': location.get('z', 0)
                    })
                    seen_points.add(point)
            
            if track_points:
                x_coords = [p['x'] for p in track_points]
                y_coords = [p['y'] for p in track_points]
                bounds = {
                    'minX': min(x_coords),
                    'maxX': max(x_coords),
                    'minY': min(y_coords),
                    'maxY': max(y_coords)
                }
            else:
                bounds = None
            
            return {
                'trackPoints': track_points,
                'bounds': bounds,
                'pointCount': len(track_points)
            }
            
        except Exception as e:
            logger.error(f"Error getting circuit data: {e}")
            return {'trackPoints': [], 'bounds': None, 'error': str(e)}

    def _format_lap_time(self, seconds: Optional[float]) -> str:
        """Format lap time from seconds to MM:SS.mmm"""
        if not seconds or seconds <= 0:
            return '--:--.---'
        
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes}:{secs:06.3f}"

    def _format_sector_time(self, seconds: Optional[float]) -> str:
        """Format sector time to S.mmm"""
        if not seconds or seconds <= 0:
            return '---.---'
        return f"{seconds:.3f}"

    def _format_gap(self, gap: Optional[float]) -> str:
        """Format gap/interval time"""
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
        
        return current_lap - stint_start + age_at_start

    def get_health_status(self) -> Dict:
        """Get service health status"""
        return {
            'consecutive_failures': self.consecutive_failures,
            'rate_limited': self.rate_limited_until > datetime.now().timestamp(),
            'cache_entries': len(self.cache),
            'cache_ttl': self.cache_ttl
        }
        
    async def get_meetings(self, year: int) -> List[Dict]:
        """Get all meetings for a specific year"""
        try:
            return await self._make_request("meetings", {"year": year})
        except Exception as e:
            logger.error(f"Error getting meetings for year {year}: {e}")
            return []

    async def get_sessions_by_meeting(self, meeting_key: str) -> List[Dict]:
        """Get all sessions for a specific meeting"""
        try:
            return await self._make_request("sessions", {"meeting_key": meeting_key})
        except Exception as e:
            logger.error(f"Error getting sessions for meeting {meeting_key}: {e}")
            return []