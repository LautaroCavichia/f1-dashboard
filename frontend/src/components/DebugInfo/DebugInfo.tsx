import React, { useState, useEffect } from 'react';
import { f1Api } from '../../services/f1Api';

interface DebugInfoProps {
  f1Data: any;
  websocket: any;
}

const DebugInfo: React.FC<DebugInfoProps> = ({ f1Data, websocket }) => {
  const [backendTest, setBackendTest] = useState<any>(null);
  const [apiCache, setApiCache] = useState<any>(null);

  const testBackendDirectly = async () => {
    try {
      console.log('[Debug] Testing backend directly...');
      
      // Test health endpoint directly
      const healthResponse = await fetch('http://localhost:8000/health');
      const healthData = await healthResponse.json();
      
      // Test current session endpoint directly
      const sessionResponse = await fetch('http://localhost:8000/api/sessions/current-or-latest');
      const sessionData = await sessionResponse.json();
      
      // Test live timing endpoint directly
      const timingResponse = await fetch('http://localhost:8000/api/live-timing/latest');
      const timingData = await timingResponse.json();
      
      setBackendTest({
        health: healthData,
        session: sessionData,
        timing: timingData,
        timestamp: new Date().toISOString()
      });
      
      console.log('[Debug] Backend test results:', {
        health: healthData,
        session: sessionData,
        timing: timingData
      });
      
    } catch (error) {
      console.error('[Debug] Backend test failed:', error);
      setBackendTest({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const getCacheStats = () => {
    const stats = f1Api.getCacheStats();
    setApiCache(stats);
  };

  useEffect(() => {
    // Run initial test
    testBackendDirectly();
    getCacheStats();
    
    // Update cache stats every 5 seconds
    const interval = setInterval(getCacheStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      right: '20px',
      width: '400px',
      maxHeight: '80vh',
      overflow: 'auto',
      background: 'rgba(0, 0, 0, 0.95)',
      border: '2px solid #ff0000',
      borderRadius: '8px',
      padding: '1rem',
      color: '#fff',
      fontSize: '0.8rem',
      fontFamily: 'monospace',
      zIndex: 1000
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#ff0000' }}>🔧 Debug Panel</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={testBackendDirectly}
          style={{
            padding: '0.5rem 1rem',
            background: '#ff0000',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '0.5rem'
          }}
        >
          Test Backend
        </button>
        <button 
          onClick={() => f1Data.refresh()}
          style={{
            padding: '0.5rem 1rem',
            background: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Data
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffaa00' }}>F1 Data Hook:</h4>
        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
          <div>Loading: {f1Data.loading ? 'YES' : 'NO'}</div>
          <div>Error: {f1Data.error || 'None'}</div>
          <div>Healthy: {f1Data.isHealthy ? 'YES' : 'NO'}</div>
          <div>Session: {f1Data.session?.session_name || 'None'}</div>
          <div>Drivers: {f1Data.drivers.length}</div>
          <div>Timings: {f1Data.driverTimings.length}</div>
          <div>Is Live: {f1Data.isLive ? 'YES' : 'NO'}</div>
          <div>Last Update: {f1Data.lastUpdate?.toLocaleTimeString() || 'Never'}</div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffaa00' }}>WebSocket:</h4>
        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
          <div>Status: {websocket.status}</div>
          <div>Connected: {websocket.isConnected ? 'YES' : 'NO'}</div>
          <div>Error: {websocket.error || 'None'}</div>
          <div>Last Message: {websocket.lastMessage?.type || 'None'}</div>
        </div>
      </div>

      {apiCache && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffaa00' }}>API Cache:</h4>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
            <div>Total Entries: {apiCache.totalEntries}</div>
            <div>Valid Entries: {apiCache.validEntries}</div>
            <div>Active Requests: {apiCache.activeRequests}</div>
          </div>
        </div>
      )}

      {backendTest && (
        <div>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffaa00' }}>Direct Backend Test:</h4>
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '0.5rem', 
            borderRadius: '4px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            {backendTest.error ? (
              <div style={{ color: '#ff6b6b' }}>ERROR: {backendTest.error}</div>
            ) : (
              <>
                <div><strong>Health:</strong> {backendTest.health?.status}</div>
                <div><strong>Session Found:</strong> {backendTest.session?.session?.session_name || 'None'}</div>
                <div><strong>Session Key:</strong> {backendTest.session?.session?.session_key || 'None'}</div>
                <div><strong>Is Live:</strong> {backendTest.session?.is_live ? 'YES' : 'NO'}</div>
                <div><strong>Driver Timings:</strong> {backendTest.timing?.driverTimings?.length || 0}</div>
                <div><strong>Timing Error:</strong> {backendTest.timing?.error || 'None'}</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#ccc' }}>
                  Updated: {backendTest.timestamp}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugInfo;