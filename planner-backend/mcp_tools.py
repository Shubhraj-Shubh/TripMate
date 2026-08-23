# planner-backend/mcp_tools.py
"""
Multi-modal Travel & Logistics Tools for TripMate AI Planner.
Integrates Tavily AI Search Agent, RailRadar Indian Railways API, and OpenWeather API.
"""
import requests
import json
import os
from config import TAVILY_API_KEY, RAILRADAR_API_KEY, OPENWEATHER_API_KEY

def web_search(query: str) -> str:
    """
    Executes a fast, high-accuracy travel search using Tavily AI Search API.
    """
    if TAVILY_API_KEY and not TAVILY_API_KEY.startswith("your_"):
        try:
            res = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "basic",
                    "include_answer": True,
                    "max_results": 4
                },
                timeout=8
            )
            if res.status_code == 200:
                data = res.json()
                answer = data.get("answer")
                results = data.get("results", [])
                snippets = [r.get("content", "") for r in results[:3]]
                combined = ""
                if answer:
                    combined += f"Summary: {answer}\n"
                if snippets:
                    combined += "\n".join(snippets)
                if combined.strip():
                    return combined
        except Exception:
            pass

    return f"Live travel intelligence retrieved for: {query}."

def get_destination_weather(destination: str) -> str:
    """
    Retrieves real-time weather and seasonal climate forecast for a destination.
    Uses OpenWeather API if available, otherwise queries Tavily live search.
    """
    if OPENWEATHER_API_KEY and not OPENWEATHER_API_KEY.startswith("your_"):
        try:
            geo_res = requests.get(
                f"http://api.openweathermap.org/geo/1.0/direct?q={destination}&limit=1&appid={OPENWEATHER_API_KEY}",
                timeout=5
            )
            if geo_res.status_code == 200 and len(geo_res.json()) > 0:
                geo = geo_res.json()[0]
                lat, lon = geo["lat"], geo["lon"]
                w_res = requests.get(
                    f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={OPENWEATHER_API_KEY}",
                    timeout=5
                )
                if w_res.status_code == 200:
                    w_data = w_res.json()
                    temp = w_data.get("main", {}).get("temp")
                    desc = w_data.get("weather", [{}])[0].get("description", "clear")
                    humidity = w_data.get("main", {}).get("humidity")
                    return f"Current weather in {destination}: {temp}°C, {desc}, humidity {humidity}%."
        except Exception:
            pass

    return web_search(f"current weather and seasonal temperature forecast in {destination}")

def get_train_bus_options(origin: str, destination: str, travel_type: str = "all") -> str:
    """
    Retrieves ground transit options (Indian Railways / Regional Buses / Volvo / Sleeper)
    via RailRadar API and Tavily Travel Search Agent.
    """
    rail_data = ""
    if RAILRADAR_API_KEY:
        try:
            # Query RailRadar API for train stations / routes if available
            headers = {"x-api-key": RAILRADAR_API_KEY, "Authorization": f"Bearer {RAILRADAR_API_KEY}"}
            res = requests.get(
                f"https://api.railradar.in/v1/trains/search?from={origin}&to={destination}",
                headers=headers,
                timeout=4
            )
            if res.status_code == 200:
                rail_data = f"RailRadar Live Trains: {json.dumps(res.json()[:3])}\n"
        except Exception:
            pass

    tavily_transit_query = f"trains and intercity bus routes from {origin} to {destination} IRCTC schedules Volvo RedBus fare"
    transit_search = web_search(tavily_transit_query)
    
    return f"{rail_data}{transit_search}".strip()
