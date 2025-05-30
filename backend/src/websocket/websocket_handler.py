"""
WebSocket Handler - Manages real-time connections and data broadcasting
"""

import json
import logging
from typing import List, Dict, Any
from fastapi import WebSocket
import asyncio

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_data: Dict[WebSocket, Dict] = {}

    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_data[websocket] = {
            'connected_at': asyncio.get_event_loop().time(),
            'subscriptions': []
        }
        logger.info(f"WebSocket connection established. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_data:
            del self.connection_data[websocket]
        logger.info(f"WebSocket connection closed. Total connections: {len(self.active_connections)}")

    async def disconnect_all(self):
        """Disconnect all WebSocket connections"""
        for websocket in self.active_connections.copy():
            try:
                await websocket.close()
            except Exception as e:
                logger.error(f"Error closing WebSocket: {e}")
            self.disconnect(websocket)

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send message to specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return

        # Create list of tasks for concurrent sending
        tasks = []
        for websocket in self.active_connections.copy():
            tasks.append(self._send_safe(websocket, message))

        # Execute all sends concurrently
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_safe(self, websocket: WebSocket, message: Dict[str, Any]):
        """Safely send message to WebSocket, handle disconnections"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error broadcasting to WebSocket: {e}")
            self.disconnect(websocket)

    async def broadcast_to_subscribed(self, message: Dict[str, Any], data_type: str):
        """Broadcast message only to clients subscribed to specific data type"""
        if not self.active_connections:
            return

        tasks = []
        for websocket in self.active_connections.copy():
            connection_info = self.connection_data.get(websocket, {})
            subscriptions = connection_info.get('subscriptions', [])
            
            if data_type in subscriptions or not subscriptions:  # Send to all if no specific subscriptions
                tasks.append(self._send_safe(websocket, message))

        await asyncio.gather(*tasks, return_exceptions=True)

    def has_connections(self) -> bool:
        """Check if there are active connections"""
        return len(self.active_connections) > 0

    def connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)

    def update_subscription(self, websocket: WebSocket, data_types: List[str], action: str = "subscribe"):
        """Update client subscriptions"""
        if websocket not in self.connection_data:
            return

        connection_info = self.connection_data[websocket]
        current_subscriptions = set(connection_info.get('subscriptions', []))

        if action == "subscribe":
            current_subscriptions.update(data_types)
        elif action == "unsubscribe":
            current_subscriptions.difference_update(data_types)

        connection_info['subscriptions'] = list(current_subscriptions)
        logger.info(f"Updated subscriptions for WebSocket: {connection_info['subscriptions']}")

    async def send_connection_stats(self):
        """Send connection statistics to all clients"""
        stats = {
            "type": "CONNECTION_STATS",
            "data": {
                "total_connections": self.connection_count(),
                "timestamp": asyncio.get_event_loop().time()
            }
        }
        await self.broadcast(stats)