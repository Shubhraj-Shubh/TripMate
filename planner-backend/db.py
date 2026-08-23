# planner-backend/db.py
import os
import re
import datetime
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "")

mongo_client = None
db = None

if MONGO_URI:
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Default mongoose database name is 'test'
        db = mongo_client["test"]
        print("Connected to MongoDB Atlas successfully in planner-backend.")
    except Exception as e:
        print("MongoDB connection error in planner-backend:", e)

def clean_destination_name(dest: str, title: str = "", itinerary: str = "") -> str:
    """Extracts strictly the clean geographical destination name without titles or day suffixes."""
    raw = (dest or "").strip()
    for prefix in ["Complete Travel Plan:", "Complete Travel Plan", "Draft Travel Plan:", "Draft Travel Plan", "Trip to", "Trip"]:
        if raw.lower().startswith(prefix.lower()):
            raw = raw[len(prefix):].strip()
    raw = re.sub(r'\(?\d+\s*Days?\)?', '', raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r'[^a-zA-Z0-9\s,\-\']', '', raw).strip()
    
    if not raw or raw.lower() in ["not specified", "vacation", "none"]:
        match = re.search(r'Travel Plan:\s*([A-Za-z\s]+?)(?:\s*\(\d+\s*Days|\n|$)', itinerary or title or "")
        if match:
            candidate = match.group(1).strip()
            if candidate.lower() not in ["not specified", "none"]:
                raw = candidate

    return raw or "Vacation"

def save_session_state(thread_id: str, state_values: dict):
    """Persists active planning session state into MongoDB so revisions never fail."""
    if db is None or not thread_id:
        return
    try:
        clean_state = {}
        for k, v in state_values.items():
            if k == "messages":
                clean_state[k] = [m.content if hasattr(m, 'content') else str(m) for m in v]
            else:
                clean_state[k] = v
        
        db["planner_sessions"].update_one(
            {"thread_id": thread_id},
            {"$set": {"thread_id": thread_id, "state": clean_state, "updatedAt": datetime.datetime.utcnow()}},
            upsert=True
        )
    except Exception as e:
        print("Error saving session state to DB:", e)

def get_session_state(thread_id: str) -> dict:
    """Retrieves planning session state from MongoDB."""
    if db is None or not thread_id:
        return {}
    try:
        doc = db["planner_sessions"].find_one({"thread_id": thread_id})
        if doc and "state" in doc:
            return doc["state"]
    except Exception as e:
        print("Error reading session state from DB:", e)
    return {}

def save_itinerary_to_db(user_id: str, plan_data: dict) -> dict:
    """Saves or appends a version to a trip document in MongoDB."""
    if db is None:
        return {"success": False, "error": "Database not connected"}
    try:
        raw_dest = plan_data.get("destination", "")
        raw_title = plan_data.get("title", "")
        raw_itin = plan_data.get("itinerary") or plan_data.get("itineraryDetails") or ""
        plan_id = plan_data.get("planId") or plan_data.get("plan_id") or plan_data.get("_id")
        
        clean_dest = clean_destination_name(raw_dest, raw_title, raw_itin)
        duration = plan_data.get("duration", "4 Days")
        group_size = plan_data.get("groupSize") or plan_data.get("group_size") or "Solo/Group"
        budget = str(plan_data.get("budget", "Moderate"))
        version_num = int(plan_data.get("version", 1))
        trip_title = f"Trip to {clean_dest} ({duration})"

        parsed_user = None
        user_query = {}
        if user_id:
            try:
                parsed_user = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
                user_query["$or"] = [{"user": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"user": user_id}, {"user": str(user_id)}]
            except Exception:
                user_query["user"] = user_id
                parsed_user = user_id

        # 1. First try matching by persistent planId if provided
        existing_trip = None
        if plan_id and ObjectId.is_valid(plan_id):
            existing_trip = db["saveditineraries"].find_one({"_id": ObjectId(plan_id)})

        # 2. Fallback to matching by destination & user
        if not existing_trip:
            find_query = {"destination": clean_dest, **user_query}
            existing_trip = db["saveditineraries"].find_one(find_query)

        version_entry = {
            "version": version_num,
            "itinerary": raw_itin,
            "duration": duration,
            "groupSize": group_size,
            "budget": budget,
            "destination": clean_dest,
            "feedback": plan_data.get("revisionFeedback", f"Version {version_num}"),
            "createdAt": datetime.datetime.utcnow().isoformat()
        }

        if existing_trip:
            # Check if this version number already exists in versions array
            existing_versions = existing_trip.get("versions", [])
            version_exists = any(v.get("version") == version_num for v in existing_versions)

            if version_exists:
                # Update the existing version's itinerary & details
                db["saveditineraries"].update_one(
                    {"_id": existing_trip["_id"], "versions.version": version_num},
                    {"$set": {
                        "versions.$": version_entry,
                        "title": trip_title,
                        "destination": clean_dest,
                        "duration": duration,
                        "groupSize": group_size,
                        "budget": budget,
                        "itinerary": raw_itin,
                        "currentVersion": version_num,
                        "updatedAt": datetime.datetime.utcnow()
                    }}
                )
            else:
                # Append new version entry to the trip
                db["saveditineraries"].update_one(
                    {"_id": existing_trip["_id"]},
                    {
                        "$push": {"versions": version_entry},
                        "$set": {
                            "title": trip_title,
                            "destination": clean_dest,
                            "duration": duration,
                            "groupSize": group_size,
                            "budget": budget,
                            "itinerary": raw_itin,
                            "currentVersion": version_num,
                            "updatedAt": datetime.datetime.utcnow()
                        }
                    }
                )
            return {"success": True, "updated": True, "planId": str(existing_trip["_id"]), "version": version_num, "destination": clean_dest}
        else:
            # Create new unified trip document
            doc_payload = {
                "title": trip_title,
                "destination": clean_dest,
                "duration": duration,
                "groupSize": group_size,
                "budget": budget,
                "itinerary": raw_itin,
                "currentVersion": version_num,
                "versions": [version_entry],
                "selectedAgents": plan_data.get("selectedAgents") or plan_data.get("selected_agents") or [],
                "status": "finalized",
                "createdAt": datetime.datetime.utcnow(),
                "updatedAt": datetime.datetime.utcnow()
            }
            if parsed_user:
                doc_payload["user"] = parsed_user

            res = db["saveditineraries"].insert_one(doc_payload)
            return {"success": True, "updated": False, "planId": str(res.inserted_id), "version": version_num, "destination": clean_dest}

    except Exception as e:
        print("Error saving itinerary to MongoDB:", e)
        return {"success": False, "error": str(e)}

