# planner-backend/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from state import AgentState
from nodes import (
    guardrail_node,
    questionnaire_node,
    supervisor_node,
    flight_node,
    hotel_node,
    weather_node,
    budget_node,
    itinerary_node,
    human_approval_node,
    final_agent_node
)

# 1. Define Conditional Routing Functions
def route_guardrail(state: AgentState) -> str:
    """Routes based on guardrail check."""
    if state.get("final_response"):
        return END
    return "questionnaire"

def route_after_supervisor(state: AgentState) -> list:
    """Parallel routes to all selected specialist agents."""
    selected = state.get("selected_agents", [])
    routes = []
    if "flight_agent" in selected:
        routes.append("flight_agent")
    if "hotel_agent" in selected:
        routes.append("hotel_agent")
    if "weather_agent" in selected:
        routes.append("weather_agent")
    if "budget_agent" in selected:
        routes.append("budget_agent")
    if "itinerary_agent" in selected:
        routes.append("itinerary_agent")
    
    if not routes:
        routes = ["itinerary_agent", "budget_agent"]
    return routes

# 2. Build the Graph
builder = StateGraph(AgentState)

# Add Nodes
builder.add_node("guardrail", guardrail_node)
builder.add_node("questionnaire", questionnaire_node)
builder.add_node("supervisor", supervisor_node)
builder.add_node("flight_agent", flight_node)
builder.add_node("hotel_agent", hotel_node)
builder.add_node("weather_agent", weather_node)
builder.add_node("budget_agent", budget_node)
builder.add_node("itinerary_agent", itinerary_node)
builder.add_node("human_approval", human_approval_node)
builder.add_node("final_agent", final_agent_node)

# Flow Edges
builder.add_edge(START, "guardrail")
builder.add_conditional_edges("guardrail", route_guardrail, ["questionnaire", END])
builder.add_edge("questionnaire", "supervisor")

# Supervisor Fan-Out to Specialists
builder.add_conditional_edges(
    "supervisor",
    route_after_supervisor,
    ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"]
)

# Fan-In from Specialists to Human Review Gate
builder.add_edge("flight_agent", "human_approval")
builder.add_edge("hotel_agent", "human_approval")
builder.add_edge("weather_agent", "human_approval")
builder.add_edge("budget_agent", "human_approval")
builder.add_edge("itinerary_agent", "human_approval")

# Initial run stops at human_approval for HITL review
builder.add_edge("human_approval", END)
builder.add_edge("final_agent", END)

# Compile Checkpointer
checkpointer = MemorySaver()
travel_graph = builder.compile(checkpointer=checkpointer)
