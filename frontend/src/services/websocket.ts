import { API_CONFIG } from '../utils/constants';
import { WebSocketMessage } from '../types/f1';

type WebSocketListener = (message: WebSocketMessage) => void;
type ConnectionStatusListener = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: WebSocketListener[] = [];
  private statusListeners: ConnectionStatusListener[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Reduced max attempts
  private reconnectDelay = 5000; // 5 seconds
  private isManuallyDisconnected = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(sessionKey?: string): void {
    // Don't connect if already connected or if we've exceeded max attempts
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached');
      this.notifyStatusListeners('error');
      return;
    }

    this.isManuallyDisconnected = false;
    this.notifyStatusListeners('connecting');

    // Clear any existing timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        console.warn('[WebSocket] Connection timeout');
        this.ws?.close();
        this.handleConnectionFailure();
      }
    }, 10000); // 10 second timeout

    try {
      // For now, let's skip WebSocket and just simulate connection
      // This removes a major source of errors while we get the core functionality working
      console.log('[WebSocket] Simulating WebSocket connection (disabled for debugging)');
      
      // Simulate successful connection after short delay
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.notifyStatusListeners('connected');
        
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        // Send a fake heartbeat every 30 seconds
        this.startSimulatedHeartbeat();
      }, 1000);

      /* 
      // Real WebSocket code - commented out for debugging
      const wsUrl = sessionKey 
        ? `${API_CONFIG.WEBSOCKET_URL}?session_key=${sessionKey}`
        : API_CONFIG.WEBSOCKET_URL;

      console.log('[WebSocket] Attempting connection to:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();
      */
      
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      this.handleConnectionFailure();
    }
  }

  /**
   * Simulated heartbeat for testing (remove when WebSocket is working)
   */
  private startSimulatedHeartbeat(): void {
    setInterval(() => {
      if (!this.isManuallyDisconnected) {
        const heartbeatMessage: WebSocketMessage = {
          type: 'HEARTBEAT',
          timestamp: new Date().toISOString()
        };
        this.notifyListeners(heartbeatMessage);
      }
    }, 30000);
  }

  /**
   * Handle connection failures
   */
  private handleConnectionFailure(): void {
    this.reconnectAttempts++;
    console.log(`[WebSocket] Connection failure ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached, giving up');
      this.notifyStatusListeners('error');
      return;
    }
    
    this.notifyStatusListeners('disconnected');
    this.scheduleReconnect();
  }

  /**
   * Setup WebSocket event listeners (currently commented out)
   */
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      this.reconnectAttempts = 0;
      this.notifyStatusListeners('connected');
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.notifyListeners(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[WebSocket] Connection closed: ${event.code} - ${event.reason}`);
      this.notifyStatusListeners('disconnected');
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      if (!this.isManuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error occurred:', error);
      this.handleConnectionFailure();
    };
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.isManuallyDisconnected || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WebSocket] Scheduling reconnect in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isManuallyDisconnected) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[WebSocket] Manual disconnect');
    this.isManuallyDisconnected = true;
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.reconnectAttempts = 0;
    this.notifyStatusListeners('disconnected');
  }

  /**
   * Send message (currently no-op since WebSocket is disabled)
   */
  send(message: any): void {
    console.log('[WebSocket] Send message (simulated):', message);
    // Real implementation would send via this.ws.send()
  }

  /**
   * Subscribe to data updates (no-op for now)
   */
  subscribe(dataTypes: string[]): void {
    console.log('[WebSocket] Subscribe (simulated):', dataTypes);
  }

  /**
   * Unsubscribe from data updates (no-op for now)
   */
  unsubscribe(dataTypes: string[]): void {
    console.log('[WebSocket] Unsubscribe (simulated):', dataTypes);
  }

  /**
   * Add message listener
   */
  addListener(listener: WebSocketListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove message listener
   */
  removeListener(listener: WebSocketListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Add connection status listener
   */
  addStatusListener(listener: ConnectionStatusListener): void {
    this.statusListeners.push(listener);
  }

  /**
   * Remove connection status listener
   */
  removeStatusListener(listener: ConnectionStatusListener): void {
    this.statusListeners = this.statusListeners.filter(l => l !== listener);
  }

  /**
   * Notify all message listeners
   */
  private notifyListeners(message: WebSocketMessage): void {
    this.listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[WebSocket] Error in listener:', error);
      }
    });
  }

  /**
   * Notify all status listeners
   */
  private notifyStatusListeners(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[WebSocket] Error in status listener:', error);
      }
    });
  }

  /**
   * Get current connection state
   */
  getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (this.isManuallyDisconnected) return 'disconnected';
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return 'error';
    
    // Since we're simulating for now, return connected if not manually disconnected
    return 'connected';
    
    /* Real implementation:
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return this.reconnectAttempts >= this.maxReconnectAttempts ? 'error' : 'disconnected';
      default:
        return 'error';
    }
    */
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return !this.isManuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts;
    // Real implementation: return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Force reconnection
   */
  forceReconnect(): void {
    console.log('[WebSocket] Force reconnect requested');
    this.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  /**
   * Reset connection state
   */
  resetConnectionState(): void {
    console.log('[WebSocket] Resetting connection state');
    this.reconnectAttempts = 0;
    this.isManuallyDisconnected = false;
  }
}

export const websocketService = new WebSocketService();