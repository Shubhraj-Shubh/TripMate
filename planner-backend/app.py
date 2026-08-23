# planner-backend/app.py
import os
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from langchain_core.messages import HumanMessage

from config import PORT
from graph import travel_graph, checkpointer
from nodes import (
    questionnaire_node, 
    supervisor_node, 
    final_agent_node, 
    guardrail_node, 
    itinerary_node, 
    budget_node, 
    human_approval_node
)
from state import AgentState
import db

app = FastAPI(title="TripMate AI Travel Planner API", version="2.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cancelled_threads = set()

class TravelRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    answers: Optional[Dict[str, str]] = None
    user_id: Optional[str] = None

class ApprovalRequest(BaseModel):
    thread_id: Optional[str] = ""
    approved: Optional[bool] = False
    feedback: Optional[str] = ""
    user_id: Optional[str] = None
    trip_constraints: Optional[Dict[str, Any]] = None

class CancelRequest(BaseModel):
    thread_id: str

class SavePlanRequest(BaseModel):
    planId: Optional[str] = None
    title: Optional[str] = "AI Travel Plan"
    destination: Optional[str] = "Destination"
    duration: Optional[str] = "4 Days"
    groupSize: Optional[str] = "Solo/Group"
    budget: Optional[str] = "Moderate"
    itinerary: str
    selectedAgents: Optional[List[str]] = []
    version: Optional[int] = 1
    status: Optional[str] = "finalized"
    revisionFeedback: Optional[str] = ""
    user_id: Optional[str] = None

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "planner-backend",
        "port": PORT,
        "mongo_connected": db.db is not None,
        "features": ["langgraph_modular", "mongo_persistence", "guardrails", "revision_context", "hitl"]
    }

@app.post("/api/travel/questionnaire")
async def check_questionnaire(req: TravelRequest):
    """Analyzes query to see if clarification is needed with strict guardrail."""
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    thread_id = req.thread_id or str(uuid.uuid4())
    temp_state: AgentState = {
        "messages": [HumanMessage(content=user_msg)],
        "thread_id": thread_id,
        "execution_trace": []
    }
    
    res = questionnaire_node(temp_state)

    if res.get("is_travel_related") is False:
        return {
            "success": True,
            "thread_id": thread_id,
            "is_travel_related": False,
            "needs_clarification": False,
            "guardrail_message": res.get("guardrail_message", "Please enter a valid destination name or travel query.")
        }

    return {
        "success": True,
        "thread_id": thread_id,
        "is_travel_related": True,
        "needs_clarification": res.get("needs_clarification", False),
        "questions": res.get("clarifying_questions", []),
        "assumptions": res.get("trip_constraints", {}).get("assumptions_made", []),
        "detected_destination": res.get("trip_constraints", {}).get("destination", "")
    }

@app.post("/api/travel")
async def generate_plan(req: TravelRequest):
    """Runs the LangGraph multi-agent travel planner up to the HITL draft review gate."""
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    thread_id = req.thread_id or str(uuid.uuid4())
    if thread_id in cancelled_threads:
        cancelled_threads.remove(thread_id)

    initial_state: AgentState = {
        "messages": [HumanMessage(content=user_msg)],
        "thread_id": thread_id,
        "execution_trace": [],
        "trip_constraints": {},
        "selected_agents": []
    }

    config = {"configurable": {"thread_id": thread_id}}

    try:
        result = await travel_graph.ainvoke(initial_state, config=config)

        if thread_id in cancelled_threads:
            cancelled_threads.remove(thread_id)
            return {"success": False, "cancelled": True, "error": "Plan generation was cancelled by user."}

        if result.get("error") in ["IRRELEVANT_QUERY", "INVALID_DESTINATION"] or (result.get("final_response") and not result.get("selected_agents")):
            return {
                "success": False,
                "is_travel_related": False,
                "error": result.get("final_response", "Please provide a valid travel destination.")
            }

        draft_itinerary = (
            result.get("final_response") or 
            result.get("itinerary") or 
            "Draft travel plan generated successfully."
        )

        # Persist session to MongoDB for resilient multi-turn recovery
        db.save_session_state(thread_id, result)

        return {
            "success": True,
            "thread_id": thread_id,
            "answer": draft_itinerary,
            "itinerary": draft_itinerary,
            "requires_approval": True,
            "selected_agents": result.get("selected_agents", []),
            "supervisor_reasoning": result.get("supervisor_reasoning", ""),
            "trip_constraints": result.get("trip_constraints", {}),
            "execution_trace": result.get("execution_trace", []),
            "flight_results": result.get("flight_results", ""),
            "hotel_results": result.get("hotel_results", ""),
            "weather_results": result.get("weather_results", ""),
            "budget_results": result.get("budget_results", "")
        }
    except Exception as e:
        return {
            "success": False,
            "thread_id": thread_id,
            "error": f"Graph execution notice: {str(e)}"
        }

