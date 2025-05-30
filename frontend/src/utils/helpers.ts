import { SECTOR_COLORS, DRS_STATUS } from './constants';

/**
 * Formats lap time from seconds to MM:SS.mmm format
 */
export const formatLapTime = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '--:--.---';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`;
};

/**
 * Formats sector time to S.mmm format
 */
export const formatSectorTime = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '--.---';
  return seconds.toFixed(3);
};

/**
 * Formats gap/interval time
 */
export const formatGap = (gap: number | string | null): string => {
  if (!gap) return '--';
  if (typeof gap === 'string') return gap;
  
  if (gap < 60) {
    return `+${gap.toFixed(3)}`;
  } else {
    const minutes = Math.floor(gap / 60);
    const seconds = gap % 60;
    return `+${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
};

/**
 * Determines sector color based on timing comparison
 */
export const getSectorColor = (
  currentTime: number,
  personalBest: number | null,
  sessionBest: number | null
): string => {
  if (!currentTime) return SECTOR_COLORS.INVALID;
  
  if (sessionBest && currentTime <= sessionBest + 0.001) {
    return SECTOR_COLORS.SESSION_BEST;
  }
  
  if (personalBest && currentTime <= personalBest + 0.001) {
    return SECTOR_COLORS.PERSONAL_BEST;
  }
  
  return SECTOR_COLORS.SLOWER;
};

/**
 * Converts DRS value to readable status
 */
export const getDRSStatus = (drsValue: number): string => {
  return DRS_STATUS[drsValue] || 'UNKNOWN';
};

/**
 * Formats speed value
 */
export const formatSpeed = (speed: number | null): string => {
  if (!speed) return '---';
  return `${Math.round(speed)}`;
};

/**
 * Formats RPM value
 */
export const formatRPM = (rpm: number | null): string => {
  if (!rpm) return '-----';
  return rpm.toLocaleString();
};

/**
 * Formats percentage values (throttle, brake)
 */
export const formatPercentage = (value: number | null): string => {
  if (value === null || value === undefined) return '--';
  return `${Math.round(value)}%`;
};

/**
 * Converts hex color to rgba with opacity
 */
export const hexToRgba = (hex: string, alpha: number = 1): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Calculates distance between two points
 */
export const calculateDistance = (
  x1: number, y1: number, 
  x2: number, y2: number
): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

/**
 * Normalizes circuit coordinates to fit viewport
 */
export const normalizeCircuitCoordinates = (
  points: Array<{x: number, y: number}>,
  width: number,
  height: number,
  margin: number = 50
): Array<{x: number, y: number}> => {
  if (points.length === 0) return [];

  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  const scaleX = (width - 2 * margin) / (maxX - minX);
  const scaleY = (height - 2 * margin) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;

  return points.map(point => ({
    x: (point.x - minX) * scale + offsetX,
    y: (point.y - minY) * scale + offsetY
  }));
};

/**
 * Debounces function calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttles function calls
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Creates a safe array from potentially undefined data
 */
export const safeArray = <T>(data: T[] | undefined | null): T[] => {
  return Array.isArray(data) ? data : [];
};

/**
 * Safely parses JSON with fallback
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

/**
 * Formats time difference in a human readable way
 */
export const formatTimeDifference = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

/**
 * Checks if a session is currently live
 */
export const isSessionLive = (sessionStart: string, sessionEnd: string): boolean => {
  const now = new Date().getTime();
  const start = new Date(sessionStart).getTime();
  const end = new Date(sessionEnd).getTime();
  
  return now >= start && now <= end;
};

/**
 * Gets current session status
 */
export const getSessionStatus = (sessionStart: string, sessionEnd: string): 'upcoming' | 'live' | 'finished' => {
  const now = new Date().getTime();
  const start = new Date(sessionStart).getTime();
  const end = new Date(sessionEnd).getTime();
  
  if (now < start) return 'upcoming';
  if (now > end) return 'finished';
  return 'live';
};