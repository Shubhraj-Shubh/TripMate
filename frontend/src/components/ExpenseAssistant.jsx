import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import { ASSISTANT_API } from '../config/api';

export default function ExpenseAssistant({ isOpen, onClose, activeTrip, onExpenseAdded }) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      content: activeTrip
        ? `👋 Hi! I'm your AI Expense Assistant for **${activeTrip.title}**.\n\nYou can say things like:\n- *"Add $45 for dinner paid by me split between everyone"*\n- *"Who owes whom?"*\n- *"How much have we spent on Transport?"*`
        : "👋 Hi! Select a trip to manage expenses with natural language."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update greeting if active trip changes
  useEffect(() => {
    if (activeTrip) {
      const memberNames = (activeTrip.members || [])
        .map(m => m.username || m.name || 'Member')
        .join(', ');

      setMessages([
        {
          role: 'ai',
          content: `🤖 Ready to manage expenses for **${activeTrip.title}**!\n\n**Trip Members:** ${memberNames || 'Just you'}\n\nAsk me to add an expense, check balances, or calculate shares!`
        }
      ]);
    }
  }, [activeTrip?._id]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    // Add user message
    const newHistory = [...messages, { role: 'user', content: text }];
    setMessages(newHistory);
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
          trip_id: activeTrip?._id || null,
          conversation_history: newHistory.map(m => ({ role: m.role, content: m.content })),
          active_trip_data: activeTrip || null
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);

        // If an expense was added, notify parent to refresh data in real-time
        if (data.action_taken === 'EXPENSE_ADDED' && onExpenseAdded) {
          onExpenseAdded();
        }
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'ai', content: `⚠️ **Error:** ${data.error || 'Failed to process request.'}` }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: `⚠️ **Network Error:** Could not reach AI server. ${err.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assistant-drawer">
      <div className="assistant-header">
        <h3>
          <span>✨</span> Smart Expense Assistant
        </h3>
        <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={onClose}>
          ✕ Close
        </button>
      </div>

      <div className="assistant-body">
        {messages.map((msg, idx) => (
          <div key={idx} className={`assistant-bubble ${msg.role}`}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}

        {loading && (
          <div className="assistant-bubble ai">
            <span style={{ fontStyle: 'italic', opacity: 0.8 }}>Thinking & processing... ⏳</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="assistant-input-area">
        <input
          type="text"
          placeholder={activeTrip ? "E.g. Add $60 for taxi paid by me..." : "Type your message..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading}
        />
        <button onClick={() => handleSend()} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
