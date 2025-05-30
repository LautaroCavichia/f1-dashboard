import { useState, useEffect, useCallback, useRef } from 'react';
import { websocketService } from '../services/websocket';
import { WebSocketMessage } from '../types/f1';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type MessageHandler = (message: WebSocketMessage) => void;

interface UseWebSocketOptions {
  sessionKey?: string;
  autoConnect?: boolean;
  subscriptions?: string[];
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  send: (message: any) => void;
  subscribe: (dataTypes: string[]) => void;
  unsubscribe: (dataTypes: string[]) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    sessionKey,
    autoConnect = true,
    subscriptions = []
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mountedRef = useRef(true);
  const hasConnectedRef = useRef(false);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (!mountedRef.current) return;
    
    setLastMessage(message);
    setError(null);
  }, []);

  /**
   * Handle connection status changes
   */
  const handleStatusChange = useCallback((newStatus: ConnectionStatus) => {
    if (!mountedRef.current) return;
    
    setStatus(newStatus);
    
    switch (newStatus) {
      case 'connected':
        setError(null);
        // Auto-subscribe to requested data types
        if (subscriptions.length > 0) {
          websocketService.subscribe(subscriptions);
        }
        break;
      case 'error':
        setError('WebSocket connection error');
        break;
      case 'disconnected':
        if (hasConnectedRef.current) {
          setError('Connection lost');
        }
        break;
      default:
        setError(null);
    }
  }, [subscriptions]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    setError(null);
    websocketService.connect(sessionKey);
    hasConnectedRef.current = true;
  }, [sessionKey]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    websocketService.disconnect();
    hasConnectedRef.current = false;
  }, []);

  /**
   * Send message through WebSocket
   */
  const send = useCallback((message: any) => {
    try {
      websocketService.send(message);
    } catch (err) {
      setError('Failed to send message');
      console.error('WebSocket send error:', err);
    }
  }, []);

  /**
   * Subscribe to data types
   */
  const subscribe = useCallback((dataTypes: string[]) => {
    websocketService.subscribe(dataTypes);
  }, []);

  /**
   * Unsubscribe from data types
   */
  const unsubscribe = useCallback((dataTypes: string[]) => {
    websocketService.unsubscribe(dataTypes);
  }, []);

  // Setup WebSocket listeners on mount
  useEffect(() => {
    websocketService.addListener(handleMessage);
    websocketService.addStatusListener(handleStatusChange);

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    return () => {
      websocketService.removeListener(handleMessage);
      websocketService.removeStatusListener(handleStatusChange);
    };
  }, [handleMessage, handleStatusChange, autoConnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (autoConnect) {
        websocketService.disconnect();
      }
    };
  }, [autoConnect]);

  // Update status when sessionKey changes
  useEffect(() => {
    if (status === 'connected' && sessionKey) {
      // Reconnect with new session key
      disconnect();
      setTimeout(() => connect(), 100);
    }
  }, [sessionKey, status, connect, disconnect]);

  return {
    status,
    isConnected: status === 'connected',
    lastMessage,
    error,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe
  };
};