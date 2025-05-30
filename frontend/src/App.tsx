import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard/Dashboard';
import SessionSelector from './components/SessionSelector/SessionSelector';
import DebugInfo from './components/DebugInfo/DebugInfo'; // Add this temporarily
import { useF1Data } from './hooks/useF1Data';
import { useWebSocket } from './hooks/useWebSocket';
import './App.css';

const App: React.FC = () => {
  const [selectedSession, setSelectedSession] = useState<string>('latest');
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  
  // Main F1 data hook
  const f1Data = useF1Data({
    sessionKey: selectedSession,
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds for stability
  });

  // WebSocket for real-time updates (simplified for now)
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

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (websocket.lastMessage && f1Data.isLive) {
      const { type } = websocket.lastMessage;
      
      console.log('[App] WebSocket message received:', type);
      
      // For live sessions, trigger fast data refresh on certain messages
      if (['POSITION', 'LOCATION', 'INTERVAL'].includes(type)) {
        console.log('[App] Triggering fast data refresh');
        f1Data.fetchFastData();
      }
    }
  }, [websocket.lastMessage, f1Data.isLive, f1Data.fetchFastData]);

  // Show connection status in a more user-friendly way
  const getConnectionStatus = () => {
    if (!f1Data.isHealthy) {
      return { status: 'error', text: 'Backend Offline' };
    }
    if (f1Data.loading) {
      return { status: 'connecting', text: 'Loading...' };
    }
    if (f1Data.error) {
      return { status: 'error', text: 'Connection Error' };
    }
    return { status: 'connected', text: f1Data.isLive ? 'Live' : 'Connected' };
  };

  const connectionStatus = getConnectionStatus();

  // Debug information (only in development)
  const showDebug = process.env.NODE_ENV === 'development';
  
  const debugInfo = showDebug ? {
    timestamp: new Date().toISOString(),
    selectedSession,
    f1Data: {
      loading: f1Data.loading,
      error: f1Data.error,
      drivers: f1Data.drivers.length,
      timings: f1Data.driverTimings.length,
      session: f1Data.session?.session_name || 'None',
      isLive: f1Data.isLive,
      isHealthy: f1Data.isHealthy,
      lastUpdate: f1Data.lastUpdate?.toISOString() || 'Never',
      hasSession: !!f1Data.session,
      hasDrivers: f1Data.drivers.length > 0
    },
    websocket: {
      status: websocket.status,
      isConnected: websocket.isConnected,
      error: websocket.error
    }
  } : null;

  // More detailed logging for debugging
  useEffect(() => {
    if (showDebug && debugInfo) {
      console.log('[App] Current state analysis:', {
        shouldShowError: !!f1Data.error,
        shouldShowLoading: f1Data.loading,
        shouldShowNoData: !f1Data.loading && !f1Data.error && f1Data.drivers.length === 0,
        shouldShowDashboard: !f1Data.error && !f1Data.loading && f1Data.drivers.length > 0,
        actualConditions: {
          hasError: !!f1Data.error,
          isLoading: f1Data.loading,
          hasDrivers: f1Data.drivers.length > 0,
          hasSession: !!f1Data.session
        }
      });
    }
  }, [f1Data.loading, f1Data.error, f1Data.drivers.length, f1Data.session, showDebug, debugInfo]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            🏎️ F1 Live Dashboard
          </h1>
          
          <div className="header-info">
            <div className="session-selector-container">
              <SessionSelector
                currentSession={f1Data.session}
                onSessionSelect={handleSessionSelect}
                isOpen={showSessionSelector}
                onToggle={() => setShowSessionSelector(!showSessionSelector)}
              />
            </div>
            
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
              <div className={`status-indicator ${connectionStatus.status}`}>
                <span className="status-dot"></span>
                <span className="status-text">{connectionStatus.text}</span>
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
        {/* Add explicit condition checking with logging */}
        {(() => {
          const hasError = !!f1Data.error;
          const isLoading = f1Data.loading;
          const hasDrivers = f1Data.drivers.length > 0;
          const hasSession = !!f1Data.session;
          
          if (showDebug) {
            console.log('[App] Render decision:', { hasError, isLoading, hasDrivers, hasSession });
          }
          
          if (hasError) {
            return (
              <div className="error-container">
                <div className="error-message">
                  <h2>⚠️ Connection Error</h2>
                  <p>{f1Data.error}</p>
                  
                  <div className="error-actions">
                    <button 
                      className="retry-button"
                      onClick={() => {
                        console.log('[App] Manual retry triggered');
                        f1Data.refresh();
                      }}
                    >
                      Retry Connection
                    </button>
                  </div>

                  {showDebug && debugInfo && (
                    <div className="debug-info">
                      <h3>Debug Information</h3>
                      <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          if (isLoading) {
            return (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <h2>Loading F1 Data...</h2>
                <p>
                  {!f1Data.isHealthy ? 'Connecting to backend...' : 
                   !hasSession ? 'Finding current session...' : 
                   'Loading live timing data...'}
                </p>
                
                {showDebug && debugInfo && (
                  <div className="loading-debug">
                    <p><strong>Backend Health:</strong> {f1Data.isHealthy ? 'OK' : 'Checking...'}</p>
                    <p><strong>Session:</strong> {debugInfo.f1Data.session}</p>
                    <p><strong>Drivers:</strong> {debugInfo.f1Data.drivers}</p>
                    <p><strong>WebSocket:</strong> {debugInfo.websocket.status}</p>
                    <p><strong>Loading State:</strong> {isLoading ? 'TRUE' : 'FALSE'}</p>
                  </div>
                )}
              </div>
            );
          }
          
          if (!hasDrivers && hasSession) {
            return (
              <div className="error-container">
                <div className="error-message">
                  <h2>📊 No Data Available</h2>
                  <p>
                    Session found: <strong>{f1Data.session?.session_name}</strong> at <strong>{f1Data.session?.circuit_short_name}</strong>
                    <br />
                    But no driver data is available for this session.
                  </p>
                  
                  <div className="error-actions">
                    <button 
                      className="retry-button"
                      onClick={() => f1Data.refresh()}
                    >
                      Retry Loading
                    </button>
                  </div>
                  
                  {showDebug && debugInfo && (
                    <div className="debug-info">
                      <h3>Session Information</h3>
                      <pre>{JSON.stringify(f1Data.session, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          // If we have data, show the dashboard
          if (hasSession && hasDrivers) {
            return (
              <>
                <Dashboard 
                  f1Data={f1Data}
                  websocketStatus={websocket.status}
                  isLive={f1Data.isLive}
                />
                
                {/* Development debug panel */}
                {showDebug && debugInfo && (
                  <div className="debug-panel">
                    <h3>🔧 Debug Panel</h3>
                    <div className="debug-grid">
                      <div>
                        <strong>F1 Data:</strong>
                        <ul>
                          <li>Healthy: {debugInfo.f1Data.isHealthy ? 'Yes' : 'No'}</li>
                          <li>Loading: {debugInfo.f1Data.loading ? 'Yes' : 'No'}</li>
                          <li>Drivers: {debugInfo.f1Data.drivers}</li>
                          <li>Timings: {debugInfo.f1Data.timings}</li>
                          <li>Live: {debugInfo.f1Data.isLive ? 'Yes' : 'No'}</li>
                          <li>Last Update: {debugInfo.f1Data.lastUpdate.split('T')[1]?.split('.')[0] || 'Never'}</li>
                        </ul>
                      </div>
                      <div>
                        <strong>WebSocket:</strong>
                        <ul>
                          <li>Status: {debugInfo.websocket.status}</li>
                          <li>Connected: {debugInfo.websocket.isConnected ? 'Yes' : 'No'}</li>
                          <li>Error: {debugInfo.websocket.error || 'None'}</li>
                        </ul>
                        <button 
                          onClick={() => {
                            console.log('Full debug info:', debugInfo);
                            alert('Debug info logged to console (F12)');
                          }}
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.7rem',
                            background: 'rgba(255,0,0,0.2)',
                            border: '1px solid rgba(255,0,0,0.4)',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Log to Console
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Advanced Debug Component - Remove when working */}
                <DebugInfo f1Data={f1Data} websocket={websocket} />
              </>
            );
          }
          
          // Fallback - shouldn't reach here
          return (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <h2>Unexpected State</h2>
              <p>Please check the console for debugging information</p>
              {showDebug && (
                <div style={{ marginTop: '1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  <p>Debug: hasError={hasError ? 'true' : 'false'}, isLoading={isLoading ? 'true' : 'false'}, hasDrivers={hasDrivers ? 'true' : 'false'}, hasSession={hasSession ? 'true' : 'false'}</p>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>
            Data provided by <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1 API</a>
          </p>
          <p className="disclaimer">
            Unofficial F1 Dashboard - Not affiliated with Formula 1
          </p>
          {showDebug && (
            <p style={{ fontSize: '0.7rem', color: '#666' }}>
              Development Mode - Debug panel active
            </p>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;