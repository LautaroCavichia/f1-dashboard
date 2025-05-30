"""
F1 Dashboard Backend - FastAPI Server
Real-time F1 telemetry data aggregation and WebSocket streaming
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
import uvicorn

from src.services.f1_service import F1Service
from src.websocket.websocket_handler import WebSocketManager
from src.models.f1_models import SessionResponse, DriverResponse, LiveTimingResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="F1 Dashboard API",
    description="Real-time Formula 1 telemetry data aggregation service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
f1_service = F1Service()
websocket_manager = WebSocketManager()

# Global task for data streaming
streaming_task: Optional[asyncio.Task] = None

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting F1 Dashboard API...")
    await f1_service.initialize()
    
    # Start background data streaming
    global streaming_task
    streaming_task = asyncio.create_task(data_streaming_loop())
    
    logger.info("F1 Dashboard API started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down F1 Dashboard API...")
    
    # Cancel streaming task
    if streaming_task:
        streaming_task.cancel()
        try:
            await streaming_task
        except asyncio.CancelledError:
            pass
    
    await websocket_manager.disconnect_all()
    logger.info("F1 Dashboard API shutdown complete")

async def data_streaming_loop():
    """Background task for streaming live data to WebSocket clients with rate limiting"""
    while True:
        try:
            if websocket_manager.has_connections():
                # Get current session
                session = await f1_service.get_current_session()
                if session:
                    session_key = session.get('session_key')
                    
                    # Fetch data with staggered requests to avoid rate limiting
                    try:
                        # Only fetch essential data for streaming
                        positions = await f1_service.get_positions(session_key)
                        await asyncio.sleep(1)  # Stagger requests
                        
                        intervals = await f1_service.get_intervals(session_key)
                        await asyncio.sleep(1)
                        
                        locations = await f1_service.get_locations(session_key)
                        
                        # Broadcast updates only if we have data
                        if positions:
                            await websocket_manager.broadcast({
                                "type": "POSITION",
                                "data": positions,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        if intervals:
                            await websocket_manager.broadcast({
                                "type": "INTERVAL",
                                "data": intervals,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        if locations:
                            await websocket_manager.broadcast({
                                "type": "LOCATION",
                                "data": locations,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                    
                    except Exception as api_error:
                        logger.warning(f"API error in streaming loop: {api_error}")
                        # Continue the loop even if API calls fail
            
            # Increased wait time to reduce API pressure
            await asyncio.sleep(10)  # 10-second intervals instead of 3
            
        except Exception as e:
            logger.error(f"Error in data streaming loop: {e}")
            await asyncio.sleep(15)  # Wait longer on error

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_key: Optional[str] = None):
    """WebSocket endpoint for real-time data streaming"""
    await websocket_manager.connect(websocket)
    
    try:
        # Send initial session data
        if session_key:
            session = await f1_service.get_session_by_key(session_key)
        else:
            session = await f1_service.get_current_session()
        
        if session:
            await websocket.send_json({
                "type": "SESSION_INFO",
                "data": session,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for client messages
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle subscription requests
                if message.get("type") == "SUBSCRIBE":
                    logger.info(f"Client subscribed to: {message.get('data', {}).get('dataTypes', [])}")
                elif message.get("type") == "UNSUBSCRIBE":
                    logger.info(f"Client unsubscribed from: {message.get('data', {}).get('dataTypes', [])}")
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket message error: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        websocket_manager.disconnect(websocket)

# API Routes
@app.get("/")
async def root():
    """API health check"""
    return {
        "message": "F1 Dashboard API",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        # Test OpenF1 API connection
        session = await f1_service.get_current_session()
        api_status = "healthy" if session else "degraded"
    except Exception as e:
        api_status = "unhealthy"
        logger.error(f"Health check failed: {e}")
    
    return {
        "status": "healthy",
        "api_connection": api_status,
        "websocket_connections": websocket_manager.connection_count(),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/sessions/current", response_model=SessionResponse)
async def get_current_session():
    """Get current F1 session information"""
    try:
        session = await f1_service.get_current_session()
        if not session:
            raise HTTPException(status_code=404, detail="No current session found")
        return SessionResponse(**session)
    except Exception as e:
        logger.error(f"Error getting current session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sessions/{session_key}")
async def get_session(session_key: str):
    """Get specific session information"""
    try:
        session = await f1_service.get_session_by_key(session_key)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    except Exception as e:
        logger.error(f"Error getting session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/drivers/{session_key}")
async def get_drivers(session_key: str):
    """Get drivers for a specific session"""
    try:
        drivers = await f1_service.get_drivers(session_key)
        return {"drivers": drivers}
    except Exception as e:
        logger.error(f"Error getting drivers for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/live-timing/{session_key}")
async def get_live_timing(session_key: str):
    """Get comprehensive live timing data"""
    try:
        timing_data = await f1_service.get_live_timing_data(session_key)
        return timing_data
    except Exception as e:
        logger.error(f"Error getting live timing for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/telemetry/{session_key}")
async def get_telemetry(session_key: str, driver_number: Optional[int] = None):
    """Get telemetry data for session"""
    try:
        car_data = await f1_service.get_car_data(session_key, driver_number)
        return {"telemetry": car_data}
    except Exception as e:
        logger.error(f"Error getting telemetry for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/positions/{session_key}")
async def get_positions(session_key: str):
    """Get current driver positions"""
    try:
        positions = await f1_service.get_positions(session_key)
        return {"positions": positions}
    except Exception as e:
        logger.error(f"Error getting positions for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/locations/{session_key}")
async def get_locations(session_key: str):
    """Get car locations on track"""
    try:
        locations = await f1_service.get_locations(session_key)
        return {"locations": locations}
    except Exception as e:
        logger.error(f"Error getting locations for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/circuit/{session_key}")
async def get_circuit_data(session_key: str):
    """Get circuit track data for visualization"""
    try:
        circuit_data = await f1_service.get_circuit_data(session_key)
        return circuit_data
    except Exception as e:
        logger.error(f"Error getting circuit data for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pit-stops/{session_key}")
async def get_pit_stops(session_key: str):
    """Get pit stop information"""
    try:
        pit_data = await f1_service.get_pit_data(session_key)
        stints = await f1_service.get_stints(session_key)
        return {
            "pit_stops": pit_data,
            "stints": stints
        }
    except Exception as e:
        logger.error(f"Error getting pit stops for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/weather/{session_key}")
async def get_weather(session_key: str):
    """Get weather information"""
    try:
        weather = await f1_service.get_weather(session_key)
        return {"weather": weather}
    except Exception as e:
        logger.error(f"Error getting weather for session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )