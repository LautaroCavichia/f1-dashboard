import React, { useEffect, useRef, useState } from 'react';
import { Location, Driver, Session } from '../../types/f1';
import { TEAM_COLORS } from '../../types/f1';
import { normalizeCircuitCoordinates, calculateDistance } from '../../utils/helpers';
import './CircuitMap.css';

interface CircuitMapProps {
  locations: Location[];
  drivers: Driver[];
  session: Session | null;
  selectedDriver: number | null;
  onDriverSelect: (driverNumber: number) => void;
}

interface CarPosition {
  driver_number: number;
  x: number;
  y: number;
  team_colour: string;
  name_acronym: string;
  lastUpdate: number;
}

const CircuitMap: React.FC<CircuitMapProps> = ({
  locations,
  drivers,
  session,
  selectedDriver,
  onDriverSelect
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [trackPath, setTrackPath] = useState<Array<{x: number, y: number}>>([]);
  const [carPositions, setCarPositions] = useState<CarPosition[]>([]);
  const animationRef = useRef<number | undefined>(undefined);

  // Update canvas size based on container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Process locations to create track path and car positions
  useEffect(() => {
    if (locations.length === 0) return;

    // Group locations by driver
    const driverLocations = new Map<number, Location[]>();
    locations.forEach(location => {
      if (!driverLocations.has(location.driver_number)) {
        driverLocations.set(location.driver_number, []);
      }
      driverLocations.get(location.driver_number)!.push(location);
    });

    // Create track path from all location points
    const allPoints = locations.map(loc => ({ x: loc.x, y: loc.y }));
    if (allPoints.length > 0) {
      const normalizedTrack = normalizeCircuitCoordinates(
        allPoints,
        canvasSize.width,
        canvasSize.height,
        50
      );
      setTrackPath(normalizedTrack);
    }

    // Get latest position for each driver
    const currentPositions: CarPosition[] = [];
    driverLocations.forEach((locations, driverNumber) => {
      const driver = drivers.find(d => d.driver_number === driverNumber);
      if (!driver) return;

      // Get most recent location
      const latestLocation = locations.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      if (latestLocation) {
        // Normalize position
        const normalizedPos = normalizeCircuitCoordinates(
          [{ x: latestLocation.x, y: latestLocation.y }],
          canvasSize.width,
          canvasSize.height,
          50
        )[0];

        currentPositions.push({
          driver_number: driverNumber,
          x: normalizedPos.x,
          y: normalizedPos.y,
          team_colour: TEAM_COLORS[driver.team_name] || '#FFFFFF',
          name_acronym: driver.name_acronym,
          lastUpdate: new Date(latestLocation.date).getTime()
        });
      }
    });

    setCarPositions(currentPositions);
  }, [locations, drivers, canvasSize]);

  // Canvas drawing function
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw track path
    if (trackPath.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(trackPath[0].x, trackPath[0].y);
      
      for (let i = 1; i < trackPath.length; i++) {
        ctx.lineTo(trackPath[i].x, trackPath[i].y);
      }
      
      ctx.stroke();

      // Draw start/finish line
      if (trackPath.length > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const startPoint = trackPath[0];
        const endPoint = trackPath[Math.floor(trackPath.length * 0.05)];
        const perpX = -(endPoint.y - startPoint.y);
        const perpY = endPoint.x - startPoint.x;
        const length = Math.sqrt(perpX * perpX + perpY * perpY);
        const normalizedPerpX = (perpX / length) * 15;
        const normalizedPerpY = (perpY / length) * 15;
        
        ctx.moveTo(startPoint.x - normalizedPerpX, startPoint.y - normalizedPerpY);
        ctx.lineTo(startPoint.x + normalizedPerpX, startPoint.y + normalizedPerpY);
        ctx.stroke();
      }
    }

    // Draw cars
    carPositions.forEach(car => {
      const isSelected = selectedDriver === car.driver_number;
      const carSize = isSelected ? 12 : 8;
      
      // Car body
      ctx.fillStyle = car.team_colour;
      ctx.beginPath();
      ctx.arc(car.x, car.y, carSize, 0, 2 * Math.PI);
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(car.x, car.y, carSize + 4, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Driver name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(car.name_acronym, car.x, car.y + carSize + 15);
    });

    // Draw circuit info
    if (session) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 200, 60);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(session.circuit_short_name, 20, 30);
      
      ctx.font = '12px Arial';
      ctx.fillStyle = '#CCCCCC';
      ctx.fillText(session.session_name, 20, 50);
    }
  };

  // Animation loop
  useEffect(() => {
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [trackPath, carPositions, selectedDriver, session]);

  // Handle canvas clicks
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Check if click is near any car
    for (const car of carPositions) {
      const distance = calculateDistance(clickX, clickY, car.x, car.y);
      if (distance <= 15) {
        onDriverSelect(car.driver_number);
        return;
      }
    }
  };

  return (
    <div className="circuit-map" ref={containerRef}>
      <div className="circuit-header">
        <h3>🏁 Circuit Map</h3>
        <div className="circuit-stats">
          <span className="car-count">{carPositions.length} cars</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height - 60} // Account for header
        onClick={handleCanvasClick}
        className="circuit-canvas"
      />

      {locations.length === 0 && (
        <div className="no-data">
          <p>No location data available</p>
          <span>Waiting for live session...</span>
        </div>
      )}

      <div className="circuit-legend">
        <div className="legend-item">
          <div className="legend-line"></div>
          <span>Track</span>
        </div>
        <div className="legend-item">
          <div className="legend-start"></div>
          <span>Start/Finish</span>
        </div>
        <div className="legend-item">
          <div className="legend-car"></div>
          <span>Cars (click to select)</span>
        </div>
      </div>
    </div>
  );
};

export default CircuitMap;