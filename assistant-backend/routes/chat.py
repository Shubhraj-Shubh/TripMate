# assistant-backend/routes/chat.py
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from auth import extract_user_id_from_token
from core.state import ChatRequest, ChatResponse, ConfirmActionRequest
from core.agent import run_assistant_agent, execute_confirmed_action
import db

router = APIRouter(prefix="/api/assistant", tags=["Chat"])

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest, authorization: Optional[str] = Header(None)):
    """
    Main chat endpoint with thread context binding, guardrail protection, and MongoDB history persistence.
    """
    token = authorization or ""
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization token.")

    user_id = extract_user_id_from_token(authorization)
    
    # 1. Resolve or Create Thread
    thread_id = req.thread_id
    thread = None
    if thread_id:
        thread = db.get_thread_by_id(thread_id, user_id)
    
    if not thread:
        # Create a new thread on first message
        first_title = req.message[:32] + ("..." if len(req.message) > 32 else "")
        thread = db.create_thread(
            user_id=user_id,
            title=first_title,
            context_type=req.context_type or "global",
            trip_id=req.trip_id,
            trip_title=None
        )
        thread_id = thread["thread_id"]

    trip_id = thread.get("trip_id") or req.trip_id
    context_type = thread.get("context_type") or req.context_type or "global"

    # 2. Fetch conversation history from thread
    history_messages = db.get_thread_messages(thread_id, user_id)

    # 3. Execute Senior Assistant Agent Loop
    result = run_assistant_agent(
        user_message=req.message,
        thread_id=thread_id,
        user_id=user_id,
        trip_id=trip_id,
        context_type=context_type,
        token=token,
        conversation_history=history_messages
    )

    return ChatResponse(
        success=result.get("success", True),
        reply=result.get("reply", ""),
        thread_id=thread_id,
        chart_data=result.get("chart_data"),
        action_proposal=result.get("action_proposal"),
        options=result.get("options")
    )

@router.post("/confirm-action")
async def confirm_action_endpoint(req: ConfirmActionRequest, authorization: Optional[str] = Header(None)):
    """
    Directly executes an interactive action proposal once the user confirms from the UI.
    """
    token = authorization or ""
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization token.")

    user_id = extract_user_id_from_token(authorization)

    if not req.confirmed:
        cancel_msg = "❌ Action cancelled by user."
        if db.db is not None:
            db.db["assistant_messages"].update_many(
                {"thread_id": req.thread_id, "action_proposal": {"$ne": None}},
                {"$set": {"action_proposal.status": "CANCELLED"}}
            )
        db.save_message(req.thread_id, user_id, "ai", cancel_msg)
        return {"success": True, "message": cancel_msg}

    result = execute_confirmed_action(
        action_type=req.action_type,
        action_payload=req.action_payload,
        user_id=user_id,
        token=token
    )

    if "error" in result:
        err_msg = f"⚠️ Could not complete action: {result['error']}"
        if db.db is not None:
            db.db["assistant_messages"].update_many(
                {"thread_id": req.thread_id, "action_proposal": {"$ne": None}},
                {"$set": {"action_proposal.status": "FAILED"}}
            )
        db.save_message(req.thread_id, user_id, "ai", err_msg)
        return {"success": False, "error": result["error"]}

    # Mark proposal as CONFIRMED in DB
    if db.db is not None:
        db.db["assistant_messages"].update_many(
            {"thread_id": req.thread_id, "action_proposal": {"$ne": None}},
            {"$set": {"action_proposal.status": "CONFIRMED"}}
        )

    success_msg = result.get("message") or f"✅ Successfully completed {req.action_type}!"
    db.save_message(req.thread_id, user_id, "ai", success_msg)
    return {"success": True, "message": success_msg, "result": result}
