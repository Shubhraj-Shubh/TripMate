import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Home, Wallet, Sparkles, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '75vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '540px',
        width: '100%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px 36px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative Background Glow */}
        <div style={{
          position: 'absolute',
          top: '-60px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0) 70%)',
          pointerEvents: 'none'
        }} />

        {/* Animated Compass Icon */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
          border: '1px solid #4f46e5',
          color: '#818cf8',
          marginBottom: '20px'
        }}>
          <Compass size={36} />
        </div>

        {/* 404 Heading */}
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: 800,
          margin: 0,
          background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.1
        }}>
          404
        </h1>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#f8fafc', margin: '12px 0 8px 0' }}>
          Destination Not Found
        </h2>

        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '28px' }}>
          The path you took seems to lead into unmapped territory. Let's get you back on track to your trips and shared expenses.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
            onClick={() => navigate('/')}
          >
            <Home size={16} /> Return to Dashboard
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'center', padding: '10px' }}
              onClick={() => navigate('/expenses')}
            >
              <Wallet size={15} /> SplitMate
            </button>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'center', padding: '10px' }}
              onClick={() => navigate('/planner')}
            >
              <Sparkles size={15} /> AI Planner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
