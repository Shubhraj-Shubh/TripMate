# ✈️ AI Planner Backend - Multi-Agent Itinerary Orchestrator

FastAPI & **LangGraph** multi-agent microservice that generates multi-day travel itineraries with real-time flight logistics, Indian Railways train schedules, intercity bus fares, hotel recommendations, and weather forecasts.

---

## 📂 Folder Structure

```
planner-backend/
├── app.py          # FastAPI REST endpoints (/api/travel/plan, /api/travel/saved)
├── graph.py        # LangGraph StateGraph compiled with in-memory checkpointer
├── nodes.py        # Specialist agent nodes (Questionnaire, Supervisor, Flight/Transit, Hotel, Weather, Budget, Itinerary)
├── mcp_tools.py    # Travel tool integrations (Tavily AI Search, RailRadar Trains, OpenWeather)
├── state.py        # TypedDict AgentState & TripConstraints
├── reducer.py      # Trace item creation & Markdown text cleaner
├── db.py           # MongoDB persistence for drafts (planner_sessions) & published plans (saveditineraries)
├── config.py       # API keys & model fallback configuration
└── .env.example    # Environment template
```

---

## 🤖 Multi-Agent Specialist Team

```
               ┌───────────────────────┐
               │    Supervisor Node    │
               │ (Strict Constraints)  │
               └───────────┬───────────┘
                           │
      ┌────────────┬───────┴───────┬────────────┐
      ▼            ▼               ▼            ▼
┌───────────┐┌───────────┐   ┌───────────┐┌───────────┐
│  Transit  ││   Hotel   │   │  Weather  ││  Budget   │
│Specialist ││Specialist │   │Specialist ││Specialist │
└─────┬─────┘└─────┬─────┘   └─────┬─────┘└─────┬─────┘
      │            │               │            │
      └────────────┴───────┬───────┴────────────┘
                           ▼
               ┌───────────────────────┐
               │  Itinerary Synthesis  │
               │ (Day-by-Day Schedule) │
               └───────────────────────┘
```

---

## 🚀 Setup & Local Development

1. Install dependencies:
   ```bash
   pip install fastapi uvicorn google-genai langgraph langchain-core pymongo python-dotenv requests
   ```
2. Configure `.env`:
   ```env
   PORT=8001
   MONGO_URI=mongodb+srv://...
   GEMINI_API_KEY=AIzaSy...
   TAVILY_API_KEY=tvly-dev-...
   RAILRADAR_API_KEY=rg_...
   OPENWEATHER_API_KEY=...
   ```
3. Run server:
   ```bash
   python app.py
   ```
