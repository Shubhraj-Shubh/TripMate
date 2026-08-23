# 💳 SplitMate Backend - Group Expense & Debt Settlement Microservice

Node.js / Express microservice responsible for user profiles, trip groups, multi-payer expense recording, exact/custom splitting, and mathematical $N \times N$ matrix debt simplification.

---

## 📂 Folder Structure

```
splitmate-backend/
├── controllers/
│   ├── tripController.js    # Expense logging, multi-payer deduplication, balance matrix calculation
│   ├── friendController.js  # Friend requests (send/accept/decline) & friend net balances
│   └── userController.js    # User sync & profile management
├── middlewares/
│   └── authMiddleware.js    # Clerk JWT verification & internal service auth
├── models/
│   ├── Trip.js              # Trip schema (members, expenses, balanceMatrix, attachedPlan)
│   ├── User.js              # User schema (clerkId, username, name, email)
│   └── FriendRequest.js     # Friend request relations schema
├── routes/
│   ├── tripRoutes.js        # /api/trips endpoints
│   ├── friendRoutes.js      # /api/friends endpoints
│   └── userRoutes.js        # /api/users endpoints
├── server.js                # Express entry point & MongoDB connection
├── .env.example             # Environment template
└── package.json             # NPM dependencies
```

---

## 🧮 Mathematical Matrix Balance Algorithm

The debt matrix is an $N \times N$ 2D array where:
- `matrix[i][j] > 0`: Member $i$ owes Member $j$ that amount.
- `matrix[i][j] < 0`: Member $i$ gets that amount from Member $j$.
- `matrix[i][i] = 0`: Diagonal is always 0.

Whenever an expense is added, edited, or deleted:
1. Each member's net paid vs net share is calculated.
2. Debt is netted between each pair $(i, j)$: $\text{matrix}[i][j] = -\text{matrix}[j][i]$.
3. Payers and custom splits are automatically consolidated to prevent repeated/duplicate entries.

---

## 🚀 Setup & Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env`:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://...
   JWT_SECRET=your_secret
   CLERK_SECRET_KEY=sk_test_...
   FRONTEND_URL=http://localhost:5173
   ```
3. Run server:
   ```bash
   node server.js
   ```
