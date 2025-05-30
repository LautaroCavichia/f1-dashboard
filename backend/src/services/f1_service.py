"""
F1 Service - Simplified without over-conservative rate limiting
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
        self.cache_ttl = 3  # Back to 3 seconds cache
        
    async def initialize(self):
        """Initialize the HTTP client session"""
        timeout = aiohttp.ClientTimeout(total=15, connect=5)
        
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            headers={
                'User-Agent': 'F1-Dashboard/1.0',
                'Accept': 'application/json'
            }
        )
        logger.info("F1Service initialized")

    async def close(self):
        """Close the HTTP client session"""
        if self.session:
            await self.session.close()

    async def _make_request(self, endpoint: str, params: Dict = None) -> List[Dict]:
        """Make HTTP request to OpenF1 API with simple error handling"""
        if not self.session:
            await self.initialize()

        # Create cache key
        cache_key = f"{endpoint}_{json.dumps(params or {}, sort_keys=True)}"
        
        # Check cache
        if cache_key in self.cache:
            cache_entry = self.cache[cache_key]
            if datetime.now() - cache_entry['timestamp'] < timedelta(seconds=self.cache_ttl):
                return cache_entry['data']

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
                    
                    logger.debug(f"API success: {endpoint}")
                    return data
                else:
                    logger.error(f"API request failed: {response.status} - {url}")
                    # Return cached data if available
                    if cache_key in self.cache:
                        return self.cache[cache_key]['data']
                    return []
                    
        except asyncio.TimeoutError:
            logger.error(f"Request timeout for {url}")
            # Return cached data if available
            if cache_key in self.cache:
                return self.cache[cache_key]['data']
            return []
        except Exception as e:
            logger.error(f"Request error for {url}: {e}")
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
        """Get car telemetry data"""
        try:
            params = {"session_key": session_key}
            
            # Get recent data (last 30 seconds)
            thirty_seconds_ago = (datetime.utcnow() - timedelta(seconds=30)).isoformat()
            params["date"] = f">={thirty_seconds_ago}"
            
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
        """Get car locations on track"""
        try:
            params = {"session_key": session_key}
            
            # Get recent locations (last 10 seconds)
            ten_seconds_ago = (datetime.utcnow() - timedelta(seconds=10)).isoformat()
            params["date"] = f">={ten_seconds_ago}"
            
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
        """Get comprehensive live timing data"""
        try:
            # Fetch data concurrently (no artificial delays)
            tasks = [
                self.get_drivers(session_key),
                self.get_positions(session_key),
                self.get_laps(session_key),
                self.get_intervals(session_key),
                self.get_stints(session_key),
                self.get_pit_data(session_key)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            drivers, positions, laps, intervals, stints, pit_data = [
                res if not isinstance(res, Exception) else [] for res in results
            ]

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