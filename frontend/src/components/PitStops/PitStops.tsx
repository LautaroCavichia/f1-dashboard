import React from 'react';
import { PitData, Stint, Driver } from '../../types/f1';
import { TYRE_COLORS } from '../../types/f1';
import { formatLapTime } from '../../utils/helpers';
import './PitStops.css';

interface PitStopsProps {
  pitData: PitData[];
  stints: Stint[];
  drivers: Driver[];
}

const PitStops: React.FC<PitStopsProps> = ({ pitData, stints, drivers }) => {
  // Sort pit stops by most recent
  const sortedPitStops = pitData.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="pit-stops">
      <div className="pit-header">
        <h3>🔧 Pit Stops</h3>
        <span className="pit-count">{pitData.length} stops</span>
      </div>

      <div className="pit-list">
        {sortedPitStops.slice(0, 10).map((pit, index) => {
          const driver = drivers.find(d => d.driver_number === pit.driver_number);
          const currentStint = stints
            .filter(s => s.driver_number === pit.driver_number)
            .sort((a, b) => b.stint_number - a.stint_number)[0];

          return (
            <div key={`${pit.driver_number}-${pit.lap_number}`} className="pit-item">
              <div className="pit-driver">
                <span 
                  className="driver-number"
                  style={{ backgroundColor: `#${driver?.team_colour}` }}
                >
                  {pit.driver_number}
                </span>
                <span className="driver-name">{driver?.name_acronym}</span>
              </div>

              <div className="pit-details">
                <div className="pit-info">
                  <span className="lap">Lap {pit.lap_number}</span>
                  <span className="duration">{pit.pit_duration.toFixed(1)}s</span>
                </div>
                
                {currentStint && (
                  <div className="tyre-change">
                    <span>→</span>
                    <span 
                      className="tyre-compound"
                      style={{ 
                        backgroundColor: TYRE_COLORS[currentStint.compound],
                        color: currentStint.compound === 'HARD' ? '#000' : '#fff'
                      }}
                    >
                      {currentStint.compound.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pitData.length === 0 && (
        <div className="no-pit-data">
          <p>No pit stops yet</p>
        </div>
      )}
    </div>
  );
};

export default PitStops;