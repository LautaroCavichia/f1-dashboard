import React, { useState, useEffect } from 'react';
import { CarData, Driver } from '../../types/f1';
import { formatSpeed, formatRPM, formatPercentage, getDRSStatus } from '../../utils/helpers';
import './TelemetryData.css';

interface TelemetryDataProps {
  carData: CarData[];
  drivers: Driver[];
  selectedDriver: number | null;
  onDriverSelect: (driverNumber: number) => void;
}

const TelemetryData: React.FC<TelemetryDataProps> = ({
  carData,
  drivers,
  selectedDriver,
  onDriverSelect
}) => {
  const [filteredData, setFilteredData] = useState<CarData[]>([]);

  useEffect(() => {
    if (selectedDriver) {
      const driverData = carData.filter(data => data.driver_number === selectedDriver);
      setFilteredData(driverData.slice(-20)); // Last 20 data points
    } else {
      // Show latest data for all drivers
      const latestData: CarData[] = [];
      drivers.forEach(driver => {
        const driverCarData = carData
          .filter(data => data.driver_number === driver.driver_number)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (driverCarData.length > 0) {
          latestData.push(driverCarData[0]);
        }
      });
      setFilteredData(latestData);
    }
  }, [carData, selectedDriver, drivers]);

  const selectedDriverInfo = selectedDriver 
    ? drivers.find(d => d.driver_number === selectedDriver)
    : null;

  return (
    <div className="telemetry-data">
      <div className="telemetry-header">
        <h2>📈 Telemetry Data</h2>
        {selectedDriverInfo && (
          <div className="selected-driver">
            <span>{selectedDriverInfo.name_acronym}</span>
            <button onClick={() => onDriverSelect(null as unknown as number)}>Show All</button>
          </div>
        )}
      </div>

      {!selectedDriver && (
        <div className="driver-selector">
          {drivers.map(driver => (
            <button
              key={driver.driver_number}
              className="driver-btn"
              onClick={() => onDriverSelect(driver.driver_number)}
              style={{ borderColor: `#${driver.team_colour}` }}
            >
              {driver.name_acronym}
            </button>
          ))}
        </div>
      )}

      <div className="telemetry-grid">
        {filteredData.map((data, index) => {
          const driver = drivers.find(d => d.driver_number === data.driver_number);
          return (
            <div key={`${data.driver_number}-${index}`} className="telemetry-card">
              <div className="card-header" style={{ borderTopColor: `#${driver?.team_colour}` }}>
                <span className="driver-name">{driver?.name_acronym}</span>
                <span className="timestamp">
                  {new Date(data.date).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="telemetry-values">
                <div className="value-row">
                  <span className="label">Speed</span>
                  <span className="value">{formatSpeed(data.speed)} km/h</span>
                </div>
                
                <div className="value-row">
                  <span className="label">RPM</span>
                  <span className="value">{formatRPM(data.rpm)}</span>
                </div>
                
                <div className="value-row">
                  <span className="label">Throttle</span>
                  <span className="value">{formatPercentage(data.throttle)}</span>
                </div>
                
                <div className="value-row">
                  <span className="label">Brake</span>
                  <span className="value">{formatPercentage(data.brake)}</span>
                </div>
                
                <div className="value-row">
                  <span className="label">Gear</span>
                  <span className="value">{data.n_gear || 'N'}</span>
                </div>
                
                <div className="value-row">
                  <span className="label">DRS</span>
                  <span className="value">{getDRSStatus(data.drs)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredData.length === 0 && (
        <div className="no-telemetry">
          <p>No telemetry data available</p>
        </div>
      )}
    </div>
  );
};

export default TelemetryData;