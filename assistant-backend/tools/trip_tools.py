# assistant-backend/tools/trip_tools.py
import requests
from typing import Any, Dict, List, Optional, Union
from fastmcp import FastMCP
from config import NODE_API_BASE

trip_mcp = FastMCP("TripMate-Trip-Server")

def _get_headers(token: str) -> dict:
    clean_token = token.replace("Bearer ", "").strip()
    return {
        "Authorization": f"Bearer {clean_token}",
        "Content-Type": "application/json"
    }

def _extract_error_message(res: requests.Response) -> str:
    try:
        data = res.json()
        if isinstance(data, dict):
            return data.get("message") or data.get("error") or res.text
        return str(data)
    except Exception:
        return res.text

def resolve_member_strict(identifier: str, members: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Strictly resolves a member from a trip's member list by exact match.
    Matches against: _id, username, email, full name, or exact first name.
    NEVER fuzzy-matches non-members or defaults to random members.
    """
    if not identifier or not members:
        return None
    clean = str(identifier).replace("@", "").strip().lower()
    
    # 1. Exact ID, Username, Email, or Full Name Match
    for m in members:
        m_id = str(m.get("_id", "")).lower()
        m_username = str(m.get("username", "")).lower()
        m_name = str(m.get("name", "")).lower()
        m_email = str(m.get("email", "")).lower()
        if clean in [m_id, m_username, m_name, m_email]:
            return m

    # 2. Exact First Name Match (e.g., 'raj' -> 'Raj Kapoor', 'sneha' -> 'Sneha Rao')
    for m in members:
        m_name = str(m.get("name", "")).lower()
        parts = m_name.split()
        if parts and clean == parts[0]:
            return m

    return None

# ---------------------------------------------------------------------------
# READ OPERATIONS (Direct Execution)
# ---------------------------------------------------------------------------

@trip_mcp.tool()
def get_user_trips(token: str) -> List[Dict[str, Any]]:
    """Fetch all trips belonging to the authenticated user."""
    try:
        res = requests.get(f"{NODE_API_BASE}/trips/my-trips", headers=_get_headers(token), timeout=10)
        if res.status_code == 200:
            return res.json()
        return [{"error": f"Failed with status {res.status_code}: {res.text}"}]
    except Exception as e:
        return [{"error": str(e)}]

@trip_mcp.tool()
def get_trip_details(trip_id: str, token: str) -> Dict[str, Any]:
    """Fetch full trip info, members, expenses, attached plan, and balance matrix."""
    try:
        res = requests.get(f"{NODE_API_BASE}/trips/{trip_id}", headers=_get_headers(token), timeout=10)
        if res.status_code == 200:
            return res.json()
        return {"error": f"Failed with status {res.status_code}: {res.text}"}
    except Exception as e:
        return {"error": str(e)}

@trip_mcp.tool()
def get_trip_balances(trip_id: str, token: str) -> Dict[str, Any]:
    """Calculate who owes whom in a trip and return both the full Balance Matrix table and simplified settlements."""
    try:
        trip_res = requests.get(f"{NODE_API_BASE}/trips/{trip_id}", headers=_get_headers(token), timeout=10)
        if trip_res.status_code != 200:
            return {"error": "Trip not found."}
        trip = trip_res.json()
        members = trip.get("members", [])
        matrix = trip.get("balanceMatrix", [])
        n = len(members)

        # 1. Build Markdown Table Matrix
        headers = ["Member (Owes \\ Gets)"] + [m.get("name") or m.get("username") for m in members]
        matrix_table_rows = []
        for i in range(n):
            p_name = members[i].get("name") or members[i].get("username")
            row = [f"**{p_name}**"]
            for j in range(n):
                if i == j:
                    row.append("—")
                else:
                    val = matrix[i][j] if i < len(matrix) and j < len(matrix[i]) else 0
                    if val > 0.01:
                        row.append(f"Owes ₹{round(val):,}")
                    elif val < -0.01:
                        row.append(f"Gets ₹{round(abs(val)):,}")
                    else:
                        row.append("₹0")
            matrix_table_rows.append("| " + " | ".join(row) + " |")

        table_md = "| " + " | ".join(headers) + " |\n"
        table_md += "| " + " | ".join(["---"] * len(headers)) + " |\n"
        table_md += "\n".join(matrix_table_rows)

        # 2. Simplified Settlements
        settlements = []
        for i in range(n):
            for j in range(i + 1, n):
                val = matrix[i][j] if i < len(matrix) and j < len(matrix[i]) else 0
                debtor = members[i].get("name") or members[i].get("username")
                creditor = members[j].get("name") or members[j].get("username")
                if val > 0.01:
                    settlements.append(f"**{debtor}** owes **{creditor}** ₹{round(val):,}")
                elif val < -0.01:
                    settlements.append(f"**{creditor}** owes **{debtor}** ₹{round(abs(val)):,}")

        return {
            "trip_title": trip.get("title"),
            "matrix_table": table_md,
            "settlements": settlements if settlements else ["All trip expenses are completely settled! (₹0)"]
        }
    except Exception as e:
        return {"error": str(e)}

@trip_mcp.tool()
def get_trip_category_summary(trip_id: str, token: str) -> Dict[str, Any]:
    """Get spending totals grouped by category (Food, Travel, Stay, Tickets, Adventure, Shopping, Other) for charts."""
    try:
        trip_res = requests.get(f"{NODE_API_BASE}/trips/{trip_id}", headers=_get_headers(token), timeout=10)
        if trip_res.status_code != 200:
            return {"error": "Trip not found."}
        trip = trip_res.json()
        expenses = trip.get("expenses", [])

        categories = {}
        total = 0
        for exp in expenses:
            cat = exp.get("category", "Other").capitalize()
            amt = float(exp.get("amount", 0))
            categories[cat] = categories.get(cat, 0) + amt
            total += amt

        chart_data = [{"name": k, "value": v} for k, v in categories.items()]
        return {
            "trip_title": trip.get("title"),
            "total_spent": total,
            "category_summary": chart_data
        }
    except Exception as e:
        return {"error": str(e)}

@trip_mcp.tool()
def get_trip_member_summary(trip_id: str, token: str) -> Dict[str, Any]:
    """Get spending contribution for each member in a trip for bar charts."""
    try:
        res = requests.get(f"{NODE_API_BASE}/trips/{trip_id}/membersExpenseSummary", headers=_get_headers(token), timeout=10)
        if res.status_code == 200:
            data = res.json()
            chart_data = [{"name": m.get("memberName"), "amount": round(m.get("totalExpenseByThatMember", 0))} for m in data.get("summary", [])]
            return {
                "trip_title": data.get("tripTitle"),
                "member_summary": chart_data
            }
        return {"error": f"Failed with status {res.status_code}: {res.text}"}
    except Exception as e:
        return {"error": str(e)}

# ---------------------------------------------------------------------------
# WRITE OPERATIONS (Triggered after HITL Confirmation)
# ---------------------------------------------------------------------------

@trip_mcp.tool()
def add_trip_member(trip_id: str, identifier: str, token: str) -> Dict[str, Any]:
    """Add a new member to a trip by username or email."""
    try:
        clean_id = identifier.replace("@", "").strip()
        res = requests.post(
            f"{NODE_API_BASE}/trips/{trip_id}/members",
            json={"members": [clean_id]},
            headers=_get_headers(token),
            timeout=10
        )
        if res.status_code == 200:
            return res.json()
        return {"error": f"Failed to add member: {res.text}"}
    except Exception as e:
        return {"error": str(e)}

@trip_mcp.tool()
def add_trip_expense(
    trip_id: str,
    description: str,
    amount: float,
    paid_by: Union[str, List[Dict[str, Any]], Dict[str, float]],
    split_between: List[str],
    category: str = "Food",
    split_type: str = "equal",
    custom_splits: Optional[Dict[str, float]] = None,
    token: str = ""
) -> Dict[str, Any]:
    """Add a new expense to a trip with strict member validation, duplicate consolidation, and exact split persistence."""
    try:
        trip_res = requests.get(f"{NODE_API_BASE}/trips/{trip_id}", headers=_get_headers(token), timeout=10)
        if trip_res.status_code != 200:
            return {"error": "Could not retrieve trip to resolve members."}
        trip = trip_res.json()
        members = trip.get("members", [])
        member_names = [m.get("name") or m.get("username") for m in members]

        # 1. Parse Payers
        raw_paid_by_list = []
        if isinstance(paid_by, list):
            for p in paid_by:
                name = p.get("user") or p.get("name") or p.get("member")
                amt = float(p.get("amount", 0))
                m_obj = resolve_member_strict(name, members)
                if not m_obj:
                    return {"error": f"'{name}' is not a registered member of this trip. Registered members: {', '.join(member_names)}."}
                raw_paid_by_list.append({"user": m_obj["_id"], "amount": amt})
        elif isinstance(paid_by, dict):
            for name, amt in paid_by.items():
                m_obj = resolve_member_strict(name, members)
                if not m_obj:
                    return {"error": f"'{name}' is not a registered member of this trip. Registered members: {', '.join(member_names)}."}
                raw_paid_by_list.append({"user": m_obj["_id"], "amount": float(amt)})
        else:
            str_paid = str(paid_by).strip()
            if ":" in str_paid or "," in str_paid:
                parts = str_paid.split(",")
                for pt in parts:
                    if ":" in pt:
                        n_part, a_part = pt.split(":")
                        m_obj = resolve_member_strict(n_part.strip(), members)
                        if not m_obj:
                            return {"error": f"'{n_part.strip()}' is not a registered member of this trip. Registered members: {', '.join(member_names)}."}
                        raw_paid_by_list.append({"user": m_obj["_id"], "amount": float(a_part.strip())})
                    else:
                        m_obj = resolve_member_strict(pt.strip(), members)
                        if not m_obj:
                            return {"error": f"'{pt.strip()}' is not a registered member of this trip. Registered members: {', '.join(member_names)}."}
                        raw_paid_by_list.append({"user": m_obj["_id"], "amount": float(amount)})
            else:
                m_obj = resolve_member_strict(str_paid, members)
                if not m_obj:
                    return {"error": f"'{str_paid}' is not a registered member of this trip. Registered members: {', '.join(member_names)}."}
                raw_paid_by_list.append({"user": m_obj["_id"], "amount": float(amount)})

        if not raw_paid_by_list:
            return {"error": "At least one valid payer is required."}

        # Consolidate Duplicate Payers
        payer_map = {}
        for p in raw_paid_by_list:
            u_id = p["user"]
            payer_map[u_id] = payer_map.get(u_id, 0.0) + p["amount"]
        paid_by_list = [{"user": u_id, "amount": amt} for u_id, amt in payer_map.items()]

        # 2. Parse & Deduplicate Split Members
        split_ids = []
        for name in split_between:
            clean_name = str(name).replace("@", "").lower().strip()
            if clean_name in ["all", "everyone", "everybody"]:
                split_ids = [m["_id"] for m in members]
                break
            m_obj = resolve_member_strict(clean_name, members)
            if not m_obj:
                return {"error": f"Split participant '{clean_name}' is not a registered member of this trip. Registered members: {', '.join(member_names)}."}
            if m_obj["_id"] not in split_ids:
                split_ids.append(m_obj["_id"])

        if not split_ids:
            split_ids = [m["_id"] for m in members]

        payload = {
            "description": description.strip(),
            "amount": float(amount),
            "category": category or "Food",
            "paidBy": paid_by_list,
            "splitBetween": split_ids,
            "splitType": split_type or "equal"
        }

        # Consolidate Custom Splits
        if split_type == "exact" and custom_splits:
            split_map = {}
            for user_ref, user_amt in custom_splits.items():
                m_obj = resolve_member_strict(user_ref, members)
                if not m_obj:
                    return {"error": f"Split participant '{user_ref}' is not a registered member of this trip."}
                u_id = m_obj["_id"]
                split_map[u_id] = split_map.get(u_id, 0.0) + float(user_amt)
            payload["splits"] = [{"user": u_id, "amount": amt} for u_id, amt in split_map.items()]

        res = requests.post(
            f"{NODE_API_BASE}/trips/{trip_id}/expenses",
            json=payload,
            headers=_get_headers(token),
            timeout=10
        )
        if res.status_code in [200, 201]:
            return {
                "success": True,
                "message": f"Successfully added expense '{description}' of ₹{amount:,.2f}.",
                "expense": payload,
                "trip_id": trip_id
            }
        return {"error": f"Failed to add expense: {res.text}"}
    except Exception as e:
        return {"error": str(e)}

@trip_mcp.tool()
def edit_trip_expense(
    trip_id: str,
    expense_id: str,
    description: str,
    amount: float,
    paid_by: Union[str, List[Dict[str, Any]], Dict[str, float]],
    split_between: List[str],
    category: str = "Food",
    split_type: str = "equal",
    custom_splits: Optional[Dict[str, float]] = None,
    token: str = ""
) -> Dict[str, Any]:
    """Edit an existing expense in a trip."""
    try:
        trip_res = requests.get(f"{NODE_API_BASE}/trips/{trip_id}", headers=_get_headers(token), timeout=10)
        if trip_res.status_code != 200:
            return {"error": "Could not retrieve trip."}
        trip = trip_res.json()
        members = trip.get("members", [])

        raw_paid = []
        if isinstance(paid_by, list):
            for p in paid_by:
                name = p.get("user") or p.get("name")
                amt = float(p.get("amount", 0))
                m_obj = resolve_member_strict(name, members)
                if not m_obj:
                    return {"error": f"Payer '{name}' is not in this trip."}
                raw_paid.append({"user": m_obj["_id"], "amount": amt})
        else:
            m_obj = resolve_member_strict(str(paid_by), members)
            if not m_obj:
                return {"error": f"Payer '{paid_by}' is not in this trip."}
            raw_paid.append({"user": m_obj["_id"], "amount": float(amount)})

        payer_map = {}
        for p in raw_paid:
            u_id = p["user"]
            payer_map[u_id] = payer_map.get(u_id, 0.0) + p["amount"]
        paid_by_list = [{"user": u_id, "amount": amt} for u_id, amt in payer_map.items()]

        split_ids = []
        for name in split_between:
            clean_name = str(name).replace("@", "").lower().strip()
            if clean_name in ["all", "everyone"]:
                split_ids = [m["_id"] for m in members]
                break
            m_obj = resolve_member_strict(clean_name, members)
            if m_obj and m_obj["_id"] not in split_ids:
                split_ids.append(m_obj["_id"])
        if not split_ids:
            split_ids = [m["_id"] for m in members]

        payload = {
            "description": description.strip(),
            "amount": float(amount),
            "category": category or "Food",
            "paidBy": paid_by_list,
            "splitBetween": split_ids,
            "splitType": split_type or "equal"
        }

        if split_type == "exact" and custom_splits:
            split_map = {}
            for user_ref, user_amt in custom_splits.items():
                m_obj = resolve_member_strict(user_ref, members)
                if m_obj:
                    u_id = m_obj["_id"]
                    split_map[u_id] = split_map.get(u_id, 0.0) + float(user_amt)
            payload["splits"] = [{"user": u_id, "amount": amt} for u_id, amt in split_map.items()]

        res = requests.put(
            f"{NODE_API_BASE}/trips/{trip_id}/expenses/{expense_id}",
            json=payload,
            headers=_get_headers(token),
            timeout=10
        )
        if res.status_code == 200:
            return {"success": True, "message": f"Updated expense '{description}' (₹{amount:,.2f})."}
        return {"error": f"Failed to edit expense: {res.text}"}
    except Exception as e:
        return {"error": str(e)}

@trip_mcp.tool()
def delete_trip_expense(trip_id: str, expense_id: str, token: str) -> Dict[str, Any]:
    """Delete a specific expense from a trip and adjust the balance matrix."""
    try:
        res = requests.delete(
            f"{NODE_API_BASE}/trips/{trip_id}/expenses/{expense_id}",
            headers=_get_headers(token),
            timeout=10
        )
        if res.status_code == 200:
            return {"success": True, "message": "Expense successfully deleted and balances recalculated."}
        return {"error": f"Failed with status {res.status_code}: {res.text}"}
    except Exception as e:
        return {"error": str(e)}

@trip_mcp.tool()
def undo_last_expense(trip_id: str, token: str) -> Dict[str, Any]:
    """Undo/remove the most recently added expense from a trip."""
    try:
        trip_res = requests.get(f"{NODE_API_BASE}/trips/{trip_id}", headers=_get_headers(token), timeout=10)
        if trip_res.status_code != 200:
            return {"error": "Trip not found."}
        trip = trip_res.json()
        expenses = trip.get("expenses", [])
        if not expenses:
            return {"message": "No expenses found in this trip to undo."}
        
        last_expense = expenses[-1]
        exp_id = last_expense.get("_id")
        desc = last_expense.get("description", "Expense")
        amt = last_expense.get("amount", 0)

        del_res = requests.delete(
            f"{NODE_API_BASE}/trips/{trip_id}/expenses/{exp_id}",
            headers=_get_headers(token),
            timeout=10
        )
        if del_res.status_code == 200:
            return {
                "success": True,
                "message": f"Successfully undone last expense: '{desc}' (₹{amt:,.2f}).",
                "undone_expense_id": exp_id
            }
        return {"error": f"Failed to undo expense: {del_res.text}"}
    except Exception as e:
        return {"error": str(e)}
