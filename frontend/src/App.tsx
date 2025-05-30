import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import { useF1Data } from './hooks/useF1Data';
import { useWebSocket } from './hooks/useWebSocket';
import { DEFAULTS } from './utils/constants';
import './App.css';

const App: React.FC = () => {
  const [selectedSession, setSelectedSession] = useState<string>(DEFAULTS.SESSION_KEY);
  
  // Main F1 data hook
  const f1Data = useF1Data({
    sessionKey: selectedSession,
    autoRefresh: true,
    refreshInterval: 5000
  });

  // WebSocket for real-time updates
  const websocket = useWebSocket({
    sessionKey: selectedSession,
    autoConnect: true,
    subscriptions: ['CAR_DATA', 'POSITION', 'LAP_DATA', 'INTERVAL']
  });

  // Handle WebSocket messages to update data in real-time
  useEffect(() => {
    if (websocket.lastMessage) {
      const { type, data } = websocket.lastMessage;
      
      // Handle different message types
      switch (type) {
        case 'CAR_DATA':
          // Fast telemetry updates
          f1Data.fetchFastData();
          break;
        case 'POSITION':
        case 'LAP_DATA':
        case 'INTERVAL':
          // Trigger data refresh for timing updates
          if (f1Data.isLive) {
            f1Data.fetchFastData();
          }
          break;
        default:
          console.log('Unhandled WebSocket message type:', type);
      }
    }
  }, [websocket.lastMessage, f1Data]);

  // Handle errors
  const hasError = f1Data.error || websocket.error;
  const isConnected = websocket.isConnected && !f1Data.loading;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            🏎️ F1 Live Dashboard
          </h1>
          
          <div className="header-info">
            {f1Data.session && (
              <div className="session-info">
                <span className="session-name">{f1Data.session.session_name}</span>
                <span className="circuit-name">{f1Data.session.circuit_short_name}</span>
              </div>
            )}
            
            <div className="connection-status">
              <div className={`status-indicator ${websocket.status}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {websocket.status === 'connected' ? 'Live' : 
                   websocket.status === 'connecting' ? 'Connecting...' :
                   'Offline'}
                </span>
              </div>
              
              {f1Data.lastUpdate && (
                <span className="last-update">
                  Updated: {f1Data.lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        {hasError ? (
          <div className="error-container">
            <div className="error-message">
              <h2>⚠️ Connection Error</h2>
              <p>{f1Data.error || websocket.error}</p>
              <button 
                className="retry-button"
                onClick={() => {
                  f1Data.refresh();
                  if (!websocket.isConnected) {
                    websocket.connect();
                  }
                }}
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : f1Data.loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h2>Loading F1 Data...</h2>
            <p>Connecting to live timing...</p>
          </div>
        ) : (
          <Dashboard 
            f1Data={f1Data}
            websocketStatus={websocket.status}
            isLive={f1Data.isLive}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>
            Data provided by <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1 API</a>
          </p>
          <p className="disclaimer">
            Unofficial F1 Dashboard - Not affiliated with Formula 1
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;