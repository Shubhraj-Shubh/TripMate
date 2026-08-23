# assistant-backend/routes/sessions.py
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from auth import extract_user_id_from_token
from core.state import CreateThreadRequest
import db

router = APIRouter(prefix="/api/assistant/sessions", tags=["Sessions & Threads"])

@router.get("")
def list_user_sessions(authorization: Optional[str] = Header(None)):
    """Fetch all chat threads belonging to the authenticated user."""
    user_id = extract_user_id_from_token(authorization)
    threads = db.get_user_threads(user_id)
    return {"success": True, "threads": threads}

@router.post("")
def create_new_session(req: CreateThreadRequest, authorization: Optional[str] = Header(None)):
    """Create a new chat thread bound to Global or a Specific Trip context."""
    user_id = extract_user_id_from_token(authorization)
    
    base_title = req.title
    if not base_title or base_title == "New Conversation":
        if req.context_type == "trip" and req.trip_title:
            base_title = f"Trip: {req.trip_title}"
        else:
            base_title = "Global Travel Assistant"

    thread = db.create_thread(
        user_id=user_id,
        title=base_title,
        context_type=req.context_type,
        trip_id=req.trip_id,
        trip_title=req.trip_title
    )
    return {"success": True, "thread": thread}

@router.get("/{thread_id}/messages")
def get_session_messages(thread_id: str, authorization: Optional[str] = Header(None)):
    """Fetch all conversational messages for a specific thread."""
    user_id = extract_user_id_from_token(authorization)
    thread = db.get_thread_by_id(thread_id, user_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found or unauthorized.")
    
    messages = db.get_thread_messages(thread_id, user_id)
    return {"success": True, "thread": thread, "messages": messages}

@router.delete("/{thread_id}")
def delete_session(thread_id: str, authorization: Optional[str] = Header(None)):
    """Delete a chat thread and all its history."""
    user_id = extract_user_id_from_token(authorization)
    deleted = db.delete_thread(thread_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Could not delete thread or thread not found.")
    return {"success": True, "message": "Thread deleted successfully."}
