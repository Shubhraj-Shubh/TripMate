import React from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { Sparkles, Wallet, Users, MessageSquare, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function FeaturePreview({ type }) {
  const configs = {
    planner: {
      icon: <Sparkles size={28} color="#818cf8" />,
      badgeColor: '#818cf8',
      title: "AI Multi-Agent Travel Planner",
      subtitle: "LangGraph Supervisor orchestrating Flights, Indian Railways, Buses, Hotels & Live Weather",
      description: "Experience fully automated, day-by-day travel planning. Submit any destination prompt, get specialist multi-modal transit options (Flights via AviationStack, Trains via RailRadar API, and Intercity Buses), and refine drafts with human-in-the-loop revisions and monotonic version tracking.",
      tags: ["✈️ Flights (AviationStack)", "🚆 Indian Railways (RailRadar)", "🚌 Intercity Buses", "🏨 Hotel Booking Specialist", "☀️ Live Weather Forecast", "📋 Monotonic Version Control"],
      ctaText: "Sign In to Plan Your Trip"
    },
    expenses: {
      icon: <Wallet size={28} color="#34d399" />,
      badgeColor: '#34d399',
      title: "SplitMate Group Expense & Debt Matrix",
      subtitle: "Deterministic N × N Mathematical Settlement with Zero Math Disputes",
      description: "Track shared group expenses effortlessly. SplitMate minimizes net transactions across all trip members, supports multi-payer expenses, unequal custom splits, category analytics, and attaches AI travel plans directly to your trip.",
      tags: ["⚖️ N × N Settlement Matrix", "👥 Multi-Payer Support", "📊 Interactive Recharts", "🤝 Custom Split Allocations", "📎 Attach Saved Itineraries"],
      ctaText: "Sign In to Manage Trips & Expenses"
    },
    friends: {
      icon: <Users size={28} color="#fbbf24" />,
      badgeColor: '#fbbf24',
      title: "Friends & Travel Network",
      subtitle: "Connect with Companions & Track Consolidated Net Balances",
      description: "Search and add friends by their username or email. View your overall 1-on-1 net balance across all shared trips in real time, and manage incoming and outgoing travel requests.",
      tags: ["🔍 Username & Email Search", "📨 Friend Requests Workflow", "💰 Consolidated Net Balances", "🔒 Privacy & Data Isolation"],
      ctaText: "Sign In to Connect with Friends"
    },
    assistant: {
      icon: <MessageSquare size={28} color="#38bdf8" />,
      badgeColor: '#38bdf8',
      title: "FastMCP Human-In-The-Loop AI Assistant",
      subtitle: "Intelligent Financial & Travel Assistant with Interactive Action Proposals",
      description: "Chat in natural language to manage your trips, log expenses ('Add ₹1500 for dinner paid by me split equally'), generate spending charts, and verify interactive confirmation cards before any mutation is executed.",
      tags: ["🤖 FastMCP Protocol", "📝 Interactive Confirmation Cards", "📊 In-Chat Recharts Visuals", "👤 Dynamic Identity ('paid by me')", "🛡️ Strict Financial Guardrails"],
      ctaText: "Sign In to Chat with AI Assistant"
    }
  };

  const feature = configs[type] || configs.planner;

  return (
    <div style={{ maxWidth: 840, margin: '30px auto', padding: '0 16px', width: '100%', boxSizing: 'border-box' }}>
      <div className="card" style={{
        padding: '36px 20px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: `1px solid rgba(255, 255, 255, 0.1)`,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        borderRadius: '20px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${feature.badgeColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px auto'
        }}>
          {feature.icon}
        </div>

        <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: '#ffffff', marginBottom: '8px', lineHeight: 1.25 }}>
          {feature.title}
        </h1>

        <p style={{ color: feature.badgeColor, fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', lineHeight: 1.4 }}>
          {feature.subtitle}
        </p>

        <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto 24px auto' }}>
          {feature.description}
        </p>

        {/* Feature Tags Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '32px' }}>
          {feature.tags.map((tag, idx) => (
            <div key={idx} style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              color: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              maxWidth: '100%',
              boxSizing: 'border-box',
              wordBreak: 'break-word'
            }}>
              <CheckCircle2 size={13} color={feature.badgeColor} style={{ flexShrink: 0 }} />
              <span>{tag}</span>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <SignInButton mode="modal">
            <button
              className="btn btn-primary"
              style={{
                fontSize: '0.95rem',
                padding: '12px 24px',
                fontWeight: 600,
                width: '100%',
                maxWidth: '380px',
                boxSizing: 'border-box',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.3,
                textAlign: 'center'
              }}
            >
              <span>{feature.ctaText}</span>
              <ArrowRight size={16} style={{ flexShrink: 0 }} />
            </button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}
