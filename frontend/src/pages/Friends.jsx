import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Users, Inbox, Send, Check, X, AlertCircle, CheckCircle, UserPlus } from 'lucide-react';

export default function Friends() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'incoming' | 'outgoing'

  const [inputTarget, setInputTarget] = useState('');
  const [friends, setFriends] = useState([]);
  const [incomingReqs, setIncomingReqs] = useState([]);
  const [outgoingReqs, setOutgoingReqs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addMsg, setAddMsg] = useState('');
  const [error, setError] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);

  // Fetch all friend relations
  const fetchAllFriendsData = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await getToken();
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Friends with Balances
      const friendsRes = await fetch('http://localhost:5000/api/users/me/friends-balances', { headers });
      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data);
      }

      // 2. Incoming Requests
      const incRes = await fetch('http://localhost:5000/api/friends/incoming', { headers });
      if (incRes.ok) {
        const data = await incRes.json();
        setIncomingReqs(data);
      }

      // 3. Outgoing Requests
      const outRes = await fetch('http://localhost:5000/api/friends/outgoing', { headers });
      if (outRes.ok) {
        const data = await outRes.json();
        setOutgoingReqs(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllFriendsData();
  }, []);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setAddMsg('');
    setError('');
    const target = inputTarget.trim();
    if (!target) {
      setError('Please enter a username or email to add.');
      return;
    }

    try {
      setAddingFriend(true);
      const token = await getToken();
      const res = await fetch('http://localhost:5000/api/friends/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ identifier: target })
      });

      const data = await res.json();
      if (res.ok) {
        setAddMsg(data.message || 'Friend request sent successfully!');
        setInputTarget('');
        fetchAllFriendsData();
      } else {
        setError(data.message || 'Could not send request.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingFriend(false);
    }
  };

  const [respondingId, setRespondingId] = useState(null);

  const handleRespond = async (requestId, action) => {
    if (respondingId) return;
    setError('');
    setAddMsg('');
    try {
      setRespondingId(requestId);
      const token = await getToken();
      const res = await fetch('http://localhost:5000/api/friends/respond', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, action })
      });

      const data = await res.json();
      if (res.ok) {
        setAddMsg(data.message);
        fetchAllFriendsData();
      } else {
        setError(data.message || 'Failed to respond to request.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
          Friends & Network
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '4px' }}>
          Connect with travel companions by username or email to easily split group expenses
        </p>
      </div>

      {/* Add Friend Card */}
      <div className="card" style={{ marginBottom: '28px', padding: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} color="#818cf8" /> Add Friend by Username or Email
        </h3>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fecaca', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {addMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#a7f3d0', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> {addMsg}
          </div>
        )}

        <form onSubmit={handleAddFriend} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <input
              type="text"
              placeholder="e.g. rohit_sharma or rohit@example.com"
              value={inputTarget}
              onChange={(e) => setInputTarget(e.target.value)}
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
          <button type="submit" className="btn btn-primary" disabled={addingFriend || !inputTarget.trim()}>
            {addingFriend ? 'Sending...' : 'Send Friend Request'}
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          className={`btn ${activeTab === 'friends' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('friends')}
        >
          <Users size={16} /> Friends ({friends.length})
        </button>
        <button
          className={`btn ${activeTab === 'incoming' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('incoming')}
        >
          <Inbox size={16} /> Incoming ({incomingReqs.length})
        </button>
        <button
          className={`btn ${activeTab === 'outgoing' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('outgoing')}
        >
          <Send size={16} /> Outgoing ({outgoingReqs.length})
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          Loading network... ⏳
        </div>
      ) : activeTab === 'friends' ? (
        friends.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            No friends added yet. Enter a username or email above to send an invite!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {friends.map(f => {
              const isOwe = f.balance > 0;
              const isGet = f.balance < 0;
              const isSettled = f.balance === 0 || f.balance === undefined;

              return (
                <div
                  key={f.userId || f._id}
                  className="card"
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderLeft: `4px solid ${isOwe ? '#ef4444' : isGet ? '#10b981' : '#64748b'}`
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#f8fafc' }}>
                      {f.name || f.username}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                      @{f.username} {f.email ? `• ${f.email}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Net Balance
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        marginTop: '2px',
                        color: isOwe ? '#ef4444' : isGet ? '#10b981' : '#94a3b8'
                      }}
                    >
                      {isOwe && `You owe ₹${Math.round(f.balance).toLocaleString()}`}
                      {isGet && `You get ₹${Math.round(Math.abs(f.balance)).toLocaleString()}`}
                      {isSettled && 'Settled (₹0)'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'incoming' ? (
        incomingReqs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            No pending incoming friend requests.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {incomingReqs.map(req => (
              <div key={req._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                    {req.sender?.name || req.sender?.username}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    @{req.sender?.username} {req.sender?.email ? `• ${req.sender?.email}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    disabled={respondingId === req._id}
                    onClick={() => handleRespond(req._id, 'accepted')}
                  >
                    <Check size={14} /> {respondingId === req._id ? 'Processing...' : 'Accept'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#ef4444', borderColor: '#ef4444' }}
                    disabled={respondingId === req._id}
                    onClick={() => handleRespond(req._id, 'declined')}
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        outgoingReqs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            No pending outgoing friend requests.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {outgoingReqs.map(req => (
              <div key={req._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                    {req.receiver?.name || req.receiver?.username}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    @{req.receiver?.username} {req.receiver?.email ? `• ${req.receiver?.email}` : ''}
                  </div>
                </div>
                <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', borderColor: '#ca8a04' }}>
                  Pending
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
