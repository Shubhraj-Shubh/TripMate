# planner-backend/reducer.py
from typing import Dict, Any, List
import time

def create_trace_item(node_name: str, status: str, details: str = "") -> List[Dict[str, Any]]:
    """Helper returning a new execution trace item list for operator.add."""
    return [{
        "node": node_name,
        "status": status,
        "details": details,
        "timestamp": time.time()
    }]

def clean_markdown_text(text: str) -> str:
    """Cleans up raw JSON escapes or raw string artifacts."""
    if not text:
        return ""
    text = text.strip()
    if text.startswith("```markdown"):
        text = text[11:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()
