# 🌍 TripMate - Unified AI Travel Planning, Expense Splitting & Multi-Agent Assistant Platform

**TripMate** is a production-grade travel platform combining multi-agent AI itinerary creation, exact group expense splitting with matrix settlement optimization, a friends network, and a FastMCP Human-In-The-Loop AI assistant.

---

## 🏗️ System Architecture & Microservices

```
                                  ┌─────────────────────────────┐
                                  │   Frontend (Vite / React)   │
                                  │   Port 5173 / Production    │
                                  └──────────────┬──────────────┘
                                                 │
                      ┌──────────────────────────┼──────────────────────────┐
                      ▼                          ▼                          ▼
         ┌─────────────────────────┐┌─────────────────────────┐┌─────────────────────────┐
         │    SplitMate Backend    ││   AI Planner Backend    ││   AI Assistant Backend  │
         │  (Node.js / Express)    ││  (FastAPI / LangGraph)  ││ (FastAPI / FastMCP)     │
         │       Port 5000         ││       Port 8001         ││       Port 8002         │
         └────────────┬────────────┘└────────────┬────────────┘└────────────┬────────────┘
                      │                          │                          │
                      └──────────────────────────┼──────────────────────────┘
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │      MongoDB Atlas          │
                                  │      (Database: 'test')     │
                                  └─────────────────────────────┘
```

---

## 📦 Microservices Breakdown

| Service | Technology | Port | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **`frontend/`** | React 19, Vite, Clerk Auth, Recharts, Lucide | `5173` | Responsive UI with real-time charts, matrix views, and AI assistant chat |
| **`splitmate-backend/`** | Node.js, Express, Mongoose, Clerk SDK | `5000` | Group expense calculations, $N \times N$ matrix debt simplification, member balance tracking |
| **`planner-backend/`** | Python, FastAPI, LangGraph, Google Gemini | `8001` | Multi-agent travel planner with flights, Indian Railways, buses, hotels, and weather |
| **`assistant-backend/`** | Python, FastAPI, FastMCP, LangChain | `8002` | Intelligent assistant with dynamic session identity, HITL form proposals, and safety guardrails |

---

## ⚡ Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js**: v18+ & `npm`
- **Python**: v3.10+ & `pip`
- **MongoDB Atlas Cluster** (or local MongoDB)
- **Clerk Account** (for authentication)
- **Google Gemini API Key**

---

### 2. Installation & Running Each Service

#### A. SplitMate Backend (Port 5000)
```bash
cd splitmate-backend
npm install
# Copy .env.example to .env and set your MONGO_URI and CLERK keys
node server.js
```

#### B. AI Planner Backend (Port 8001)
```bash
cd planner-backend
pip install fastapi uvicorn google-genai langgraph langchain-core pymongo python-dotenv requests
python app.py
```

#### C. AI Assistant Backend (Port 8002)
```bash
cd assistant-backend
pip install fastapi uvicorn google-genai langchain-core langgraph fastmcp pymongo python-dotenv requests pyjwt
python app.py
```

#### D. Frontend (Port 5173)
```bash
cd frontend
npm install
# Copy .env.example to .env and set VITE_CLERK_PUBLISHABLE_KEY
npm run dev
```

Visit: `http://localhost:5173`

---

## ☁️ Production Deployment (Vercel & Render)

### 1. Frontend on Vercel
1. Link your repository to Vercel and select the `frontend/` root directory.
2. Set Environment Variable:
   - `VITE_CLERK_PUBLISHABLE_KEY`: `pk_live_...` or `pk_test_...`
3. Deploy!

### 2. Backends on Render (Web Services)
Create 3 Web Services on [Render](https://render.com):

1. **`splitmate-backend`**:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Env Vars: `MONGO_URI`, `JWT_SECRET`, `CLERK_SECRET_KEY`, `FRONTEND_URL`
2. **`planner-backend`**:
   - Environment: `Python`
   - Build Command: `pip install -r requirements.txt` (or install commands above)
   - Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - Env Vars: `MONGO_URI`, `GEMINI_API_KEY`, `TAVILY_API_KEY`, `RAILRADAR_API_KEY`, `CLERK_SECRET_KEY`
3. **`assistant-backend`**:
   - Environment: `Python`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - Env Vars: `MONGO_URI`, `NODE_API_BASE` (URL of deployed splitmate-backend), `PLANNER_API_BASE` (URL of deployed planner-backend), `GEMINI_API_KEY`, `CLERK_SECRET_KEY`

---

## 🔒 Security & Guardrails
- **Clerk JWT Authentication**: Every request verifies token claims dynamically.
- **Dynamic Identity**: User queries ("paid by me", "my balance") dynamically resolve to the authenticated profile from MongoDB.
- **Human-In-The-Loop (HITL)**: Mutating financial operations (Add/Edit/Delete expenses, Add members) generate interactive proposal cards requiring explicit confirmation.
- **Chat Deletion Isolation**: The AI agent has **zero tools or permissions** to delete chats or data; deletion is human-only via the UI.
