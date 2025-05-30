import { useState, useEffect, useCallback, useRef } from 'react';
import { f1Api } from '../services/f1Api';
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
  DriverTiming 
} from '../types/f1';
import { UPDATE_INTERVALS, DEFAULTS } from '../utils/constants';

interface F1DataState {
  // Core data
  session: Session | null;
  drivers: Driver[];
  carData: CarData[];
  positions: Position[];
  locations: Location[];
  laps: LapData[];
  pitData: PitData[];
  stints: Stint[];
  intervals: Interval[];
  
  // Processed data
  driverTimings: DriverTiming[];
  
  // State flags
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isLive: boolean;
}

interface UseF1DataOptions {
  sessionKey?: string | number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface LiveTimingResponse {
  error?: string;
  driverTimings?: any[];
}

export const useF1Data = (options: UseF1DataOptions = {}) => {
  const {
    sessionKey = DEFAULTS.SESSION_KEY,
    autoRefresh = true,
    refreshInterval = UPDATE_INTERVALS.LAP_TIMES
  } = options;

  const [state, setState] = useState<F1DataState>({
    session: null,
    drivers: [],
    carData: [],
    positions: [],
    locations: [],
    laps: [],
    pitData: [],
    stints: [],
    intervals: [],
    driverTimings: [],
    loading: true,
    error: null,
    lastUpdate: null,
    isLive: false
  });

  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = useRef(true);
  const actualSessionKey = useRef<string | number>(sessionKey);

  /**
   * Safe state update (only if component is still mounted)
   */
  const safeSetState = useCallback((updater: Partial<F1DataState> | ((prev: F1DataState) => F1DataState)) => {
    if (mountedRef.current) {
      setState(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
    }
  }, []);

  /**
   * Convert live timing data to our internal format
   */
  const processLiveTimingData = useCallback((liveTimingData: any): {
    driverTimings: DriverTiming[];
    drivers: Driver[];
  } => {
    console.log('[useF1Data] Processing live timing data:', liveTimingData);
    
    if (!liveTimingData || !liveTimingData.driverTimings) {
      console.log('[useF1Data] No driver timings in live data');
      return { driverTimings: [], drivers: [] };
    }

    const driverTimings = liveTimingData.driverTimings.map((timing: any) => ({
      driver: timing.driver,
      position: timing.position || 0,
      lapTime: timing.lapTime || '--:--.---',
      sector1: timing.sector1 || '---.---',
      sector2: timing.sector2 || '---.---',
      sector3: timing.sector3 || '---.---',
      gap: timing.gap || '--',
      interval: timing.interval || '--',
      lastLap: timing.lastLap || 0,
      tyreCompound: timing.tyreCompound || 'UNKNOWN',
      tyreAge: timing.tyreAge || 0,
      pitStops: timing.pitStops || 0
    }));

    const drivers = driverTimings.map((timing: DriverTiming) => timing.driver);

    console.log('[useF1Data] Processed timings:', { driverTimings, drivers });
    return { driverTimings, drivers };
  }, []);

  /**
   * Fetch session and determine actual session key to use
   */
  const fetchSessionKey = useCallback(async (): Promise<string | null> => {
    try {
      console.log(`[useF1Data] Fetching session for key: ${sessionKey}`);
      
      let sessionResponse: {session: Session | null, message: string, is_live: boolean} | null = null;
      
      if (sessionKey === 'latest' || sessionKey === DEFAULTS.SESSION_KEY) {
        // Use the new current-or-latest endpoint
        sessionResponse = await f1Api.getCurrentOrLatestSession();
      } else {
        // Specific session key requested
        const session = await f1Api.getSessionByKey(sessionKey.toString());
        if (session) {
          sessionResponse = {
            session,
            message: 'Specific session',
            is_live: false // We'll determine this later
          };
        }
      }

      if (sessionResponse?.session) {
        const session = sessionResponse.session;
        const actualKey = session.session_key.toString();
        actualSessionKey.current = actualKey;
        
        console.log(`[useF1Data] Using session: ${session.session_name} (${actualKey})`);
        console.log(`[useF1Data] Message: ${sessionResponse.message}`);
        
        // Update session in state
        safeSetState(prev => ({ 
          ...prev, 
          session,
          isLive: sessionResponse!.is_live 
        }));
        
        return actualKey;
      } else {
        console.log('[useF1Data] No session found');
        throw new Error(sessionResponse?.message || 'No F1 session available');
      }
    } catch (error) {
      console.error('[useF1Data] Error fetching session:', error);
      throw error;
    }
  }, [sessionKey, safeSetState]);

  /**
   * Fetch all F1 data using the backend API
   */
  const fetchData = useCallback(async () => {
    try {
      console.log('[useF1Data] Starting data fetch...');
      safeSetState({ loading: true, error: null });

      // First, check backend health
      const isBackendHealthy = await f1Api.healthCheck();
      if (!isBackendHealthy) {
        throw new Error('Backend API is not available');
      }

      // Get the actual session key to use
      const actualKey = await fetchSessionKey();
      if (!actualKey) {
        throw new Error('No F1 session available');
      }

      console.log(`[useF1Data] Fetching data for session: ${actualKey}`);

      // Get live timing data (this contains most of what we need)
      const liveTimingData = await f1Api.getLiveTimingData(actualKey) as LiveTimingResponse;
      
      if (liveTimingData.error) {
        throw new Error(liveTimingData.error);
      }

      // Process the live timing data
      const { driverTimings, drivers } = processLiveTimingData(liveTimingData);

      if (drivers.length === 0) {
        console.log('[useF1Data] No drivers found, continuing with limited data...');
      }

      // Fetch additional data in parallel (with error handling)
      const [positions, locations, carData, pitData, stints] = await Promise.allSettled([
        f1Api.getPositions(actualKey),
        f1Api.getLocations(actualKey),
        f1Api.getCarData(actualKey),
        f1Api.getPitData(actualKey),
        f1Api.getStints(actualKey)
      ]);

      // Extract successful results
      const positionsData = positions.status === 'fulfilled' ? positions.value : [];
      const locationsData = locations.status === 'fulfilled' ? locations.value : [];
      const carDataData = carData.status === 'fulfilled' ? carData.value : [];
      const pitDataData = pitData.status === 'fulfilled' ? pitData.value : [];
      const stintsData = stints.status === 'fulfilled' ? stints.value : [];

      // Check if session is live (rough estimation)
      const session = state.session;
      const isLive = session ? 
        new Date().getTime() >= new Date(session.date_start).getTime() &&
        new Date().getTime() <= new Date(session.date_end).getTime() : false;

      console.log('[useF1Data] Data fetch complete:', {
        drivers: drivers.length,
        driverTimings: driverTimings.length,
        positions: positionsData.length,
        locations: locationsData.length,
        carData: carDataData.length,
        pitData: pitDataData.length,
        stints: stintsData.length,
        isLive
      });

      safeSetState({
        drivers,
        driverTimings,
        positions: positionsData,
        locations: locationsData,
        carData: carDataData,
        pitData: pitDataData,
        stints: stintsData,
        intervals: [], // We'll get this from live timing later
        laps: [], // Not implemented yet
        loading: false,
        lastUpdate: new Date(),
        isLive,
        error: null
      });

    } catch (error) {
      console.error('[useF1Data] Failed to fetch F1 data:', error);
      safeSetState({ 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch data' 
      });
    }
  }, [sessionKey, processLiveTimingData, safeSetState, fetchSessionKey, state.session]);

  /**
   * Fetch only fast-updating data (for frequent updates)
   */
  const fetchFastData = useCallback(async () => {
    try {
      const actualKey = actualSessionKey.current;
      if (!actualKey) return;

      console.log('[useF1Data] Fetching fast data...');

      const [carData, locations] = await Promise.allSettled([
        f1Api.getCarData(actualKey),
        f1Api.getLocations(actualKey)
      ]);

      const carDataData = carData.status === 'fulfilled' ? carData.value : [];
      const locationsData = locations.status === 'fulfilled' ? locations.value : [];

      safeSetState(prev => ({
        ...prev,
        carData: carDataData,
        locations: locationsData,
        lastUpdate: new Date()
      }));

    } catch (error) {
      console.error('[useF1Data] Failed to fetch fast data:', error);
    }
  }, [safeSetState]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    console.log('[useF1Data] Manual refresh triggered');
    fetchData();
  }, [fetchData]);

  /**
   * Get specific driver data
   */
  const getDriverData = useCallback((driverNumber: number) => {
    const driver = state.drivers.find(d => d.driver_number === driverNumber);
    const carData = state.carData.filter(c => c.driver_number === driverNumber);
    const positions = state.positions.filter(p => p.driver_number === driverNumber);
    const locations = state.locations.filter(l => l.driver_number === driverNumber);
    const laps = state.laps.filter(l => l.driver_number === driverNumber);
    const timing = state.driverTimings.find(t => t.driver.driver_number === driverNumber);

    return {
      driver,
      carData,
      positions,
      locations,
      laps,
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
      if (state.isLive) {
        fetchFastData(); // Fast updates during live session
      } else {
        fetchData(); // Full updates for non-live sessions
      }
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, state.isLive, fetchData, fetchFastData]);

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

  return {
    ...state,
    refresh,
    getDriverData,
    fetchFastData
  };
};