@app.post("/api/travel/approve")
async def process_approval(req: ApprovalRequest):
    """Processes user review: either finalizing the report or re-running specialists with revision feedback."""
    thread_id = req.thread_id
    config = {"configurable": {"thread_id": thread_id}}

    # 1. Retrieve state from checkpointer or fallback to MongoDB session
    current_state = travel_graph.get_state(config)
    state_values = {}

    if current_state and current_state.values:
        state_values = dict(current_state.values)
    else:
        state_values = db.get_session_state(thread_id)

    if not state_values:
        state_values = {
            "thread_id": thread_id,
            "messages": [HumanMessage(content="Travel request")],
            "trip_constraints": req.trip_constraints or {},
            "selected_agents": ["itinerary_agent", "budget_agent"]
        }

    # Merge explicitly passed constraints to guarantee zero context loss
    if req.trip_constraints:
        if "trip_constraints" not in state_values or not state_values["trip_constraints"]:
            state_values["trip_constraints"] = {}
        for k, v in req.trip_constraints.items():
            if v and v != "Not specified":
                state_values["trip_constraints"][k] = v

    if req.approved:
        # Final approval: polish unified report
        final_res = final_agent_node(state_values)
        state_values.update(final_res)
        
        try:
            travel_graph.update_state(config, state_values)
        except Exception:
            pass

        db.save_session_state(thread_id, state_values)

        return {
            "success": True,
            "thread_id": thread_id,
            "approved": True,
            "requires_approval": False,
            "answer": final_res.get("final_response", ""),
            "itinerary": final_res.get("final_response", ""),
            "execution_trace": state_values.get("execution_trace", []),
            "selected_agents": state_values.get("selected_agents", []),
            "trip_constraints": state_values.get("trip_constraints", {})
        }
    else:
        # Revision feedback requested: re-run supervisor & relevant specialists with feedback!
        feedback_text = req.feedback or "Please adjust and update the plan."
        state_values["feedback"] = feedback_text
        
        # 1. Re-run supervisor to extract updated parameters
        sup_res = supervisor_node(state_values)
        state_values.update(sup_res)
        
        # 2. Re-run itinerary & budget specialists with updated constraints
        itin_res = itinerary_node(state_values)
        state_values.update(itin_res)
        
        bud_res = budget_node(state_values)
        state_values.update(bud_res)
        
        # 3. Re-synthesize draft
        draft_res = human_approval_node(state_values)
        state_values.update(draft_res)

        try:
            travel_graph.update_state(config, state_values)
        except Exception:
            pass

        db.save_session_state(thread_id, state_values)

        return {
            "success": True,
            "thread_id": thread_id,
            "approved": False,
            "requires_approval": True,
            "answer": draft_res.get("final_response", ""),
            "itinerary": draft_res.get("final_response", ""),
            "execution_trace": state_values.get("execution_trace", []),
            "selected_agents": state_values.get("selected_agents", []),
            "trip_constraints": state_values.get("trip_constraints", {})
        }

@app.post("/api/travel/cancel")
async def cancel_plan(req: CancelRequest):
    """Cancels an in-flight plan generation."""
    cancelled_threads.add(req.thread_id)
    return {"success": True, "message": "Cancellation registered."}

# ==========================================
# Direct MongoDB CRUD Endpoints for Planner
# ==========================================

@app.post("/api/travel/save")
async def save_plan_directly(req: SavePlanRequest, request: Request):
    """Saves a plan directly to MongoDB without depending on splitmate-backend."""
    user_id = req.user_id or request.headers.get("x-user-id")
    result = db.save_itinerary_to_db(user_id, req.dict())
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to save to database"))
    return result

@app.get("/api/travel/saved")
async def get_saved_plans_directly(user_id: Optional[str] = None, request: Request = None):
    """Retrieves all saved itineraries directly from MongoDB."""
    uid = user_id
    if not uid and request:
        uid = request.headers.get("x-user-id")
    plans = db.get_saved_itineraries_from_db(uid)
    return plans

@app.delete("/api/travel/saved/{plan_id}")
async def delete_saved_plan_directly(plan_id: str):
    """Deletes an itinerary directly from MongoDB."""
    success = db.delete_saved_itinerary_from_db(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"success": True, "message": "Plan deleted from MongoDB."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
