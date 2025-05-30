"""
F1 Data Models - Pydantic models for API responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class DriverResponse(BaseModel):
    driver_number: int
    broadcast_name: str
    full_name: str
    first_name: str
    last_name: str
    name_acronym: str
    team_name: str
    team_colour: str
    country_code: str
    headshot_url: Optional[str] = None
    meeting_key: int
    session_key: int

class SessionResponse(BaseModel):
    circuit_key: int
    circuit_short_name: str
    country_code: str
    country_key: int
    country_name: str
    date_end: str
    date_start: str
    gmt_offset: str
    location: str
    meeting_key: int
    session_key: int
    session_name: str
    session_type: str
    year: int

class CarDataResponse(BaseModel):
    brake: int
    date: str
    driver_number: int
    drs: int
    meeting_key: int
    n_gear: int
    rpm: int
    session_key: int
    speed: int
    throttle: int

class PositionResponse(BaseModel):
    date: str
    driver_number: int
    meeting_key: int
    position: int
    session_key: int

class LocationResponse(BaseModel):
    date: str
    driver_number: int
    meeting_key: int
    session_key: int
    x: float
    y: float
    z: float

class LapResponse(BaseModel):
    date_start: str
    driver_number: int
    duration_sector_1: Optional[float] = None
    duration_sector_2: Optional[float] = None
    duration_sector_3: Optional[float] = None
    i1_speed: Optional[int] = None
    i2_speed: Optional[int] = None
    is_pit_out_lap: bool
    lap_duration: Optional[float] = None
    lap_number: int
    meeting_key: int
    segments_sector_1: Optional[List[int]] = None
    segments_sector_2: Optional[List[int]] = None
    segments_sector_3: Optional[List[int]] = None
    session_key: int
    st_speed: Optional[int] = None

class PitResponse(BaseModel):
    date: str
    driver_number: int
    lap_number: int
    meeting_key: int
    pit_duration: float
    session_key: int

class StintResponse(BaseModel):
    compound: str
    driver_number: int
    lap_end: Optional[int] = None
    lap_start: int
    meeting_key: int
    session_key: int
    stint_number: int
    tyre_age_at_start: int

class IntervalResponse(BaseModel):
    date: str
    driver_number: int
    gap_to_leader: Optional[float] = None
    interval: Optional[float] = None
    meeting_key: int
    session_key: int

class WeatherResponse(BaseModel):
    air_temperature: float
    date: str
    humidity: int
    meeting_key: int
    pressure: float
    rainfall: int
    session_key: int
    track_temperature: float
    wind_direction: int
    wind_speed: float

class DriverTimingResponse(BaseModel):
    driver: DriverResponse
    position: Optional[int] = None
    lapTime: str = "--:--.---"
    sector1: str = "---.---"
    sector2: str = "---.---"
    sector3: str = "---.---"
    gap: str = "--"
    interval: str = "--"
    lastLap: int = 0
    tyreCompound: str = "UNKNOWN"
    tyreAge: int = 0
    pitStops: int = 0

class LiveTimingResponse(BaseModel):
    driverTimings: List[DriverTimingResponse]
    lastUpdate: str
    sessionKey: str
    error: Optional[str] = None

class CircuitDataResponse(BaseModel):
    trackPoints: List[Dict[str, float]]
    bounds: Optional[Dict[str, float]] = None
    pointCount: int = 0
    error: Optional[str] = None

class WebSocketMessage(BaseModel):
    type: str
    data: Any
    timestamp: str

class APIResponse(BaseModel):
    success: bool = True
    data: Any = None
    error: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class HealthCheckResponse(BaseModel):
    status: str
    api_connection: str
    websocket_connections: int
    timestamp: str