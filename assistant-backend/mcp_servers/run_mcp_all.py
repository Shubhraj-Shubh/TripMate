# assistant-backend/mcp_servers/run_mcp_all.py
"""
Standalone Cloud Runner for TripMate FastMCP Microservices.
Can be deployed as independent microservices or started locally for FastMCP tool inspection.
"""
import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tools.trip_tools import trip_mcp
from tools.friend_tools import friend_mcp
from tools.planner_tools import planner_mcp

if __name__ == "__main__":
    server_name = sys.argv[1] if len(sys.argv) > 1 else "trip"
    print(f"🚀 Starting TripMate FastMCP Server: {server_name}...")
    
    if server_name == "trip":
        trip_mcp.run()
    elif server_name == "friend":
        friend_mcp.run()
    elif server_name == "planner":
        planner_mcp.run()
    else:
        print(f"Unknown server '{server_name}'. Available: trip, friend, planner")
