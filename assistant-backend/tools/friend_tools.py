# assistant-backend/tools/friend_tools.py
import requests
import json
from typing import Any, Dict, List
from fastmcp import FastMCP
from config import NODE_API_BASE

friend_mcp = FastMCP("TripMate-Friend-Server")

def _get_headers(token: str) -> dict:
    clean_token = token.replace("Bearer ", "").strip()
    return {
        "Authorization": f"Bearer {clean_token}",
        "Content-Type": "application/json"
    }

def _extract_error_message(res: requests.Response) -> str:
    try:
        data = res.json()
        if isinstance(data, dict):
            return data.get("message") or data.get("error") or res.text
        return str(data)
    except Exception:
        return res.text

# ---------------------------------------------------------------------------
# READ OPERATIONS (Direct Execution)
# ---------------------------------------------------------------------------

@friend_mcp.tool()
def get_friends_balances(token: str) -> List[Dict[str, Any]]:
    """Fetch all connected friends and their net balances (You owe / You get / Settled)."""
    try:
        res = requests.get(f"{NODE_API_BASE}/users/me/friends-balances", headers=_get_headers(token), timeout=10)
        if res.status_code == 200:
            return res.json()
        return [{"error": _extract_error_message(res)}]
    except Exception as e:
        return [{"error": str(e)}]

@friend_mcp.tool()
def get_friend_requests(token: str) -> Dict[str, Any]:
    """Fetch all incoming and outgoing friend requests."""
    try:
        inc = requests.get(f"{NODE_API_BASE}/friends/incoming", headers=_get_headers(token), timeout=10).json()
        out = requests.get(f"{NODE_API_BASE}/friends/outgoing", headers=_get_headers(token), timeout=10).json()
        return {
            "incoming": inc if isinstance(inc, list) else [],
            "outgoing": out if isinstance(out, list) else []
        }
    except Exception as e:
        return {"error": str(e)}

# ---------------------------------------------------------------------------
# WRITE OPERATIONS (Triggered after HITL Confirmation)
# ---------------------------------------------------------------------------

@friend_mcp.tool()
def send_friend_request(identifier: str, token: str) -> Dict[str, Any]:
    """Send a friend request to a user by username or email."""
    try:
        clean_id = identifier.replace("@", "").strip()
        res = requests.post(
            f"{NODE_API_BASE}/friends/send",
            json={"identifier": clean_id},
            headers=_get_headers(token),
            timeout=10
        )
        if res.status_code in [200, 201]:
            data = res.json()
            return {
                "success": True,
                "message": data.get("message") or f"Friend request successfully sent to {clean_id}!"
            }
        return {"error": _extract_error_message(res)}
    except Exception as e:
        return {"error": str(e)}

@friend_mcp.tool()
def respond_friend_request(request_id: str, action: str, token: str) -> Dict[str, Any]:
    """Accept or decline an incoming friend request (action: 'accepted' | 'declined')."""
    try:
        res = requests.put(
            f"{NODE_API_BASE}/friends/respond",
            json={"requestId": request_id, "action": action},
            headers=_get_headers(token),
            timeout=10
        )
        if res.status_code == 200:
            data = res.json()
            return {
                "success": True,
                "message": data.get("message") or f"Friend request successfully {action}."
            }
        return {"error": _extract_error_message(res)}
    except Exception as e:
        return {"error": str(e)}
