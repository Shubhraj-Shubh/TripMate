import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Search, ArrowRight, AlertCircle, CheckCircle, X, UserPlus, FileText, Check } from 'lucide-react';
import { SPLITMATE_API, PLANNER_API } from '../config/api';
import './Trips.css';

export default function Trips() {
  const { getToken, userId } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Create Trip Modal State
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [memberChips, setMemberChips] = useState([]);
  const [memberInput, setMemberInput] = useState('');
  const [availableFriends, setAvailableFriends] = useState([]);
  const [selectedPlanOption, setSelectedPlanOption] = useState('');
  const [savedPlansList, setSavedPlansList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await fetch(`${SPLITMATE_API}/trips/my-trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
      }
    } catch (err) {
      console.error("Failed to load trips:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch friends and saved itinerary plans
  const fetchAuxData = async () => {
    try {
      const token = await getToken();
      // 1. Friends list
      const friendsRes = await fetch(`${SPLITMATE_API}/users/me/friends-balances`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        setAvailableFriends(Array.isArray(friendsData) ? friendsData : []);
      }

      // 2. Saved Travel Plans from planner-backend
      const plansRes = await fetch(`${PLANNER_API}/travel/saved?user_id=${userId || ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setSavedPlansList(Array.isArray(plansData) ? plansData : []);
      }
    } catch (e) {
      console.error("Error fetching aux data for trips modal:", e);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const openCreateModal = () => {
    setShowModal(true);
    fetchAuxData();
  };

  const handleAddMemberChip = (val) => {
    const clean = String(val || '').trim();
    if (!clean) return;
    if (!memberChips.includes(clean)) {
      setMemberChips(prev => [...prev, clean]);
    }
    setMemberInput('');
  };

  const handleRemoveMemberChip = (chipToRemove) => {
    setMemberChips(prev => prev.filter(c => c !== chipToRemove));
  };

  const handleKeyDownMemberInput = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddMemberChip(memberInput);
    }
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast("Please enter a trip title.", "error");
      return;
    }

    try {
      setCreating(true);
      const token = await getToken();

      let attachedPlanPayload = null;
      if (selectedPlanOption) {
        const [targetPlanId, targetVersion] = selectedPlanOption.split('_v');
        const targetPlanDoc = savedPlansList.find(p => p._id === targetPlanId || p.planId === targetPlanId);
        if (targetPlanDoc) {
          const vNum = Number(targetVersion) || 1;
          const vObj = (targetPlanDoc.versions || []).find(v => v.version === vNum) || {};
          attachedPlanPayload = {
            planId: targetPlanDoc._id || targetPlanDoc.planId,
            title: targetPlanDoc.title,
            destination: targetPlanDoc.destination,
            version: vNum,
            itinerary: vObj.itinerary || targetPlanDoc.itinerary,
            duration: vObj.duration || targetPlanDoc.duration,
            groupSize: vObj.groupSize || targetPlanDoc.groupSize,
            budget: vObj.budget || targetPlanDoc.budget
          };
        }
      }

      const res = await fetch(`${SPLITMATE_API}/trips/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          memberUsernames: memberChips,
          attachedPlan: attachedPlanPayload
        })
      });

      if (res.ok) {
        setShowModal(false);
        setNewTitle('');
        setMemberChips([]);
        setMemberInput('');
        setSelectedPlanOption('');
        showToast("Trip created successfully!", "success");
        fetchTrips();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to create trip', "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const filteredTrips = trips.filter(trip => 
    trip.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Toast Notification */}
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

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: 0 }}>All Trips</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '4px' }}>
            Manage group travel, split expenses, and view settlement matrices
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Create Trip
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/planner')}>
            <Sparkles size={16} /> Plan with AI
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search trip name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 42px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: '#f8fafc',
              fontSize: '0.95rem'
            }}
          />
        </div>
      </div>

      {/* Trips List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <p>Loading trips... ⏳</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <h2>No Trips Found</h2>
          <p style={{ color: '#94a3b8', margin: '15px 0 25px 0' }}>
            {search ? `No trips match "${search}".` : "Create your first trip or generate an AI itinerary to get started!"}
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create Trip
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/planner')}>
              <Sparkles size={16} /> Plan with AI
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredTrips.map((trip) => {
            const memberNames = (trip.members || []).map(m => m.name || m.username).join(', ');
            const createdByName = trip.createdBy?.name || trip.createdBy?.username || (trip.members?.[0]?.name) || 'You';

            return (
              <div
                key={trip._id}
                className="card"
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                onClick={() => navigate(`/trips/${trip._id}`)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      {trip.title}
                    </h3>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '8px' }}>
                    <strong style={{ color: '#cbd5e1' }}>Members:</strong> {memberNames || 'None'}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '14px' }}>
                    Created by: @{createdByName}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span>{trip.members?.length || 1} {(trip.members?.length || 1) === 1 ? 'Member' : 'Members'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Open Trip <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Trip Modal with Skill-Tag Style Member Selector & Optional Itinerary Attachment */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Create New Trip</h3>
              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTrip}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>Trip Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Goa Trip, Manali Trek, Tokyo 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              {/* Tag-Style Interactive Member Selector */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                  Add Members (Username or Email)
                </label>

                {/* Selected Chips Container */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: memberChips.length > 0 ? '8px' : '0' }}>
                  {memberChips.map((chip) => (
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
                        onClick={() => handleRemoveMemberChip(chip)}
                        style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Input with Add button */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    placeholder="Type username or email..."
                    value={memberInput}
                    onChange={(e) => setMemberInput(e.target.value)}
                    onKeyDown={handleKeyDownMemberInput}
                    style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleAddMemberChip(memberInput)}
                    disabled={!memberInput.trim()}
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {/* Friends Quick-Add Dropdown */}
                {availableFriends.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Or pick from your friends list:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '70px', overflowY: 'auto' }}>
                      {availableFriends.map(f => {
                        const fName = f.username || f.name || f.email;
                        const isAdded = memberChips.includes(fName) || memberChips.includes(f.username) || memberChips.includes(f.email);
                        if (isAdded) return null;
                        return (
                          <button
                            key={f.userId || f._id || fName}
                            type="button"
                            onClick={() => handleAddMemberChip(f.username || f.email || f.name)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              border: '1px dashed #475569',
                              background: 'var(--bg-surface)',
                              color: '#94a3b8',
                              fontSize: '0.78rem',
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
              </div>

              {/* Optional Itinerary Plan Attachment Dropdown */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
                  Attach Saved Itinerary Plan (Optional)
                </label>
                <select
                  value={selectedPlanOption}
                  onChange={(e) => setSelectedPlanOption(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">— No Itinerary Plan —</option>
                  {savedPlansList.map(plan => {
                    const versions = plan.versions && plan.versions.length > 0 ? plan.versions : [{ version: plan.version || 1 }];
                    return versions.map(v => (
                      <option key={`${plan._id}::${v.version}`} value={`${plan._id}::${v.version}`}>
                        Trip to {plan.destination} (Version {v.version}) • {v.duration || plan.duration || '4 Days'}
                      </option>
                    ));
                  })}
                </select>
                <small style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                  Attaches a specific itinerary version from your AI Travel Planner history.
                </small>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating || !newTitle.trim()}>
                  {creating ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
