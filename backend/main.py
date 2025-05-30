"""
F1 Dashboard Backend - FastAPI Server with improved rate limiting
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
    
    # Start background data streaming with reduced frequency
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
    await f1_service.close()
    logger.info("F1 Dashboard API shutdown complete")

async def data_streaming_loop():
    """Background task for streaming live data with aggressive rate limiting"""
    while True:
        try:
            if websocket_manager.has_connections():
                # Get current session
                session = await f1_service.get_current_session()
                if session:
                    session_key = session.get('session_key')
                    
                    # Check service health before making requests
                    health = f1_service.get_health_status()
                    if health['rate_limited']:
                        logger.info("Service is rate limited, skipping this cycle")
                        await asyncio.sleep(60)  # Wait longer when rate limited
                        continue
                    
                    if health['consecutive_failures'] > 5:
                        logger.warning(f"Too many failures ({health['consecutive_failures']}), reducing frequency")
                        await asyncio.sleep(120)  # Wait 2 minutes after many failures
                        continue
                    
                    try:
                        # Only fetch the most essential data with long delays
                        logger.info("Fetching positions...")
                        positions = await f1_service.get_positions(session_key)
                        
                        if positions:
                            await websocket_manager.broadcast({
                                "type": "POSITION",
                                "data": positions,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # Wait between requests to avoid rate limiting
                        await asyncio.sleep(2)
                        
                        logger.info("Fetching intervals...")
                        intervals = await f1_service.get_intervals(session_key)
                        
                        if intervals:
                            await websocket_manager.broadcast({
                                "type": "INTERVAL",
                                "data": intervals,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # Only fetch locations occasionally to avoid rate limits
                        await asyncio.sleep(2)
                        
                        logger.info("Fetching locations...")
                        locations = await f1_service.get_locations(session_key)
                        
                        if locations:
                            await websocket_manager.broadcast({
                                "type": "LOCATION",
                                "data": locations,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                    
                    except Exception as api_error:
                        logger.warning(f"API error in streaming loop: {api_error}")
                        # Don't continue immediately, wait longer on errors
                        await asyncio.sleep(30)
                        continue
            
            # Much longer wait time to reduce API pressure - 30 seconds between cycles
            logger.info("Waiting 30 seconds before next data fetch...")
            await asyncio.sleep(30)
            
        except Exception as e:
            logger.error(f"Error in data streaming loop: {e}")
            await asyncio.sleep(60)  # Wait longer on error

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
        else:
            # Send a message indicating no session is available
            await websocket.send_json({
                "type": "NO_SESSION",
                "data": {"message": "No active F1 session available"},
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for client messages with a timeout
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                
                # Handle subscription requests
                if message.get("type") == "SUBSCRIBE":
                    logger.info(f"Client subscribed to: {message.get('data', {}).get('dataTypes', [])}")
                elif message.get("type") == "UNSUBSCRIBE":
                    logger.info(f"Client unsubscribed from: {message.get('data', {}).get('dataTypes', [])}")
                elif message.get("type") == "PING":
                    # Respond to ping
                    await websocket.send_json({
                        "type": "PONG",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({
                    "type": "HEARTBEAT",
                    "timestamp": datetime.utcnow().isoformat()
                })
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
    health = f1_service.get_health_status()
    return {
        "message": "F1 Dashboard API",
        "version": "1.0.0",
        "status": "running",
        "health": health,
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
    
    service_health = f1_service.get_health_status()
    
    return {
        "status": "healthy",
        "api_connection": api_status,
        "websocket_connections": websocket_manager.connection_count(),
        "service_health": service_health,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/sessions/current")
async def get_current_session():
    """Get current F1 session information"""
    try:
        session = await f1_service.get_current_session()
        if not session:
            # Instead of 404, return a message about no current session
            return {
                "message": "No current F1 session available",
                "session": None,
                "timestamp": datetime.utcnow().isoformat()
            }
        return session
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