import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CategoryPieChart, SpendingBarChart } from '../components/Charts/DashboardCharts';
import { Compass, Wallet, Users, Sparkles, ArrowRight } from 'lucide-react';
import { SPLITMATE_API } from '../config/api';

const TRAVEL_QUOTES = [
  "Adventure is worthwhile.",
  "Travel is the only thing you buy that makes you richer.",
  "Jobs fill your pocket, but adventures fill your soul.",
  "Life is short and the world is wide.",
  "To travel is to live.",
  "The journey, not the arrival, matters.",
  "Collect moments, not things.",
  "Travel far enough, you meet yourself.",
  "Wander often, wonder always.",
  "Let’s find some beautiful place to get lost.",
  "Take only memories, leave only footprints."
];

export default function Dashboard() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [totalTrips, setTotalTrips] = useState(null);
  const [totalExpense, setTotalExpense] = useState(null);
  const [totalFriends, setTotalFriends] = useState(null);
  const [recentTripsSummary, setRecentTripsSummary] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const quote = useMemo(() => TRAVEL_QUOTES[Math.floor(Math.random() * TRAVEL_QUOTES.length)], []);

  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Total Trips
        const tripsRes = await fetch(`${SPLITMATE_API}/users/totalTrips`, { headers });
        if (tripsRes.ok) {
          const d = await tripsRes.json();
          setTotalTrips(d.totalTrips ?? 0);
        }

        // 2. Total Expense (User's share in INR)
        const expRes = await fetch(`${SPLITMATE_API}/users/totalExpense`, { headers });
        if (expRes.ok) {
          const d = await expRes.json();
          setTotalExpense(d.totalExpense ?? 0);
        }

        // 3. Total Friends
        const friendsRes = await fetch(`${SPLITMATE_API}/users/totalFriends`, { headers });
        if (friendsRes.ok) {
          const d = await friendsRes.json();
          setTotalFriends(d.totalFriends ?? 0);
        }

        // 4. Category Summary
        const catRes = await fetch(`${SPLITMATE_API}/users/categorySummary`, { headers });
        if (catRes.ok) {
          const d = await catRes.json();
          let chartData = [];
          if (Array.isArray(d.categories) && d.categories.length > 0) {
            chartData = d.categories.map(c => ({
              name: c.category || 'Other',
              value: Number(c.amount) || 0
            }));
          } else if (d.categorySummary && typeof d.categorySummary === 'object') {
            chartData = Object.entries(d.categorySummary).map(([cat, amt]) => ({
              name: cat.charAt(0).toUpperCase() + cat.slice(1),
              value: Number(amt) || 0
            }));
          }
          setCategoryData(chartData.filter(c => c.value > 0));
        }

        // 5. Recent Trips Expense Comparison
        const recentSumRes = await fetch(`${SPLITMATE_API}/users/recentTripsSummary`, { headers });
        if (recentSumRes.ok) {
          const d = await recentSumRes.json();
          if (Array.isArray(d.summary)) {
            const barData = d.summary.map(s => ({
              name: s.tripTitle?.length > 14 ? s.tripTitle.substring(0, 12) + '...' : s.tripTitle,
              amount: Math.round(s.totalUserExpense || 0)
            }));
            setRecentTripsSummary(barData);
          }
        }

        // 6. Recent Trips list
        const myTripsRes = await fetch(`${SPLITMATE_API}/trips/my-trips`, { headers });
        if (myTripsRes.ok) {
          const d = await myTripsRes.json();
          setRecentTrips(d.slice(0, 4));
        }
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardStats();
  }, []);

  return (
    <div className="page-container">
      {/* Quote Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 30px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            ✨ Daily Inspiration
          </span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
            "{quote}"
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => navigate('/planner')}>
            <Sparkles size={16} /> Plan New Trip
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/expenses')}>
            <Wallet size={16} /> Open SplitMate
          </button>
        </div>
      </div>

      {/* 3 Core SplitMate Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '14px', borderRadius: '12px', color: '#818cf8' }}>
            <Compass size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Trips</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>
              {loading ? '...' : totalTrips ?? 0}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '14px', borderRadius: '12px', color: '#10b981' }}>
            <Wallet size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Expense</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#34d399' }}>
              {loading ? '...' : (totalExpense !== null ? `₹${Number(totalExpense).toLocaleString()}` : '₹0')}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(14, 165, 233, 0.15)', padding: '14px', borderRadius: '12px', color: '#38bdf8' }}>
            <Users size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Friends</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8' }}>
              {loading ? '...' : totalFriends ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Recharts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Category-wise Expense</h3>
          <CategoryPieChart data={categoryData} />
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Recent Trips Expense Comparison</h3>
          <SpendingBarChart data={recentTripsSummary} />
        </div>
      </div>

      {/* Recent Trips Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Recent Trips in SplitMate</h3>
          <button className="btn btn-secondary" onClick={() => navigate('/expenses')}>
            View All Trips <ArrowRight size={14} />
          </button>
        </div>

        {recentTrips.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No trips found. Create or plan your first trip!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {recentTrips.map(t => (
              <div
                key={t._id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/trips/${t._id}`)}
              >
                <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>{t.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  👥 {t.members?.length || 1} Members • {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
