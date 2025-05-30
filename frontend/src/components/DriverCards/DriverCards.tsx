import React from 'react';
import { Driver, DriverTiming } from '../../types/f1';
import { TEAM_COLORS, TYRE_COLORS } from '../../types/f1';
import './DriverCards.css';

interface DriverCardsProps {
  drivers: Driver[];
  driverTimings: DriverTiming[];
  onDriverSelect: (driverNumber: number) => void;
  selectedDriver: number | null;
}

const DriverCards: React.FC<DriverCardsProps> = ({
  drivers,
  driverTimings,
  onDriverSelect,
  selectedDriver
}) => {
  return (
    <div className="driver-cards">
      <div className="cards-header">
        <h3>🏎️ Drivers</h3>
        <span className="driver-count">{drivers.length} drivers</span>
      </div>

      <div className="cards-grid">
        {driverTimings.map(timing => {
          const isSelected = selectedDriver === timing.driver.driver_number;
          const teamColor = TEAM_COLORS[timing.driver.team_name] || '#FFFFFF';
          const tyreColor = TYRE_COLORS[timing.tyreCompound] || '#CCCCCC';

          return (
            <div
              key={timing.driver.driver_number}
              className={`driver-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onDriverSelect(timing.driver.driver_number)}
              style={{ borderColor: teamColor }}
            >
              <div className="card-header" style={{ backgroundColor: teamColor }}>
                <span className="driver-number">{timing.driver.driver_number}</span>
                <span className="position">P{timing.position || '--'}</span>
              </div>

              <div className="card-content">
                <div className="driver-info">
                  <span className="driver-name">{timing.driver.name_acronym}</span>
                  <span className="team-name">{timing.driver.team_name}</span>
                </div>

                <div className="timing-info">
                  <div className="lap-time">{timing.lapTime}</div>
                  <div className="gap">{timing.gap}</div>
                </div>

                <div className="tyre-info">
                  <span 
                    className="tyre-indicator"
                    style={{ backgroundColor: tyreColor }}
                  >
                    {timing.tyreCompound.charAt(0)}
                  </span>
                  <span className="tyre-age">{timing.tyreAge} laps</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {drivers.length === 0 && (
        <div className="no-drivers">
          <p>No drivers data available</p>
        </div>
      )}
    </div>
  );
};

export default DriverCards;