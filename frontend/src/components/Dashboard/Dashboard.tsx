import React, { useState } from 'react';
import LiveTiming from '../LiveTiming/LiveTiming';
import CircuitMap from '../CircuitMap/CircuitMap';
import TelemetryData from '../TelemetryData/TelemetryData';
import PitStops from '../PitStops/PitStops';
import DriverCards from '../DriverCards/DriverCards';
import { useF1Data } from '../../hooks/useF1Data';
import './Dashboard.css';

interface DashboardProps {
  f1Data: ReturnType<typeof useF1Data>;
  websocketStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isLive: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ f1Data, websocketStatus, isLive }) => {
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'telemetry' | 'analysis'>('overview');

  const {
    drivers,
    driverTimings,
    locations,
    carData,
    pitData,
    stints,
    session
  } = f1Data;

  // Get selected driver data
  const selectedDriverData = selectedDriver ? f1Data.getDriverData(selectedDriver) : null;

  return (
    <div className="dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="view-selector">
          <button 
            className={`view-btn ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`view-btn ${activeView === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveView('telemetry')}
          >
            📈 Telemetry
          </button>
          <button 
            className={`view-btn ${activeView === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveView('analysis')}
          >
            🔍 Analysis
          </button>
        </div>

        {selectedDriver && (
          <div className="selected-driver-info">
            <span className="driver-name">
              {drivers.find(d => d.driver_number === selectedDriver)?.name_acronym}
            </span>
            <button 
              className="clear-selection"
              onClick={() => setSelectedDriver(null)}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Dashboard Content */}
      <div className="dashboard-content">
        {activeView === 'overview' && (
          <div className="overview-layout">
            {/* Main timing and circuit */}
            <div className="main-section">
              <div className="timing-section">
                <LiveTiming 
                  driverTimings={driverTimings}
                  onDriverSelect={setSelectedDriver}
                  selectedDriver={selectedDriver}
                  isLive={isLive}
                />
              </div>
              
              <div className="circuit-section">
                <CircuitMap 
                  locations={locations}
                  drivers={drivers}
                  session={session}
                  selectedDriver={selectedDriver}
                  onDriverSelect={setSelectedDriver}
                />
              </div>
            </div>

            {/* Side panels */}
            <div className="side-section">
              <div className="driver-cards-section">
                <DriverCards 
                  drivers={drivers}
                  driverTimings={driverTimings}
                  onDriverSelect={setSelectedDriver}
                  selectedDriver={selectedDriver}
                />
              </div>
              
              <div className="pit-stops-section">
                <PitStops 
                  pitData={pitData}
                  stints={stints}
                  drivers={drivers}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'telemetry' && (
          <div className="telemetry-layout">
            <TelemetryData 
              carData={carData}
              drivers={drivers}
              selectedDriver={selectedDriver}
              onDriverSelect={setSelectedDriver}
            />
          </div>
        )}

        {activeView === 'analysis' && (
          <div className="analysis-layout">
            <div className="analysis-placeholder">
              <h2>🔍 Analysis View</h2>
              <p>Advanced analysis features coming soon...</p>
              <div className="features-list">
                <div className="feature-item">📊 Lap time comparison</div>
                <div className="feature-item">⚡ Sector analysis</div>
                <div className="feature-item">🏁 Race strategy insights</div>
                <div className="feature-item">📈 Performance trends</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard Footer */}
      <div className="dashboard-footer">
        <div className="stats-summary">
          <div className="stat">
            <span className="stat-label">Drivers:</span>
            <span className="stat-value">{drivers.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Live Data:</span>
            <span className={`stat-value ${isLive ? 'live' : 'offline'}`}>
              {isLive ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Connection:</span>
            <span className={`stat-value ${websocketStatus}`}>
              {websocketStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {session && (
          <div className="session-summary">
            <span>{session.session_name} - {session.circuit_short_name}</span>
            <span className="session-time">
              {new Date(session.date_start).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;