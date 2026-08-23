import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Planner from './pages/Planner';
import Trips from './pages/Trips';
import TripDetails from './pages/TripDetails';
import Friends from './pages/Friends';
import Assistant from './pages/Assistant';
import NotFound from './pages/NotFound';
import FeaturePreview from './components/FeaturePreview';

import { Compass, Sparkles, Wallet, Users, MessageSquare } from 'lucide-react';
import logoImg from './assets/logo.png';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="navbar">
          <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logoImg} alt="TripMate Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>TripMate</h2>
          </div>
          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Compass size={16} /> Dashboard
            </NavLink>
            <NavLink to="/planner" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Sparkles size={16} /> AI Planner
            </NavLink>
            <NavLink to="/expenses" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Wallet size={16} /> SplitMate
            </NavLink>
            <NavLink to="/friends" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Users size={16} /> Friends
            </NavLink>
            <NavLink to="/assistant" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <MessageSquare size={16} /> AI Assistant
            </NavLink>
          </nav>
          <div className="auth-buttons">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<HomeWrapper />} />
            <Route path="/planner" element={
              <>
                <SignedIn>
                  <Planner />
                </SignedIn>
                <SignedOut>
                  <FeaturePreview type="planner" />
                </SignedOut>
              </>
            } />
            <Route path="/expenses" element={
              <>
                <SignedIn>
                  <Trips />
                </SignedIn>
                <SignedOut>
                  <FeaturePreview type="expenses" />
                </SignedOut>
              </>
            } />
            <Route path="/trips" element={
              <>
                <SignedIn>
                  <Trips />
                </SignedIn>
                <SignedOut>
                  <FeaturePreview type="expenses" />
                </SignedOut>
              </>
            } />
            <Route path="/trips/:tripId" element={
              <>
                <SignedIn>
                  <TripDetails />
                </SignedIn>
                <SignedOut>
                  <FeaturePreview type="expenses" />
                </SignedOut>
              </>
            } />
            <Route path="/friends" element={
              <>
                <SignedIn>
                  <Friends />
                </SignedIn>
                <SignedOut>
                  <FeaturePreview type="friends" />
                </SignedOut>
              </>
            } />
            <Route path="/assistant" element={
              <>
                <SignedIn>
                  <Assistant />
                </SignedIn>
                <SignedOut>
                  <FeaturePreview type="assistant" />
                </SignedOut>
              </>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function HomeWrapper() {
  return (
    <>
      <SignedIn>
        <Dashboard />
      </SignedIn>
      <SignedOut>
        <LandingPage />
      </SignedOut>
    </>
  );
}

export default App;
