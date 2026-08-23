# assistant-backend/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import PORT
from routes.sessions import router as sessions_router
from routes.chat import router as chat_router

app = FastAPI(
    title="TripMate AI Assistant Backend",
    version="3.0.0",
    description="Production-grade AI Assistant with FastMCP tools, LangGraph checkpointers, and thread history"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Modular Routers
app.include_router(sessions_router)
app.include_router(chat_router)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "assistant-backend",
        "port": PORT,
        "features": [
            "fastmcp_tools",
            "mongodb_thread_history",
            "hitl_action_proposals",
            "inline_recharts",
            "user_data_isolation"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
