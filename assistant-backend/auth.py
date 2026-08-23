# assistant-backend/auth.py
import jwt
from typing import Optional, Dict, Any
from bson import ObjectId
from pymongo import MongoClient
from config import MONGO_URI

# Cached Mongo client for auth profile lookups
_auth_client = None
_auth_db = None
if MONGO_URI:
    try:
        _auth_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=4000)
        _auth_db = _auth_client["test"]
    except Exception:
        pass

def extract_user_id_from_token(authorization_header: Optional[str]) -> str:
    """
    Extracts the authenticated Clerk User ID (sub claim) from the Bearer token.
    """
    if not authorization_header:
        return "anonymous_user"
    
    clean_token = authorization_header.replace("Bearer ", "").strip()
    if not clean_token or clean_token.lower() in ["null", "undefined"]:
        return "anonymous_user"

    try:
        unverified = jwt.decode(clean_token, options={"verify_signature": False})
        user_id = unverified.get("sub") or unverified.get("id") or unverified.get("userId")
        if user_id:
            return str(user_id)
    except Exception as e:
        if len(clean_token) > 5 and not "." in clean_token:
            return clean_token
    
    return "authenticated_user"

def get_authenticated_user_profile(authorization_header: Optional[str]) -> Dict[str, Any]:
    """
    Retrieves the actual authenticated user's name, username, email, and DB ObjectId from MongoDB.
    """
    user_id = extract_user_id_from_token(authorization_header)
    
    default_profile = {
        "user_id": user_id,
        "name": "Authenticated User",
        "username": "user",
        "email": ""
    }

    if _auth_db is None or user_id in ["anonymous_user", "authenticated_user"]:
        return default_profile

    try:
        query_conditions = [{"clerkId": user_id}]
        if ObjectId.is_valid(user_id):
            query_conditions.append({"_id": ObjectId(user_id)})
            
        doc = _auth_db["users"].find_one({"$or": query_conditions})
        if doc:
            return {
                "user_id": user_id,
                "db_id": str(doc.get("_id")),
                "name": doc.get("name") or doc.get("username") or "User",
                "username": doc.get("username") or "user",
                "email": doc.get("email") or ""
            }
    except Exception as e:
        print("Error fetching user profile:", e)

    return default_profile
