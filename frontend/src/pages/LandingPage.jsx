import React from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { 
  Sparkles, 
  Compass, 
  Wallet, 
  Users, 
  MessageSquare, 
  ArrowRight, 
  CheckCircle2, 
  Plane, 
  Train, 
  ShieldCheck, 
  TrendingUp, 
  PieChart,
  Bot
} from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function LandingPage() {
  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 20px 80px 20px', width: '100%' }}>
      {/* 1. HERO SECTION */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '24px',
        padding: '56px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        marginBottom: '48px'
      }}>
        {/* Glowing Background Blob */}
        <div style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none'
        }} />

        {/* Top Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '30px',
          padding: '6px 16px',
          fontSize: '0.85rem',
          color: '#c7d2fe',
          fontWeight: 600,
          marginBottom: '20px'
        }}>
          <Sparkles size={15} color="#818cf8" /> AI-Powered Group Travel & Expense Settlement Platform
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.8px',
          lineHeight: 1.15,
          maxWidth: '900px',
          margin: '0 auto 18px auto'
        }}>
          Plan Journeys with <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Multi-Agent AI</span>. Settle Group Expenses with <span style={{ background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zero-Dispute Math</span>.
        </h1>

        {/* Subtitle */}
        <p style={{
          color: '#94a3b8',
          fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
          maxWidth: '720px',
          margin: '0 auto 28px auto',
          lineHeight: 1.6
        }}>
          TripMate orchestrates multi-modal transit (flights, Indian Railways, buses), hotels, live weather, N × N matrix debt simplification, and a FastMCP Human-In-The-Loop AI assistant in one unified app.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
          <SignInButton mode="modal">
            <button
              className="btn btn-primary"
              style={{
                fontSize: '1rem',
                padding: '12px 28px',
                fontWeight: 600,
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
                maxWidth: '100%',
                boxSizing: 'border-box',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                textAlign: 'center',
                lineHeight: 1.3
              }}
            >
              <span>Sign In to Get Started</span>
              <ArrowRight size={18} style={{ flexShrink: 0 }} />
            </button>
          </SignInButton>
        </div>

        {/* Metrics Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '16px',
          marginTop: '40px',
          paddingTop: '28px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>₹0 Math Errors</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>N × N Settlement Matrix</div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818cf8' }}>4 AI Specialists</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Transit, Hotels, Weather, Budget</div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>FastMCP Agent</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Human-In-The-Loop Proposals</div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8' }}>100% Verified</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Clerk Enterprise Authentication</div>
          </div>
        </div>
      </div>

      {/* 2. CORE CAPABILITIES (4 FEATURE CARDS) */}
      <div style={{ marginBottom: '56px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px 0' }}>
            Engineered for Stress-Free Travel & Finance
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0 }}>
            Explore the four interconnected pillars powering TripMate
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Feature 1 */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid #6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                marginBottom: '16px'
              }}>
                <Sparkles size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                Multi-Agent AI Travel Planner
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
                LangGraph Supervisor orchestrates specialist sub-agents for Flights, Indian Railways (RailRadar API), Intercity Buses, Hotels, and real-time Weather with interactive versioning.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Monotonic Version Tracking
            </div>
          </div>

          {/* Feature 2 */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                marginBottom: '16px'
              }}>
                <Wallet size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                SplitMate Debt Matrix
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
                Accurate $N \times N$ matrix delta settlements. Supports multi-payer expenses, custom unequal splits, category spending analytics, and one-click itinerary plan attachment.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Zero Duplicate Calculations
            </div>
          </div>

          {/* Feature 3 */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #0ea5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                marginBottom: '16px'
              }}>
                <Bot size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                FastMCP AI Assistant
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
                Conversational assistant with dynamic session identity ("paid by me"), Human-In-The-Loop interactive proposal cards, and in-chat spending charts via Recharts.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Strict Safety Guardrails
            </div>
          </div>

          {/* Feature 4 */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fbbf24',
                marginBottom: '16px'
              }}>
                <Users size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                Social Travel Network
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
                Connect with travel friends by username or email. View your overall 1-on-1 net balances across all shared trips and manage incoming/outgoing friend requests.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Instant Friend Sync
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM CALL TO ACTION */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.9) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '20px',
        padding: '40px 24px',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ffffff', marginBottom: '12px' }}>
          Ready for your next adventure?
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '600px', margin: '0 auto 24px auto' }}>
          Sign in with Google or your email in seconds to create travel plans, manage group trips, and chat with your AI assistant.
        </p>
        <SignInButton mode="modal">
          <button
            className="btn btn-primary"
            style={{
              fontSize: '1rem',
              padding: '12px 28px',
              fontWeight: 600,
              maxWidth: '100%',
              boxSizing: 'border-box',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              textAlign: 'center',
              lineHeight: 1.3
            }}
          >
            <span>Get Started Free</span>
            <ArrowRight size={16} style={{ flexShrink: 0 }} />
          </button>
        </SignInButton>
      </div>
    </div>
  );
}
