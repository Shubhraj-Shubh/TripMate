import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SPLITMATE_API, PLANNER_API } from '../config/api';
import { CategoryPieChart, SpendingBarChart } from '../components/Charts/DashboardCharts';
import { 
  ArrowLeft, 
  Plus, 
  UserPlus, 
  Sparkles, 
  Trash2, 
  Edit3, 
  PieChart as PieIcon, 
  Table, 
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Printer,
  Calendar,
  MapPin,
  Users,
  Wallet,
  Check,
  Bookmark
} from 'lucide-react';

export default function TripDetails() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { getToken, userId } = useAuth();

  const [trip, setTrip] = useState(null);
  const [totalExpense, setTotalExpense] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [memberData, setMemberData] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [userBalances, setUserBalances] = useState([]);
  const [userCategoryData, setUserCategoryData] = useState([]);
  const [userTotalExpense, setUserTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Tabs: 'overview' | 'user' | 'matrix' | 'expenses' | 'tripPlan'
  const [activeTab, setActiveTab] = useState('overview');
  const [expenseFilter, setExpenseFilter] = useState('all');

  // Add / Edit Expense State with Multi-Payer & Custom Splits
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Food');
  
  // Multi-Payer Array: [{ user: userId, amount: '' }]
  const [paidByRows, setPaidByRows] = useState([{ user: '', amount: '' }]);

  // Split Type: 'equal' | 'exact'
  const [splitType, setSplitType] = useState('equal');
  // For equal split: array of user IDs
  const [splitBetween, setSplitBetween] = useState([]);
  // For exact split: object { [userId]: amount }
  const [customSplits, setCustomSplits] = useState({});
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Multi-Member Add Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberChips, setNewMemberChips] = useState([]);
  const [newMemberInput, setNewMemberInput] = useState('');
  const [availableFriends, setAvailableFriends] = useState([]);
  const [addingMember, setAddingMember] = useState(false);

  // Plan Attachment State
  const [savedPlansList, setSavedPlansList] = useState([]);
  const [selectedPlanToAttach, setSelectedPlanToAttach] = useState('');
  const [attachingPlan, setAttachingPlan] = useState(false);
  const [showPlanAttachModal, setShowPlanAttachModal] = useState(false);

  // Toast Notification state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Core trip details
      const res = await fetch(`${SPLITMATE_API}/trips/${tripId}`, { headers });
      if (!res.ok) {
        showToast("Could not load trip details.", "error");
        navigate('/expenses');
        return;
      }
      const data = await res.json();
      setTrip(data);

      // 2. Parallel fetch metrics
      const [totalRes, catRes, memRes, matRes, myBalRes, myCatRes] = await Promise.all([
        fetch(`${SPLITMATE_API}/trips/${tripId}/totalExpense`, { headers }),
        fetch(`${SPLITMATE_API}/trips/${tripId}/category-expenses`, { headers }),
        fetch(`${SPLITMATE_API}/trips/${tripId}/membersExpenseSummary`, { headers }),
        fetch(`${SPLITMATE_API}/trips/${tripId}/balanceMatrix`, { headers }),
        fetch(`${SPLITMATE_API}/trips/${tripId}/my-balances`, { headers }),
        fetch(`${SPLITMATE_API}/trips/${tripId}/user/category-expenses`, { headers })
      ]);

      if (totalRes.ok) {
        const d = await totalRes.json();
        setTotalExpense(d.totalExpense ?? 0);
      }

      if (catRes.ok) {
        const d = await catRes.json();
        if (d.categories && typeof d.categories === 'object') {
          const chartArr = Object.entries(d.categories).map(([k, v]) => ({
            name: k,
            value: Number(v) || 0
          }));
          setCategoryData(chartArr.filter(c => c.value > 0));
        } else {
          setCategoryData([]);
        }
      }

      if (memRes.ok) {
        const d = await memRes.json();
        if (Array.isArray(d.summary)) {
          const memArr = d.summary.map(m => ({
            name: m.memberName || 'Member',
            amount: Math.round(m.totalExpenseByThatMember || 0)
          }));
          setMemberData(memArr.filter(m => m.amount > 0));
        } else {
          setMemberData([]);
        }
      }

      if (matRes.ok) {
        const d = await matRes.json();
        setMatrixData(d.balanceMatrix || []);
      } else {
        setMatrixData(data.balanceMatrix || []);
      }

      if (myBalRes.ok) {
        const d = await myBalRes.json();
        setUserBalances(d || []);
      }

      if (myCatRes.ok) {
        const d = await myCatRes.json();
        setUserTotalExpense(d.totalUserExpense || 0);
        if (d.categories && typeof d.categories === 'object') {
          const uChart = Object.entries(d.categories).map(([k, v]) => ({
            name: k,
            value: Number(v) || 0
          }));
          setUserCategoryData(uChart.filter(c => c.value > 0));
        }
      }

    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxData = async () => {
    try {
      const token = await getToken();
      // Friends list
      const friendsRes = await fetch(`${SPLITMATE_API}/users/me/friends-balances`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (friendsRes.ok) {
        const fData = await friendsRes.json();
        setAvailableFriends(Array.isArray(fData) ? fData : []);
      }

      // Saved Plans from planner-backend
      const plansRes = await fetch(`${PLANNER_API}/travel/saved?user_id=${userId || ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (plansRes.ok) {
        const pData = await plansRes.json();
        setSavedPlansList(Array.isArray(pData) ? pData : []);
      }
    } catch (e) {
      console.error("Aux fetch error:", e);
    }
  };

  useEffect(() => {
    fetchTripDetails();
    fetchAuxData();
  }, [tripId, userId]);

  // Open Add Expense
  const handleOpenAddExpense = () => {
    setEditingExpenseId(null);
    setExpDescription('');
    setExpAmount('');
    setExpCategory('Food');
    setSplitType('equal');

    const defaultMemberId = trip?.members?.[0]?._id || '';
    setPaidByRows([{ user: defaultMemberId, amount: '' }]);
    setSplitBetween((trip?.members || []).map(m => m._id));

    const initialCustom = {};
    (trip?.members || []).forEach(m => { initialCustom[m._id] = ''; });
    setCustomSplits(initialCustom);

    setShowExpenseModal(true);
  };

  // Open Edit Expense
  const handleOpenEditExpense = (exp) => {
    setEditingExpenseId(exp._id);
    setExpDescription(exp.description || '');
    setExpAmount(String(exp.amount || ''));
    setExpCategory(exp.category || 'Food');
    setSplitType(exp.splitType || 'equal');

    // Load paidBy rows
    if (Array.isArray(exp.paidBy) && exp.paidBy.length > 0) {
      setPaidByRows(exp.paidBy.map(p => ({
        user: p.user?._id || p.user || '',
        amount: String(p.amount || '')
      })));
    } else {
      setPaidByRows([{ user: trip?.members?.[0]?._id || '', amount: String(exp.amount || '') }]);
    }

    // Load splitBetween
    setSplitBetween((exp.splitBetween || []).map(u => u._id || u));

    // Load custom splits
    const customMap = {};
    (trip?.members || []).forEach(m => {
      const match = (exp.splits || []).find(s => (s.user?._id || s.user) === m._id);
      customMap[m._id] = match ? String(match.amount) : '';
    });
    setCustomSplits(customMap);

    setShowExpenseModal(true);
  };

  // Multi-Payer Row Handlers
  const handlePaidByRowChange = (idx, field, value) => {
    setPaidByRows(prev => {
      const updated = [...prev];
      updated[idx][field] = value;
      return updated;
    });
  };

  const handleAddPaidByRow = () => {
    setPaidByRows(prev => [...prev, { user: trip?.members?.[0]?._id || '', amount: '' }]);
  };

  const handleRemovePaidByRow = (idx) => {
    setPaidByRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  // Save Expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const totalNum = parseFloat(expAmount);
    if (!expDescription.trim() || isNaN(totalNum) || totalNum <= 0) {
      showToast("Please enter a valid description and amount.", "error");
      return;
    }

    const cleanPaidBy = paidByRows
      .filter(p => p.user && Number(p.amount) > 0)
      .map(p => ({ user: p.user, amount: Number(p.amount) }));

    if (cleanPaidBy.length === 0) {
      showToast("Please specify at least one payer with a positive amount.", "error");
      return;
    }

    const totalPaid = cleanPaidBy.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPaid - totalNum) > 0.05) {
      showToast(`Total paid (₹${totalPaid}) must equal the expense amount (₹${totalNum}).`, "error");
      return;
    }

    let splitsPayload = [];
    let splitBetweenPayload = [];

    if (splitType === 'exact') {
      splitsPayload = Object.entries(customSplits)
        .filter(([_, amt]) => Number(amt) > 0)
        .map(([uId, amt]) => ({ user: uId, amount: Number(amt) }));

      if (splitsPayload.length === 0) {
        showToast("Please specify split amounts for participating members.", "error");
        return;
      }

      const totalCustomSplit = splitsPayload.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(totalCustomSplit - totalNum) > 0.05) {
        showToast(`Sum of custom splits (₹${totalCustomSplit}) must equal total amount (₹${totalNum}).`, "error");
        return;
      }
      splitBetweenPayload = splitsPayload.map(s => s.user);
    } else {
      if (splitBetween.length === 0) {
        showToast("Please select at least one member to split between.", "error");
        return;
      }
      splitBetweenPayload = splitBetween;
    }

    try {
      setSubmittingExpense(true);
      const token = await getToken();

      const payload = {
        description: expDescription.trim(),
        amount: totalNum,
        category: expCategory,
        paidBy: cleanPaidBy,
        splitBetween: splitBetweenPayload,
        splits: splitsPayload,
        splitType
      };

      const url = editingExpenseId 
        ? `${SPLITMATE_API}/trips/${tripId}/expenses/${editingExpenseId}`
        : `${SPLITMATE_API}/trips/${tripId}/expenses`;
      
      const method = editingExpenseId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowExpenseModal(false);
        showToast(editingExpenseId ? "Expense updated successfully!" : "Expense added and split calculated!", "success");
        fetchTripDetails();
      } else {
        const data = await res.json();
        showToast(data.message || "Failed to save expense.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Delete Confirmation Modal State
  const [deleteExpenseModalId, setDeleteExpenseModalId] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  const confirmDeleteExpense = async (expenseId) => {
    if (deletingExpense) return;
    try {
      setDeletingExpense(true);
      const token = await getToken();
      const res = await fetch(`${SPLITMATE_API}/trips/${tripId}/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setDeleteExpenseModalId(null);
        showToast("Expense removed and balances updated!", "success");
        fetchTripDetails();
      } else {
        const data = await res.json();
        showToast(data.message || "Failed to delete expense.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeletingExpense(false);
    }
  };

  // Add Member Chip Helpers
  const handleAddMemberChip = (val) => {
    const clean = String(val || '').trim();
    if (!clean) return;
    if (!newMemberChips.includes(clean)) {
      setNewMemberChips(prev => [...prev, clean]);
    }
    setNewMemberInput('');
  };

  const handleRemoveMemberChip = (chipToRemove) => {
    setNewMemberChips(prev => prev.filter(c => c !== chipToRemove));
  };

  const handleKeyDownMemberInput = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddMemberChip(newMemberInput);
    }
  };

  // Batch Add Multiple Members
  const handleAddMembersSubmit = async (e) => {
    if (e) e.preventDefault();
    const finalMembersList = [...newMemberChips];
    if (newMemberInput.trim() && !finalMembersList.includes(newMemberInput.trim())) {
      finalMembersList.push(newMemberInput.trim());
    }

    if (finalMembersList.length === 0) {
      showToast("Please enter or select at least one member to add.", "error");
      return;
    }

    try {
      setAddingMember(true);
      const token = await getToken();
      const res = await fetch(`${SPLITMATE_API}/trips/${tripId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ members: finalMembersList })
      });

      const data = await res.json();
      if (res.ok) {
        setNewMemberChips([]);
        setNewMemberInput('');
        setShowAddMemberModal(false);
        showToast(data.message || "Members added to trip successfully!", "success");
        fetchTripDetails();
      } else {
        showToast(data.message || "Could not add member(s).", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setAddingMember(false);
    }
  };

  // Attach / Detach Itinerary Plan from Dropdown
  const handleAttachPlan = async () => {
    try {
      setAttachingPlan(true);
      const token = await getToken();

      if (!selectedPlanToAttach || selectedPlanToAttach === 'detach') {
        const res = await fetch(`${SPLITMATE_API}/trips/${tripId}/attach-plan`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ planId: 'detach' })
        });

        if (res.ok) {
          setShowPlanAttachModal(false);
          setSelectedPlanToAttach('');
          showToast("Itinerary plan removed from trip.", "success");
          fetchTripDetails();
        } else {
          const data = await res.json();
          showToast(data.message || "Failed to update plan.", "error");
        }
        return;
      }

      const [planDocId, versionStr] = selectedPlanToAttach.split('::');
      const targetPlanDoc = savedPlansList.find(p => p._id === planDocId);
      
      if (!targetPlanDoc) {
        showToast("Selected plan not found.", "error");
        return;
      }

      const vNum = parseInt(versionStr, 10);
      const vObj = (targetPlanDoc.versions || []).find(v => v.version === vNum) || {
        version: vNum,
        itinerary: targetPlanDoc.itinerary,
        duration: targetPlanDoc.duration,
        groupSize: targetPlanDoc.groupSize,
        budget: targetPlanDoc.budget,
        destination: targetPlanDoc.destination
      };

      const payload = {
        planId: targetPlanDoc._id,
        title: `Trip to ${vObj.destination || targetPlanDoc.destination} (v${vNum})`,
        destination: vObj.destination || targetPlanDoc.destination,
        version: vNum,
        itinerary: vObj.itinerary || targetPlanDoc.itinerary,
        duration: vObj.duration || targetPlanDoc.duration,
        groupSize: vObj.groupSize || targetPlanDoc.groupSize,
        budget: vObj.budget || targetPlanDoc.budget
      };

      const res = await fetch(`${SPLITMATE_API}/trips/${tripId}/attach-plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowPlanAttachModal(false);
        showToast(`Attached ${payload.title} to this trip!`, "success");
        fetchTripDetails();
        setActiveTab('tripPlan');
      } else {
        const data = await res.json();
        showToast(data.message || "Failed to attach plan.", "error");
      }
    } catch (err) {
      showToast("Attach error: " + err.message, "error");
    } finally {
      setAttachingPlan(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px', textAlign: 'center', color: '#94a3b8' }}>
        Loading trip details... ⏳
      </div>
    );
  }

  if (!trip) return null;

  const members = trip.members || [];
  const matrix = matrixData.length > 0 ? matrixData : (trip.balanceMatrix || []);
  const attachedPlan = trip.attachedPlan;

  // Filter expenses
  const allCategories = Array.from(new Set((trip.expenses || []).map(e => e.category || 'Food')));
  const filteredExpenses = expenseFilter === 'all' 
    ? (trip.expenses || []) 
    : (trip.expenses || []).filter(e => e.category === expenseFilter);

  const hasExpenses = (trip.expenses || []).length > 0;

  // Multi-Payer Live Total
  const currentTotalPaid = paidByRows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const targetTotal = Number(expAmount) || 0;
  const paidRemaining = targetTotal - currentTotalPaid;

  return (
    <div className="page-container">
      {/* Toast Notification Banner */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#450a0a' : '#064e3b',
          border: `1px solid ${toast.type === 'error' ? '#dc2626' : '#059669'}`,
          borderRadius: '8px',
          padding: '12px 18px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} color="#ef4444" /> : <CheckCircle size={18} color="#10b981" />}
          <span style={{ fontSize: '0.9rem' }}>{toast.message}</span>
        </div>
      )}

      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/expenses')} style={{ padding: '8px 12px' }}>
            <ArrowLeft size={16} /> Back to Trips
          </button>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              {trip.title}
            </h1>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              👥 Members: {members.map(m => m.name || m.username).join(', ')} • Created by: @{trip.createdBy?.name || trip.createdBy?.username || 'You'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleOpenAddExpense}>
            <Plus size={16} /> Add Expense
          </button>
          <button className="btn btn-secondary" onClick={() => { setNewMemberChips([]); setNewMemberInput(''); setShowAddMemberModal(true); }}>
            <UserPlus size={16} /> Add Members
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/assistant')}>
            <Sparkles size={16} /> AI Assistant
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('overview')}>
          <PieIcon size={16} /> Overview
        </button>
        <button className={`btn ${activeTab === 'user' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('user')}>
          <User size={16} /> User
        </button>
        <button className={`btn ${activeTab === 'matrix' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('matrix')}>
          <Table size={16} /> Split Matrix
        </button>
        <button className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('expenses')}>
          <FileText size={16} /> Expense Log ({trip.expenses?.length || 0})
        </button>
        <button 
          className={`btn ${activeTab === 'tripPlan' ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('tripPlan')}
          style={{
            borderColor: attachedPlan?.itinerary ? '#818cf8' : undefined
          }}
        >
          <Bookmark size={16} /> Trip Plan {attachedPlan?.itinerary ? `(v${attachedPlan.version || 1})` : ''}
        </button>
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          {/* 3 Metric Cards with Clear Headings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div className="card">
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                Total Trip Expense
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>
                ₹{Number(totalExpense ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                Trip Members
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#38bdf8', marginTop: '6px' }}>
                {members.length} {members.length === 1 ? 'Member' : 'Members'}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                Total Expenses Logged
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#818cf8', marginTop: '6px' }}>
                {trip.expenses?.length || 0}
              </div>
            </div>
          </div>

          {/* Visual Recharts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
            <div className="card">
              <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Category Distribution</h3>
              {hasExpenses && categoryData.length > 0 ? (
                <CategoryPieChart data={categoryData} />
              ) : (
                <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📊</span>
                  <span>No expenses logged yet. Add your first expense to view category analytics.</span>
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Member Spending Contribution</h3>
              {hasExpenses && memberData.length > 0 ? (
                <SpendingBarChart data={memberData} />
              ) : (
                <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.8rem', marginBottom: '8px' }}>👥</span>
                  <span>No member contributions yet.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. USER TAB (With Personal Total Expense and Accurate Legacy Color Coding) */}
      {activeTab === 'user' && (
        <div>
          {/* Top User Metric Card */}
          <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#818cf8', textTransform: 'uppercase', fontWeight: 600 }}>
                Your Spending in this Trip
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                ₹{Math.round(userTotalExpense).toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              Includes your individual share from all split expenses
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            {/* Balances list */}
            <div className="card">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px' }}>Your Net Balances in this Trip</h3>
              {userBalances.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>All settled up in this trip!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {userBalances.map(bal => {
                    const isOwe = bal.balance > 0;
                    const isGet = bal.balance < 0;
                    const isSettled = bal.balance === 0;

                    return (
                      <div
                        key={bal.userId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'var(--bg-surface)',
                          borderLeft: `4px solid ${isOwe ? '#ef4444' : isGet ? '#10b981' : '#64748b'}`,
                          padding: '12px 16px',
                          borderRadius: '6px'
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>{bal.name || bal.username}</span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: isOwe ? '#ef4444' : isGet ? '#10b981' : '#94a3b8'
                          }}
                        >
                          {isOwe && `You owe ₹${Math.round(bal.balance).toLocaleString()}`}
                          {isGet && `You get ₹${Math.round(Math.abs(bal.balance)).toLocaleString()}`}
                          {isSettled && 'Settled (₹0)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px' }}>Your Expense by Category</h3>
              <CategoryPieChart data={userCategoryData} />
            </div>
          </div>
        </div>
      )}

      {/* 3. SPLIT MATRIX TAB (With Legacy Color Coding: Owes in Red, Gets in Green) */}
      {activeTab === 'matrix' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Settlement Matrix</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>
              Row member owes column member (<span style={{ color: '#ef4444', fontWeight: 600 }}>Owes</span>) or gets money (<span style={{ color: '#10b981', fontWeight: 600 }}>Gets</span>)
            </p>
          </div>

          {members.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No members in this trip.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', textAlign: 'left', fontWeight: 700, color: '#818cf8' }}>
                    Debtor \ Creditor
                  </th>
                  {members.map(m => (
                    <th key={m._id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', fontWeight: 600 }}>
                      {m.name || m.username}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((rowMember, i) => (
                  <tr key={rowMember._id}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, textAlign: 'left', color: '#cbd5e1' }}>
                      {rowMember.name || rowMember.username}
                    </td>
                    {members.map((colMember, j) => {
                      const amount = matrix[i]?.[j] ?? 0;
                      const isSelf = i === j;
                      const owes = amount > 0;
                      const gets = amount < 0;

                      return (
                        <td
                          key={colMember._id}
                          style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isSelf ? 'rgba(100, 116, 139, 0.05)' : owes ? 'rgba(239, 68, 68, 0.12)' : gets ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                            color: isSelf ? '#64748b' : owes ? '#ef4444' : gets ? '#10b981' : '#64748b',
                            fontWeight: owes || gets ? 700 : 400,
                            fontSize: '0.88rem'
                          }}
                        >
                          {isSelf ? '—' : owes ? `Owes ₹${Math.round(amount).toLocaleString()}` : gets ? `Gets ₹${Math.round(Math.abs(amount)).toLocaleString()}` : '0'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 4. EXPENSE LOG TAB (Clean Card Layout with Populated Names & Badges) */}
      {activeTab === 'expenses' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Logged Expenses</h3>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={expenseFilter}
                onChange={(e) => setExpenseFilter(e.target.value)}
                style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
              >
                <option value="all">All Categories</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <button className="btn btn-primary" onClick={handleOpenAddExpense} style={{ padding: '8px 14px' }}>
                <Plus size={15} /> Add Expense
              </button>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px' }}>No expenses found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredExpenses.map(exp => {
                // Resolve Payer Names
                const payers = (exp.paidBy || []).map(p => {
                  const pUser = p.user;
                  const name = (typeof pUser === 'object' && pUser !== null)
                    ? (pUser.name || pUser.username)
                    : (members.find(m => m._id === pUser)?.name || members.find(m => m._id === pUser)?.username || 'Member');
                  return { name, amount: p.amount };
                });

                // Resolve Split Names
                let splitList = [];
                if (exp.splitType === 'exact' && Array.isArray(exp.splits)) {
                  splitList = exp.splits.map(s => {
                    const sUser = s.user;
                    const name = (typeof sUser === 'object' && sUser !== null)
                      ? (sUser.name || sUser.username)
                      : (members.find(m => m._id === sUser)?.name || members.find(m => m._id === sUser)?.username || 'Member');
                    return `${name} (₹${Number(s.amount).toLocaleString()})`;
                  });
                } else {
                  splitList = (exp.splitBetween || []).map(u => {
                    if (typeof u === 'object' && u !== null) return u.name || u.username;
                    return members.find(m => m._id === u)?.name || members.find(m => m._id === u)?.username || 'Member';
                  });
                }

                return (
                  <div
                    key={exp._id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '18px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.15rem', color: '#f8fafc' }}>
                          {exp.description}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#818cf8',
                            border: '1px solid #4f46e5',
                            fontSize: '0.75rem',
                            padding: '2px 8px'
                          }}
                        >
                          {exp.category}
                        </span>
                      </div>

                      {/* Paid By Badges */}
                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: '#94a3b8' }}>Paid by:</strong>
                        {payers.map((p, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: '#1e1b4b',
                              border: '1px solid #3730a3',
                              color: '#a5b4fc',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 500
                            }}
                          >
                            {p.name}: ₹{Number(p.amount).toLocaleString()}
                          </span>
                        ))}
                      </div>

                      {/* Split Between Badges */}
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                        <strong>Split ({exp.splitType === 'exact' ? 'Custom' : 'Equal'}):</strong>
                        {splitList.map((sName, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              color: '#cbd5e1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.78rem'
                            }}
                          >
                            {sName}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#10b981' }}>
                        ₹{Number(exp.amount).toLocaleString()}
                      </span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 10px' }}
                        onClick={() => handleOpenEditExpense(exp)}
                        title="Edit expense"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 10px', color: '#ef4444', borderColor: '#ef4444' }}
                        onClick={() => setDeleteExpenseModalId(exp._id)}
                        title="Delete expense"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TRIP PLAN TAB */}
      {activeTab === 'tripPlan' && (
        <div>
          {attachedPlan && attachedPlan.itinerary ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#818cf8' }}>
                      Trip to {attachedPlan.destination || trip.title}
                    </h2>
                    <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: '#4f46e5', fontSize: '0.8rem', fontWeight: 600 }}>
                      Version {attachedPlan.version || 1}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.85rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
                    {attachedPlan.duration && <span>📅 <strong>Duration:</strong> {attachedPlan.duration}</span>}
                    {attachedPlan.groupSize && <span>👥 <strong>Group:</strong> {attachedPlan.groupSize}</span>}
                    {attachedPlan.budget && <span>💰 <strong>Budget:</strong> {attachedPlan.budget}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => window.print()}>
                    <Printer size={15} /> Download PDF
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowPlanAttachModal(true)}>
                    <Edit3 size={15} /> Switch / Change Plan
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-subtle)', lineHeight: 1.8, color: '#f1f5f9', overflowX: 'auto' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{attachedPlan.itinerary}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '50px' }}>
              <Bookmark size={36} color="#818cf8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px 0' }}>No Travel Plan Attached</h3>
              <p style={{ color: '#94a3b8', maxWidth: '480px', margin: '0 auto 20px auto', fontSize: '0.92rem' }}>
                Attach a specific version of your AI Travel Plan (Flights, Hotels, Budget, Weather & Schedules) to this trip.
              </p>
              <button className="btn btn-primary" onClick={() => setShowPlanAttachModal(true)}>
                <Plus size={16} /> Attach Itinerary Plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{editingExpenseId ? "Edit Expense" : "Add Expense"}</h3>
              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setShowExpenseModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.88rem', fontWeight: 500 }}>Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Dinner at Fisherman's Wharf, Flight Tickets, Resort Stay"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.88rem', fontWeight: 500 }}>Total Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={expAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExpAmount(val);
                      if (paidByRows.length === 1 && val) {
                        setPaidByRows([{ user: paidByRows[0].user || members[0]?._id, amount: val }]);
                      }
                    }}
                    required
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.88rem', fontWeight: 500 }}>Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="Food">Food & Drinks</option>
                    <option value="Travel">Travel / Transit</option>
                    <option value="Stay">Stay / Accommodation</option>
                    <option value="Tickets">Tickets & Entry</option>
                    <option value="Adventure">Adventure / Activities</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Multi-Payer Section */}
              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                    Paid By (Multi-Payer Supported) *
                  </label>
                  <span style={{ fontSize: '0.78rem', color: Math.abs(paidRemaining) < 0.05 ? '#10b981' : '#f59e0b' }}>
                    Total: ₹{currentTotalPaid} / ₹{targetTotal} {Math.abs(paidRemaining) >= 0.05 && `(₹${Math.abs(paidRemaining)} ${paidRemaining > 0 ? 'remaining' : 'over'})`}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {paidByRows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={row.user}
                        onChange={(e) => handlePaidByRowChange(idx, 'user', e.target.value)}
                        required
                        style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem' }}
                      >
                        {members.map(m => (
                          <option key={m._id} value={m._id}>{m.name || m.username}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={row.amount}
                        onChange={(e) => handlePaidByRowChange(idx, 'amount', e.target.value)}
                        required
                        style={{ width: '120px', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem' }}
                      />

                      {paidByRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePaidByRow(idx)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="Remove payer"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddPaidByRow}
                  style={{
                    background: 'none',
                    border: '1px dashed #4f46e5',
                    color: '#818cf8',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={12} /> Add Another Payer
                </button>
              </div>

              {/* Split Mode Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                  Split Mode *
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    className={`btn ${splitType === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSplitType('equal')}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                  >
                    Equal Split (Equal Shares)
                  </button>
                  <button
                    type="button"
                    className={`btn ${splitType === 'exact' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSplitType('exact')}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                  >
                    Custom / Exact Amounts
                  </button>
                </div>

                {/* 1. Equal Split UI */}
                {splitType === 'equal' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    {members.map(m => {
                      const isChecked = splitBetween.includes(m._id);
                      return (
                        <button
                          key={m._id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSplitBetween(splitBetween.filter(id => id !== m._id));
                            } else {
                              setSplitBetween([...splitBetween, m._id]);
                            }
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${isChecked ? '#818cf8' : 'var(--border-subtle)'}`,
                            background: isChecked ? '#312e81' : 'var(--bg-surface)',
                            color: isChecked ? '#fff' : '#94a3b8',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isChecked && <Check size={14} color="#818cf8" />}
                          <span>{m.name || m.username}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. Custom / Exact Split UI */}
                {splitType === 'exact' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    {members.map(m => (
                      <div key={m._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.88rem', color: '#f8fafc' }}>{m.name || m.username}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>₹</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={customSplits[m._id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomSplits(prev => ({ ...prev, [m._id]: val }));
                            }}
                            style={{ width: '100px', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.88rem' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)} disabled={submittingExpense}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingExpense || !expDescription || !expAmount}>
                  {submittingExpense ? 'Saving...' : (editingExpenseId ? 'Update Expense' : 'Add Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Member Add Modal */}
      {showAddMemberModal && (
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Add Members to Trip</h3>
              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setShowAddMemberModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMembersSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 500 }}>
                  Enter Usernames or Emails
                </label>

                {/* Selected Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: newMemberChips.length > 0 ? '8px' : '0' }}>
                  {newMemberChips.map((chip) => (
                    <span
                      key={chip}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: '#312e81',
                        border: '1px solid #4f46e5',
                        borderRadius: '16px',
                        color: '#c7d2fe',
                        fontSize: '0.82rem',
                        fontWeight: 500
                      }}
                    >
                      {chip}
                      <button
                        type="button"
                        onClick={() => handleRemoveNewMemberChip(chip)}
                        style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type username or email..."
                    value={newMemberInput}
                    onChange={(e) => setNewMemberInput(e.target.value)}
                    onKeyDown={handleKeyDownNewMember}
                    style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleAddNewMemberChip(newMemberInput)}
                    disabled={!newMemberInput.trim()}
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Friends Quick Pick */}
              {availableFriends.length > 0 && (
                <div style={{ marginTop: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>Or pick from your friends:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto' }}>
                    {availableFriends.map(f => {
                      const fTarget = f.username || f.email || f.name;
                      const isAlreadyMember = members.some(m => m._id === f.userId || m._id === f._id || m.username === f.username || m.email === f.email);
                      const isAlreadyInChips = newMemberChips.includes(fTarget) || newMemberChips.includes(f.username) || newMemberChips.includes(f.email);
                      if (isAlreadyMember || isAlreadyInChips) return null;
                      return (
                        <button
                          key={f.userId || f._id || f.username}
                          type="button"
                          onClick={() => handleAddNewMemberChip(f.username || f.email || f.name)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            border: '1px dashed #475569',
                            background: 'var(--bg-surface)',
                            color: '#94a3b8',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          + {f.name || f.username}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMemberModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addingMember || (newMemberChips.length === 0 && !newMemberInput.trim())}>
                  {addingMember ? 'Adding...' : 'Add Members'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach / Switch Itinerary Plan Modal */}
      {showPlanAttachModal && (
        <div className="modal-overlay" onClick={() => setShowPlanAttachModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Attach Travel Plan Version</h3>
              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setShowPlanAttachModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '14px' }}>
                Select an itinerary version for <strong>{trip.title}</strong>, or choose No Itinerary Plan to detach:
              </p>

              <select
                value={selectedPlanToAttach}
                onChange={(e) => setSelectedPlanToAttach(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  marginBottom: '18px'
                }}
              >
                <option value="">— No Itinerary Plan (Detach / Remove) —</option>
                {savedPlansList.map(plan => {
                  const versions = plan.versions && plan.versions.length > 0 ? plan.versions : [{ version: plan.version || 1 }];
                  return versions.map(v => (
                    <option key={`${plan._id}::${v.version}`} value={`${plan._id}::${v.version}`}>
                      Trip to {plan.destination} (Version {v.version}) • {v.duration || plan.duration || '4 Days'}
                    </option>
                  ));
                })}
              </select>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPlanAttachModal(false)} disabled={attachingPlan}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleAttachPlan} disabled={attachingPlan}>
                  {attachingPlan ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Expense Confirmation Modal */}
      {deleteExpenseModalId && (
        <div className="modal-overlay" onClick={() => setDeleteExpenseModalId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: '#ef4444' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#f8fafc' }}>Delete Expense?</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '22px', lineHeight: 1.5 }}>
              Are you sure you want to delete this expense? This action will immediately recalculate all member balances and settlement matrix.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button className="btn btn-secondary" disabled={deletingExpense} onClick={() => setDeleteExpenseModalId(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={deletingExpense}
                style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                onClick={() => confirmDeleteExpense(deleteExpenseModalId)}
              >
                {deletingExpense ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
