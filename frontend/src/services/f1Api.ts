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
  private baseUrl = API_CONFIG.OPENF1_BASE_URL;
  private backendUrl = API_CONFIG.BACKEND_BASE_URL;

  /**
   * Generic fetch method with improved error handling and rate limiting
   */
  private async fetchWithRetry<T>(url: string, retries = REFRESH_CONFIG.MAX_RETRIES): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REFRESH_CONFIG.TIMEOUT);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'F1-Dashboard/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return data as T;
        } else if (response.status === 429) {
          // Rate limited - wait longer
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          console.warn(`Rate limited, waiting ${retryAfter} seconds`);
          
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.min(retryAfter * 1000, REFRESH_CONFIG.RATE_LIMIT_DELAY)));
          }
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.warn(`API request attempt ${i + 1} failed:`, error);
        if (i === retries - 1) throw error;
        
        // Exponential backoff with jitter
        const delay = Math.min(
          REFRESH_CONFIG.RETRY_DELAY * Math.pow(2, i) + Math.random() * 1000,
          30000
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
      const sessions = await this.fetchWithRetry<Session[]>(
        `${this.baseUrl}/sessions?session_key=${DEFAULTS.SESSION_KEY}`
      );
      return sessions[0] || null;
    } catch (error) {
      console.error('Failed to get current session:', error);
      return null;
    }
  }

  /**
   * Get all drivers for a specific session
   */
  async getDrivers(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Driver[]> {
    try {
      return await this.fetchWithRetry<Driver[]>(
        `${this.baseUrl}/drivers?session_key=${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get drivers:', error);
      return [];
    }
  }

  /**
   * Get real-time car telemetry data
   */
  async getCarData(sessionKey: string | number = DEFAULTS.SESSION_KEY, driverNumber?: number): Promise<CarData[]> {
    try {
      let url = `${this.baseUrl}/car_data?session_key=${sessionKey}`;
      if (driverNumber) {
        url += `&driver_number=${driverNumber}`;
      }
      
      // Get recent data (last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      url += `&date>=${thirtySecondsAgo}`;
      
      return await this.fetchWithRetry<CarData[]>(url);
    } catch (error) {
      console.error('Failed to get car data:', error);
      return [];
    }
  }

  /**
   * Get current driver positions
   */
  async getPositions(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Position[]> {
    try {
      return await this.fetchWithRetry<Position[]>(
        `${this.baseUrl}/position?session_key=${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get positions:', error);
      return [];
    }
  }

  /**
   * Get car locations on track
   */
  async getLocations(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Location[]> {
    try {
      // Get recent locations (last 10 seconds for smooth animation)
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      return await this.fetchWithRetry<Location[]>(
        `${this.baseUrl}/location?session_key=${sessionKey}&date>=${tenSecondsAgo}`
      );
    } catch (error) {
      console.error('Failed to get locations:', error);
      return [];
    }
  }

  /**
   * Get lap timing data
   */
  async getLaps(sessionKey: string | number = DEFAULTS.SESSION_KEY, driverNumber?: number): Promise<LapData[]> {
    try {
      let url = `${this.baseUrl}/laps?session_key=${sessionKey}`;
      if (driverNumber) {
        url += `&driver_number=${driverNumber}`;
      }
      return await this.fetchWithRetry<LapData[]>(url);
    } catch (error) {
      console.error('Failed to get lap data:', error);
      return [];
    }
  }

  /**
   * Get pit stop information
   */
  async getPitData(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<PitData[]> {
    try {
      return await this.fetchWithRetry<PitData[]>(
        `${this.baseUrl}/pit?session_key=${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get pit data:', error);
      return [];
    }
  }

  /**
   * Get tyre stint information
   */
  async getStints(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Stint[]> {
    try {
      return await this.fetchWithRetry<Stint[]>(
        `${this.baseUrl}/stints?session_key=${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get stint data:', error);
      return [];
    }
  }

  /**
   * Get interval/gap data
   */
  async getIntervals(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Interval[]> {
    try {
      return await this.fetchWithRetry<Interval[]>(
        `${this.baseUrl}/intervals?session_key=${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get interval data:', error);
      return [];
    }
  }

  /**
   * Get weather information
   */
  async getWeather(sessionKey: string | number = DEFAULTS.SESSION_KEY): Promise<Weather[]> {
    try {
      return await this.fetchWithRetry<Weather[]>(
        `${this.baseUrl}/weather?session_key=${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get weather data:', error);
      return [];
    }
  }

  /**
   * Get all meetings for current year
   */
  async getMeetings(year: number = new Date().getFullYear()): Promise<Meeting[]> {
    try {
      return await this.fetchWithRetry<Meeting[]>(
        `${this.baseUrl}/meetings?year=${year}`
      );
    } catch (error) {
      console.error('Failed to get meetings:', error);
      return [];
    }
  }

  /**
   * Get sessions for a specific meeting
   */
  async getSessions(meetingKey: string | number): Promise<Session[]> {
    try {
      return await this.fetchWithRetry<Session[]>(
        `${this.baseUrl}/sessions?meeting_key=${meetingKey}`
      );
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Get comprehensive live timing data (aggregated from backend)
   */
  async getLiveTimingData(sessionKey: string | number = DEFAULTS.SESSION_KEY) {
    try {
      return await this.fetchWithRetry(
        `${this.backendUrl}/api/live-timing/${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get live timing data:', error);
      return null;
    }
  }

  /**
   * Get circuit track data points for visualization
   */
  async getCircuitData(sessionKey: string | number = DEFAULTS.SESSION_KEY) {
    try {
      return await this.fetchWithRetry(
        `${this.backendUrl}/api/circuit/${sessionKey}`
      );
    } catch (error) {
      console.error('Failed to get circuit data:', error);
      return null;
    }
  }

  /**
   * Health check for API availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.fetchWithRetry<Session[]>(`${this.baseUrl}/sessions?limit=1`);
      return true;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }
}

export const f1Api = new F1ApiService();