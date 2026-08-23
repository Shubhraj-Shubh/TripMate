# planner-backend/nodes.py
import json
import re
from google import genai
from google.genai import types
from langchain_core.messages import HumanMessage, AIMessage

from config import GEMINI_API_KEY, PRIMARY_MODEL, FALLBACK_MODELS
from state import AgentState, TripConstraints
from reducer import create_trace_item, clean_markdown_text
from mcp_tools import web_search, get_destination_weather, get_train_bus_options

# Initialize Gemini Client
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

def call_gemini(prompt: str, system_instruction: str = "") -> str:
    """Helper to call Gemini reliably with automatic model fallback."""
    if not client:
        return "Gemini API client not initialized. Please configure GEMINI_API_KEY."
    
    models_to_try = [PRIMARY_MODEL] + [m for m in FALLBACK_MODELS if m != PRIMARY_MODEL]
    last_err = ""

    for model_name in models_to_try:
        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction if system_instruction else None,
                temperature=0.2
            )
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config
            )
            if resp and resp.text:
                return resp.text.strip()
        except Exception as e:
            last_err = str(e)
            continue

    return f"Model notice: Generating travel intelligence ({last_err[:100]})."

# 1. Guardrail Node (Strict Travel Intent & Destination Validity Verification)
def guardrail_node(state: AgentState) -> dict:
    """Validates if the user query has genuine travel intent AND a valid geographical destination."""
    user_msg = state.get("messages", [])[-1].content if state.get("messages") else ""
    cleaned_input = user_msg.strip()
    
    # Fast check for single letter or trivial input
    if len(cleaned_input) <= 2:
        return {
            "execution_trace": create_trace_item("guardrail", "rejected", "Rejected invalid/short destination input"),
            "final_response": "👋 Please enter a valid travel destination or query with at least 3 characters (e.g. 'Goa', 'Paris', 'Tokyo', 'Manali').",
            "requires_approval": False,
            "error": "INVALID_DESTINATION"
        }

    prompt = f"""
Evaluate if this user input is a genuine travel planning request with a valid geographical location.

Input: "{cleaned_input}"

Strict Validation Rules:
1. Destination must be a REAL, known geographical location (city, state, country, region, island, or tourist landmark).
2. Reject single letters (e.g. "b", "c", "x", "a"), random typos, test strings (e.g. "asdf", "test", "qwerty"), currency math ("how many rupees in dollar"), and non-travel coding/general questions.
3. If the input is only a single letter or gibberish destination, set "is_travel_related": false.

Respond in JSON format only:
{{
    "is_travel_related": true/false,
    "destination": "Extracted destination if valid, else empty",
    "reason": "Short explanation why valid or invalid"
}}
"""
    resp_text = call_gemini(prompt)
    is_travel = True
    dest = ""
    try:
        match = re.search(r'\{.*\}', resp_text, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            is_travel = data.get("is_travel_related", True)
            dest = data.get("destination", "").strip()
            if len(dest) <= 2:
                is_travel = False
    except Exception:
        if len(cleaned_input) <= 2 or cleaned_input.lower() in ["b", "c", "d", "e", "f", "g", "x", "y", "z", "test", "asdf"]:
            is_travel = False

    trace_item = create_trace_item("guardrail", "completed" if is_travel else "rejected", "Validated travel intent & location")
    
    if not is_travel:
        return {
            "execution_trace": trace_item,
            "final_response": "👋 I am TripMate's AI Travel Planner. Please provide a valid real destination (e.g. 'Plan a 4-day trip to Goa', 'Vacation in Paris', 'Trip to Bali').",
            "requires_approval": False,
            "error": "IRRELEVANT_QUERY"
        }
    
    return {
        "execution_trace": trace_item
    }

# 2. Questionnaire Node (Smart Parameter Clarifier with Guaranteed Interactive Questions)
def questionnaire_node(state: AgentState) -> dict:
    """Analyzes missing details and generates smart clarifying questions if query lacks full parameters."""
    user_msg = state.get("messages", [])[-1].content if state.get("messages") else ""
    
    # 1. First verify guardrail
    g_res = guardrail_node(state)
    if g_res.get("error") or g_res.get("final_response"):
        return {
            "is_travel_related": False,
            "needs_clarification": False,
            "guardrail_message": g_res.get("final_response"),
            "execution_trace": g_res.get("execution_trace", [])
        }

    # 2. Programmatic check for missing parameters
    has_duration = bool(re.search(r'\b\d+\s*(?:days?|weeks?|nights?)\b', user_msg, re.IGNORECASE))
    has_group = bool(re.search(r'\b(?:\d+\s*(?:people|persons|friends|travelers|pax)|solo|couple|family)\b', user_msg, re.IGNORECASE))
    has_budget = bool(re.search(r'\b(?:budget|moderate|luxury|backpacker|₹|\$|\d+k)\b', user_msg, re.IGNORECASE))

    # Fast extract destination
    dest = ""
    prompt = f"""Extract ONLY the city, region, or country destination from: "{user_msg}". Respond in JSON: {{"destination": "City Name"}}"""
    try:
        match = re.search(r'\{.*\}', call_gemini(prompt), re.DOTALL)
        if match:
            dest = json.loads(match.group(0)).get("destination", "").strip()
    except Exception:
        dest = ""

    place_name = dest if (dest and len(dest) > 2) else "your destination"

    questions = []
    if not has_duration:
        questions.append({
            "id": "duration",
            "question": f"How many days are you planning to stay in {place_name}?",
            "options": ["3 Days (Weekend)", "5 Days", "7 Days (1 Week)", "10 Days"]
        })
    if not has_group:
        questions.append({
            "id": "group_size",
            "question": f"Who will be traveling with you to {place_name}?",
            "options": ["Solo Traveler", "Couple (2 People)", "Small Group (3-5 Friends)", "Large Group (6+)"]
        })
    if not has_budget:
        questions.append({
            "id": "budget",
            "question": f"What is your target budget style for {place_name}?",
            "options": ["Budget Friendly (Backpacker)", "Moderate (Comfortable)", "Luxury (Premium)"]
        })

    needs_clarification = len(questions) > 0

    trace_item = create_trace_item("questionnaire", "completed", f"Evaluated requirements for {place_name}")
    
    constraints = dict(state.get("trip_constraints", {}))
    if dest:
        constraints["destination"] = dest

    return {
        "is_travel_related": True,
        "needs_clarification": needs_clarification,
        "clarifying_questions": questions,
        "trip_constraints": constraints,
        "execution_trace": trace_item
    }

# 3. Supervisor Node (Strict Negative Constraint & Context-Preserving Specialist Routing)
def supervisor_node(state: AgentState) -> dict:
    """Extracts all constraints and strictly preserves prior context across revisions."""
    user_msg = state.get("messages", [])[-1].content if state.get("messages") else ""
    feedback = state.get("feedback", "")
    
    existing_constraints = dict(state.get("trip_constraints", {}))
    existing_dest = existing_constraints.get("destination", "")
    existing_duration = existing_constraints.get("duration", "")
    existing_group = existing_constraints.get("group_size", "")
    existing_budget = existing_constraints.get("budget", "")

    full_context = f"""
Current Known Destination: {existing_dest or 'Not explicitly set'}
Current Known Duration: {existing_duration or 'Not explicitly set'}
Current Known Group Size: {existing_group or 'Not explicitly set'}
Current Known Budget: {existing_budget or 'Not explicitly set'}

User Request: {user_msg}
{f'Revision Feedback / Adjustments: {feedback}' if feedback else ''}
"""

    prompt = f"""
You are the Lead Travel Supervisor AI.
Analyze the user request and revision instruction to configure the specialist team and update trip parameters.

CRITICAL CONTEXT RETENTION RULES:
1. Destination: Always retain the destination ("{existing_dest}") unless the user explicitly specifies a different city/country! Never set destination to "Not specified" or empty if it was already known.
2. Group Size: If revision says e.g. "make for 5 people", update group size to "5 People". Otherwise retain "{existing_group or '2 People'}".
3. Duration: If revision specifies new duration, update it. Otherwise retain "{existing_duration or '4 Days'}".
4. Budget: If revision specifies new budget, update it. Otherwise retain "{existing_budget or 'Moderate'}".

Available Specialists:
- "flight_agent": Multi-Modal Transit & Transport (Flights, Indian Railways trains, intercity Volvo/sleeper buses, and local rentals).
- "hotel_agent": Accommodations, hotels, villas, and homestays.
- "weather_agent": Climate, seasonal weather, and packing advice.
- "budget_agent": Cost breakdowns and itemized estimations in INR (₹).
- "itinerary_agent": Day-wise activities and realistic schedules.

STRICT NEGATIVE CONSTRAINT RULES:
- If user says "no weather", "skip weather", "without weather", DO NOT include "weather_agent".
- If user says "no transport", "no flights", "already have transport", DO NOT include "flight_agent".
- If user says "no hotels", "stay arranged", DO NOT include "hotel_agent".
- If user says "no budget", "skip budget advice", DO NOT include "budget_agent".

Context Details:
{full_context}

Respond in JSON format only:
{{
    "destination": "Destination name (retain existing if not changed)",
    "duration": "Duration (e.g. 4 Days, 5 Days, 10 Days)",
    "group_size": "Group size (e.g. 5 People, Solo, Couple)",
    "budget": "Budget (e.g. Budget-friendly, Moderate, Luxury)",
    "selected_agents": ["flight_agent", "hotel_agent", ...],
    "negative_constraints_found": ["e.g. Excluded weather_agent"],
    "supervisor_reasoning": "Clear 1-sentence note of coordinated specialists and updated parameters."
}}
"""
    resp_text = call_gemini(prompt)
    
    selected_agents = ["flight_agent", "hotel_agent", "budget_agent", "itinerary_agent"]
    supervisor_note = "Supervisor coordinated specialist team based on your request."
    constraints = dict(existing_constraints)

    try:
        match = re.search(r'\{.*\}', resp_text, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            raw_agents = data.get("selected_agents", [])
            
            valid_agents = ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"]
            selected_agents = [a for a in raw_agents if a in valid_agents]
            if not selected_agents:
                selected_agents = ["itinerary_agent", "budget_agent"]
                
            supervisor_note = data.get("supervisor_reasoning", supervisor_note)
            
            # Update constraints while protecting against context erasure
            new_dest = data.get("destination")
            if new_dest and new_dest.lower() not in ["not specified", "none", ""]:
                constraints["destination"] = new_dest
            elif existing_dest:
                constraints["destination"] = existing_dest
                
            new_dur = data.get("duration")
            if new_dur and new_dur.lower() not in ["not specified", "none", ""]:
                constraints["duration"] = new_dur
            elif existing_duration:
                constraints["duration"] = existing_duration
                
            new_grp = data.get("group_size")
            if new_grp and new_grp.lower() not in ["not specified", "none", ""]:
                constraints["group_size"] = new_grp
            elif existing_group:
                constraints["group_size"] = existing_group
                
            new_bud = data.get("budget")
            if new_bud and new_bud.lower() not in ["not specified", "none", ""]:
                constraints["budget"] = new_bud
            elif existing_budget:
                constraints["budget"] = existing_budget
                
            if data.get("negative_constraints_found"):
                constraints["negative_constraints"] = data["negative_constraints_found"]
    except Exception:
        pass

    # Ensure fallback constraints are populated if empty
    if not constraints.get("destination") and existing_dest:
        constraints["destination"] = existing_dest
    if not constraints.get("duration"):
        constraints["duration"] = existing_duration or "4 Days"
    if not constraints.get("group_size"):
        constraints["group_size"] = existing_group or "2 People"
    if not constraints.get("budget"):
        constraints["budget"] = existing_budget or "Moderate"

    lower_msg = full_context.lower()
    if "no weather" in lower_msg or "don't check weather" in lower_msg or "no need to check weather" in lower_msg:
        if "weather_agent" in selected_agents:
            selected_agents.remove("weather_agent")
    if "no flight" in lower_msg or "no flights" in lower_msg or "already have flight" in lower_msg:
        if "flight_agent" in selected_agents:
            selected_agents.remove("flight_agent")
    if "no hotel" in lower_msg or "no hotels" in lower_msg or "stay arranged" in lower_msg:
        if "hotel_agent" in selected_agents:
            selected_agents.remove("hotel_agent")

    trace_item = create_trace_item("supervisor", "completed", f"Configured {len(selected_agents)} specialists for {constraints.get('destination', 'trip')}")

    return {
        "selected_agents": selected_agents,
        "supervisor_reasoning": supervisor_note,
        "trip_constraints": constraints,
        "execution_trace": trace_item
    }

# 4. Flight & Ground Transit Specialist Node (Flights, Trains, Buses & Local Commute)
def flight_node(state: AgentState) -> dict:
    if "flight_agent" not in state.get("selected_agents", []):
        return {}
    
    constraints = state.get("trip_constraints", {})
    dest = constraints.get("destination") or "Destination"
    budget = constraints.get("budget") or "Moderate"
    
    flight_search = web_search(f"flights and major airports to {dest}")
    train_bus_search = get_train_bus_options("Major Transit Hubs", dest)
    
    prompt = f"""
You are the Transit & Transportation Specialist Agent.
Synthesize the search data into a comprehensive Markdown travel transport section with budget comparisons:

### ✈️ Flights & Airports
- Nearest Major Airport & IATA Code
- Key Airlines & Typical Flight Fare Range (in INR ₹)

### 🚆 Trains (Indian Railways)
- Nearest Railway Station
- Key Express / Vande Bharat / Rajdhani Trains & Estimated Fares (Sleeper/3AC/2AC)

### 🚌 Intercity Buses & Road Trips
- Volvo / Sleeper / State RTC (e.g. HRTC/UPSRTC/KSRTC) Bus Routes & Fares (₹)
- Approximate Road Highway Duration

### 🛵 Local Commute & Rental Tips
- Recommended local transport (Cabs, Scooters/Bikes, Auto-rickshaws)

Destination: {dest}
Target Budget: {budget}
Flight Info: {flight_search}
Train/Bus Info: {train_bus_search}
"""
    result = clean_markdown_text(call_gemini(prompt, "You are an expert travel logistics specialist."))
    trace_item = create_trace_item("flight_agent", "completed", f"Researched multi-modal transport (Flights, Trains, Buses) for {dest}")
    
    return {
        "flight_results": result,
        "execution_trace": trace_item
    }

# 5. Hotel Specialist Node
def hotel_node(state: AgentState) -> dict:
    if "hotel_agent" not in state.get("selected_agents", []):
        return {}

    constraints = state.get("trip_constraints", {})
    dest = constraints.get("destination") or "Destination"
    budget = constraints.get("budget") or "Moderate"
    group_size = constraints.get("group_size") or "Travelers"
    
    search_data = web_search(f"best hotels stays in {dest} for {group_size} with {budget} budget")
    
    prompt = f"""
You are the Hotel & Stays Specialist Agent.
Synthesize accommodations into structured Markdown:
- Curated Budget & Mid-Range Stays (with estimated ₹/night)
- Villas / Group Stays for {group_size}
- Recommended Neighborhoods

Destination: {dest}, Group: {group_size}, Budget: {budget}
Search Results: {search_data}
"""
    result = clean_markdown_text(call_gemini(prompt, "You are an expert hospitality specialist."))
    trace_item = create_trace_item("hotel_agent", "completed", f"Curated hotel recommendations for {dest}")
    
    return {
        "hotel_results": result,
        "execution_trace": trace_item
    }

# 6. Weather Specialist Node
def weather_node(state: AgentState) -> dict:
    if "weather_agent" not in state.get("selected_agents", []):
        return {}

    constraints = state.get("trip_constraints", {})
    dest = constraints.get("destination") or "Destination"
    weather_data = get_destination_weather(dest)
    
    prompt = f"""
You are the Climate & Weather Specialist Agent.
Synthesize weather info into clean Markdown:
- Seasonal Temperature Range (°C) & Rain Outlook
- Best Time to Visit
- Packing Checklist

Destination: {dest}
Weather Data: {weather_data}
"""
    result = clean_markdown_text(call_gemini(prompt, "You are a travel climate specialist."))
    trace_item = create_trace_item("weather_agent", "completed", f"Forecasted climate for {dest}")
    
    return {
        "weather_results": result,
        "execution_trace": trace_item
    }

# 7. Budget Specialist Node
def budget_node(state: AgentState) -> dict:
    if "budget_agent" not in state.get("selected_agents", []):
        return {}

    constraints = state.get("trip_constraints", {})
    dest = constraints.get("destination") or "Destination"
    duration = constraints.get("duration") or "4 Days"
    group_size = constraints.get("group_size") or "2 People"
    target_budget = constraints.get("budget") or "Moderate"

    prompt = f"""
You are the Budget Specialist Agent.
Provide an itemized cost estimate in Indian Rupees (INR ₹) for {group_size} visiting {dest} for {duration}.

TABLE FORMAT REQUIREMENT:
Format the budget strictly as a clean Markdown Table with line breaks between rows:

| Expense Category | Estimated Cost (in ₹) | Description |
| :--- | :--- | :--- |
| Stays & Accommodation | ₹15,000 | Comfortable stay for {group_size} |
| Food & Dining | ₹10,000 | Cafes, restaurants, street food |
| Local Transport | ₹5,000 | Cabs and local rentals |
| Sightseeing & Activities | ₹4,000 | Entry passes and tours |
| Miscellaneous / Buffer | ₹2,000 | Incidentals |
| **Total Estimated ({group_size})** | **₹36,000** | **Total estimated for {duration}** |

Destination: {dest}, Duration: {duration}, Group: {group_size}, Budget: {target_budget}
"""
    result = clean_markdown_text(call_gemini(prompt, "You are a financial travel advisor specializing in Indian Rupee budgeting."))
    trace_item = create_trace_item("budget_agent", "completed", f"Prepared itemized budget for {dest}")
    
    return {
        "budget_results": result,
        "execution_trace": trace_item
    }

# 8. Itinerary Specialist Node
def itinerary_node(state: AgentState) -> dict:
    if "itinerary_agent" not in state.get("selected_agents", []):
        return {}

    constraints = state.get("trip_constraints", {})
    dest = constraints.get("destination") or "Destination"
    duration = constraints.get("duration") or "4 Days"
    group_size = constraints.get("group_size") or "2 People"

    prompt = f"""
You are the Itinerary Planning Specialist Agent.
Create a structured day-by-day travel plan for {duration} in {dest} for {group_size}.
For each day:
- **Morning**: Top cultural or scenic attraction in {dest}
- **Afternoon**: Key activity or local spot in {dest}
- **Evening**: Recommended dinner spot or sunset location

Use clear markdown bullet points.
"""
    result = clean_markdown_text(call_gemini(prompt, "You are an expert itinerary architect."))
    trace_item = create_trace_item("itinerary_agent", "completed", f"Drafted day-by-day plan for {dest}")
    
    return {
        "itinerary": result,
        "execution_trace": trace_item
    }

# 9. Human Approval Node (HITL Draft Synthesis)
def human_approval_node(state: AgentState) -> dict:
    """Compiles the draft report from all specialist findings and pauses for human review."""
    constraints = state.get("trip_constraints", {})
    dest = constraints.get("destination") or "Destination"
    duration = constraints.get("duration") or "4 Days"
    group_size = constraints.get("group_size") or "Travelers"
    budget = constraints.get("budget") or "Moderate"

    flight = state.get("flight_results", "")
    hotel = state.get("hotel_results", "")
    weather = state.get("weather_results", "")
    budget_rep = state.get("budget_results", "")
    itin = state.get("itinerary", "")

    draft_parts = [f"# Draft Travel Plan: {dest} ({duration})\n\n"]
    draft_parts.append(f"**Trip Summary:** {dest} • {duration} • {group_size} • Budget: {budget}\n\n")

    if itin:
        draft_parts.append(f"## 📅 Day-by-Day Itinerary\n{itin}\n\n")
    if hotel:
        draft_parts.append(f"## 🏨 Accommodations & Stays\n{hotel}\n\n")
    if budget_rep:
        draft_parts.append(f"## 💰 Estimated Budget Breakdown (INR ₹)\n{budget_rep}\n\n")
    if flight:
        draft_parts.append(f"## ✈️ Flights & Transit Logistics\n{flight}\n\n")
    if weather:
        draft_parts.append(f"## 🌤️ Climate & Packing Advice\n{weather}\n\n")

    draft_text = clean_markdown_text("".join(draft_parts))
    trace_item = create_trace_item("human_approval", "pending", f"Draft for {dest} compiled for review")

    return {
        "final_response": draft_text,
        "itinerary": draft_text,
        "requires_approval": True,
        "approved": False,
        "execution_trace": trace_item
    }

# 10. Final Agent Node (Senior Architect Optimizer & Unified Report Generator)
def final_agent_node(state: AgentState) -> dict:
    """Senior Architect: Synthesizes all specialist outputs and revision feedback into a cohesive unified final report."""
    constraints = state.get("trip_constraints", {})
    dest = constraints.get("destination") or "Destination"
    duration = constraints.get("duration") or "4 Days"
    group_size = constraints.get("group_size") or "Travelers"
    budget = constraints.get("budget") or "Moderate"
    feedback = state.get("feedback", "")
    
    flight = state.get("flight_results", "")
    hotel = state.get("hotel_results", "")
    weather = state.get("weather_results", "")
    budget_rep = state.get("budget_results", "")
    itin = state.get("itinerary", "")

    prompt = f"""
You are the Lead Senior Travel Architect & Polisher.
Synthesize the specialist data into ONE cohesive, reader-friendly, highly optimized Travel Report in Markdown format.

Trip Details:
- Destination: {dest}
- Duration: {duration}
- Group Size: {group_size}
- Budget Context: {budget}
{f'- User Revision Feedback Applied: {feedback}' if feedback else ''}

Specialist Inputs:
{f'### ✈️ Flights & Transit Logistics\n{flight}\n\n' if flight else ''}
{f'### 🏨 Accommodations & Stays\n{hotel}\n\n' if hotel else ''}
{f'### 🌤️ Climate & Weather Overview\n{weather}\n\n' if weather else ''}
{f'### 📅 Day-by-Day Detailed Itinerary\n{itin}\n\n' if itin else ''}
{f'### 💰 Estimated Budget Breakdown (INR ₹)\n{budget_rep}\n\n' if budget_rep else ''}

Format Requirements:
- Title: `# Complete Travel Plan: {dest} ({duration})`
- Include a crisp **Executive Summary**
- Ensure all budget tables use proper Markdown table syntax with clean newlines between rows
- Day-wise sections should be distinct and actionable
- End with 3 **💡 Pro Local Travel Hacks**
"""
    final_rep = clean_markdown_text(call_gemini(prompt, "You are a master senior travel architect and document polisher."))
    trace_item = create_trace_item("final_agent", "completed", f"Generated optimized final report for {dest}")

    return {
        "final_response": final_rep,
        "itinerary": final_rep,
        "requires_approval": False,
        "approved": True,
        "execution_trace": trace_item
    }
