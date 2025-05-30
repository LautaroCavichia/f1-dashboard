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
  
  // Update intervals - conservative for stability
  export const UPDATE_INTERVALS = {
    FAST_DATA: 5000,         // 5 seconds for live telemetry/positions
    TIMING_DATA: 15000,      // 15 seconds for timing data
    SESSION_DATA: 60000,     // 1 minute for session info
    HEALTH_CHECK: 30000,     // 30 seconds for health checks
    RETRY_CONNECTION: 10000, // 10 seconds for connection retry
    HEARTBEAT: 30000         // 30 seconds for WebSocket heartbeat
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
  
  // DRS status mapping
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
  
  // Circuit visualization config
  export const CIRCUIT_CONFIG = {
    SCALE_FACTOR: 0.5,
    CAR_SIZE: 8,
    TRACK_WIDTH: 2,
    MARGIN: 50
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
  
  // Default values  
  export const DEFAULTS = {
    SESSION_KEY: 'latest',
    MEETING_KEY: 'latest',
    MAX_DRIVERS: 20,
    CACHE_TTL: 30000          // 30 seconds default cache
  };
  
  // Rate limiting configuration - very conservative
  export const RATE_LIMIT = {
    MAX_REQUESTS_PER_MINUTE: 15,  // Very conservative
    BACKOFF_MULTIPLIER: 2,
    MAX_BACKOFF_TIME: 300000      // 5 minutes max backoff
  };