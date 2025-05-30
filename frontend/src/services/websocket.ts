import { API_CONFIG, UPDATE_INTERVALS } from '../utils/constants';
import { WebSocketMessage } from '../types/f1';

type WebSocketListener = (message: WebSocketMessage) => void;
type ConnectionStatusListener = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: WebSocketListener[] = [];
  private statusListeners: ConnectionStatusListener[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = UPDATE_INTERVALS.RETRY_CONNECTION;
  private isManuallyDisconnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;

  /**
   * Connect to WebSocket server with improved error handling
   */
  connect(sessionKey?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isManuallyDisconnected = false;
    this.notifyStatusListeners('connecting');

    // Clear any existing connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        console.warn('WebSocket connection timeout');
        this.ws?.close();
        this.scheduleReconnect();
      }
    }, 15000);

    const wsUrl = sessionKey 
      ? `${API_CONFIG.WEBSOCKET_URL}?session_key=${sessionKey}`
      : API_CONFIG.WEBSOCKET_URL;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.notifyStatusListeners('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event listeners with improved error handling
   */
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected successfully');
      this.reconnectAttempts = 0;
      this.notifyStatusListeners('connected');
      
      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      // Start heartbeat
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Handle ping messages
        if (message.type === 'PING') {
          this.sendPong();
          return;
        }
        
        this.notifyListeners(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
      this.notifyStatusListeners('disconnected');
      
      // Clear heartbeat
      this.stopHeartbeat();
      
      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      // Handle different close codes
      if (event.code === 1001) {
        // Going away - normal close, but may want to reconnect
        console.log('WebSocket closed normally (going away)');
      } else if (event.code === 1006) {
        // Abnormal closure
        console.warn('WebSocket closed abnormally');
      }
      
      if (!this.isManuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.notifyStatusListeners('error');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyStatusListeners('error');
    };
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'HEARTBEAT',
          timestamp: new Date().toISOString()
        });
      }
    }, UPDATE_INTERVALS.HEARTBEAT);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send pong response to ping
   */
  private sendPong(): void {
    this.send({
      type: 'PONG',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Schedule automatic reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isManuallyDisconnected) return;

    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    const baseDelay = this.reconnectInterval;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
    const jitter = Math.random() * 2000; // Add up to 2 seconds of jitter
    const delay = exponentialDelay + jitter;

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);
    
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
    this.isManuallyDisconnected = true;
    
    // Clear timeouts and intervals
    this.stopHeartbeat();
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
   * Send message to server with error handling
   */
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Subscribe to data updates
   */
  subscribe(dataTypes: string[]): void {
    this.send({
      type: 'SUBSCRIBE',
      data: { dataTypes }
    });
  }

  /**
   * Unsubscribe from data updates
   */
  unsubscribe(dataTypes: string[]): void {
    this.send({
      type: 'UNSUBSCRIBE',
      data: { dataTypes }
    });
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
        console.error('Error in WebSocket listener:', error);
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
        console.error('Error in WebSocket status listener:', error);
      }
    });
  }

  /**
   * Get current connection state
   */
  getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get reconnection attempts count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Force reconnection (useful for manual retry)
   */
  forceReconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.reconnectAttempts = 0; // Reset attempts for manual reconnect
      this.connect();
    }, 1000);
  }
}

export const websocketService = new WebSocketService();