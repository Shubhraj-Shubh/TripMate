# 🎨 TripMate - Frontend Application

Modern, dark-themed responsive single-page application built with **React 19**, **Vite**, **Clerk Authentication**, and **Recharts**.

---

## 📂 Folder Structure

```
frontend/
├── src/
│   ├── assets/             # Static logos and image assets
│   ├── components/         # Reusable UI components & Recharts (CategoryPieChart, SpendingBarChart)
│   ├── pages/
│   │   ├── Dashboard.jsx   # Global spending overview, active trips & friends cards
│   │   ├── Planner.jsx     # AI Multi-Agent Travel Itinerary Generator & Version History
│   │   ├── Trips.jsx       # SplitMate trip management & new trip creation modal
│   │   ├── TripDetails.jsx # Detailed trip view: expense logging, member management, balance matrix table
│   │   ├── Friends.jsx     # Friend network, balance overview (You owe / You get), incoming & outgoing requests
│   │   ├── Assistant.jsx   # AI Travel Assistant with FastMCP tools & HITL form proposal cards
│   │   └── NotFound.jsx    # Custom 404 page
│   ├── App.jsx             # Main router & Clerk authentication wrappers
│   ├── App.css             # Main navigation & hero styling
│   ├── index.css           # Global design system, glassmorphic card styles & modal overlays
│   └── main.jsx            # React root with ClerkProvider
├── .env.example            # Environment template
└── vite.config.js          # Vite bundler configuration
```

---

## 🚀 Setup & Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure `.env`:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```
   Application will be available at `http://localhost:5173`.

---

## 🌟 Key Features
- **Interactive Proposal Cards**: Form-like Human-In-The-Loop confirmation cards for adding/editing/deleting expenses and sending friend requests.
- **Centered In-App Dialogs**: Fixed-position animated modals for deletions, additions, and confirmations without browser alerts.
- **Dynamic Charting**: Live Recharts visualizations (Pie charts for category spending, Bar charts for member contributions).
- **Markdown & Code Rendering**: GitHub Flavored Markdown for AI chat replies and multi-day travel plans.
