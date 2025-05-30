import { useState, useEffect, useCallback, useRef } from 'react';
import { f1Api } from '../services/f1Api';
import { 
  Driver, 
  CarData, 
  Position, 
  Location, 
  PitData, 
  Stint, 
  Session,
  DriverTiming 
} from '../types/f1';

interface F1DataState {
  // Core data
  session: Session | null;
  drivers: Driver[];
  carData: CarData[];
  positions: Position[];
  locations: Location[];
  pitData: PitData[];
  stints: Stint[];
  
  // Processed data
  driverTimings: DriverTiming[];
  
  // State flags
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isLive: boolean;
  isHealthy: boolean;
}

interface UseF1DataOptions {
  sessionKey?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useF1Data = (options: UseF1DataOptions = {}) => {
  const {
    sessionKey = 'latest',
    autoRefresh = true,
    refreshInterval = 30000 // 30 seconds
  } = options;

  const [state, setState] = useState<F1DataState>({
    session: null,
    drivers: [],
    carData: [],
    positions: [],
    locations: [],
    pitData: [],
    stints: [],
    driverTimings: [],
    loading: true,
    error: null,
    lastUpdate: null,
    isLive: false,
    isHealthy: false
  });

  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = useRef(true);
  const currentSessionKey = useRef<string>(sessionKey);

  /**
   * Safe state update (only if component is still mounted)
   */
  const safeSetState = useCallback((updater: Partial<F1DataState> | ((prev: F1DataState) => F1DataState)) => {
    if (mountedRef.current) {
      setState(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
    }
  }, []);

  /**
   * Check backend health
   */
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const isHealthy = await f1Api.healthCheck();
      safeSetState({ isHealthy });
      return isHealthy;
    } catch (error) {
      console.error('[useF1Data] Health check failed:', error);
      safeSetState({ isHealthy: false });
      return false;
    }
  }, [safeSetState]);

  /**
   * Fetch session information
   */
  const fetchSession = useCallback(async (): Promise<Session | null> => {
    try {
      console.log('[useF1Data] Fetching session...');
      
      const sessionResponse = await f1Api.getCurrentOrLatestSession();
      
      if (sessionResponse?.session) {
        const session = sessionResponse.session;
        const isLive = sessionResponse.is_live || false;
        const isCompleted = sessionResponse.is_completed || false;
        
        currentSessionKey.current = session.session_key.toString();
        
        console.log(`[useF1Data] Session found: ${session.session_name} at ${session.circuit_short_name}`);
        console.log(`[useF1Data] Session status - Live: ${isLive}, Completed: ${isCompleted}`);
        console.log(`[useF1Data] Using session key: ${currentSessionKey.current}`);
        
        safeSetState(prev => ({ 
          ...prev, 
          session,
          isLive 
        }));
        
        return session;
      } else {
        const message = sessionResponse?.message || 'No session data returned';
        console.log(`[useF1Data] No session found: ${message}`);
        safeSetState(prev => ({ 
          ...prev, 
          session: null,
          isLive: false 
        }));
        return null;
      }
    } catch (error) {
      console.error('[useF1Data] Error fetching session:', error);
      throw error;
    }
  }, [safeSetState]);

  /**
   * Fetch all F1 data
   */
  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      console.log('[useF1Data] Starting data fetch...', { forceRefresh });
      
      if (forceRefresh) {
        console.log('[useF1Data] Clearing API cache...');
        f1Api.clearCache();
      }
      
      safeSetState({ loading: true, error: null });

      // Check backend health first
      console.log('[useF1Data] Checking backend health...');
      const isHealthy = await checkHealth();
      if (!isHealthy) {
        throw new Error('Backend API is not available - check that the backend is running on localhost:8000');
      }
      console.log('[useF1Data] Backend health check passed');

      // Get session information
      console.log('[useF1Data] Fetching session information...');
      const session = await fetchSession();
      if (!session) {
        throw new Error('No F1 session available - this might be normal if there are no recent sessions');
      }
      console.log('[useF1Data] Session loaded successfully');

      const actualSessionKey = currentSessionKey.current;
      console.log(`[useF1Data] Using session key: ${actualSessionKey} for data loading`);

      // Get live timing data (contains drivers and timing info)
      console.log('[useF1Data] Fetching live timing data...');
      const liveTimingData = await f1Api.getLiveTimingData(actualSessionKey);
      
      if (liveTimingData.error) {
        console.error('[useF1Data] Live timing error:', liveTimingData.error);
        throw new Error(`Live timing data error: ${liveTimingData.error}`);
      }

      console.log(`[useF1Data] Live timing data loaded: ${liveTimingData.driverTimings.length} drivers`);

      // Process driver timings
      const driverTimings = liveTimingData.driverTimings || [];
      const drivers = driverTimings.map((timing: any) => timing.driver);

      if (drivers.length === 0) {
        console.warn('[useF1Data] No drivers found in timing data');
        // Continue anyway - maybe other endpoints have data
      }

      // Fetch additional data in parallel (non-blocking)
      console.log('[useF1Data] Fetching additional data in parallel...');
      const [positions, locations, carData, pitData, stints] = await Promise.allSettled([
        f1Api.getPositions(actualSessionKey),
        f1Api.getLocations(actualSessionKey),
        f1Api.getCarData(actualSessionKey),
        f1Api.getPitData(actualSessionKey),
        f1Api.getStints(actualSessionKey)
      ]);

      // Extract successful results, use empty arrays for failures
      const positionsData = positions.status === 'fulfilled' ? positions.value : [];
      const locationsData = locations.status === 'fulfilled' ? locations.value : [];
      const carDataData = carData.status === 'fulfilled' ? carData.value : [];
      const pitDataData = pitData.status === 'fulfilled' ? pitData.value : [];
      const stintsData = stints.status === 'fulfilled' ? stints.value : [];

      // Log any failed requests
      if (positions.status === 'rejected') console.warn('[useF1Data] Positions failed:', positions.reason);
      if (locations.status === 'rejected') console.warn('[useF1Data] Locations failed:', locations.reason);
      if (carData.status === 'rejected') console.warn('[useF1Data] Car data failed:', carData.reason);
      if (pitData.status === 'rejected') console.warn('[useF1Data] Pit data failed:', pitData.reason);
      if (stints.status === 'rejected') console.warn('[useF1Data] Stints failed:', stints.reason);

      console.log('[useF1Data] Additional data loaded:', {
        positions: positionsData.length,
        locations: locationsData.length,
        carData: carDataData.length,
        pitData: pitDataData.length,
        stints: stintsData.length
      });

      // Update state with all data
      const newState = {
        drivers,
        driverTimings,
        positions: positionsData,
        locations: locationsData,
        carData: carDataData,
        pitData: pitDataData,
        stints: stintsData,
        loading: false,
        lastUpdate: new Date(),
        error: null
      };
      
      console.log('[useF1Data] About to update state with:', {
        drivers: drivers.length,
        driverTimings: driverTimings.length,
        loading: false,
        hasError: false
      });
      
      safeSetState(newState);

      console.log('[useF1Data] Data fetch completed successfully - setting loading to false');
      
      // Force a second update to ensure loading is false
      setTimeout(() => {
        console.log('[useF1Data] Force ensuring loading is false');
        safeSetState(prev => ({ ...prev, loading: false }));
      }, 100);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      console.error('[useF1Data] Failed to fetch F1 data:', error);
      console.error('[useF1Data] Full error details:', error);
      
      safeSetState({ 
        loading: false, 
        error: errorMessage
      });
    }
  }, [safeSetState, checkHealth, fetchSession]);

  /**
   * Fetch only fast-updating data (for live sessions)
   */
  const fetchFastData = useCallback(async () => {
    try {
      const actualSessionKey = currentSessionKey.current;
      if (!actualSessionKey || actualSessionKey === 'latest') return;

      console.log('[useF1Data] Fetching fast data...');

      // Only fetch fast-changing data
      const [carData, locations, positions] = await Promise.allSettled([
        f1Api.getCarData(actualSessionKey),
        f1Api.getLocations(actualSessionKey),
        f1Api.getPositions(actualSessionKey)
      ]);

      const carDataData = carData.status === 'fulfilled' ? carData.value : [];
      const locationsData = locations.status === 'fulfilled' ? locations.value : [];
      const positionsData = positions.status === 'fulfilled' ? positions.value : [];

      safeSetState(prev => ({
        ...prev,
        carData: carDataData,
        locations: locationsData,
        positions: positionsData,
        lastUpdate: new Date()
      }));

      console.log('[useF1Data] Fast data updated');

    } catch (error) {
      console.error('[useF1Data] Failed to fetch fast data:', error);
    }
  }, [safeSetState]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    console.log('[useF1Data] Manual refresh triggered');
    fetchData(true); // Force refresh with cache clear
  }, [fetchData]);

  /**
   * Get specific driver data
   */
  const getDriverData = useCallback((driverNumber: number) => {
    const driver = state.drivers.find(d => d.driver_number === driverNumber);
    const carData = state.carData.filter(c => c.driver_number === driverNumber);
    const positions = state.positions.filter(p => p.driver_number === driverNumber);
    const locations = state.locations.filter(l => l.driver_number === driverNumber);
    const timing = state.driverTimings.find(t => t.driver.driver_number === driverNumber);

    return {
      driver,
      carData,
      positions,
      locations,
      timing
    };
  }, [state]);

  // Initial data fetch
  useEffect(() => {
    console.log('[useF1Data] Initial data fetch triggered');
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    console.log(`[useF1Data] Setting up auto-refresh every ${refreshInterval}ms`);
    
    intervalRef.current = setInterval(() => {
      if (state.isLive && !state.loading) {
        // For live sessions, use fast data updates
        fetchFastData();
      } else if (!state.loading) {
        // For non-live sessions, full refresh less frequently
        fetchData();
      }
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, state.isLive, state.loading, fetchData, fetchFastData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[useF1Data] Cleaning up...');
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Debug logging - with more detail
  useEffect(() => {
    const debugInfo = {
      session: state.session?.session_name || 'None',
      sessionKey: state.session?.session_key || 'None',
      drivers: state.drivers.length,
      timings: state.driverTimings.length,
      isLive: state.isLive,
      isHealthy: state.isHealthy,
      loading: state.loading,
      error: state.error,
      lastUpdate: state.lastUpdate?.toISOString() || 'Never',
      // Add raw state for debugging
      hasSession: !!state.session,
      hasDrivers: state.drivers.length > 0,
      hasTimings: state.driverTimings.length > 0
    };
    
    console.log('[useF1Data] State update:', debugInfo);
    
    // Extra logging when loading changes
    if (debugInfo.loading !== undefined) {
      console.log(`[useF1Data] LOADING STATE: ${debugInfo.loading}`);
    }
    
    // Log when we have data but still loading
    if (!debugInfo.loading && debugInfo.drivers > 0) {
      console.log('[useF1Data] ✅ DATA LOADED SUCCESSFULLY - should show dashboard now');
    }
    
  }, [state]);

  return {
    ...state,
    refresh,
    getDriverData,
    fetchFastData
  };
};