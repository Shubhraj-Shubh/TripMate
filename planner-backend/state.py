# planner-backend/state.py
import operator
from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class TripConstraints(TypedDict, total=False):
    destination: str
    duration: str
    group_size: str
    budget: str
    preferences: List[str]
    negative_constraints: List[str]  # e.g., ['no_weather', 'no_flight', 'no_hotel']
    assumptions_made: List[str]      # e.g., ['Assumed solo traveler', 'Assumed moderate budget']

class AgentState(TypedDict, total=False):
    messages: Annotated[List[AnyMessage], add_messages]
    thread_id: str
    trip_constraints: TripConstraints
    selected_agents: List[str]
    execution_trace: Annotated[List[Dict[str, Any]], operator.add]
    clarifying_questions: List[Dict[str, Any]]
    needs_clarification: bool
    flight_results: str
    hotel_results: str
    weather_results: str
    budget_results: str
    itinerary: str
    supervisor_reasoning: str
    requires_approval: bool
    approved: bool
    feedback: str
    final_response: str
    error: Optional[str]
