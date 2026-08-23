# assistant-backend/core/agent.py
import json
import re
from typing import List, Dict, Any, Optional, Union
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool

from core.llm import get_llm
from core.prompts import SYSTEM_PROMPT
from config import PRIMARY_MODEL, FALLBACK_MODELS
import tools.trip_tools as trip_tools
import tools.friend_tools as friend_tools
import tools.planner_tools as planner_tools
import auth
import db

def run_assistant_agent(
    user_message: str,
    thread_id: str,
    user_id: str,
    trip_id: Optional[str] = None,
    context_type: Optional[str] = "global",
    token: str = "",
    conversation_history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Executes the TripMate Assistant Agent with dynamic User Identity, Playbook Guardrails, and Consolidated Payers.
    """
    chart_data = None
    action_proposal = None
    is_trip_mode = (context_type == "trip" and bool(trip_id))

    # Dynamically Resolve Authenticated User Profile from Bearer Token
    user_profile = auth.get_authenticated_user_profile(token)
    user_display_name = user_profile.get("name") or "User"
    user_username = user_profile.get("username") or "user"
    user_email = user_profile.get("email") or ""
    user_db_id = user_profile.get("db_id") or ""

    user_identity_block = (
        f"- Full Name: {user_display_name}\n"
        f"- Username: @{user_username}\n"
        f"- Email: {user_email}\n"
        f"- Database ID: {user_db_id}"
    )

    # -----------------------------------------------------------------------
    # 1. READ TOOLS
    # -----------------------------------------------------------------------
    @tool
    def tool_get_user_trips() -> str:
        """Fetch all trips belonging to the authenticated user."""
        res = trip_tools.get_user_trips(token=token)
        return json.dumps(res)

    @tool
    def tool_get_trip_details(target_trip_id: Optional[str] = None) -> str:
        """Fetch details of a specific trip including members, expenses, attached plan, and balance matrix."""
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: No trip selected. Please specify which trip you are asking about."
        res = trip_tools.get_trip_details(trip_id=tid, token=token)
        return json.dumps(res)

    @tool
    def tool_get_trip_balances(target_trip_id: Optional[str] = None) -> str:
        """Calculate who owes whom in a trip and return the Markdown Matrix Table."""
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: No trip selected."
        res = trip_tools.get_trip_balances(trip_id=tid, token=token)
        return json.dumps(res)

    @tool
    def tool_get_trip_category_summary(target_trip_id: Optional[str] = None) -> str:
        """Get spending totals grouped by category for pie charts."""
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: No trip selected."
        res = trip_tools.get_trip_category_summary(trip_id=tid, token=token)
        return json.dumps(res)

    @tool
    def tool_get_trip_member_summary(target_trip_id: Optional[str] = None) -> str:
        """Get spending contribution for each member in a trip for bar charts."""
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: No trip selected."
        res = trip_tools.get_trip_member_summary(trip_id=tid, token=token)
        return json.dumps(res)

    @tool
    def tool_get_friends_balances() -> str:
        """Fetch all connected friends and their net balances (You owe / You get / Settled)."""
        res = friend_tools.get_friends_balances(token=token)
        return json.dumps(res)

    @tool
    def tool_get_friend_requests() -> str:
        """Fetch all incoming and outgoing friend requests."""
        res = friend_tools.get_friend_requests(token=token)
        return json.dumps(res)

    @tool
    def tool_list_saved_itineraries() -> str:
        """List all saved AI travel itineraries and their available version numbers."""
        res = planner_tools.list_saved_itineraries(token=token)
        return json.dumps(res)

    @tool
    def tool_get_itinerary_version_details(plan_id_or_destination: str, version: Optional[int] = None) -> str:
        """Fetch the Markdown itinerary text for a specific trip plan and version."""
        res = planner_tools.get_itinerary_version_details(plan_id=plan_id_or_destination, version=version, token=token)
        return json.dumps(res)

    # -----------------------------------------------------------------------
    # 2. WRITE PROPOSAL TOOLS
    # -----------------------------------------------------------------------
    @tool
    def tool_propose_add_expense(
        description: str,
        amount: float,
        paid_by: Union[str, List[Dict[str, Any]], Dict[str, float]],
        split_between: List[str],
        category: str = "Food",
        split_type: str = "equal",
        custom_splits: Optional[Dict[str, float]] = None,
        target_trip_id: Optional[str] = None
    ) -> str:
        """Propose adding a new expense with strict member validation, consolidated duplicate payers, and exact splits."""
        nonlocal action_proposal
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: Please specify which trip to add this expense to."

        # Fetch Trip Members
        trip_info = trip_tools.get_trip_details(tid, token)
        if "error" in trip_info:
            return f"Error retrieving trip: {trip_info['error']}"
        members = trip_info.get("members", [])
        member_names = [m.get("name") or m.get("username") for m in members]

        # Helper to normalize 'me' / 'i'
        def normalize_name(raw_name: str) -> str:
            clean = str(raw_name).strip()
            if clean.lower() in ["me", "i", "myself", "you"]:
                return user_display_name
            return clean

        # Parse & Validate Payers
        raw_payers = []
        if isinstance(paid_by, list):
            for p in paid_by:
                name = normalize_name(p.get("name") or p.get("user") or "")
                amt = float(p.get("amount", 0))
                m_obj = trip_tools.resolve_member_strict(name, members)
                if not m_obj:
                    return f"MEMBER_NOT_FOUND: '{name}' is not a registered member of this trip. Valid trip members are: {', '.join(member_names)}. DO NOT create proposal."
                raw_payers.append({"obj": m_obj, "amount": amt})
        elif isinstance(paid_by, dict):
            for raw_n, amt in paid_by.items():
                name = normalize_name(raw_n)
                m_obj = trip_tools.resolve_member_strict(name, members)
                if not m_obj:
                    return f"MEMBER_NOT_FOUND: '{name}' is not a registered member of this trip. Valid trip members are: {', '.join(member_names)}. DO NOT create proposal."
                raw_payers.append({"obj": m_obj, "amount": float(amt)})
        else:
            str_paid = str(paid_by).strip()
            if ":" in str_paid or "," in str_paid:
                for pt in str_paid.split(","):
                    if ":" in pt:
                        n_pt, a_pt = pt.split(":")
                        name = normalize_name(n_pt)
                        m_obj = trip_tools.resolve_member_strict(name, members)
                        if not m_obj:
                            return f"MEMBER_NOT_FOUND: '{n_pt.strip()}' is not a registered member of this trip. Valid trip members are: {', '.join(member_names)}. DO NOT create proposal."
                        raw_payers.append({"obj": m_obj, "amount": float(a_pt.strip())})
                    else:
                        name = normalize_name(pt)
                        m_obj = trip_tools.resolve_member_strict(name, members)
                        if not m_obj:
                            return f"MEMBER_NOT_FOUND: '{pt.strip()}' is not a registered member of this trip. Valid trip members are: {', '.join(member_names)}. DO NOT create proposal."
                        raw_payers.append({"obj": m_obj, "amount": float(amount)})
            else:
                name = normalize_name(str_paid)
                m_obj = trip_tools.resolve_member_strict(name, members)
                if not m_obj:
                    return f"MEMBER_NOT_FOUND: '{str_paid}' is not a registered member of this trip. Valid trip members are: {', '.join(member_names)}. DO NOT create proposal."
                raw_payers.append({"obj": m_obj, "amount": float(amount)})

        # Consolidate Duplicate Payers by User ID
        payer_map = {}
        for p in raw_payers:
            u_id = p["obj"]["_id"]
            u_name = p["obj"].get("name") or p["obj"].get("username")
            if u_id not in payer_map:
                payer_map[u_id] = {"name": u_name, "amount": 0.0, "user": u_id}
            payer_map[u_id]["amount"] += p["amount"]

        payers_breakdown = [f"{p['name']} (₹{p['amount']:,.2f})" for p in payer_map.values()]
        sum_payers = sum(p["amount"] for p in payer_map.values())
        parsed_paid_by = [{"name": p["name"], "user": p["user"], "amount": p["amount"]} for p in payer_map.values()]

        # Mathematical Validation (Total vs Payers)
        if abs(sum_payers - float(amount)) > 0.01:
            return (
                f"MATHEMATICAL_MISMATCH: Total expense amount (₹{amount:,.2f}) does not match sum of payer contributions (₹{sum_payers:,.2f}). "
                f"Difference is ₹{abs(amount - sum_payers):,.2f}. DO NOT create proposal. Ask user to clarify."
            )

        # Custom Split Validation
        clean_custom_splits = None
        if split_type == "exact" or custom_splits:
            if not custom_splits:
                return "ERROR: For custom split mode, exact amounts for each member must be specified. DO NOT create proposal."
            
            clean_custom_splits = {}
            sum_splits = 0.0
            split_breakdown_items = []

            for s_name, s_amt in custom_splits.items():
                norm_s = normalize_name(s_name)
                m_obj = trip_tools.resolve_member_strict(norm_s, members)
                if not m_obj:
                    return f"MEMBER_NOT_FOUND: Split participant '{s_name}' is not in this trip. Valid trip members: {', '.join(member_names)}. DO NOT create proposal."
                m_name = m_obj.get("name") or m_obj.get("username")
                val = float(s_amt)
                # Consolidate duplicate split members if entered repeatedly
                clean_custom_splits[m_name] = clean_custom_splits.get(m_name, 0.0) + val
                sum_splits += val

            for m_name, val in clean_custom_splits.items():
                split_breakdown_items.append(f"{m_name} (₹{val:,.2f})")

            if abs(sum_splits - float(amount)) > 0.01:
                return (
                    f"SPLIT_MATH_MISMATCH: Total custom split amount (₹{sum_splits:,.2f}) does not match total expense amount (₹{amount:,.2f}). "
                    f"Difference is ₹{abs(amount - sum_splits):,.2f}. DO NOT create proposal. Ask user to correct split distribution."
                )
            
            split_mode_label = f"Custom Split: {', '.join(split_breakdown_items)}"
            split_members_summary = ", ".join(clean_custom_splits.keys())
            split_type = "exact"
        else:
            # Equal Split Validation
            split_display = []
            for s_name in split_between:
                clean_s = str(s_name).replace("@", "").lower().strip()
                if clean_s in ["all", "everyone", "everybody"]:
                    split_display = member_names
                    break
                norm_s = normalize_name(s_name)
                m_obj = trip_tools.resolve_member_strict(norm_s, members)
                if not m_obj:
                    return f"MEMBER_NOT_FOUND: Split participant '{s_name}' is not in this trip. Valid trip members: {', '.join(member_names)}. DO NOT create proposal."
                m_name = m_obj.get("name") or m_obj.get("username")
                if m_name not in split_display:
                    split_display.append(m_name)

            if not split_display:
                split_display = member_names

            per_person = float(amount) / len(split_display) if split_display else float(amount)
            split_mode_label = f"Equal (₹{per_person:,.2f} / person across {len(split_display)} members)"
            split_members_summary = ", ".join(split_display)

        paid_summary = ", ".join(payers_breakdown)

        action_proposal = {
            "action_type": "ADD_EXPENSE",
            "summary": f"Add expense: **{description}** (₹{amount:,.2f}) paid by **{paid_summary}**, split among **{split_members_summary}**",
            "status": "PENDING",
            "form_details": {
                "Description": description,
                "Total Amount": f"₹{amount:,.2f}",
                "Category": category or "Food",
                "Paid By": paid_summary,
                "Split Mode": split_mode_label,
                "Split Members": split_members_summary
            },
            "payload": {
                "trip_id": tid,
                "description": description,
                "amount": amount,
                "paid_by": parsed_paid_by,
                "split_between": list(clean_custom_splits.keys()) if clean_custom_splits else split_display,
                "category": category,
                "split_type": split_type,
                "custom_splits": clean_custom_splits
            }
        }
        return f"Created proposal to add expense '{description}' (₹{amount:,.2f}). Form card presented to user."

    @tool
    def tool_propose_delete_expense(
        expense_id: Optional[str] = None,
        description: Optional[str] = None,
        target_trip_id: Optional[str] = None
    ) -> str:
        """Propose deleting an expense with full historical summary."""
        nonlocal action_proposal
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: No trip selected."

        trip_info = trip_tools.get_trip_details(tid, token)
        if "error" in trip_info:
            return f"Error retrieving trip: {trip_info['error']}"
        
        expenses = trip_info.get("expenses", [])
        if not expenses:
            return "No expenses found in this trip to delete."

        target_exp = None
        if expense_id:
            target_exp = next((e for e in expenses if str(e.get("_id")) == str(expense_id)), None)
        if not target_exp and description:
            clean_desc = description.lower().strip()
            target_exp = next((e for e in reversed(expenses) if clean_desc in e.get("description", "").lower()), None)
        if not target_exp:
            target_exp = expenses[-1]

        exp_id = str(target_exp.get("_id"))
        exp_desc = target_exp.get("description", "Expense")
        exp_amt = float(target_exp.get("amount", 0))
        exp_cat = target_exp.get("category", "General")
        
        paid_items = []
        for p in target_exp.get("paidBy", []):
            u_obj = p.get("user")
            u_name = u_obj.get("name") if isinstance(u_obj, dict) else "Member"
            paid_items.append(f"{u_name} (₹{float(p.get('amount', 0)):,.2f})")
        paid_str = ", ".join(paid_items) if paid_items else "Trip Member"

        action_proposal = {
            "action_type": "DELETE_EXPENSE",
            "summary": f"Delete expense: **{exp_desc}** (₹{exp_amt:,.2f}) and recalculate balances",
            "status": "PENDING",
            "form_details": {
                "Expense Description": exp_desc,
                "Amount": f"₹{exp_amt:,.2f}",
                "Category": exp_cat,
                "Paid By": paid_str,
                "Split Mode": target_exp.get("splitType", "equal").capitalize(),
                "Action": "Permanently Delete & Recalculate Balance Matrix"
            },
            "payload": {
                "trip_id": tid,
                "expense_id": exp_id
            }
        }
        return f"Created proposal to delete expense '{exp_desc}' (₹{exp_amt:,.2f}). Confirmation card presented to user."

    @tool
    def tool_propose_edit_expense(
        expense_id: Optional[str] = None,
        description: Optional[str] = None,
        amount: Optional[float] = None,
        paid_by: Optional[Union[str, List[Dict[str, Any]]]] = None,
        split_between: Optional[List[str]] = None,
        category: Optional[str] = None,
        target_trip_id: Optional[str] = None
    ) -> str:
        """Propose editing an existing expense with Old vs New comparison and no-change detection."""
        nonlocal action_proposal
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: No trip selected."

        trip_info = trip_tools.get_trip_details(tid, token)
        expenses = trip_info.get("expenses", [])
        if not expenses:
            return "No expenses found in this trip to edit."

        target_exp = None
        if expense_id:
            target_exp = next((e for e in expenses if str(e.get("_id")) == str(expense_id)), None)
        if not target_exp and description:
            clean_d = description.lower().strip()
            target_exp = next((e for e in reversed(expenses) if clean_d in e.get("description", "").lower()), None)
        if not target_exp:
            target_exp = expenses[-1]

        target_id = str(target_exp.get("_id"))
        old_desc = target_exp.get("description", "Expense")
        old_amt = float(target_exp.get("amount", 0))
        old_cat = target_exp.get("category", "Food")

        new_desc = description.strip() if description else old_desc
        new_amt = float(amount) if amount is not None else old_amt
        new_cat = category or old_cat

        # Check for Zero Changes
        if new_desc == old_desc and abs(new_amt - old_amt) < 0.01 and new_cat == old_cat and not paid_by and not split_between:
            return (
                f"NO_CHANGES_DETECTED: The expense '{old_desc}' is already set to ₹{old_amt:,.2f} ({old_cat}). "
                "No modifications were provided. Please specify what you would like to update (e.g. amount, description, payer, or split)."
            )

        action_proposal = {
            "action_type": "EDIT_EXPENSE",
            "summary": f"Update expense: **{old_desc}** (₹{old_amt:,.2f}) -> **{new_desc}** (₹{new_amt:,.2f})",
            "status": "PENDING",
            "form_details": {
                "Current Expense": f"{old_desc} (₹{old_amt:,.2f})",
                "New Description": new_desc,
                "New Amount": f"₹{new_amt:,.2f}",
                "Category": new_cat,
                "Action": "Update Expense & Recalculate Balance Matrix"
            },
            "payload": {
                "trip_id": tid,
                "expense_id": target_id,
                "description": new_desc,
                "amount": new_amt,
                "paid_by": paid_by or target_exp.get("paidBy", []),
                "split_between": split_between or target_exp.get("splitBetween", []),
                "category": new_cat,
                "split_type": target_exp.get("splitType", "equal")
            }
        }
        return f"Created proposal to edit expense '{old_desc}'. Form card presented to user."

    @tool
    def tool_propose_add_member(identifier: str, target_trip_id: Optional[str] = None) -> str:
        """Propose adding a member to a trip with a confirmation card."""
        nonlocal action_proposal
        tid = target_trip_id or trip_id
        if not tid:
            return "Error: Please specify which trip to add this member to."

        action_proposal = {
            "action_type": "ADD_MEMBER",
            "summary": f"Add **{identifier}** to the trip",
            "status": "PENDING",
            "form_details": {
                "Member Identifier": identifier,
                "Notice": "Once added, members cannot be removed to preserve balance integrity"
            },
            "payload": {
                "trip_id": tid,
                "identifier": identifier
            }
        }
        return f"Created proposal to add member '{identifier}'. Form card presented to user."

    @tool
    def tool_propose_send_friend_request(identifier: str) -> str:
        """Propose sending a friend request to a user by username or email."""
        nonlocal action_proposal
        clean = identifier.replace("@", "").strip().lower()
        if clean == user_username.lower() or clean == user_email.lower():
            return "ERROR: You cannot send a friend request to your own account."

        action_proposal = {
            "action_type": "SEND_FRIEND_REQUEST",
            "summary": f"Send friend request to **{identifier}**",
            "status": "PENDING",
            "form_details": {
                "Recipient": identifier,
                "Action": "Send Friend Request"
            },
            "payload": {
                "identifier": identifier
            }
        }
        return f"Created proposal to send friend request to '{identifier}'. Form card presented to user."

    @tool
    def tool_propose_respond_friend_request(request_id: str, action: str, sender_name: str = "User") -> str:
        """Propose accepting or declining a friend request."""
        nonlocal action_proposal
        verb = "Accept" if action == "accepted" else "Decline"
        action_proposal = {
            "action_type": "RESPOND_FRIEND_REQUEST",
            "summary": f"{verb} friend request from **{sender_name}**",
            "status": "PENDING",
            "form_details": {
                "Request From": sender_name,
                "Action": f"{verb} Request"
            },
            "payload": {
                "request_id": request_id,
                "action": action
            }
        }
        return f"Created proposal to {verb} friend request from '{sender_name}'. Form card presented to user."

    # -----------------------------------------------------------------------
    # 3. STRICT CONTEXT-BASED TOOL SANDBOXING
    # -----------------------------------------------------------------------
    if is_trip_mode:
        tools_list = [
            tool_get_trip_details,
            tool_get_trip_balances,
            tool_get_trip_category_summary,
            tool_get_trip_member_summary,
            tool_propose_add_expense,
            tool_propose_edit_expense,
            tool_propose_delete_expense,
            tool_propose_add_member
        ]
        mode_desc = f"TRIP CONTEXT MODE: Bound strictly to Trip ID '{trip_id}'. You can ONLY manage expenses, members, and balances for this specific trip."
    else:
        tools_list = [
            tool_get_user_trips,
            tool_get_friends_balances,
            tool_get_friend_requests,
            tool_propose_send_friend_request,
            tool_propose_respond_friend_request,
            tool_list_saved_itineraries,
            tool_get_itinerary_version_details
        ]
        mode_desc = "GLOBAL MODE: Scoped to Friends Network, All Trips Overview (Read-Only), and Saved Itineraries. YOU CANNOT ADD OR MODIFY EXPENSES, MEMBERS, OR SETTLEMENTS FOR TRIPS IN GLOBAL MODE."

    system_content = SYSTEM_PROMPT.format(
        user_identity_block=user_identity_block,
        user_display_name=user_display_name,
        user_username=user_username,
        mode_description=mode_desc
    )

    messages = [SystemMessage(content=system_content)]

    # Append recent conversation history
    if conversation_history:
        for msg in conversation_history[-8:]:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "ai":
                messages.append(AIMessage(content=msg.get("content", "")))

    messages.append(HumanMessage(content=user_message))

    # Initialize LLM with Fallback
    llm_with_tools = None
    for m_name in FALLBACK_MODELS:
        try:
            llm = get_llm(model_name=m_name)
            llm_with_tools = llm.bind_tools(tools_list)
            break
        except Exception:
            continue

    if not llm_with_tools:
        llm = get_llm()
        llm_with_tools = llm.bind_tools(tools_list)

    # Conversational Loop
    for _ in range(5):
        try:
            ai_msg = llm_with_tools.invoke(messages)
        except Exception as e:
            recovered = False
            for fb_name in FALLBACK_MODELS:
                try:
                    fb_llm = get_llm(model_name=fb_name).bind_tools(tools_list)
                    ai_msg = fb_llm.invoke(messages)
                    recovered = True
                    break
                except Exception:
                    continue
            if not recovered:
                error_reply = f"⚠️ Assistant notice: {str(e)}"
                db.save_message(thread_id, user_id, "user", user_message)
                db.save_message(thread_id, user_id, "ai", error_reply)
                return {
                    "success": False,
                    "reply": error_reply,
                    "thread_id": thread_id,
                    "chart_data": None,
                    "action_proposal": None
                }

        messages.append(ai_msg)

        if not ai_msg.tool_calls:
            break

        for tool_call in ai_msg.tool_calls:
            t_name = tool_call["name"]
            t_args = tool_call["args"]

            tool_fn = next((t for t in tools_list if t.name == t_name), None)
            if tool_fn:
                try:
                    tool_output = tool_fn.invoke(t_args)

                    # Extract Chart Payloads
                    if t_name == "tool_get_trip_category_summary":
                        try:
                            cat_json = json.loads(tool_output)
                            if "category_summary" in cat_json:
                                chart_data = {
                                    "type": "PIE",
                                    "title": f"Spending Breakdown: {cat_json.get('trip_title', 'Trip')}",
                                    "data": cat_json.get("category_summary", [])
                                }
                        except Exception:
                            pass
                    elif t_name == "tool_get_trip_member_summary":
                        try:
                            mem_json = json.loads(tool_output)
                            if "member_summary" in mem_json:
                                chart_data = {
                                    "type": "BAR",
                                    "title": f"Member Contributions: {mem_json.get('trip_title', 'Trip')}",
                                    "data": mem_json.get("member_summary", [])
                                }
                        except Exception:
                            pass

                except Exception as e:
                    tool_output = f"Tool execution error: {str(e)}"
            else:
                tool_output = f"Tool '{t_name}' not available in this mode."

            messages.append(ToolMessage(content=str(tool_output), tool_call_id=tool_call["id"]))

    final_content = messages[-1].content if messages else "How can I assist you with your trips, expenses, or travel plans today?"
    if isinstance(final_content, list):
        final_reply = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in final_content])
    else:
        final_reply = str(final_content)

    # Clean raw JSON dumps if present
    if final_reply.strip().startswith("{") and ("settlements" in final_reply or "matrix_table" in final_reply):
        try:
            parsed = json.loads(final_reply.strip())
            m_table = parsed.get("matrix_table", "")
            settlements = parsed.get("settlements", [])
            title = parsed.get("trip_title", "Trip")
            
            parts = [f"### ⚖️ Balance & Settlement Matrix for **{title}**\n"]
            if m_table:
                parts.append("#### 📊 Matrix Table (Row owes Column):\n" + m_table + "\n")
            if settlements:
                parts.append("#### 🔄 Simplified Net Settlements:\n" + "\n".join([f"- {s}" for s in settlements]))
            final_reply = "\n".join(parts)
        except Exception:
            pass

    # Save to Persistent MongoDB Message History
    db.save_message(thread_id, user_id, "user", user_message)
    db.save_message(thread_id, user_id, "ai", final_reply, chart_data=chart_data, action_proposal=action_proposal)

    return {
        "success": True,
        "reply": final_reply,
        "thread_id": thread_id,
        "chart_data": chart_data,
        "action_proposal": action_proposal
    }

def execute_confirmed_action(
    action_type: str,
    action_payload: Dict[str, Any],
    user_id: str,
    token: str
) -> Dict[str, Any]:
    """
    Directly executes an interactive action tool once confirmed by user.
    """
    try:
        if action_type == "ADD_EXPENSE":
            res = trip_tools.add_trip_expense(
                trip_id=action_payload.get("trip_id"),
                description=action_payload.get("description"),
                amount=action_payload.get("amount"),
                paid_by=action_payload.get("paid_by"),
                split_between=action_payload.get("split_between", []),
                category=action_payload.get("category", "Food"),
                split_type=action_payload.get("split_type", "equal"),
                custom_splits=action_payload.get("custom_splits"),
                token=token
            )
            return res
        elif action_type == "EDIT_EXPENSE":
            res = trip_tools.edit_trip_expense(
                trip_id=action_payload.get("trip_id"),
                expense_id=action_payload.get("expense_id"),
                description=action_payload.get("description"),
                amount=action_payload.get("amount"),
                paid_by=action_payload.get("paid_by"),
                split_between=action_payload.get("split_between", []),
                category=action_payload.get("category", "Food"),
                split_type=action_payload.get("split_type", "equal"),
                custom_splits=action_payload.get("custom_splits"),
                token=token
            )
            return res
        elif action_type == "DELETE_EXPENSE":
            res = trip_tools.delete_trip_expense(
                trip_id=action_payload.get("trip_id"),
                expense_id=action_payload.get("expense_id"),
                token=token
            )
            return res
        elif action_type == "ADD_MEMBER":
            res = trip_tools.add_trip_member(
                trip_id=action_payload.get("trip_id"),
                identifier=action_payload.get("identifier"),
                token=token
            )
            return res
        elif action_type == "SEND_FRIEND_REQUEST":
            res = friend_tools.send_friend_request(
                identifier=action_payload.get("identifier"),
                token=token
            )
            return res
        elif action_type == "RESPOND_FRIEND_REQUEST":
            res = friend_tools.respond_friend_request(
                request_id=action_payload.get("request_id"),
                action=action_payload.get("action", "accepted"),
                token=token
            )
            return res
        return {"error": f"Unknown action type '{action_type}'"}
    except Exception as e:
        return {"error": str(e)}
