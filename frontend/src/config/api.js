// frontend/src/config/api.js
// Centralized API endpoints with fallback to local development ports

export const SPLITMATE_API = import.meta.env.VITE_SPLITMATE_API || 'http://localhost:5000/api';
export const PLANNER_API = import.meta.env.VITE_PLANNER_API || 'http://localhost:8001/api';
export const ASSISTANT_API = import.meta.env.VITE_ASSISTANT_API || 'http://localhost:8002/api';
