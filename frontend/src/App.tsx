import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import SessionSelector from './components/SessionSelector/SessionSelector';
import { useF1Data } from './hooks/useF1Data';
import { useWebSocket } from './hooks/useWebSocket';
import { DEFAULTS } from './utils/constants';
import './App.css';

const App: React.FC = () => {
  const [selectedSession, setSelectedSession] = useState<string>(DEFAULTS.SESSION_KEY);
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  
  // Main F1 data hook
  const f1Data = useF1Data({
    sessionKey: selectedSession,
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds
  });

  // WebSocket for real-time updates
  const websocket = useWebSocket({
    sessionKey: selectedSession,
    autoConnect: true,
    subscriptions: ['POSITION', 'INTERVAL', 'LOCATION']
  });

  // Handle session selection
  const handleSessionSelect = (sessionKey: string) => {
    console.log(`[App] Session selected: ${sessionKey}`);
    setSelectedSession(sessionKey);
    setShowSessionSelector(false);
  };

  // Debug logging
  useEffect(() => {
    const debugData = {
      timestamp: new Date().toISOString(),
      selectedSession,
      f1Data: {
        loading: f1Data.loading,
        error: f1Data.error,
        drivers: f1Data.drivers.length,
        driverTimings: f1Data.driverTimings.length,
        session: f1Data.session?.session_name || 'None',
        sessionKey: f1Data.session?.session_key || 'None',
        lastUpdate: f1Data.lastUpdate?.toISOString() || 'Never',
        isLive: f1Data.isLive
      },
      websocket: {
        status: websocket.status,
        isConnected: websocket.isConnected,
        error: websocket.error,
        lastMessage: websocket.lastMessage?.type || 'None'
      }
    };
    
    setDebugInfo(debugData);
    console.log('[App] Debug Info:', debugData);
  }, [selectedSession, f1Data, websocket]);

  // Handle WebSocket messages to update data in real-time
  useEffect(() => {
    if (websocket.lastMessage) {
      const { type, data } = websocket.lastMessage;
      
      console.log('[App] WebSocket message received:', type, data);
      
      // Handle different message types
      switch (type) {
        case 'POSITION':
        case 'LOCATION':
        case 'INTERVAL':
          // Trigger fast data refresh for real-time updates
          if (f1Data.isLive) {
            console.log('[App] Triggering fast data refresh for live session');
            f1Data.fetchFastData();
          }
          break;
        case 'SESSION_INFO':
          console.log('[App] Session info received:', data);
          break;
        case 'NO_SESSION':
          console.log('[App] No session available');
          break;
        default:
          console.log('[App] Unhandled WebSocket message type:', type);
      }
    }
  }, [websocket.lastMessage, f1Data]);

  // Handle errors - Only show error if F1 data failed, not just WebSocket
  const hasError = f1Data.error; // Remove websocket.error from here
  const isConnected = websocket.isConnected;

  // Show debug information in development
  const showDebug = process.env.NODE_ENV === 'development';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            🏎️ F1 Live Dashboard
          </h1>
          
          <div className="header-info">
            <SessionSelector
              currentSession={f1Data.session}
              onSessionSelect={handleSessionSelect}
              isOpen={showSessionSelector}
              onToggle={() => setShowSessionSelector(!showSessionSelector)}
            />
            
            {f1Data.session && (
              <div className="session-info">
                <span className="session-name">
                  {f1Data.session.session_name}
                  {f1Data.isLive && <span className="live-indicator"> 🔴 LIVE</span>}
                </span>
                <span className="circuit-name">{f1Data.session.circuit_short_name}</span>
              </div>
            )}
            
            <div className="connection-status">
              <div className={`status-indicator ${websocket.status}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {websocket.status === 'connected' ? 'Connected' : 
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
              
              {showDebug && (
                <div className="debug-info">
                  <h3>Debug Information</h3>
                  <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                </div>
              )}
              
              <div className="error-actions">
                <button 
                  className="retry-button"
                  onClick={() => {
                    console.log('[App] Manual retry triggered');
                    f1Data.refresh();
                    if (!websocket.isConnected) {
                      websocket.connect();
                    }
                  }}
                >
                  Retry Connection
                </button>
                
                {showDebug && (
                  <button 
                    className="retry-button"
                    onClick={() => {
                      console.log('[App] Opening browser console for debugging');
                      alert('Check the browser console (F12) for detailed debug information');
                    }}
                  >
                    Show Debug Console
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : f1Data.loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h2>Loading F1 Data...</h2>
            <p>Connecting to live timing...</p>
            
            {showDebug && (
              <div className="loading-debug">
                <p>Session: {debugInfo.f1Data?.session || 'Loading...'}</p>
                <p>Drivers: {debugInfo.f1Data?.drivers || 0}</p>
                <p>WebSocket: {debugInfo.websocket?.status || 'Unknown'}</p>
                <p>Last Update: {debugInfo.f1Data?.lastUpdate || 'Never'}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <Dashboard 
              f1Data={f1Data}
              websocketStatus={websocket.status}
              isLive={f1Data.isLive}
            />
            
            {showDebug && (
              <div className="debug-panel">
                <h3>Debug Panel (Development Only)</h3>
                <div className="debug-grid">
                  <div>
                    <strong>F1 Data:</strong>
                    <ul>
                      <li>Loading: {f1Data.loading ? 'Yes' : 'No'}</li>
                      <li>Error: {f1Data.error || 'None'}</li>
                      <li>Drivers: {f1Data.drivers.length}</li>
                      <li>Timings: {f1Data.driverTimings.length}</li>
                      <li>Session: {f1Data.session?.session_name || 'None'}</li>
                      <li>Live: {f1Data.isLive ? 'Yes' : 'No'}</li>
                    </ul>
                  </div>
                  <div>
                    <strong>WebSocket:</strong>
                    <ul>
                      <li>Status: {websocket.status}</li>
                      <li>Connected: {websocket.isConnected ? 'Yes' : 'No'}</li>
                      <li>Error: {websocket.error || 'None'}</li>
                      <li>Last Message: {websocket.lastMessage?.type || 'None'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
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
