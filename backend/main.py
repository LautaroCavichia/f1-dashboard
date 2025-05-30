"""
Fixed F1 Dashboard Backend - Simplified and robust
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from datetime import datetime
from typing import Optional
import uvicorn

from src.services.f1_service import F1Service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="F1 Dashboard API",
    description="Formula 1 Live Data API",
    version="2.0.0"
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

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🏎️  Starting F1 Dashboard API...")
    await f1_service.initialize()
    logger.info("✅ F1 Dashboard API started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down F1 Dashboard API...")
    await f1_service.close()
    logger.info("✅ F1 Dashboard API shutdown complete")

@app.get("/")
async def root():
    """API health check"""
    health = f1_service.get_health_status()
    return {
        "message": "F1 Dashboard API v2.0",
        "status": "healthy" if health['is_healthy'] else "degraded",
        "health": health,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    health = f1_service.get_health_status()
    
    # Test API connection
    try:
        session = await f1_service.get_current_session()
        api_status = "healthy" if session else "no_session"
    except Exception:
        api_status = "unhealthy"
    
    return {
        "status": "healthy" if health['is_healthy'] else "degraded",
        "api_connection": api_status,
        "service_health": health,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/sessions/current-or-latest")
async def get_current_or_latest_session():
    """Get current live session or fallback to latest completed session"""
    try:
        session = await f1_service.get_current_session()
        
        if not session:
            return {
                "session": None,
                "message": "No F1 sessions available",
                "is_live": False
            }
        
        # Check if session is live - fix timezone comparison
        from datetime import timezone
        now = datetime.now(timezone.utc)
        
        # Parse dates and ensure they have timezone info
        start_str = session['date_start']
        end_str = session['date_end']
        
        # Handle different date formats from API
        if start_str.endswith('Z'):
            start_time = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
        elif '+' in start_str or start_str.endswith('00'):
            start_time = datetime.fromisoformat(start_str)
        else:
            start_time = datetime.fromisoformat(start_str + '+00:00')
            
        if end_str.endswith('Z'):
            end_time = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
        elif '+' in end_str or end_str.endswith('00'):
            end_time = datetime.fromisoformat(end_str)
        else:
            end_time = datetime.fromisoformat(end_str + '+00:00')
        
        is_live = start_time <= now <= end_time
        is_upcoming = start_time > now
        is_completed = end_time < now
        
        if is_live:
            message = "Current live session"
        elif is_upcoming:
            message = "Next upcoming session"
        else:
            message = "Latest completed session"
        
        return {
            "session": session,
            "message": message,
            "is_live": is_live,
            "is_upcoming": is_upcoming,
            "is_completed": is_completed
        }
        
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        return {
            "session": None,
            "message": f"Error retrieving session: {str(e)}",
            "is_live": False
        }

@app.get("/api/sessions/{session_key}")
async def get_session_by_key(session_key: str):
    """Get specific session by key"""
    try:
        if session_key == "latest" or session_key == "current":
            return await get_current_or_latest_session()
        
        # For specific session keys, we'll need to implement this
        # For now, fallback to current session
        session = await f1_service.get_current_session()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return session
        
    except Exception as e:
        logger.error(f"Error getting session {session_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/drivers/{session_key}")
async def get_drivers(session_key: str):
    """Get drivers for a session"""
    try:
        # Handle 'latest' session key
        if session_key == "latest":
            session = await f1_service.get_current_session()
            if not session:
                return {"drivers": []}
            session_key = str(session['session_key'])
        
        drivers = await f1_service.get_drivers(session_key)
        return {"drivers": drivers}
        
    except Exception as e:
        logger.error(f"Error getting drivers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/live-timing/{session_key}")
async def get_live_timing(session_key: str):
    """Get comprehensive live timing data"""
    try:
        # Handle 'latest' session key
        if session_key == "latest":
            session = await f1_service.get_current_session()
            if not session:
                return {
                    "driverTimings": [],
                    "error": "No current session available"
                }
            session_key = str(session['session_key'])
        
        timing_data = await f1_service.get_comprehensive_timing_data(session_key)
        return timing_data
        
    except Exception as e:
        logger.error(f"Error getting live timing: {e}")
        return {
            "driverTimings": [],
            "error": str(e)
        }

@app.get("/api/positions/{session_key}")
async def get_positions(session_key: str):
    """Get current positions"""
    try:
        if session_key == "latest":
            session = await f1_service.get_current_session()
            if not session:
                return {"positions": []}
            session_key = str(session['session_key'])
        
        positions = await f1_service.get_positions(session_key)
        return {"positions": positions}
        
    except Exception as e:
        logger.error(f"Error getting positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/locations/{session_key}")
async def get_locations(session_key: str):
    """Get car locations"""
    try:
        if session_key == "latest":
            session = await f1_service.get_current_session()
            if not session:
                return {"locations": []}
            session_key = str(session['session_key'])
        
        locations = await f1_service.get_locations(session_key)
        return {"locations": locations}
        
    except Exception as e:
        logger.error(f"Error getting locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/telemetry/{session_key}")
async def get_telemetry(session_key: str, driver_number: Optional[int] = None):
    """Get telemetry data"""
    try:
        if session_key == "latest":
            session = await f1_service.get_current_session()
            if not session:
                return {"telemetry": []}
            session_key = str(session['session_key'])
        
        car_data = await f1_service.get_car_data(session_key, driver_number)
        return {"telemetry": car_data}
        
    except Exception as e:
        logger.error(f"Error getting telemetry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pit-stops/{session_key}")
async def get_pit_stops(session_key: str):
    """Get pit stop data"""
    try:
        if session_key == "latest":
            session = await f1_service.get_current_session()
            if not session:
                return {"pit_stops": [], "stints": []}
            session_key = str(session['session_key'])
        
        pit_data = await f1_service.get_pit_data(session_key)
        stints = await f1_service.get_stints(session_key)
        
        return {
            "pit_stops": pit_data,
            "stints": stints
        }
        
    except Exception as e:
        logger.error(f"Error getting pit stops: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/circuit/{session_key}")
async def get_circuit_data(session_key: str):
    """Get circuit visualization data"""
    try:
        if session_key == "latest":
            session = await f1_service.get_current_session()
            if not session:
                return {"trackPoints": [], "bounds": None}
            session_key = str(session['session_key'])
        
        locations = await f1_service.get_locations(session_key)
        
        # Process locations into track points
        track_points = []
        seen_points = set()
        
        for location in locations:
            x, y = location.get('x'), location.get('y')
            if x is not None and y is not None:
                point = (round(x, 1), round(y, 1))  # Round to reduce duplicates
                if point not in seen_points:
                    track_points.append({'x': x, 'y': y})
                    seen_points.add(point)
        
        # Calculate bounds
        bounds = None
        if track_points:
            x_coords = [p['x'] for p in track_points]
            y_coords = [p['y'] for p in track_points]
            bounds = {
                'minX': min(x_coords),
                'maxX': max(x_coords),
                'minY': min(y_coords),
                'maxY': max(y_coords)
            }
        
        return {
            "trackPoints": track_points,
            "bounds": bounds,
            "pointCount": len(track_points)
        }
        
    except Exception as e:
        logger.error(f"Error getting circuit data: {e}")
        return {
            "trackPoints": [],
            "bounds": None,
            "error": str(e)
        }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )