import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SPLITMATE_API, ASSISTANT_API } from '../config/api';
import { CategoryPieChart, SpendingBarChart } from '../components/Charts/DashboardCharts';
import { 
  Sparkles, 
  Send, 
  Plus, 
  Trash2, 
  X, 
  AlertTriangle, 
  Globe, 
  MapPin, 
  Users, 
  Wallet, 
  CheckCircle, 
  MessageSquare, 
  ArrowRight,
  Search,
  Check,
  Calendar,
  Compass,
  FileText,
  UserPlus,
  SendHorizontal
} from 'lucide-react';

export default function Assistant() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // Sidebar & Threads State
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [threadSearch, setThreadSearch] = useState('');

  // Trip list for context selection
  const [trips, setTrips] = useState([]);

  // New Thread Modal State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatContextType, setNewChatContextType] = useState('global');
  const [newChatTripId, setNewChatTripId] = useState('');
  const [creatingThread, setCreatingThread] = useState(false);

  // Active Chat Messages State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const messagesEndRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check if there is a pending action proposal waiting for user response
  const lastMessage = messages[messages.length - 1];
  const isActionPending = lastMessage && lastMessage.role === 'ai' && lastMessage.action_proposal && 
    (lastMessage.action_proposal.status === 'PENDING' || (!lastMessage.action_proposal.status && !lastMessage.action_resolved));

  // 1. Load User Trips & Threads on Initial Mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = await getToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch Trips
        const tripsRes = await fetch(`${SPLITMATE_API}/trips/my-trips`, { headers });
        if (tripsRes.ok) {
          const tData = await tripsRes.json();
          setTrips(Array.isArray(tData) ? tData : []);
          if (tData.length > 0) {
            setNewChatTripId(tData[0]._id);
          }
        }

        // Fetch User Threads
        const threadsRes = await fetch(`${ASSISTANT_API}/assistant/sessions`, { headers });
        if (threadsRes.ok) {
          const sData = await threadsRes.json();
          const list = sData.threads || [];
          setThreads(list);
          if (list.length > 0) {
            selectThread(list[0].thread_id);
          } else {
            handleCreateNewThread('global', null, 'Global Travel Assistant');
          }
        }
      } catch (err) {
        console.error("Initial assistant fetch error:", err);
      }
    };

    fetchInitialData();
  }, []);

  // 2. Select & Load a Specific Thread Messages
  const selectThread = async (threadId) => {
    setActiveThreadId(threadId);
    setMobileSidebarOpen(false);
    try {
      setLoading(true);
      const token = await getToken();
      const res = await fetch(`${ASSISTANT_API}/assistant/sessions/${threadId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setActiveThread(data.thread);
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Error loading thread messages:", err);
      showToast("Could not load thread messages", "error");
    } finally {
      setLoading(false);
    }
  };

  // 3. Create a New Thread
  const handleCreateNewThread = async (contextType, tripId, customTitle = null) => {
    try {
      setCreatingThread(true);
      const token = await getToken();
      
      let title = customTitle;
      let tripTitle = null;
      if (contextType === 'trip' && tripId) {
        const matched = trips.find(t => t._id === tripId);
        tripTitle = matched ? matched.title : 'Trip';
        title = `Trip: ${tripTitle}`;
      } else if (!title) {
        title = 'Global Travel Assistant';
      }

      const res = await fetch(`${ASSISTANT_API}/assistant/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          context_type: contextType,
          trip_id: contextType === 'trip' ? tripId : null,
          trip_title: tripTitle
        })
      });

      if (res.ok) {
        const data = await res.json();
        const newThread = data.thread;
        setThreads(prev => [newThread, ...prev]);
        setShowNewChatModal(false);
        selectThread(newThread.thread_id);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreatingThread(false);
    }
  };

  const [threadToDelete, setThreadToDelete] = useState(null);
  const [isDeletingThread, setIsDeletingThread] = useState(false);

  // 4. Delete Thread
  const handleDeleteThreadClick = (e, threadId) => {
    e.stopPropagation();
    setThreadToDelete(threadId);
  };

  const confirmDeleteThread = async (threadId) => {
    if (isDeletingThread) return;
    try {
      setIsDeletingThread(true);
      const token = await getToken();
      const res = await fetch(`${ASSISTANT_API}/assistant/sessions/${threadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const updated = threads.filter(t => t.thread_id !== threadId);
        setThreads(updated);
        showToast("Conversation deleted.", "success");
        if (activeThreadId === threadId) {
          if (updated.length > 0) {
            selectThread(updated[0].thread_id);
          } else {
            handleCreateNewThread('global', null, 'Global Travel Assistant');
          }
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsDeletingThread(false);
      setThreadToDelete(null);
    }
  };

  // 5. Send Message in Active Thread
  const handleSendMessage = async (textToSend) => {
    if (isActionPending) {
      showToast("Please confirm (Yes / No) the pending action proposal above first.", "error");
      return;
    }

    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsgObj = {
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsgObj]);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch(`${ASSISTANT_API}/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          thread_id: activeThreadId,
          trip_id: activeThread?.trip_id || null,
          context_type: activeThread?.context_type || 'global'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            content: data.reply,
            chart_data: data.chart_data,
            action_proposal: data.action_proposal,
            options: data.options,
            createdAt: new Date().toISOString()
          }
        ]);
        fetchThreadsList();
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            content: `⚠️ **Notice:** ${data.error || 'Could not process message.'}`,
            createdAt: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: `⚠️ **Network Notice:** ${err.message}`, createdAt: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchThreadsList = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${ASSISTANT_API}/assistant/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch (e) {}
  };

  // 6. Confirm / Execute Interactive Action Proposal
  const handleConfirmAction = async (actionType, actionPayload, confirmed = true) => {
    try {
      setConfirmingAction(true);
      const token = await getToken();
      const res = await fetch(`${ASSISTANT_API}/assistant/confirm-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          thread_id: activeThreadId,
          action_type: actionType,
          action_payload: actionPayload,
          confirmed
        })
      });

      const data = await res.json();
      
      // Mark the proposal as resolved in messages state
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].action_proposal) {
            updated[i] = { ...updated[i], action_resolved: true };
            break;
          }
        }
        return updated;
      });

      if (res.ok && data.success) {
        showToast(data.message, "success");
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            content: data.message,
            createdAt: new Date().toISOString()
          }
        ]);
      } else {
        let rawErr = data.error || data.message || "Could not complete action.";
        let cleanError = rawErr;
        try {
          if (typeof rawErr === 'string' && (rawErr.includes('{') || rawErr.includes('}'))) {
            const jsonMatch = rawErr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const inner = parsed.message || parsed.error || '';
              if (inner) {
                cleanError = rawErr.replace(jsonMatch[0], inner).trim();
              }
            }
          }
        } catch (e) {}

        showToast(cleanError, "error");
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            content: `⚠️ ${cleanError}`,
            createdAt: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setConfirmingAction(false);
    }
  };

  const filteredThreads = threads.filter(t => 
    t.title.toLowerCase().includes(threadSearch.toLowerCase()) ||
    (t.trip_title && t.trip_title.toLowerCase().includes(threadSearch.toLowerCase()))
  );

  return (
    <div className="assistant-layout-container">
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div className="assistant-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
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
          {toast.type === 'error' ? <AlertTriangle size={18} color="#ef4444" /> : <CheckCircle size={18} color="#10b981" />}
          <span style={{ fontSize: '0.9rem' }}>{toast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEFT COLUMN: CHAT HISTORY SIDEBAR                                         */}
      {/* ========================================================================= */}
      <div className={`assistant-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        {/* Sidebar Header with + New Chat Button */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>Conversations</span>
            <button
              className="btn btn-secondary mobile-threads-toggle"
              onClick={() => setMobileSidebarOpen(false)}
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            >
              <X size={14} /> Close
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowNewChatModal(true)}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: '0.92rem', fontWeight: 600 }}
          >
            <Plus size={16} /> New Chat Session
          </button>

          {/* Search Filter */}
          <div style={{ position: 'relative', marginTop: '12px' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search chat history..."
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.82rem'
              }}
            />
          </div>
        </div>

        {/* Threads List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', padding: '4px 8px 8px 8px' }}>
            Your Conversations ({filteredThreads.length})
          </div>

          {filteredThreads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b', fontSize: '0.85rem' }}>
              No chat sessions found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredThreads.map(thread => {
                const isActive = thread.thread_id === activeThreadId;
                const isTrip = thread.context_type === 'trip';

                return (
                  <div
                    key={thread.thread_id}
                    onClick={() => selectThread(thread.thread_id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(56, 189, 248, 0.1) 100%)' : 'var(--bg-surface)',
                      border: `1px solid ${isActive ? '#6366f1' : 'transparent'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#ffffff' : '#cbd5e1',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {thread.title}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: isTrip ? 'rgba(129, 140, 248, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: isTrip ? '#a5b4fc' : '#7dd3fc',
                          border: `1px solid ${isTrip ? '#4f46e5' : '#0284c7'}`
                        }}>
                          {isTrip ? '📍 Trip' : '🌐 Global'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteThreadClick(e, thread.thread_id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Delete thread"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: ACTIVE CHAT CONVERSATION VIEW                               */}
      {/* ========================================================================= */}
      <div className="assistant-chat-panel">
        {/* Active Chat Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-surface)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: activeThread?.context_type === 'trip' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(56, 189, 248, 0.2)',
              border: `1px solid ${activeThread?.context_type === 'trip' ? '#6366f1' : '#0ea5e9'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeThread?.context_type === 'trip' ? '#818cf8' : '#38bdf8',
              flexShrink: 0
            }}>
              {activeThread?.context_type === 'trip' ? <MapPin size={18} /> : <Globe size={18} />}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeThread?.title || 'TripMate AI Assistant'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeThread?.context_type === 'trip' 
                  ? `Bound to ${activeThread?.trip_title || 'Selected Trip'}`
                  : 'Global Scope • Network, Balances & Plans'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary mobile-threads-toggle"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              style={{ fontSize: '0.8rem', padding: '6px 10px', gap: '6px' }}
            >
              <MessageSquare size={14} /> Chats ({threads.length})
            </button>

            {activeThread?.context_type === 'trip' && activeThread?.trip_id && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                onClick={() => navigate(`/trips/${activeThread.trip_id}`)}
              >
                Open Trip <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', maxWidth: '440px', padding: '30px' }}>
              <Sparkles size={36} color="#818cf8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 8px 0' }}>
                {activeThread?.context_type === 'trip' ? `Ready for ${activeThread?.trip_title || 'Trip'}` : 'Global AI Assistant Ready'}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                {activeThread?.context_type === 'trip'
                  ? 'Ask about who owes whom, request spending category charts, or add and split expenses with full form confirmations.'
                  : 'Ask about friends and net balances, incoming requests, or view summaries of your saved travel itineraries.'}
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const hasPlannerRedirect = msg.content && (msg.content.includes('/planner') || msg.content.includes('AI Trip Planner'));

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: isUser ? 'var(--primary)' : 'var(--bg-surface)',
                      color: isUser ? '#ffffff' : '#f8fafc',
                      border: isUser ? 'none' : '1px solid var(--border-subtle)',
                      lineHeight: 1.6,
                      fontSize: '0.95rem'
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>

                    {/* Interactive Button for Trip Planner Redirection */}
                    {hasPlannerRedirect && !isUser && (
                      <div style={{ marginTop: '12px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                          onClick={() => navigate('/planner')}
                        >
                          <Compass size={16} /> Open AI Trip Planner <ArrowRight size={14} />
                        </button>
                      </div>
                    )}

                    {/* Live Recharts Rendering */}
                    {msg.chart_data && (
                      <div style={{ marginTop: '16px', background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontWeight: 600, color: '#818cf8', marginBottom: '10px', fontSize: '0.9rem' }}>
                          {msg.chart_data.title || 'Spending Breakdown'}
                        </div>
                        {msg.chart_data.type === 'PIE' ? (
                          <CategoryPieChart data={msg.chart_data.data} />
                        ) : (
                          <SpendingBarChart data={msg.chart_data.data} />
                        )}
                      </div>
                    )}

                    {/* Form-Like Action Proposal Card (For All Write Operations) */}
                    {msg.action_proposal && (
                      (() => {
                        const isConfirmed = msg.action_proposal.status === 'CONFIRMED' || (msg.action_resolved && msg.action_proposal.status !== 'CANCELLED' && msg.action_proposal.status !== 'FAILED');
                        const isCancelled = msg.action_proposal.status === 'CANCELLED';
                        const isFailed = msg.action_proposal.status === 'FAILED';

                        if (isConfirmed) {
                          return (
                            <div style={{
                              marginTop: '12px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              border: '1px solid #10b981',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#6ee7b7',
                              fontSize: '0.86rem'
                            }}>
                              <Check size={16} color="#34d399" />
                              <span><strong>Action Confirmed & Executed</strong>: {msg.action_proposal.summary}</span>
                            </div>
                          );
                        }

                        if (isCancelled) {
                          return (
                            <div style={{
                              marginTop: '12px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid #ef4444',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#fca5a5',
                              fontSize: '0.86rem'
                            }}>
                              <X size={16} color="#f87171" />
                              <span><strong>Action Cancelled</strong>: {msg.action_proposal.summary}</span>
                            </div>
                          );
                        }

                        if (isFailed) {
                          return (
                            <div style={{
                              marginTop: '12px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid #ef4444',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#fca5a5',
                              fontSize: '0.86rem'
                            }}>
                              <AlertTriangle size={16} color="#ef4444" />
                              <span><strong>Action Attempted / Notice</strong>: {msg.action_proposal.summary}</span>
                            </div>
                          );
                        }

                        return (
                          <div style={{
                            marginTop: '14px',
                            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                            border: '1px solid #6366f1',
                            borderRadius: '10px',
                            padding: '16px 18px',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.35)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(99, 102, 241, 0.3)', paddingBottom: '8px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c7d2fe', fontWeight: 700, fontSize: '0.92rem' }}>
                                <FileText size={16} color="#818cf8" /> Action Proposal Form: {msg.action_proposal.action_type}
                              </span>
                              <span style={{ fontSize: '0.75rem', background: '#312e81', color: '#a5b4fc', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                Pending Confirmation
                              </span>
                            </div>

                            {/* Structured Form Fields */}
                            {msg.action_proposal.form_details && Object.keys(msg.action_proposal.form_details).length > 0 ? (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '14px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                {Object.entries(msg.action_proposal.form_details).map(([key, val]) => (
                                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>{key}:</span>
                                    <span style={{ color: '#f8fafc', fontWeight: 600, textAlign: 'right' }}>
                                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.9rem', color: '#e0e7ff', marginBottom: '12px' }}>
                                {msg.action_proposal.summary}
                              </div>
                            )}

                            {/* Boolean Interactive Buttons */}
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-secondary"
                                disabled={confirmingAction}
                                style={{ padding: '7px 16px', fontSize: '0.85rem', color: '#fca5a5', borderColor: '#7f1d1d' }}
                                onClick={() => handleConfirmAction(msg.action_proposal.action_type, msg.action_proposal.payload, false)}
                              >
                                <X size={14} /> {confirmingAction ? 'Processing...' : 'No, Cancel / Modify'}
                              </button>
                              <button
                                className="btn btn-primary"
                                disabled={confirmingAction}
                                style={{ padding: '7px 18px', fontSize: '0.85rem', fontWeight: 600 }}
                                onClick={() => handleConfirmAction(msg.action_proposal.action_type, msg.action_proposal.payload, true)}
                              >
                                <Check size={14} /> {confirmingAction ? 'Executing...' : 'Yes, Confirm & Execute'}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.88rem' }}>
              <div className="spinner" style={{ width: 16, height: 16 }}></div>
              <span>FastMCP agent analyzing and querying platform tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Suggested Prompt Chips (Only enabled when no action is pending) */}
        {!isActionPending && (
          <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {activeThread?.context_type === 'trip' ? (
              <>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Who owes whom in this trip?")} disabled={loading}>
                  ⚖️ Who owes whom?
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Show category spending pie chart")} disabled={loading}>
                  📊 Category chart
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Show member spending contribution bar chart")} disabled={loading}>
                  👥 Member contributions
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Add ₹1500 for dinner paid by me split equally")} disabled={loading}>
                  💸 Add ₹1500 dinner
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Explain the travel plan attached to this trip")} disabled={loading}>
                  📋 Explain travel plan
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Undo the last expense")} disabled={loading}>
                  ↩️ Undo last expense
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Show my friends and our net balances")} disabled={loading}>
                  🤝 Friends & Net Balances
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("Check my incoming and outgoing friend requests")} disabled={loading}>
                  📨 Friend Requests
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("List all my saved AI travel itineraries")} disabled={loading}>
                  📜 Saved Itineraries
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("List all my trips in SplitMate")} disabled={loading}>
                  📍 My Trips Overview
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSendMessage("How do I plan a new trip?")} disabled={loading}>
                  ✈️ How to plan trip?
                </button>
              </>
            )}
          </div>
        )}

        {/* Input Bar with Disabling during Pending Action Proposal */}
        {isActionPending ? (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: '#1e1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c7d2fe', fontSize: '0.88rem' }}>
              <AlertTriangle size={16} color="#facc15" />
              <span>Please confirm <strong>Yes</strong> or <strong>No</strong> on the action proposal above to proceed.</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                disabled={confirmingAction}
                style={{ padding: '6px 14px', fontSize: '0.82rem', color: '#fca5a5', borderColor: '#7f1d1d' }}
                onClick={() => handleConfirmAction(lastMessage.action_proposal.action_type, lastMessage.action_proposal.payload, false)}
              >
                <X size={13} /> {confirmingAction ? 'Cancelling...' : 'No / Cancel'}
              </button>
              <button
                className="btn btn-primary"
                disabled={confirmingAction}
                style={{ padding: '6px 16px', fontSize: '0.82rem', fontWeight: 600 }}
                onClick={() => handleConfirmAction(lastMessage.action_proposal.action_type, lastMessage.action_proposal.payload, true)}
              >
                <Check size={13} /> {confirmingAction ? 'Executing...' : 'Yes, Confirm'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '10px', background: 'var(--bg-card)' }}>
            <input
              type="text"
              placeholder={
                activeThread?.context_type === 'trip'
                  ? `Ask about ${activeThread?.trip_title || 'this trip'} (e.g. 'Add priya to trip', 'Add 1200 taxi', 'Who owes what?')...`
                  : "Ask Global Assistant (e.g. 'Who owes me money?', 'Send friend request to rohit', 'List saved plans')..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '11px 16px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: '#f8fafc',
                fontSize: '0.92rem'
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !input.trim()}
              style={{ padding: '0 20px' }}
            >
              <Send size={16} />
            </button>
          </form>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW CHAT SESSION                                            */}
      {/* ========================================================================= */}
      {showNewChatModal && (
        <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Start New Conversation</h3>
              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setShowNewChatModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                Select Conversation Context Scope:
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setNewChatContextType('global')}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    border: `1px solid ${newChatContextType === 'global' ? '#38bdf8' : 'var(--border-subtle)'}`,
                    background: newChatContextType === 'global' ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-surface)',
                    color: newChatContextType === 'global' ? '#fff' : '#94a3b8',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Globe size={22} color="#38bdf8" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Global Mode</span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Friends & Itineraries</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewChatContextType('trip')}
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    border: `1px solid ${newChatContextType === 'trip' ? '#818cf8' : 'var(--border-subtle)'}`,
                    background: newChatContextType === 'trip' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface)',
                    color: newChatContextType === 'trip' ? '#fff' : '#94a3b8',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <MapPin size={22} color="#818cf8" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Trip Context</span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Bound to a Trip</span>
                </button>
              </div>

              {newChatContextType === 'trip' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 500, color: '#cbd5e1' }}>
                    Choose Trip:
                  </label>
                  {trips.length === 0 ? (
                    <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>No trips found in SplitMate.</div>
                  ) : (
                    <select
                      value={newChatTripId}
                      onChange={(e) => setNewChatTripId(e.target.value)}
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
                      {trips.map(t => (
                        <option key={t._id} value={t._id}>
                          {t.title} ({t.members?.length || 1} members)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowNewChatModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={creatingThread || (newChatContextType === 'trip' && !newChatTripId)}
                onClick={() => handleCreateNewThread(newChatContextType, newChatTripId)}
              >
                {creatingThread ? 'Creating...' : 'Start Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {threadToDelete && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
              <Trash2 size={20} /> Delete Chat History
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete this chat conversation? All associated messages and chart records will be removed.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" disabled={isDeletingThread} onClick={() => setThreadToDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" disabled={isDeletingThread} onClick={() => confirmDeleteThread(threadToDelete)}>
                {isDeletingThread ? 'Deleting...' : 'Delete Conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
