import { API_CONFIG, DEFAULTS, REFRESH_CONFIG } from '../utils/constants';
import { 
  Driver, 
  CarData, 
  Position, 
  Location, 
  LapData, 
  PitData, 
  Stint, 
  Interval, 
  Session, 
  Meeting, 
  Weather 
} from '../types/f1';

class F1ApiService {
  private backendUrl = API_CONFIG.BACKEND_BASE_URL;

  /**
   * Generic fetch method with improved error handling
   */
  private async fetchWithRetry<T>(url: string, retries = REFRESH_CONFIG.MAX_RETRIES): Promise<T> {
    console.log(`[F1API] Fetching: ${url}`);
    
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REFRESH_CONFIG.TIMEOUT);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log(`[F1API] Success: ${url}`, data);
          return data as T;
        } else {
          console.error(`[F1API] HTTP Error ${response.status}: ${url}`);
          if (response.status === 404) {
            // Don't retry 404s, return empty data
            return {} as T;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.warn(`[F1API] Attempt ${i + 1} failed for ${url}:`, error);
        if (i === retries - 1) throw error;
        
        // Exponential backoff
        const delay = Math.min(
          REFRESH_CONFIG.RETRY_DELAY * Math.pow(2, i) + Math.random() * 1000,
          10000
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Get current or latest session information
   */
  async getCurrentSession(): Promise<Session | null> {
    try {
      console.log('[F1API] Getting current session...');
      const response = await this.fetchWithRetry<any>(`${this.backendUrl}/api/sessions/current`);
      
      // Handle the response format from your backend
      if (response && response.session) {
        return response.session;
      } else if (response && response.session_key) {
        return response;
      } else {
        console.log('[F1API] No current session available');
        return null;
      }
    } catch (error) {
      console.error('[F1API] Failed to get current session:', error);
      return null;
    }
  }

  /**
   * Get session by key
   */
  async getSessionByKey(sessionKey: string): Promise<Session | null> {
    try {
      console.log(`[F1API] Getting session ${sessionKey}...`);
      return await this.fetchWithRetry<Session>(`${this.backendUrl}/api/sessions/${sessionKey}`);
    } catch (error) {
      console.error(`[F1API] Failed to get session ${sessionKey}:`, error);
      return null;
    }
  }

  /**
   * Get all drivers for a specific session
   */
  async getDrivers(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Driver[]> {
    try {
      console.log(`[F1API] Getting drivers for session ${sessionKey}...`);
      const response = await this.fetchWithRetry<{drivers: Driver[]}>(`${this.backendUrl}/api/drivers/${sessionKey}`);
      return response.drivers || [];
    } catch (error) {
      console.error('[F1API] Failed to get drivers:', error);
      return [];
    }
  }

  /**
   * Get live timing data (comprehensive)
   */
  async getLiveTimingData(sessionKey: string | number = DEFAULTS.SESSION_KEY) {
    try {
      console.log(`[F1API] Getting live timing for session ${sessionKey}...`);
      return await this.fetchWithRetry(`${this.backendUrl}/api/live-timing/${sessionKey}`);
    } catch (error) {
      console.error('[F1API] Failed to get live timing data:', error);
      return { driverTimings: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get real-time car telemetry data
   */
  async getCarData(sessionKey: string | number = DEFAULTS.SESSION_KEY, driverNumber?: number): Promise<CarData[]> {
    try {
      console.log(`[F1API] Getting car data for session ${sessionKey}...`);
      let url = `${this.backendUrl}/api/telemetry/${sessionKey}`;
      if (driverNumber) {
        url += `?driver_number=${driverNumber}`;
      }
      
      const response = await this.fetchWithRetry<{telemetry: CarData[]}>(url);
      return response.telemetry || [];
    } catch (error) {
      console.error('[F1API] Failed to get car data:', error);
      return [];
    }
  }

  /**
   * Get current driver positions
   */
  async getPositions(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Position[]> {
    try {
      console.log(`[F1API] Getting positions for session ${sessionKey}...`);
      const response = await this.fetchWithRetry<{positions: Position[]}>(`${this.backendUrl}/api/positions/${sessionKey}`);
      return response.positions || [];
    } catch (error) {
      console.error('[F1API] Failed to get positions:', error);
      return [];
    }
  }

  /**
   * Get car locations on track
   */
  async getLocations(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Location[]> {
    try {
      console.log(`[F1API] Getting locations for session ${sessionKey}...`);
      const response = await this.fetchWithRetry<{locations: Location[]}>(`${this.backendUrl}/api/locations/${sessionKey}`);
      return response.locations || [];
    } catch (error) {
      console.error('[F1API] Failed to get locations:', error);
      return [];
    }
  }

  /**
   * Get pit stop information and stints
   */
  async getPitData(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<PitData[]> {
    try {
      console.log(`[F1API] Getting pit data for session ${sessionKey}...`);
      const response = await this.fetchWithRetry<{pit_stops: PitData[]}>(`${this.backendUrl}/api/pit-stops/${sessionKey}`);
      return response.pit_stops || [];
    } catch (error) {
      console.error('[F1API] Failed to get pit data:', error);
      return [];
    }
  }

  /**
   * Get tyre stint information
   */
  async getStints(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Stint[]> {
    try {
      console.log(`[F1API] Getting stints for session ${sessionKey}...`);
      const response = await this.fetchWithRetry<{stints: Stint[]}>(`${this.backendUrl}/api/pit-stops/${sessionKey}`);
      return response.stints || [];
    } catch (error) {
      console.error('[F1API] Failed to get stint data:', error);
      return [];
    }
  }

  /**
   * Get interval/gap data (from live timing)
   */
  async getIntervals(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Interval[]> {
    try {
      // This data comes from live timing, so we'll extract it there
      const liveData = await this.getLiveTimingData(sessionKey);
      // Convert driver timings to interval format if needed
      return [];
    } catch (error) {
      console.error('[F1API] Failed to get interval data:', error);
      return [];
    }
  }

  /**
   * Get weather information
   */
  async getWeather(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Weather[]> {
    try {
      console.log(`[F1API] Getting weather for session ${sessionKey}...`);
      const response = await this.fetchWithRetry<{weather: Weather[]}>(`${this.backendUrl}/api/weather/${sessionKey}`);
      return response.weather || [];
    } catch (error) {
      console.error('[F1API] Failed to get weather data:', error);
      return [];
    }
  }

  /**
   * Get circuit track data points for visualization
   */
  async getCircuitData(sessionKey: string | number = DEFAULTS.SESSION_KEY) {
    try {
      console.log(`[F1API] Getting circuit data for session ${sessionKey}...`);
      return await this.fetchWithRetry(`${this.backendUrl}/api/circuit/${sessionKey}`);
    } catch (error) {
      console.error('[F1API] Failed to get circuit data:', error);
      return { trackPoints: [], bounds: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Health check for backend availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('[F1API] Checking backend health...');
      const response = await this.fetchWithRetry<any>(`${this.backendUrl}/health`);
      const isHealthy = response.status === 'healthy';
      console.log('[F1API] Backend health:', isHealthy ? 'OK' : 'DEGRADED');
      return isHealthy;
    } catch (error) {
      console.error('[F1API] Backend health check failed:', error);
      return false;
    }
  }

  /**
   * Get current session or fall back to latest completed
   */
  async getCurrentOrLatestSession(): Promise<{session: Session | null, message: string, is_live: boolean} | null> {
    try {
      console.log('[F1API] Getting current or latest session...');
      return await this.fetchWithRetry<{session: Session | null, message: string, is_live: boolean}>(`${this.backendUrl}/api/sessions/current-or-latest`);
    } catch (error) {
      console.error('[F1API] Failed to get current or latest session:', error);
      return null;
    }
  }

  /**
   * Get all sessions for a year
   */
  async getAllSessions(year: number = new Date().getFullYear()): Promise<{sessions: Session[], total: number, year: number}> {
    try {
      console.log(`[F1API] Getting all sessions for year ${year}...`);
      return await this.fetchWithRetry<{sessions: Session[], total: number, year: number}>(`${this.backendUrl}/api/sessions?year=${year}`);
    } catch (error) {
      console.error(`[F1API] Failed to get sessions for year ${year}:`, error);
      return {sessions: [], total: 0, year};
    }
  }

  /**
   * Get latest completed session
   */
  async getLatestCompletedSession(): Promise<{session: Session | null, message: string, is_live: boolean} | null> {
    try {
      console.log('[F1API] Getting latest completed session...');
      return await this.fetchWithRetry<{session: Session | null, message: string, is_live: boolean}>(`${this.backendUrl}/api/sessions/latest-completed`);
    } catch (error) {
      console.error('[F1API] Failed to get latest completed session:', error);
      return null;
    }
  }

  /**
   * Simplified methods that don't exist in backend yet - fallback to empty data
   */
  async getLaps(sessionKey: string | number = DEFAULTS.SESSION_KEY, driverNumber?: number): Promise<LapData[]> {
    console.log('[F1API] getLaps not implemented in backend, returning empty array');
    return [];
  }

  async getMeetings(year: number = new Date().getFullYear()): Promise<Meeting[]> {
    console.log('[F1API] getMeetings not implemented in backend, returning empty array');
    return [];
  }

  async getSessions(meetingKey: string | number): Promise<Session[]> {
    console.log('[F1API] getSessions not implemented in backend, returning empty array');
    return [];
  }
}

export const f1Api = new F1ApiService();