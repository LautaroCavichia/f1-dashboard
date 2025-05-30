// API Configuration
export const API_CONFIG = {
    OPENF1_BASE_URL: 'https://api.openf1.org/v1',
    BACKEND_BASE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://your-backend-url.com' 
      : 'http://localhost:8000',
    WEBSOCKET_URL: process.env.NODE_ENV === 'production'
      ? 'wss://your-backend-url.com/ws'
      : 'ws://localhost:8000/ws'
  };
  
  // Update intervals (conservative to reduce API pressure)
  export const UPDATE_INTERVALS = {
    TELEMETRY: 15000,       // 15 seconds for telemetry data
    POSITIONS: 10000,       // 10 seconds for car positions
    LAP_TIMES: 30000,       // 30 seconds for lap timing (increased)
    WEATHER: 120000,        // 2 minutes for weather data
    RETRY_CONNECTION: 10000, // 10 seconds for WebSocket retry
    HEARTBEAT: 30000        // 30 seconds for connection heartbeat
  };
  
  // Session types
  export const SESSION_TYPES = {
    PRACTICE_1: 'Practice 1',
    PRACTICE_2: 'Practice 2',
    PRACTICE_3: 'Practice 3',
    QUALIFYING: 'Qualifying',
    SPRINT: 'Sprint',
    RACE: 'Race'
  };
  
  // DRS interpretation mapping
  export const DRS_STATUS: Record<number, string> = {
    0: 'OFF',
    1: 'OFF',
    8: 'ELIGIBLE',
    10: 'ON',
    12: 'ON',
    14: 'ON'
  };
  
  // Sector colors for timing display
  export const SECTOR_COLORS = {
    PERSONAL_BEST: '#9D4EDD',  // Purple
    SESSION_BEST: '#06FFA5',   // Green
    SLOWER: '#FFD23F',         // Yellow
    INVALID: '#FF6B6B'         // Red
  };
  
  // Circuit scaling factors
  export const CIRCUIT_CONFIG = {
    SCALE_FACTOR: 0.5,
    CAR_SIZE: 8,
    TRACK_WIDTH: 2,
    MARGIN: 50
  };
  
  // Data refresh configuration - more conservative
  export const REFRESH_CONFIG = {
    MAX_RETRIES: 3,           // Reduced retries
    TIMEOUT: 15000,           // 15 seconds timeout
    BATCH_SIZE: 20,
    RETRY_DELAY: 2000,        // 2 seconds between retries
    RATE_LIMIT_DELAY: 60000   // 1 minute delay on rate limit
  };
  
  // Dashboard layout configuration
  export const LAYOUT_CONFIG = {
    TIMING_TOWER_WIDTH: 320,
    TELEMETRY_HEIGHT: 300,
    CIRCUIT_MIN_WIDTH: 400,
    MOBILE_BREAKPOINT: 768
  };
  
  // Error messages
  export const ERROR_MESSAGES = {
    NO_LIVE_SESSION: 'No live session currently available',
    CONNECTION_FAILED: 'Failed to connect to data source',
    DATA_UNAVAILABLE: 'Data temporarily unavailable',
    WEBSOCKET_ERROR: 'Real-time connection lost',
    RATE_LIMITED: 'API rate limit reached, using cached data',
    SERVER_ERROR: 'Server temporarily unavailable',
    BACKEND_UNAVAILABLE: 'Backend server is not responding'
  };
  
  // Default values - IMPORTANT: Use 'latest' instead of actual session key
  export const DEFAULTS = {
    SESSION_KEY: 'latest',    // This will be resolved to actual session key
    MEETING_KEY: 'latest',
    MAX_DRIVERS: 20,
    FALLBACK_REFRESH: 60000   // 1 minute fallback refresh
  };
  
  // Rate limiting configuration
  export const RATE_LIMIT = {
    MAX_REQUESTS_PER_MINUTE: 20,  // Reduced from 30
    BACKOFF_MULTIPLIER: 2,
    MAX_BACKOFF_TIME: 300000      // 5 minutes max backoff
  };