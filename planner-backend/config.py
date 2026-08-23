# planner-backend/config.py
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
RAILRADAR_API_KEY = os.getenv("RAILRADAR_API_KEY", "")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
AVIATION_STACK_API_KEY = os.getenv("AVIATION_STACK_API_KEY", "")
MONGO_URI = os.getenv("MONGO_URI", "")

PORT = int(os.getenv("PORT", 8001))
PRIMARY_MODEL = os.getenv("MODEL_NAME", "gemini-flash-latest")
FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]

if not GEMINI_API_KEY:
    print("⚠️ WARNING: GEMINI_API_KEY is not set in environment variables.")
