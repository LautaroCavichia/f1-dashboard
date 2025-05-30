// F1 Data Types

export interface Driver {
    driver_number: number;
    broadcast_name: string;
    full_name: string;
    first_name: string;
    last_name: string;
    name_acronym: string;
    team_name: string;
    team_colour: string;
    country_code: string;
    headshot_url: string;
    meeting_key: number;
    session_key: number;
  }
  
  export interface CarData {
    brake: number;
    date: string;
    driver_number: number;
    drs: number;
    meeting_key: number;
    n_gear: number;
    rpm: number;
    session_key: number;
    speed: number;
    throttle: number;
  }
  
  export interface Position {
    date: string;
    driver_number: number;
    meeting_key: number;
    position: number;
    session_key: number;
  }
  
  export interface Location {
    date: string;
    driver_number: number;
    meeting_key: number;
    session_key: number;
    x: number;
    y: number;
    z: number;
  }
  
  export interface LapData {
    date_start: string;
    driver_number: number;
    duration_sector_1: number;
    duration_sector_2: number;
    duration_sector_3: number;
    i1_speed: number;
    i2_speed: number;
    is_pit_out_lap: boolean;
    lap_duration: number;
    lap_number: number;
    meeting_key: number;
    segments_sector_1: number[];
    segments_sector_2: number[];
    segments_sector_3: number[];
    session_key: number;
    st_speed: number;
  }
  
  export interface PitData {
    date: string;
    driver_number: number;
    lap_number: number;
    meeting_key: number;
    pit_duration: number;
    session_key: number;
  }
  
  export interface Stint {
    compound: string;
    driver_number: number;
    lap_end: number;
    lap_start: number;
    meeting_key: number;
    session_key: number;
    stint_number: number;
    tyre_age_at_start: number;
  }
  
  export interface Interval {
    date: string;
    driver_number: number;
    gap_to_leader: number;
    interval: number;
    meeting_key: number;
    session_key: number;
  }
  
  export interface Session {
    circuit_key: number;
    circuit_short_name: string;
    country_code: string;
    country_key: number;
    country_name: string;
    date_end: string;
    date_start: string;
    gmt_offset: string;
    location: string;
    meeting_key: number;
    meeting_name: string;
    session_key: number;
    session_name: string;
    session_type: string;
    year: number;
  }
  
  export interface Meeting {
    circuit_key: number;
    circuit_short_name: string;
    country_code: string;
    country_key: number;
    country_name: string;
    date_start: string;
    gmt_offset: string;
    location: string;
    meeting_key: number;
    meeting_name: string;
    meeting_official_name: string;
    year: number;
  }
  
  export interface Weather {
    air_temperature: number;
    date: string;
    humidity: number;
    meeting_key: number;
    pressure: number;
    rainfall: number;
    session_key: number;
    track_temperature: number;
    wind_direction: number;
    wind_speed: number;
  }
  
  // Dashboard specific types
  export interface DriverTiming {
    driver: Driver;
    position: number;
    lapTime: string;
    sector1: string;
    sector2: string;
    sector3: string;
    gap: string;
    interval: string;
    lastLap: number;
    tyreCompound: string;
    tyreAge: number;
    pitStops: number;
  }
  
  export interface CircuitPoint {
    x: number;
    y: number;
    sector: number;
  }
  
  export interface DriverPosition {
    driver_number: number;
    x: number;
    y: number;
    team_colour: string;
  }
  
  export interface WebSocketMessage {
    type: 'CAR_DATA' | 'POSITION' | 'LAP_DATA' | 'PIT_DATA' | 'INTERVAL' | 'DRIVER_UPDATE' | 
          'PING' | 'PONG' | 'HEARTBEAT' | 'LOCATION' | 'SESSION_INFO' | 'NO_SESSION';
    data?: any;
    timestamp: string;
  }
  
  // Team colors mapping
  export const TEAM_COLORS: Record<string, string> = {
    'Red Bull Racing': '#3671C6',
    'Mercedes': '#27F4D2',
    'Ferrari': '#E8002D',
    'McLaren': '#FF8000',
    'Aston Martin': '#229971',
    'Alpine': '#0093CC',
    'Williams': '#64C4FF',
    'AlphaTauri': '#5E8FAA',
    'Alfa Romeo': '#C92D4B',
    'Haas': '#B6BABD'
  };
  
  // Tyre compound colors
  export const TYRE_COLORS: Record<string, string> = {
    'SOFT': '#FF3333',
    'MEDIUM': '#FFF200',
    'HARD': '#EBEBEB',
    'INTERMEDIATE': '#43B02A',
    'WET': '#0067AD'
  };