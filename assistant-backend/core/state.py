# assistant-backend/core/state.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ActionProposal(BaseModel):
    action_type: str = Field(..., description="Action identifier: ADD_EXPENSE | DELETE_EXPENSE | EDIT_EXPENSE | ADD_MEMBER | SEND_FRIEND_REQUEST | RESPOND_FRIEND_REQUEST")
    summary: str = Field(..., description="Human-readable summary of proposed action")
    form_details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Structured form field rows for UI rendering")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Execution parameters for the tool")

class ChartData(BaseModel):
    type: str = Field(..., description="Chart type: PIE | BAR")
    title: str = Field(..., description="Chart title")
    data: List[Dict[str, Any]] = Field(default_factory=list, description="Data points for Recharts rendering")

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    trip_id: Optional[str] = None
    context_type: Optional[str] = "global"

class ConfirmActionRequest(BaseModel):
    thread_id: str
    action_type: str
    action_payload: Dict[str, Any]
    confirmed: bool = True

class CreateThreadRequest(BaseModel):
    title: Optional[str] = "New Conversation"
    context_type: Optional[str] = "global"
    trip_id: Optional[str] = None
    trip_title: Optional[str] = None

class ChatResponse(BaseModel):
    success: bool
    reply: str
    thread_id: Optional[str] = None
    chart_data: Optional[Dict[str, Any]] = None
    action_proposal: Optional[Dict[str, Any]] = None
    options: Optional[Dict[str, Any]] = None
