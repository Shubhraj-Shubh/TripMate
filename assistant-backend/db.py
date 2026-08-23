# assistant-backend/db.py
import uuid
import datetime
from bson import ObjectId
from pymongo import MongoClient
from config import MONGO_URI

mongo_client = None
db = None

if MONGO_URI:
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Use default MongoDB database matching splitmate and planner backends
        db = mongo_client["test"]
        print("Connected to MongoDB Atlas successfully in assistant-backend.")
        
        # Create compound indexes for sub-10ms retrieval
        try:
            db["assistant_messages"].create_index([("thread_id", 1), ("createdAt", 1)])
            db["assistant_threads"].create_index([("user_id", 1), ("updatedAt", -1)])
        except Exception:
            pass
    except Exception as e:
        print("MongoDB connection error in assistant-backend:", e)

# ---------------------------------------------------------------------------
# THREAD & SESSION MANAGEMENT
# ---------------------------------------------------------------------------

def create_thread(
    user_id: str,
    title: str = "New Conversation",
    context_type: str = "global",
    trip_id: str = None,
    trip_title: str = None
) -> dict:
    """Creates a new assistant thread/session in MongoDB with auto-incremented title counters."""
    thread_id = str(uuid.uuid4())
    base_title = title or ("Trip: " + trip_title if context_type == "trip" and trip_title else "Global Travel Assistant")

    if db is None:
        return {
            "thread_id": thread_id,
            "title": f"{base_title} #1",
            "context_type": context_type,
            "trip_id": trip_id,
            "trip_title": trip_title,
            "createdAt": datetime.datetime.utcnow().isoformat()
        }

    try:
        import re
        pattern = f"^{re.escape(base_title)}"
        existing_count = db["assistant_threads"].count_documents({
            "user_id": user_id,
            "title": {"$regex": pattern}
        })
        final_title = f"{base_title} #{existing_count + 1}"
    except Exception:
        final_title = base_title

    doc = {
        "thread_id": thread_id,
        "user_id": user_id,
        "title": final_title,
        "context_type": context_type or "global",
        "trip_id": trip_id,
        "trip_title": trip_title,
        "createdAt": datetime.datetime.utcnow(),
        "updatedAt": datetime.datetime.utcnow()
    }
    
    res = db["assistant_threads"].insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    doc["createdAt"] = doc["createdAt"].isoformat()
    doc["updatedAt"] = doc["updatedAt"].isoformat()
    return doc

def get_user_threads(user_id: str) -> list:
    """Fetches all assistant threads belonging strictly to the authenticated user."""
    if db is None or not user_id:
        return []
    try:
        docs = list(db["assistant_threads"].find({"user_id": user_id}).sort("updatedAt", -1).limit(50))
        result = []
        for d in docs:
            d["_id"] = str(d["_id"])
            if isinstance(d.get("createdAt"), datetime.datetime):
                d["createdAt"] = d["createdAt"].isoformat()
            if isinstance(d.get("updatedAt"), datetime.datetime):
                d["updatedAt"] = d["updatedAt"].isoformat()
            result.append(d)
        return result
    except Exception as e:
        print("Error fetching threads:", e)
        return []

def get_thread_by_id(thread_id: str, user_id: str = None) -> dict:
    """Fetches a specific thread with user scope verification."""
    if db is None or not thread_id:
        return None
    try:
        query = {"thread_id": thread_id}
        if user_id:
            query["user_id"] = user_id
        doc = db["assistant_threads"].find_one(query)
        if doc:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("createdAt"), datetime.datetime):
                doc["createdAt"] = doc["createdAt"].isoformat()
            if isinstance(doc.get("updatedAt"), datetime.datetime):
                doc["updatedAt"] = doc["updatedAt"].isoformat()
        return doc
    except Exception as e:
        print("Error getting thread by ID:", e)
        return None

def update_thread_metadata(thread_id: str, title: str = None):
    """Updates thread title and updatedAt timestamp."""
    if db is None or not thread_id:
        return
    try:
        update_fields = {"updatedAt": datetime.datetime.utcnow()}
        if title:
            update_fields["title"] = title
        db["assistant_threads"].update_one(
            {"thread_id": thread_id},
            {"$set": update_fields}
        )
    except Exception as e:
        print("Error updating thread:", e)

def delete_thread(thread_id: str, user_id: str) -> bool:
    """Deletes a thread and all associated messages."""
    if db is None or not thread_id:
        return False
    try:
        res = db["assistant_threads"].delete_one({"thread_id": thread_id, "user_id": user_id})
        if res.deleted_count > 0:
            db["assistant_messages"].delete_many({"thread_id": thread_id})
            return True
        return False
    except Exception as e:
        print("Error deleting thread:", e)
        return False

# ---------------------------------------------------------------------------
# MESSAGE HISTORY MANAGEMENT
# ---------------------------------------------------------------------------

def save_message(
    thread_id: str,
    user_id: str,
    role: str,
    content: str,
    chart_data: dict = None,
    action_proposal: dict = None
) -> dict:
    """Saves a message into MongoDB message history."""
    if db is None:
        return {
            "thread_id": thread_id,
            "role": role,
            "content": content,
            "chart_data": chart_data,
            "action_proposal": action_proposal,
            "createdAt": datetime.datetime.utcnow().isoformat()
        }
    
    doc = {
        "thread_id": thread_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "chart_data": chart_data,
        "action_proposal": action_proposal,
        "createdAt": datetime.datetime.utcnow()
    }
    
    res = db["assistant_messages"].insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    doc["createdAt"] = doc["createdAt"].isoformat()
    
    # Touch thread updatedAt
    update_thread_metadata(thread_id)
    return doc

def get_thread_messages(thread_id: str, user_id: str = None) -> list:
    """Fetches full conversational message history for a given thread."""
    if db is None or not thread_id:
        return []
    try:
        query = {"thread_id": thread_id}
        if user_id:
            query["user_id"] = user_id
        docs = list(db["assistant_messages"].find(query).sort("createdAt", 1).limit(200))
        result = []
        for d in docs:
            d["_id"] = str(d["_id"])
            if isinstance(d.get("createdAt"), datetime.datetime):
                d["createdAt"] = d["createdAt"].isoformat()
            result.append(d)
        return result
    except Exception as e:
        print("Error fetching messages:", e)
        return []
