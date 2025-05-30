#!/usr/bin/env python3
"""
Simple test script to verify the F1 Dashboard backend is working
Run this after starting the backend to check all endpoints
"""

import requests
import json
import sys

BACKEND_URL = "http://localhost:8000"

def test_endpoint(endpoint, description):
    """Test a single endpoint and return the result"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        print(f"Testing {description}...")
        print(f"  URL: {url}")
        
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ SUCCESS ({response.status_code})")
            return True, data
        else:
            print(f"  ❌ FAILED ({response.status_code}): {response.text}")
            return False, None
            
    except requests.exceptions.ConnectionError:
        print(f"  ❌ CONNECTION FAILED - Is the backend running on {BACKEND_URL}?")
        return False, None
    except requests.exceptions.Timeout:
        print(f"  ❌ TIMEOUT - Backend took too long to respond")
        return False, None
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        return False, None

def main():
    print("🏎️  F1 Dashboard Backend Test")
    print("=" * 50)
    
    # Test endpoints in order of importance
    tests = [
        ("/", "Root endpoint"),
        ("/health", "Health check"),
        ("/api/sessions/current-or-latest", "Current/Latest session"),
        ("/api/drivers/latest", "Drivers list"),
        ("/api/live-timing/latest", "Live timing data"),
        ("/api/positions/latest", "Driver positions"),
        ("/api/locations/latest", "Car locations"),
        ("/api/pit-stops/latest", "Pit stop data"),
        ("/api/circuit/latest", "Circuit data"),
    ]
    
    results = {}
    
    for endpoint, description in tests:
        success, data = test_endpoint(endpoint, description)
        results[endpoint] = (success, data)
        print()
    
    # Summary
    print("📊 Test Summary")
    print("=" * 50)
    
    successful = sum(1 for success, _ in results.values() if success)
    total = len(results)
    
    print(f"Successful: {successful}/{total}")
    
    if results["/health"][0]:
        health_data = results["/health"][1]
        print(f"Backend Status: {health_data.get('status', 'Unknown')}")
        print(f"API Connection: {health_data.get('api_connection', 'Unknown')}")
    
    if results["/api/sessions/current-or-latest"][0]:
        session_data = results["/api/sessions/current-or-latest"][1]
        session = session_data.get('session')
        if session:
            print(f"Current Session: {session.get('session_name')} at {session.get('circuit_short_name')}")
            print(f"Is Live: {session_data.get('is_live', False)}")
        else:
            print(f"Session Status: {session_data.get('message', 'No session info')}")
    
    if results["/api/drivers/latest"][0]:
        drivers_data = results["/api/drivers/latest"][1]
        driver_count = len(drivers_data.get('drivers', []))
        print(f"Drivers Found: {driver_count}")
    
    if results["/api/live-timing/latest"][0]:
        timing_data = results["/api/live-timing/latest"][1]
        timing_count = len(timing_data.get('driverTimings', []))
        print(f"Driver Timings: {timing_count}")
        if timing_data.get('error'):
            print(f"Timing Error: {timing_data['error']}")
    
    print("\n🔧 Troubleshooting")
    print("=" * 50)
    
    if successful == total:
        print("✅ All tests passed! Backend is working correctly.")
        print("You can now start the frontend with: npm start")
    elif results["/"][0] and results["/health"][0]:
        print("⚠️  Backend is running but some endpoints have issues.")
        print("This might be due to OpenF1 API being unavailable or no current F1 session.")
        print("The frontend should still work with cached/fallback data.")
    else:
        print("❌ Backend has serious issues. Check the following:")
        print("1. Is the backend running? (python main.py)")
        print("2. Is port 8000 available?")
        print("3. Are all dependencies installed? (pip install -r requirements.txt)")
        print("4. Check backend console for error messages")
    
    # Detailed error info
    failed_endpoints = [ep for ep, (success, _) in results.items() if not success]
    if failed_endpoints:
        print(f"\nFailed endpoints: {', '.join(failed_endpoints)}")
    
    return successful == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)