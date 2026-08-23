# TripMate AI Assistant - Production Test Suite & Behavioral Playbook

This document contains the complete test cases, edge-case resolution rules, dynamic identity verification, and FastMCP microservice specs for the TripMate platform.

---

## 📑 Test Categories & Edge Cases

1. **Category 1: Dynamic Session-Based User Identity (Zero Hardcoding)**
2. **Category 2: Duplicate Payer & Split Consolidation (Fixed Repeated Entries)**
3. **Category 3: Human Ambiguity & Refusal of Arbitrary Actions (Playbook Rules)**
4. **Category 4: Edit Expense Edge Cases (No Changes vs Proposed Changes vs Ambiguity)**
5. **Category 5: Custom Split Mathematical Verification**
6. **Category 6: Persisted Proposal Resolution & Disabling**
7. **Category 7: In-App Dialogs (No Native Browser Popups)**
8. **Category 8: Standalone FastMCP Microservice Cloud Deployment**

---

## 1. Category 1: Dynamic Session-Based User Identity

### Test Case 1.1: Logged-in User Identity Query ("What is my name?")
* **Scenario**:
  * User A (`shubhraj`, `Shubh Rajput`) is logged in $\rightarrow$ Output: `"Your name is **Shubh Rajput** (username: @shubhraj)."`
  * User B (`priya`, `Priya Patel`) is logged in $\rightarrow$ Output: `"Your name is **Priya Patel** (username: @priya, email: priya@example.com)."`
* **Zero Hardcoding**: Identity is dynamically resolved from the Clerk session token on every API call.

### Test Case 1.2: "Paid by me" Resolution
* **User Input**:
  ```text
  Add 1500 for dinner paid by me split equally
  ```
* **Expected Result**:
  * Resolves "me" dynamically to the active session user (e.g. `Priya Patel` if Priya is logged in, `Shubh Rajput` if Shubh is logged in).

---

## 2. Category 2: Duplicate Payer & Split Consolidation

### Test Case 2.1: Repeated Payer Mentions
* **User Input**:
  ```text
  Add 800 for snacks where Priya paid 500, Rohit paid 200 and Rohit paid 100, split between all
  ```
* **Expected Result**:
  * Consolidates duplicate mentions for Rohit into a single entry: `Rohit Sharma (₹300.00)`.
  * Form Proposal Card displays:
    * `Paid By`: `Priya Patel (₹500.00), Rohit Sharma (₹300.00) [Total: ₹800.00]`
  * Stored in SplitMate as a single consolidated `{ user: rohit_id, amount: 300 }` entry.

---

## 3. Category 3: Human Ambiguity & Refusal of Arbitrary Actions

### Test Case 3.1: Open-Ended or Guesswork Amounts
* **User Input**:
  ```text
  Add lunch for whatever you think is fair
  ```
* **Expected Result**:
  * Assistant **strictly refuses to invent amounts**:
    > *"As a financial assistant, I cannot assume or invent expense amounts. Please provide the exact amount spent on lunch (e.g., ₹1,200), who paid for it, and how it should be split."*

### Test Case 3.2: Arbitrary Delete Request
* **User Input**:
  ```text
  Delete whatever expense is bad
  ```
* **Expected Result**:
  * Assistant refuses random deletion and asks for the exact expense name or ID.

---

## 4. Category 4: Edit Expense Edge Cases

### Test Case 4.1: Ambiguous Edit Request
* **User Input**:
  ```text
  Edit the dinner expense
  ```
* **Expected Result**:
  * Assistant asks what to modify:
    > *"What would you like to update for 'Dinner' (₹1,500)? You can change the total amount, description, category, payer, or split distribution."*

### Test Case 4.2: Zero-Change Edit Request
* **User Input**:
  ```text
  Change dinner to dinner for 1500
  ```
* **Expected Result**:
  * Assistant detects identical values and informs the user:
    > *"No changes detected. The expense 'Dinner' is already recorded as ₹1,500.00. Please specify which field you would like to update."*

### Test Case 4.3: Valid Edit Request (Old vs New Comparison)
* **User Input**:
  ```text
  Change dinner expense amount from 1500 to 2000
  ```
* **Expected Result**:
  * Displays Old vs New comparison in the Proposal Card:
    * `Current Expense`: `Dinner (₹1,500.00)`
    * `New Amount`: `₹2,000.00`
    * `Action`: `Update Expense & Recalculate Balance Matrix`
    * Buttons: `[✅ Yes, Confirm & Execute]` and `[❌ No, Cancel]`.

---

## 5. Category 5: Standalone FastMCP Microservices

FastMCP tools are decoupled and ready for standalone cloud deployment via [run_mcp_all.py](file:///s:/CDC%20Projects/TripMate/TripMate-Mega/assistant-backend/mcp_servers/run_mcp_all.py):
* `python mcp_servers/run_mcp_all.py trip` $\rightarrow$ Runs Trip Management MCP Server
* `python mcp_servers/run_mcp_all.py friend` $\rightarrow$ Runs Friend Network MCP Server
* `python mcp_servers/run_mcp_all.py planner` $\rightarrow$ Runs AI Planner MCP Server
