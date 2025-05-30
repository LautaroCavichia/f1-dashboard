import React from 'react';
import { DriverTiming } from '../../types/f1';
import { TEAM_COLORS, TYRE_COLORS } from '../../types/f1';
import { hexToRgba } from '../../utils/helpers';
import './LiveTiming.css';

interface LiveTimingProps {
  driverTimings: DriverTiming[];
  onDriverSelect: (driverNumber: number) => void;
  selectedDriver: number | null;
  isLive: boolean;
}

const LiveTiming: React.FC<LiveTimingProps> = ({
  driverTimings,
  onDriverSelect,
  selectedDriver,
  isLive
}) => {
  return (
    <div className="live-timing">
      <div className="timing-header">
        <h2>🏁 Live Timing</h2>
        <div className="timing-status">
          <span className={`status-badge ${isLive ? 'live' : 'offline'}`}>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="timing-table">
        <div className="timing-header-row">
          <div className="col-pos">POS</div>
          <div className="col-driver">DRIVER</div>
          <div className="col-time">TIME</div>
          <div className="col-sector">S1</div>
          <div className="col-sector">S2</div>
          <div className="col-sector">S3</div>
          <div className="col-gap">GAP</div>
          <div className="col-interval">INT</div>
          <div className="col-tyre">TYRE</div>
        </div>

        <div className="timing-rows">
          {driverTimings.map((timing, index) => {
            const teamColor = TEAM_COLORS[timing.driver.team_name] || '#FFFFFF';
            const tyreColor = TYRE_COLORS[timing.tyreCompound] || '#CCCCCC';
            const isSelected = selectedDriver === timing.driver.driver_number;

            return (
              <div
                key={timing.driver.driver_number}
                className={`timing-row ${isSelected ? 'selected' : ''}`}
                onClick={() => onDriverSelect(timing.driver.driver_number)}
                style={{
                  borderLeft: `4px solid ${teamColor}`,
                  backgroundColor: isSelected ? hexToRgba(teamColor, 0.1) : 'transparent'
                }}
              >
                <div className="col-pos">
                  <span className="position">{timing.position || '--'}</span>
                </div>

                <div className="col-driver">
                  <div className="driver-info">
                    <span 
                      className="driver-number"
                      style={{ backgroundColor: teamColor }}
                    >
                      {timing.driver.driver_number}
                    </span>
                    <div className="driver-details">
                      <span className="driver-name">{timing.driver.name_acronym}</span>
                      <span className="team-name">{timing.driver.team_name}</span>
                    </div>
                  </div>
                </div>

                <div className="col-time">
                  <span className="lap-time">{timing.lapTime}</span>
                </div>

                <div className="col-sector">
                  <span className="sector-time">{timing.sector1}</span>
                </div>

                <div className="col-sector">
                  <span className="sector-time">{timing.sector2}</span>
                </div>

                <div className="col-sector">
                  <span className="sector-time">{timing.sector3}</span>
                </div>

                <div className="col-gap">
                  <span className="gap-time">{timing.gap}</span>
                </div>

                <div className="col-interval">
                  <span className="interval-time">{timing.interval}</span>
                </div>

                <div className="col-tyre">
                  <div className="tyre-info">
                    <span 
                      className="tyre-compound"
                      style={{ backgroundColor: tyreColor }}
                    >
                      {timing.tyreCompound.charAt(0)}
                    </span>
                    <span className="tyre-age">{timing.tyreAge}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {driverTimings.length === 0 && (
        <div className="no-data">
          <p>No timing data available</p>
          <span>Waiting for live session...</span>
        </div>
      )}
    </div>
  );
};

export default LiveTiming;