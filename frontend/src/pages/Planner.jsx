import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { 
  Plane, 
  Hotel, 
  CloudSun, 
  Wallet, 
  Calendar, 
  CheckCircle2, 
  Sparkles, 
  RotateCcw, 
  Save, 
  Bookmark, 
  AlertCircle, 
  StopCircle, 
  HelpCircle, 
  RefreshCw, 
  Edit3, 
  Printer, 
  Trash2, 
  Clock, 
  Layers, 
  Check, 
  MapPin, 
  Users 
} from 'lucide-react';
import './Planner.css';

function cleanMarkdownContent(raw) {
  if (!raw) return '';
  if (typeof raw !== 'string') {
    try {
      raw = JSON.stringify(raw);
    } catch {
      return '';
    }
  }
  let text = raw.trim();
  if (text.startsWith('```markdown')) text = text.slice(11);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  
  text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  return text.trim();
}

function cleanDestinationName(dest, title = '', itinerary = '') {
  let raw = (dest || '').trim();
  const prefixes = [
    'Complete Travel Plan:', 'Complete Travel Plan',
    'Draft Travel Plan:', 'Draft Travel Plan',
    'Trip to', 'Trip'
  ];
  for (const prefix of prefixes) {
    if (raw.toLowerCase().startsWith(prefix.toLowerCase())) {
      raw = raw.slice(prefix.length).trim();
    }
  }
  raw = raw.replace(/\(?\d+\s*Days?\)?/gi, '').trim();
  raw = raw.replace(/[^a-zA-Z0-9\s,\-']/g, '').trim();

  if (!raw || ['not specified', 'vacation', 'none'].includes(raw.toLowerCase())) {
    const match = (itinerary || title || '').match(/Travel Plan:\s*([A-Za-z\s]+?)(?:\s*\(\d+\s*Days|\n|$)/i);
    if (match && match[1] && !['not specified', 'none'].includes(match[1].toLowerCase())) {
      raw = match[1].trim();
    }
  }
  return raw || 'Vacation';
}

export default function Planner() {
  const { getToken, userId } = useAuth();
  const navigate = useNavigate();

  // Mode: 'planner' | 'history'
  const [activeView, setActiveView] = useState('planner');

  // Filter state (optional controls)
  const [destFilter, setDestFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [groupSizeFilter, setGroupSizeFilter] = useState('');
  const [budgetFilter, setBudgetFilter] = useState('');
  
  // Natural Language Prompt State
  const [inputQuery, setInputQuery] = useState('');
  const [feedback, setFeedback] = useState('');

  // Workflow & Execution State
  // status: 'idle' | 'clarifying' | 'generating' | 'draft_review' | 'finalized' | 'error'
  const [plannerStatus, setPlannerStatus] = useState('idle');
  const [threadId, setThreadId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [planVersion, setPlanVersion] = useState(1);

  // Set of version numbers that have been saved to MongoDB for current trip
  const [savedVersionsSet, setSavedVersionsSet] = useState(new Set());

  // Active Trip Context & Version History
  const [activeTripConstraints, setActiveTripConstraints] = useState({});
  const [activeTripVersions, setActiveTripVersions] = useState([]);

  // Granular Independent Loading Flags
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isBusy = isGenerating || isRevising || isFinalizing || isSaving;

  // Dynamic Saved Status check based on active planVersion
  const isCurrentPlanSaved = savedVersionsSet.has(planVersion);

  // Real-Time Progress & Routing
  const [activeNodeText, setActiveNodeText] = useState('');
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [supervisorReasoning, setSupervisorReasoning] = useState('');
  
  // Results
  const [itineraryResult, setItineraryResult] = useState('');
  const [savedTripId, setSavedTripId] = useState(null);

  // Questionnaire / Clarification State
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [customClarificationText, setCustomClarificationText] = useState('');

  // Saved Plans Collection
  const [savedPlans, setSavedPlans] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState(null);
  
  // Abort Controller for Cancellation
  const abortControllerRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch saved plans directly from MongoDB via planner-backend
  const fetchSavedPlans = async () => {
    try {
      setLoadingHistory(true);
      const token = await getToken();
      const res = await fetch(`http://localhost:8001/api/travel/saved?user_id=${userId || ''}`, {
        headers: { 
          'Authorization': token ? `Bearer ${token}` : '',
          'x-user-id': userId || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedPlans(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load saved plans from MongoDB:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSavedPlans();
  }, [userId]);

  useEffect(() => {
    if (activeView === 'history') {
      fetchSavedPlans();
    }
  }, [activeView]);

  const buildFinalPrompt = (customInput = null) => {
    const rawInput = customInput !== null ? customInput : inputQuery;
    let parts = [];
    if (destFilter) parts.push(`Destination: ${destFilter}`);
    if (durationFilter) parts.push(`Duration: ${durationFilter}`);
    if (groupSizeFilter) parts.push(`Group Size: ${groupSizeFilter}`);
    if (budgetFilter) parts.push(`Budget: ${budgetFilter}`);
    
    if (parts.length > 0 && rawInput.trim()) {
      return `${parts.join(', ')}. Details: ${rawInput.trim()}`;
    } else if (rawInput.trim()) {
      return rawInput.trim();
    } else if (parts.length > 0) {
      return `Plan a trip to ${destFilter || 'a top travel destination'} for ${durationFilter || '4 days'}, ${groupSizeFilter || 'group of friends'}, with ${budgetFilter || 'moderate'} budget.`;
    }
    return '';
  };

  const isFormEmpty = !inputQuery.trim() && !destFilter.trim();

  // 1. Initial Submit: Pre-planning Questionnaire Check with Guaranteed Guardrail & Questions
  const handleInitiatePlanning = async (e) => {
    if (e) e.preventDefault();
    const finalPrompt = buildFinalPrompt();
    if (!finalPrompt) {
      showToast("Please enter a destination or prompt to start planning.", "error");
      return;
    }

    // Reset previous execution state cleanly
    setSelectedAgents([]);
    setSupervisorReasoning('');
    setItineraryResult('');
    setSavedTripId(null);
    setFeedback('');
    setErrorMessage('');
    setQuestionAnswers({});
    setClarifyingQuestions([]);
    setCustomClarificationText('');
    setPlanVersion(1);
    setSavedVersionsSet(new Set());
    setActiveTripVersions([]);

    setIsGenerating(true);
    setPlannerStatus('generating');
    setActiveNodeText('Supervisor analyzing travel intent & guardrails...');

    try {
      const qRes = await fetch('http://localhost:8001/api/travel/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalPrompt, user_id: userId || '' })
      });

      if (qRes.ok) {
        const qData = await qRes.json();
        setThreadId(qData.thread_id);

        if (qData.is_travel_related === false) {
          setErrorMessage(qData.guardrail_message || "Please provide a valid real destination (e.g. 'Goa', 'Paris', 'Tokyo').");
          setPlannerStatus('error');
          setIsGenerating(false);
          showToast("Invalid destination or non-travel query.", "error");
          return;
        }

        if (qData.needs_clarification && qData.questions?.length > 0) {
          setClarifyingQuestions(qData.questions);
          setPlannerStatus('clarifying');
          setIsGenerating(false);
          return;
        }
      }

      await executePlanGeneration(finalPrompt);

    } catch (err) {
      setErrorMessage("Failed to initiate planner: " + err.message);
      setPlannerStatus('error');
      setIsGenerating(false);
    }
  };

  // 2. Execute Full Multi-Agent Graph Generation
  const executePlanGeneration = async (promptToRun) => {
    setIsGenerating(true);
    setPlannerStatus('generating');
    setErrorMessage('');
    setActiveNodeText('Coordinating specialist agents in parallel...');
    
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('http://localhost:8001/api/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          message: promptToRun,
          thread_id: threadId,
          user_id: userId || ''
        })
      });

      const data = await res.json();

      if (data.cancelled) {
        showToast("Generation cancelled.", "error");
        setIsGenerating(false);
        setPlannerStatus('idle');
        return;
      }

      if (data.is_travel_related === false || data.error?.includes('AI Travel Planner') || data.error?.includes('valid')) {
        setErrorMessage(data.error || "Please enter a valid real travel destination.");
        setPlannerStatus('error');
        setIsGenerating(false);
        return;
      }

      if (data.success) {
        setThreadId(data.thread_id);
        setSelectedAgents(data.selected_agents || []);
        setSupervisorReasoning(data.supervisor_reasoning || '');
        
        const returnedConstraints = data.trip_constraints || {};
        const cleanDest = cleanDestinationName(returnedConstraints.destination, '', data.itinerary || '');
        returnedConstraints.destination = cleanDest;
        setActiveTripConstraints(returnedConstraints);

        const cleanPlan = cleanMarkdownContent(data.itinerary || data.answer || '');
        
        if (cleanPlan.includes('RESOURCE_EXHAUSTED') || cleanPlan.includes('Model error: 429') || cleanPlan.includes('Quota exceeded')) {
          setErrorMessage("AI service is currently experiencing high demand. Please retry in a few moments.");
          setPlannerStatus('error');
          return;
        }

        setItineraryResult(cleanPlan);
        setPlanVersion(1);
        setSavedVersionsSet(new Set());
        
        // Initial version tracking
        setActiveTripVersions([{
          version: 1,
          itinerary: cleanPlan,
          groupSize: returnedConstraints.group_size || '2 People',
          duration: returnedConstraints.duration || '4 Days',
          budget: returnedConstraints.budget || 'Moderate'
        }]);

        // Clear input boxes once draft is ready
        setInputQuery('');
        setDestFilter('');
        setDurationFilter('');
        setGroupSizeFilter('');
        setBudgetFilter('');

        setPlannerStatus('draft_review');
        showToast("Draft ready for review!", "success");
      } else {
        setErrorMessage(data.error || "Failed to generate plan.");
        setPlannerStatus('error');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMessage("Generation error: " + err.message);
        setPlannerStatus('error');
      } else {
        setPlannerStatus('idle');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Handle Answering Questionnaire Options
  const handleAnswerQuestion = (qId, optionVal) => {
    setQuestionAnswers(prev => ({ ...prev, [qId]: optionVal }));
  };

  const hasSelectedAnyOption = Object.keys(questionAnswers).length > 0 || customClarificationText.trim().length > 0;

  const handleSubmitClarifications = () => {
    if (!hasSelectedAnyOption) return;
    const chipAnswers = Object.entries(questionAnswers)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const combinedPrompt = `${buildFinalPrompt()}${chipAnswers ? ` Details: ${chipAnswers}` : ''}${customClarificationText ? ` Custom Preferences: ${customClarificationText}` : ''}`;
    executePlanGeneration(combinedPrompt);
  };

  const handleSkipClarifications = () => {
    executePlanGeneration(buildFinalPrompt());
  };

  // 4. Handle Real-Time Cancellation
  const handleCancelGeneration = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (threadId) {
      try {
        await fetch('http://localhost:8001/api/travel/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thread_id: threadId })
        });
      } catch (e) {
        console.error("Cancel notify error:", e);
      }
    }
    setIsGenerating(false);
    setPlannerStatus('idle');
    showToast("Plan generation stopped.", "error");
  };

  // 5. Handle HITL Review Feedback Revision with Non-Colliding Monotonic Versioning
  const handleReviseDraft = async () => {
    if (!feedback.trim() || isRevising || isFinalizing) return;

    try {
      setIsRevising(true);
      setActiveNodeText('Applying feedback and updating itinerary...');
      
      const res = await fetch('http://localhost:8001/api/travel/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId,
          approved: false,
          feedback: feedback.trim(),
          user_id: userId || '',
          trip_constraints: activeTripConstraints
        })
      });

      const data = await res.json();
      if (data.success) {
        const cleanPlan = cleanMarkdownContent(data.itinerary || data.answer || '');
        
        // Monotonically determine next version number so existing versions are NEVER overwritten
        const existingMaxVersion = activeTripVersions.reduce((max, v) => Math.max(max, Number(v.version) || 1), 0);
        const nextVersion = Math.max(existingMaxVersion, planVersion) + 1;
        
        setItineraryResult(cleanPlan);
        setFeedback('');
        setPlanVersion(nextVersion);

        if (data.trip_constraints) {
          const cleanDest = cleanDestinationName(data.trip_constraints.destination, '', cleanPlan);
          data.trip_constraints.destination = cleanDest;
          setActiveTripConstraints(data.trip_constraints);
        }

        // Add to active versions array as new version (not marked as saved until user clicks Save)
        setActiveTripVersions(prev => [
          ...prev,
          {
            version: nextVersion,
            itinerary: cleanPlan,
            groupSize: data.trip_constraints?.group_size || activeTripConstraints.group_size || '2 People',
            duration: data.trip_constraints?.duration || activeTripConstraints.duration || '4 Days',
            budget: data.trip_constraints?.budget || activeTripConstraints.budget || 'Moderate',
            feedback: feedback.trim()
          }
        ]);

        setPlannerStatus('draft_review');
        showToast(`Draft updated to Version ${nextVersion}!`, "success");
      } else {
        showToast("Revision notice: " + (data.error || "Failed to update draft"), "error");
      }
    } catch (err) {
      showToast("Revision failed: " + err.message, "error");
    } finally {
      setIsRevising(false);
    }
  };

  // 6. Handle HITL Final Approval
  const handleApproveFinal = async () => {
    if (isFinalizing || isRevising) return;

    try {
      setIsFinalizing(true);
      setActiveNodeText('Finalizing unified report & formatting...');

      const res = await fetch('http://localhost:8001/api/travel/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId,
          approved: true,
          feedback: "",
          user_id: userId || '',
          trip_constraints: activeTripConstraints
        })
      });

      const data = await res.json();
      if (data.success) {
        const cleanPlan = cleanMarkdownContent(data.itinerary || data.answer || '');
        setItineraryResult(cleanPlan);
        if (data.trip_constraints) {
          const cleanDest = cleanDestinationName(data.trip_constraints.destination, '', cleanPlan);
          data.trip_constraints.destination = cleanDest;
          setActiveTripConstraints(data.trip_constraints);
        }
        setPlannerStatus('finalized');
        showToast("Plan approved & finalized!", "success");
      }
    } catch (err) {
      showToast("Approval error: " + err.message, "error");
    } finally {
      setIsFinalizing(false);
    }
  };

  // 7. Save Trip Directly to MongoDB via Python Planner Backend
  const handleSaveToMongoDB = async () => {
    if (isSaving || isCurrentPlanSaved) return;

    try {
      setIsSaving(true);
      
      const dest = cleanDestinationName(activeTripConstraints.destination || destFilter || 'Vacation', '', itineraryResult);
      const dur = activeTripConstraints.duration || durationFilter || '4 Days';
      const grp = activeTripConstraints.group_size || groupSizeFilter || 'Solo/Group';
      const bud = activeTripConstraints.budget || budgetFilter || 'Moderate';
      const title = `Trip to ${dest} (${dur})`;

      const res = await fetch('http://localhost:8001/api/travel/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({
          planId: savedTripId || undefined,
          title: title,
          destination: dest,
          duration: dur,
          groupSize: grp,
          budget: bud,
          version: planVersion,
          status: 'finalized',
          itinerary: itineraryResult,
          selectedAgents: selectedAgents,
          user_id: userId || ''
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSavedTripId(data.planId);
        // Mark this specific version as saved
        setSavedVersionsSet(prev => new Set([...prev, planVersion]));
        showToast(`Trip to ${dest} (v${planVersion}) saved to MongoDB!`, "success");
        fetchSavedPlans();
      } else {
        showToast(data.detail || data.error || "Failed to save plan.", "error");
      }
    } catch (err) {
      showToast("Save error: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // 8. Delete Saved Plan from MongoDB
  const handleDeleteSavedPlan = async (planId) => {
    try {
      const res = await fetch(`http://localhost:8001/api/travel/saved/${planId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast("Plan deleted from MongoDB.", "success");
        fetchSavedPlans();
      }
    } catch (err) {
      showToast("Delete failed: " + err.message, "error");
    }
  };

  // 9. Switch to Specific Version without mutating other versions
  const handleSwitchVersion = (versionObj) => {
    if (!versionObj || !versionObj.itinerary) return;
    setItineraryResult(cleanMarkdownContent(versionObj.itinerary));
    setPlanVersion(versionObj.version);
    setActiveTripConstraints({
      destination: versionObj.destination || activeTripConstraints.destination,
      duration: versionObj.duration || activeTripConstraints.duration || '4 Days',
      group_size: versionObj.groupSize || activeTripConstraints.group_size || '2 People',
      budget: versionObj.budget || activeTripConstraints.budget || 'Moderate'
    });
    showToast(`Switched to Version ${versionObj.version}`, 'success');
  };

  // 10. Native PDF Download via Print Engine
  const handleDownloadPDF = () => {
    window.print();
  };

  const isRouted = (agentId) => selectedAgents.includes(agentId);

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
          {toast.type === 'error' ? <AlertCircle size={18} color="#ef4444" /> : <CheckCircle2 size={18} color="#10b981" />}
          <span style={{ fontSize: '0.9rem' }}>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: 0 }}>
            AI Multi-Agent Travel Planner
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '4px' }}>
            LangGraph Supervisor orchestrating Flights, Hotels, Budget, Weather & Day-wise Schedules
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className={`btn ${activeView === 'planner' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('planner')}
          >
            <Sparkles size={16} /> Plan New Trip
          </button>
          <button
            className={`btn ${activeView === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveView('history');
              fetchSavedPlans();
            }}
          >
            <Bookmark size={16} /> Saved Plans ({savedPlans.length})
          </button>
        </div>
      </div>

      {activeView === 'planner' ? (
        <div>
          {/* Quick Filters (Optional) */}
          <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#818cf8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🎯 Optional Filters (Leave blank to type freely below):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Destination</label>
                <input
                  type="text"
                  placeholder="e.g. Goa, Tokyo, Paris"
                  value={destFilter}
                  onChange={(e) => setDestFilter(e.target.value)}
                  disabled={isBusy}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Duration</label>
                <select
                  value={durationFilter}
                  onChange={(e) => setDurationFilter(e.target.value)}
                  disabled={isBusy}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="">— Any / Specify in text —</option>
                  <option value="3 Days">3 Days (Weekend Getaway)</option>
                  <option value="5 Days">5 Days</option>
                  <option value="7 Days">7 Days (1 Week)</option>
                  <option value="10 Days">10 Days</option>
                  <option value="14 Days">14 Days (2 Weeks)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Group Size</label>
                <select
                  value={groupSizeFilter}
                  onChange={(e) => setGroupSizeFilter(e.target.value)}
                  disabled={isBusy}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="">— Any / Specify in text —</option>
                  <option value="Solo">Solo Traveler</option>
                  <option value="Couple (2 People)">Couple (2 People)</option>
                  <option value="Small Group (3-5 People)">Small Group (3-5 People)</option>
                  <option value="Large Group (6-10 People)">Large Group (6-10 People)</option>
                  <option value="10+ People">10+ People</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Target Budget</label>
                <select
                  value={budgetFilter}
                  onChange={(e) => setBudgetFilter(e.target.value)}
                  disabled={isBusy}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="">— Any / Specify in text —</option>
                  <option value="Backpacker / Budget friendly (₹15,000 - ₹30,000)">Budget Friendly</option>
                  <option value="Moderate / Comfortable (₹40,000 - ₹80,000)">Moderate / Standard</option>
                  <option value="Luxury / Premium (₹1,00,000+)">Luxury / Premium</option>
                </select>
              </div>
            </div>
          </div>

          {/* Natural Language Prompt Input Bar */}
          <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
            <form onSubmit={handleInitiatePlanning}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="e.g. Plan a trip to Goa for 10 people, budget friendly, no need to check weather, 10 days duration..."
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  disabled={isBusy}
                  style={{
                    flex: 1,
                    minWidth: '280px',
                    padding: '12px 16px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: '#f8fafc',
                    fontSize: '1rem'
                  }}
                />

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isBusy || isFormEmpty}
                    title={isFormEmpty ? "Please enter a destination or prompt" : isBusy ? "Action in progress..." : "Generate Plan 🚀"}
                    style={{
                      whiteSpace: 'nowrap',
                      opacity: (isBusy || isFormEmpty) ? 0.6 : 1,
                      cursor: (isBusy || isFormEmpty) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Sparkles size={16} /> {isGenerating ? 'Generating Plan...' : 'Generate Plan 🚀'}
                  </button>

                  {isGenerating && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelGeneration}
                      style={{ color: '#ef4444', borderColor: '#ef4444', whiteSpace: 'nowrap' }}
                    >
                      <StopCircle size={16} /> Cancel
                    </button>
                  )}
                </div>
              </div>

              {isFormEmpty && !isBusy && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💡</span>
                  <span>Enter a destination or query in the box above to enable the <strong>Generate Plan</strong> button.</span>
                </div>
              )}
            </form>
          </div>

          {/* Graceful Error Notice Box */}
          {plannerStatus === 'error' && errorMessage && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>
                <AlertCircle size={18} /> Travel Request Notice
              </div>
              <p style={{ color: '#fecaca', fontSize: '0.92rem', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                {errorMessage}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => executePlanGeneration(buildFinalPrompt())}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={15} /> Try Again
              </button>
            </div>
          )}

          {/* Clarification / Questionnaire Card with Enabled/Disabled Options Button */}
          {plannerStatus === 'clarifying' && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid #6366f1', background: 'rgba(99, 102, 241, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#818cf8', fontWeight: 600, fontSize: '1.05rem' }}>
                <HelpCircle size={19} /> Quick Travel Clarification (Help AI refine your plan)
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '20px' }}>
                {clarifyingQuestions.map((q) => (
                  <div key={q.id}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 500, color: '#f8fafc' }}>
                      {q.question}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {q.options?.map((opt) => {
                        const isSelected = questionAnswers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleAnswerQuestion(q.id, opt)}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '20px',
                              border: `1px solid ${isSelected ? '#818cf8' : 'var(--border-subtle)'}`,
                              background: isSelected ? 'var(--primary)' : 'var(--bg-surface)',
                              color: isSelected ? '#ffffff' : '#cbd5e1',
                              fontSize: '0.85rem',
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer'
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div>
                  <label style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                    ✍️ Specify any custom details (e.g. "Traveling with 3 college friends, budget under 40k, focus on water sports"):
                  </label>
                  <input
                    type="text"
                    placeholder="Type any custom preferences or details..."
                    value={customClarificationText}
                    onChange={(e) => setCustomClarificationText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitClarifications}
                  disabled={isBusy || !hasSelectedAnyOption}
                  style={{
                    opacity: hasSelectedAnyOption ? 1 : 0.5,
                    cursor: hasSelectedAnyOption ? 'pointer' : 'not-allowed'
                  }}
                  title={hasSelectedAnyOption ? "Proceed with selected choices" : "Please select at least one option chip or type details"}
                >
                  <Sparkles size={16} /> Proceed with Selected Options
                </button>
                <button className="btn btn-secondary" onClick={handleSkipClarifications} disabled={isBusy}>
                  ⚡ Skip & Auto-Plan with Smart Defaults
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Active Progress & Node Indicator */}
          {isGenerating && (
            <div className="card" style={{ marginBottom: '24px', textAlign: 'center', padding: '30px' }}>
              <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                {activeNodeText}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '6px' }}>
                Analyzing negative constraints and synthesizing specialist intelligence in INR (₹)
              </div>
            </div>
          )}

          {/* Dynamic Supervisor Workflow Routing Team */}
          {selectedAgents.length > 0 && plannerStatus !== 'error' && (
            <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Supervisor Workflow & Specialist Team
                </div>
                <div style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>
                  {selectedAgents.length} SPECIALISTS ROUTED
                </div>
              </div>

              {supervisorReasoning && (
                <div style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '14px', background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '6px' }}>
                  <strong>Supervisor Note:</strong> {supervisorReasoning}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {isRouted('flight_agent') && (
                  <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: '#0284c7', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plane size={14} /> Transit & Transport (Flights, Trains, Buses)
                  </span>
                )}
                {isRouted('hotel_agent') && (
                  <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderColor: '#9333ea', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Hotel size={14} /> Hotels & Stays
                  </span>
                )}
                {isRouted('weather_agent') && (
                  <span className="badge" style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', borderColor: '#0d9488', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CloudSun size={14} /> Weather & Packing
                  </span>
                )}
                {isRouted('budget_agent') && (
                  <span className="badge" style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', borderColor: '#ca8a04', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wallet size={14} /> Budget Specialist (₹)
                  </span>
                )}
                {isRouted('itinerary_agent') && (
                  <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: '#4f46e5', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} /> Itinerary Planner
                  </span>
                )}
              </div>
            </div>
          )}

          {/* HITL Phase 1: Review Draft Itinerary & Provide Feedback (Focused on current draft, no distraction chips) */}
          {plannerStatus === 'draft_review' && itineraryResult && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid #eab308', background: 'rgba(234, 179, 8, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', color: '#facc15', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Review Draft Itinerary & Provide Feedback ✍️
                </h2>
                
                {/* Clean Active Draft Badge without cross-version distraction */}
                <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', borderColor: '#ca8a04', fontSize: '0.82rem', fontWeight: 600, padding: '4px 10px' }}>
                  <Layers size={13} /> Version {planVersion} (Draft under review)
                </span>
              </div>
              
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '16px' }}>
                The specialist team has drafted your plan. Suggest adjustments below or click <strong>Approve & Finalize</strong>.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Suggest adjustments (e.g. make for 5 people, focus on beaches, reduce budget)..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  disabled={isRevising || isFinalizing}
                  style={{
                    flex: 1,
                    minWidth: '260px',
                    padding: '10px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.95rem',
                    opacity: (isRevising || isFinalizing) ? 0.6 : 1
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleReviseDraft}
                  disabled={isRevising || isFinalizing || !feedback.trim()}
                  style={{ opacity: (isRevising || isFinalizing || !feedback.trim()) ? 0.6 : 1, cursor: (isRevising || isFinalizing || !feedback.trim()) ? 'not-allowed' : 'pointer' }}
                >
                  <RotateCcw size={15} /> {isRevising ? 'Revising...' : 'Revise Using Feedback'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApproveFinal}
                  disabled={isFinalizing || isRevising}
                  style={{ opacity: (isFinalizing || isRevising) ? 0.6 : 1, cursor: (isFinalizing || isRevising) ? 'not-allowed' : 'pointer' }}
                >
                  <CheckCircle2 size={15} /> {isFinalizing ? 'Finalizing...' : 'Approve & Finalize'}
                </button>
              </div>

              {/* Draft Markdown Preview with RemarkGFM tables */}
              <div className="final-report-print-container" style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', lineHeight: 1.7, color: '#e2e8f0', overflowX: 'auto' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{itineraryResult}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* HITL Phase 2: Final Approved Report with Direct MongoDB Save and PDF Download */}
          {plannerStatus === 'finalized' && itineraryResult && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={20} /> Finalized Travel Itinerary
                  </h2>
                  
                  {/* Version Switching Bar in Finalized View */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Version:</span>
                    {activeTripVersions.length > 0 ? (
                      activeTripVersions.map((vObj) => (
                        <button
                          key={vObj.version}
                          type="button"
                          onClick={() => handleSwitchVersion(vObj)}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            border: vObj.version === planVersion ? '1px solid #10b981' : '1px solid #334155',
                            background: vObj.version === planVersion ? '#059669' : '#1e293b',
                            color: vObj.version === planVersion ? '#ffffff' : '#94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          v{vObj.version}
                        </button>
                      ))
                    ) : (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: '#059669', fontSize: '0.78rem' }}>
                        v{planVersion}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => setPlannerStatus('draft_review')}>
                    <Edit3 size={15} /> Request Revisions
                  </button>

                  <button className="btn btn-secondary" onClick={handleDownloadPDF}>
                    <Printer size={15} /> Download PDF
                  </button>

                  <button
                    className={`btn ${isCurrentPlanSaved ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleSaveToMongoDB}
                    disabled={isSaving || isCurrentPlanSaved}
                    style={{
                      background: isCurrentPlanSaved ? '#064e3b' : undefined,
                      borderColor: isCurrentPlanSaved ? '#059669' : undefined,
                      color: isCurrentPlanSaved ? '#6ee7b7' : undefined,
                      cursor: isCurrentPlanSaved ? 'default' : 'pointer'
                    }}
                  >
                    {isCurrentPlanSaved ? (
                      <><Check size={16} /> Plan Saved in DB (v{planVersion})</>
                    ) : (
                      <><Save size={16} /> {isSaving ? 'Saving to DB...' : 'Save Plan to MongoDB'}</>
                    )}
                  </button>
                </div>
              </div>

              {/* Final Report Markdown Content with RemarkGFM tables */}
              <div className="final-report-print-container" style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-subtle)', lineHeight: 1.8, color: '#f1f5f9', overflowX: 'auto' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{itineraryResult}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Saved Plans History View - Unified Trip Cards with Version Switching */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>Saved Itineraries & Version History</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '4px 0 0 0' }}>Stored directly in MongoDB Atlas</p>
            </div>
            <button className="btn btn-secondary" onClick={fetchSavedPlans}>
              <RefreshCw size={15} /> Refresh Plans
            </button>
          </div>

          {loadingHistory ? (
            <p style={{ color: '#94a3b8' }}>Loading saved plans from MongoDB... ⏳</p>
          ) : savedPlans.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '50px' }}>
              <h3>No Saved Plans Yet</h3>
              <p style={{ color: '#94a3b8', margin: '10px 0 20px 0' }}>Generate a travel plan and click "Save Plan to MongoDB" to persist it!</p>
              <button className="btn btn-primary" onClick={() => setActiveView('planner')}>
                <Sparkles size={16} /> Plan a Trip Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {savedPlans.map((plan) => {
                const versionsList = plan.versions && plan.versions.length > 0 ? plan.versions : [{ version: plan.version || 1, itinerary: plan.itinerary }];
                // Ensure versionsList is sorted ascending
                const sortedVersions = [...versionsList].sort((a, b) => Number(a.version || 1) - Number(b.version || 1));
                const latestVersionObj = sortedVersions[sortedVersions.length - 1] || {};
                const latestVersionNum = latestVersionObj.version || plan.version || 1;
                const cleanDest = cleanDestinationName(latestVersionObj.destination || plan.destination, plan.title, latestVersionObj.itinerary || plan.itinerary);
                const savedVersionNums = new Set(sortedVersions.map(v => v.version));

                return (
                  <div key={plan._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
                    <div>
                      {/* Header: Title & Latest Version Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#f8fafc', fontWeight: 600, lineHeight: 1.3 }}>
                          Trip to {cleanDest}
                        </h3>
                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: '#4f46e5', fontSize: '0.78rem', fontWeight: 600, padding: '3px 8px' }}>
                          v{latestVersionNum} (Latest)
                        </span>
                      </div>
                      
                      {/* Clean Structured Grid with Place as ONLY the city name from latest version */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                          <MapPin size={14} color="#818cf8" />
                          <span><strong>Place:</strong> {cleanDest}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                          <Calendar size={14} color="#38bdf8" />
                          <span><strong>Days:</strong> {latestVersionObj.duration || plan.duration || '4 Days'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                          <Users size={14} color="#34d399" />
                          <span><strong>People:</strong> {latestVersionObj.groupSize || plan.groupSize || 'Solo/Group'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                          <Wallet size={14} color="#facc15" />
                          <span><strong>Budget:</strong> {latestVersionObj.budget || plan.budget || 'Moderate'}</span>
                        </div>
                      </div>

                      {/* Version Switching Chips on Card (Sorted in ascending order: v1, v2, v3...) */}
                      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>Versions:</span>
                        {sortedVersions.map((vObj) => (
                          <button
                            key={vObj.version}
                            type="button"
                            onClick={() => {
                              setSavedTripId(plan._id);
                              setItineraryResult(cleanMarkdownContent(vObj.itinerary || plan.itinerary));
                              setPlanVersion(vObj.version);
                              setSavedVersionsSet(savedVersionNums);
                              setActiveTripVersions(sortedVersions);
                              setActiveTripConstraints({
                                destination: cleanDestinationName(vObj.destination || plan.destination, '', vObj.itinerary || ''),
                                duration: vObj.duration || plan.duration,
                                group_size: vObj.groupSize || plan.groupSize,
                                budget: vObj.budget || plan.budget
                              });
                              setPlannerStatus('finalized');
                              setActiveView('planner');
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: '1px solid #4f46e5',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              cursor: 'pointer'
                            }}
                            title={`Click to view v${vObj.version}`}
                          >
                            v{vObj.version}
                          </button>
                        ))}
                      </div>

                      {/* Timestamp */}
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> Created: {new Date(plan.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(plan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Actions: View Report & Delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        onClick={() => {
                          setSavedTripId(plan._id);
                          setItineraryResult(cleanMarkdownContent(latestVersionObj.itinerary || plan.itinerary));
                          setPlanVersion(latestVersionObj.version || plan.version || 1);
                          setSavedVersionsSet(savedVersionNums);
                          setActiveTripVersions(sortedVersions);
                          setActiveTripConstraints({
                            destination: cleanDest,
                            duration: latestVersionObj.duration || plan.duration,
                            group_size: latestVersionObj.groupSize || plan.groupSize,
                            budget: latestVersionObj.budget || plan.budget
                          });
                          setPlannerStatus('finalized');
                          setActiveView('planner');
                        }}
                      >
                        View Report
                      </button>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', color: '#ef4444', borderColor: '#ef4444' }}
                        onClick={() => handleDeleteSavedPlan(plan._id)}
                        title="Delete plan"
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
    </div>
  );
}
