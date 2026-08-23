# assistant-backend/tools/planner_tools.py
import requests
from typing import Any, Dict, List, Optional
from fastmcp import FastMCP
from config import PLANNER_API_BASE

planner_mcp = FastMCP("TripMate-Planner-Server")

def _get_headers(token: str) -> dict:
    clean_token = token.replace("Bearer ", "").strip()
    return {
        "Authorization": f"Bearer {clean_token}",
        "Content-Type": "application/json"
    }

# ---------------------------------------------------------------------------
# READ OPERATIONS ONLY (Itineraries are Read-Only in Chatbot)
# ---------------------------------------------------------------------------

@planner_mcp.tool()
def list_saved_itineraries(token: str) -> List[Dict[str, Any]]:
    """Fetch all saved AI travel itineraries created with the Trip Planner, including their version count and destinations."""
    try:
        res = requests.get(f"{PLANNER_API_BASE}/travel/saved", headers=_get_headers(token), timeout=10)
        if res.status_code == 200:
            plans = res.json()
            summary = []
            for p in plans:
                versions = p.get("versions", [])
                summary.append({
                    "planId": str(p.get("_id")),
                    "title": p.get("title"),
                    "destination": p.get("destination"),
                    "duration": p.get("duration"),
                    "total_versions": len(versions),
                    "version_numbers": [v.get("version") for v in versions],
                    "latest_version": p.get("currentVersion", 1),
                    "budget": p.get("budget"),
                    "groupSize": p.get("groupSize")
                })
            return summary
        return [{"error": f"Planner backend responded with {res.status_code}"}]
    except Exception as e:
        return [{"error": str(e)}]

@planner_mcp.tool()
def get_itinerary_version_details(plan_id: str, version: Optional[int] = None, token: str = "") -> Dict[str, Any]:
    """Fetch the detailed Markdown itinerary for a specific trip plan and version."""
    try:
        res = requests.get(f"{PLANNER_API_BASE}/travel/saved", headers=_get_headers(token), timeout=10)
        if res.status_code != 200:
            return {"error": "Could not fetch itineraries from planner backend."}
        plans = res.json()
        target_plan = next((p for p in plans if str(p.get("_id")) == str(plan_id) or p.get("destination", "").lower() == plan_id.lower()), None)
        if not target_plan:
            return {"error": f"No travel plan found matching '{plan_id}'."}

        versions = target_plan.get("versions", [])
        if not versions:
            return {
                "destination": target_plan.get("destination"),
                "version": 1,
                "itinerary": target_plan.get("itinerary", "No itinerary text available.")
            }

        target_v_num = int(version) if version else target_plan.get("currentVersion", versions[-1].get("version", 1))
        v_obj = next((v for v in versions if int(v.get("version", 1)) == target_v_num), versions[-1])

        return {
            "planId": str(target_plan.get("_id")),
            "destination": v_obj.get("destination") or target_plan.get("destination"),
            "version": v_obj.get("version"),
            "duration": v_obj.get("duration"),
            "budget": v_obj.get("budget"),
            "itinerary": v_obj.get("itinerary", ""),
            "all_available_versions": [v.get("version") for v in versions]
        }
    except Exception as e:
        return {"error": str(e)}
