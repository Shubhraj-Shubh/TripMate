# assistant-backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", 8002))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
MONGO_URI = os.getenv("MONGO_URI", "")

NODE_API_BASE = os.getenv("NODE_API_BASE", "http://localhost:5000/api")
PLANNER_API_BASE = os.getenv("PLANNER_API_BASE", "http://localhost:8001/api")

PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]