def get_saved_itineraries_from_db(user_id: str = None) -> list:
    """Fetches all saved itineraries with numerically sorted versions and latest parameters."""
    if db is None:
        return []
    try:
        query = {}
        if user_id:
            if ObjectId.is_valid(user_id):
                query["$or"] = [{"user": ObjectId(user_id)}, {"user": str(user_id)}]
            else:
                query["user"] = user_id
        
        docs = list(db["saveditineraries"].find(query).sort("updatedAt", -1).limit(50))
        result = []

        for d in docs:
            d["_id"] = str(d["_id"])
            if "user" in d:
                d["user"] = str(d["user"])
            if "createdAt" in d and isinstance(d["createdAt"], datetime.datetime):
                d["createdAt"] = d["createdAt"].isoformat()
            if "updatedAt" in d and isinstance(d["updatedAt"], datetime.datetime):
                d["updatedAt"] = d["updatedAt"].isoformat()

            raw_versions = d.get("versions", [])
            if not raw_versions:
                raw_versions = [{
                    "version": d.get("version", 1),
                    "itinerary": d.get("itinerary", ""),
                    "duration": d.get("duration", "4 Days"),
                    "groupSize": d.get("groupSize", "Solo/Group"),
                    "budget": d.get("budget", "Moderate"),
                    "destination": d.get("destination", "Vacation"),
                    "createdAt": d.get("createdAt", "")
                }]

            # Sort versions strictly in ascending numerical order: v1, v2, v3, v4, v5
            sorted_versions = sorted(raw_versions, key=lambda v: int(v.get("version", 1)))
            d["versions"] = sorted_versions
            
            # The latest version is the last item
            latest_v = sorted_versions[-1]
            d["currentVersion"] = latest_v.get("version", 1)
            d["destination"] = clean_destination_name(latest_v.get("destination") or d.get("destination", ""), d.get("title", ""), latest_v.get("itinerary", ""))
            d["duration"] = latest_v.get("duration") or d.get("duration", "4 Days")
            d["groupSize"] = latest_v.get("groupSize") or d.get("groupSize", "Solo/Group")
            d["budget"] = latest_v.get("budget") or d.get("budget", "Moderate")

            result.append(d)

        return result
    except Exception as e:
        print("Error fetching itineraries from MongoDB:", e)
        return []

def delete_saved_itinerary_from_db(plan_id: str, user_id: str = None) -> bool:
    """Deletes an itinerary from MongoDB."""
    if db is None or not plan_id:
        return False
    try:
        query = {}
        if ObjectId.is_valid(plan_id):
            query["_id"] = ObjectId(plan_id)
        else:
            query["_id"] = plan_id
        
        res = db["saveditineraries"].delete_one(query)
        return res.deleted_count > 0
    except Exception as e:
        print("Error deleting itinerary from MongoDB:", e)
        return False
