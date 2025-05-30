import { API_CONFIG } from '../utils/constants';
import { 
  Driver, 
  CarData, 
  Position, 
  Location, 
  PitData, 
  Stint, 
  Session 
} from '../types/f1';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface SessionResponse {
  session: Session | null;
  message: string;
  is_live: boolean;
  is_upcoming?: boolean;
  is_completed?: boolean;
}

interface LiveTimingResponse {
  driverTimings: any[];
  lastUpdate: string;
  sessionKey: string;
  totalDrivers?: number;
  error?: string;
}

class F1ApiService {
  private backendUrl = API_CONFIG.BACKEND_BASE_URL;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private requestQueue = new Map<string, Promise<any>>();

  /**
   * Generic fetch with caching and deduplication
   */
  private async fetchWithCache<T>(
    url: string, 
    cacheTtl: number = 30000, // 30 seconds default
    retries: number = 3
  ): Promise<T> {
    const cacheKey = url;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`[F1API] Cache hit: ${url}`);
      return cached.data;
    }

    // Check if request is already in progress (deduplication)
    if (this.requestQueue.has(cacheKey)) {
      console.log(`[F1API] Request in progress, waiting: ${url}`);
      return this.requestQueue.get(cacheKey)!;
    }

    // Make the request
    const requestPromise = this.makeRequest<T>(url, retries);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: cacheTtl
      });
      
      return result;
    } finally {
      // Remove from queue when done
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(url: string, retries: number): Promise<T> {
    console.log(`[F1API] Fetching: ${url}`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[F1API] Success: ${url}`);
        return data;

      } catch (error) {
        console.warn(`[F1API] Attempt ${attempt}/${retries} failed for ${url}:`, error);
        
        if (attempt === retries) {
          throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${error}`);
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Unexpected error in makeRequest');
  }

  /**
   * Clear cache (useful for manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[F1API] Cache cleared');
  }

  /**
   * Get current or latest session
   */
  async getCurrentOrLatestSession(): Promise<SessionResponse | null> {
    try {
      console.log('[F1API] Requesting current-or-latest session...');
      const response = await this.fetchWithCache<SessionResponse>(
        `${this.backendUrl}/api/sessions/current-or-latest`,
        30000 // 30 seconds cache for session info
      );
      
      console.log('[F1API] Session response:', response);
      return response;
    } catch (error) {
      console.error('[F1API] Failed to get current/latest session:', error);
      return null;
    }
  }

  /**
   * Get session by key
   */
  async getSessionByKey(sessionKey: string): Promise<Session | null> {
    try {
      const response = await this.fetchWithCache<Session>(
        `${this.backendUrl}/api/sessions/${sessionKey}`,
        60000
      );
      return response;
    } catch (error) {
      console.error(`[F1API] Failed to get session ${sessionKey}:`, error);
      return null;
    }
  }

  /**
   * Get drivers for a session
   */
  async getDrivers(sessionKey: string = 'latest'): Promise<Driver[]> {
    try {
      const response = await this.fetchWithCache<{drivers: Driver[]}>(
        `${this.backendUrl}/api/drivers/${sessionKey}`,
        300000 // 5 minutes cache for drivers (rarely changes)
      );
      return response.drivers || [];
    } catch (error) {
      console.error('[F1API] Failed to get drivers:', error);
      return [];
    }
  }

  /**
   * Get comprehensive live timing data
   */
  async getLiveTimingData(sessionKey: string = 'latest'): Promise<LiveTimingResponse> {
    try {
      return await this.fetchWithCache<LiveTimingResponse>(
        `${this.backendUrl}/api/live-timing/${sessionKey}`,
        10000 // 10 seconds cache for timing data
      );
    } catch (error) {
      console.error('[F1API] Failed to get live timing:', error);
      return { 
        driverTimings: [], 
        lastUpdate: new Date().toISOString(),
        sessionKey,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get car positions
   */
  async getPositions(sessionKey: string = 'latest'): Promise<Position[]> {
    try {
      const response = await this.fetchWithCache<{positions: Position[]}>(
        `${this.backendUrl}/api/positions/${sessionKey}`,
        5000 // 5 seconds cache for positions
      );
      return response.positions || [];
    } catch (error) {
      console.error('[F1API] Failed to get positions:', error);
      return [];
    }
  }

  /**
   * Get car locations for track visualization
   */
  async getLocations(sessionKey: string = 'latest'): Promise<Location[]> {
    try {
      const response = await this.fetchWithCache<{locations: Location[]}>(
        `${this.backendUrl}/api/locations/${sessionKey}`,
        5000 // 5 seconds cache
      );
      return response.locations || [];
    } catch (error) {
      console.error('[F1API] Failed to get locations:', error);
      return [];
    }
  }

  /**
   * Get car telemetry data
   */
  async getCarData(sessionKey: string = 'latest', driverNumber?: number): Promise<CarData[]> {
    try {
      let url = `${this.backendUrl}/api/telemetry/${sessionKey}`;
      if (driverNumber) {
        url += `?driver_number=${driverNumber}`;
      }
      
      const response = await this.fetchWithCache<{telemetry: CarData[]}>(
        url,
        3000 // 3 seconds cache for telemetry
      );
      return response.telemetry || [];
    } catch (error) {
      console.error('[F1API] Failed to get car data:', error);
      return [];
    }
  }

  /**
   * Get pit stop data
   */
  async getPitData(sessionKey: string = 'latest'): Promise<PitData[]> {
    try {
      const response = await this.fetchWithCache<{pit_stops: PitData[]}>(
        `${this.backendUrl}/api/pit-stops/${sessionKey}`,
        30000 // 30 seconds cache for pit data
      );
      return response.pit_stops || [];
    } catch (error) {
      console.error('[F1API] Failed to get pit data:', error);
      return [];
    }
  }

  /**
   * Get stint data
   */
  async getStints(sessionKey: string = 'latest'): Promise<Stint[]> {
    try {
      const response = await this.fetchWithCache<{stints: Stint[]}>(
        `${this.backendUrl}/api/pit-stops/${sessionKey}`,
        30000 // 30 seconds cache
      );
      return response.stints || [];
    } catch (error) {
      console.error('[F1API] Failed to get stint data:', error);
      return [];
    }
  }

  /**
   * Get circuit visualization data
   */
  async getCircuitData(sessionKey: string = 'latest') {
    try {
      return await this.fetchWithCache(
        `${this.backendUrl}/api/circuit/${sessionKey}`,
        300000 // 5 minutes cache for circuit data
      );
    } catch (error) {
      console.error('[F1API] Failed to get circuit data:', error);
      return { 
        trackPoints: [], 
        bounds: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithCache<any>(
        `${this.backendUrl}/health`,
        5000 // 5 seconds cache for health
      );
      return response.status === 'healthy' || response.status === 'degraded';
    } catch (error) {
      console.error('[F1API] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get all sessions for a given year
   */
  async getAllSessions(year: number): Promise<{sessions: Session[]}> {
    try {
      return await this.fetchWithCache<{sessions: Session[]}>(
        `${this.backendUrl}/api/sessions/year/${year}`,
        300000 // 5 minutes cache for session list
      );
    } catch (error) {
      console.error(`[F1API] Failed to get sessions for year ${year}:`, error);
      return { sessions: [] };
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats() {
    const now = Date.now();
    const validEntries = Array.from(this.cache.entries()).filter(
      ([, value]) => now - value.timestamp < value.ttl
    );
    
    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      activeRequests: this.requestQueue.size
    };
  }
}

export const f1Api = new F1ApiService();