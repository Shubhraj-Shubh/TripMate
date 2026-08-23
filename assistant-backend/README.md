# 🤖 TripMate AI Assistant Backend - FastMCP & HITL Conversational Engine

FastAPI & **FastMCP** conversational engine providing intelligent trip management, friend network actions, spending analytics, and structured Human-In-The-Loop (HITL) proposal forms.

---

## 📂 Folder Structure

```
assistant-backend/
├── app.py                # FastAPI entry point & CORS configuration
├── auth.py               # Dynamic JWT decoding & MongoDB user profile resolution (zero hardcoding)
├── config.py             # Model names, service URLs, and environment variables
├── db.py                 # Persistent MongoDB chat history (assistant_threads, assistant_messages)
├── core/
│   ├── agent.py          # Conversational agent, tool orchestration & proposal generation
│   ├── llm.py            # Model factory with automatic fallback
│   ├── prompts.py        # System prompt with dynamic user identity block
│   ├── playbook.py       # Comprehensive behavioral playbook for human ambiguity & edge cases
│   └── state.py          # Chat message models & payload types
├── tools/
│   ├── trip_tools.py     # Trip info, balance matrix table, multi-payer add/edit/delete expense tools
│   ├── friend_tools.py   # Friend balances & friend request send/respond tools
│   └── planner_tools.py  # Itinerary list & Markdown version viewer tools
├── mcp_servers/
│   └── run_mcp_all.py    # Standalone runner to deploy MCP tools as independent cloud microservices
├── routes/
│   ├── chat.py           # /api/assistant/chat & /api/assistant/confirm-action endpoints
│   └── session.py        # /api/assistant/sessions CRUD endpoints
└── .env.example          # Environment template
```

---

## 🛡️ Strict Architectural Guardrails
1. **Dynamic Session Identity**: The caller's name, username, and email are extracted on every call from the Clerk Bearer token and MongoDB. "Paid by me" and "my name" always resolve to the actual active user.
2. **Mathematical Validation**:
   - $\sum \text{Payer Contributions} = \text{Total Expense Amount}$
   - $\sum \text{Custom Splits} = \text{Total Expense Amount}$
   - Any mismatch refuses proposal creation and asks for clarification.
3. **HITL Form Cards**: Financial write operations require explicit user confirmation.
4. **Chat Deletion Security**: The AI Assistant LLM agent has **zero tools or permissions** to delete any chat session or data.

---

## 🚀 Setup & Local Development

1. Install dependencies:
   ```bash
   pip install fastapi uvicorn google-genai langchain-core fastmcp pymongo python-dotenv requests pyjwt
   ```
2. Configure `.env`:
   ```env
   PORT=8002
   MONGO_URI=mongodb+srv://...
   NODE_API_BASE=http://localhost:5000/api
   PLANNER_API_BASE=http://localhost:8001/api
   GEMINI_API_KEY=AIzaSy...
   ```
3. Run server:
   ```bash
   python app.py
   ```
