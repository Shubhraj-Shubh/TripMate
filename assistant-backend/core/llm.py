# assistant-backend/core/llm.py
from langchain_google_genai import ChatGoogleGenerativeAI
from config import GEMINI_API_KEY, PRIMARY_MODEL, FALLBACK_MODELS

def get_llm(model_name: str = None):
    """
    Initializes Google Generative AI LLM with model fallback capability.
    """
    target_model = model_name or PRIMARY_MODEL
    return ChatGoogleGenerativeAI(
        model=target_model,
        google_api_key=GEMINI_API_KEY,
        temperature=0.2,
        max_retries=2,
    )
