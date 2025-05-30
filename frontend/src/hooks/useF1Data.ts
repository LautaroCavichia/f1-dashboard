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
import { formatLapTime, formatGap, formatSectorTime } from '../utils/helpers';

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

  /**
   * Safe state update (only if component is still mounted)
   */
  const safeSetState = useCallback((updater: Partial<F1DataState> | ((prev: F1DataState) => F1DataState)) => {
    if (mountedRef.current) {
      setState(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
    }
  }, []);

  /**
   * Process raw data into driver timing information
   */
  const processDriverTimings = useCallback((
    drivers: Driver[],
    positions: Position[],
    laps: LapData[],
    intervals: Interval[],
    stints: Stint[],
    pitData: PitData[]
  ): DriverTiming[] => {
    return drivers.map(driver => {
      // Get latest position
      const latestPosition = positions
        .filter(p => p.driver_number === driver.driver_number)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      // Get latest lap
      const latestLap = laps
        .filter(l => l.driver_number === driver.driver_number)
        .sort((a, b) => b.lap_number - a.lap_number)[0];

      // Get gap/interval
      const latestInterval = intervals
        .filter(i => i.driver_number === driver.driver_number)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      // Get current stint
      const currentStint = stints
        .filter(s => s.driver_number === driver.driver_number)
        .sort((a, b) => b.stint_number - a.stint_number)[0];

      // Count pit stops
      const pitStops = pitData.filter(p => p.driver_number === driver.driver_number).length;

      return {
        driver,
        position: latestPosition?.position || 0,
        lapTime: latestLap ? formatLapTime(latestLap.lap_duration) : '--:--.---',
        sector1: latestLap ? formatSectorTime(latestLap.duration_sector_1) : '---.---',
        sector2: latestLap ? formatSectorTime(latestLap.duration_sector_2) : '---.---',
        sector3: latestLap ? formatSectorTime(latestLap.duration_sector_3) : '---.---',
        gap: latestInterval ? formatGap(latestInterval.gap_to_leader) : '--',
        interval: latestInterval ? formatGap(latestInterval.interval) : '--',
        lastLap: latestLap?.lap_number || 0,
        tyreCompound: currentStint?.compound || 'UNKNOWN',
        tyreAge: currentStint ? (latestLap?.lap_number || 0) - currentStint.lap_start + currentStint.tyre_age_at_start : 0,
        pitStops
      };
    }).sort((a, b) => (a.position || 999) - (b.position || 999));
  }, []);

  /**
   * Fetch all F1 data
   */
  const fetchData = useCallback(async () => {
    try {
      safeSetState({ loading: true, error: null });

      // Fetch core data in parallel
      const [
        session,
        drivers,
        positions,
        locations,
        laps,
        pitData,
        stints,
        intervals
      ] = await Promise.all([
        f1Api.getCurrentSession(),
        f1Api.getDrivers(sessionKey),
        f1Api.getPositions(sessionKey),
        f1Api.getLocations(sessionKey),
        f1Api.getLaps(sessionKey),
        f1Api.getPitData(sessionKey),
        f1Api.getStints(sessionKey),
        f1Api.getIntervals(sessionKey)
      ]);

      // Process driver timings
      const driverTimings = processDriverTimings(
        drivers,
        positions,
        laps,
        intervals,
        stints,
        pitData
      );

      // Check if session is live
      const isLive = session ? 
        new Date().getTime() >= new Date(session.date_start).getTime() &&
        new Date().getTime() <= new Date(session.date_end).getTime() : false;

      safeSetState({
        session,
        drivers,
        positions,
        locations,
        laps,
        pitData,
        stints,
        intervals,
        driverTimings,
        loading: false,
        lastUpdate: new Date(),
        isLive
      });

    } catch (error) {
      console.error('Failed to fetch F1 data:', error);
      safeSetState({ 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch data' 
      });
    }
  }, [sessionKey, processDriverTimings, safeSetState]);

  /**
   * Fetch only fast-updating data (for frequent updates)
   */
  const fetchFastData = useCallback(async () => {
    try {
      const [carData, locations, intervals] = await Promise.all([
        f1Api.getCarData(sessionKey),
        f1Api.getLocations(sessionKey),
        f1Api.getIntervals(sessionKey)
      ]);

      safeSetState(prev => ({
        ...prev,
        carData,
        locations,
        intervals,
        lastUpdate: new Date()
      }));

    } catch (error) {
      console.error('Failed to fetch fast data:', error);
    }
  }, [sessionKey, safeSetState]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
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
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

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