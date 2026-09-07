import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Shield, MessageSquare, FileText, TrendingUp, Users, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // Calculator Sandbox States
  const [calcAmount, setCalcAmount] = useState(10000);
  const [calcRate, setCalcRate] = useState(2.0);
  const [overdueDays, setOverdueDays] = useState(15);

  const weeksOverdue = Math.floor(overdueDays / 7);
  const penaltyAccrued = weeksOverdue > 0 ? (calcAmount * (calcRate / 100)) * weeksOverdue : 0;
  const totalOutstanding = calcAmount + penaltyAccrued;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <header className="navbar">
        <div className="logo">
          <TrendingUp size={24} />
          Hisaab360
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/auth?role=customer')}>
            Customer Portal
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/auth?role=seller')}>
            Seller Sign In
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Hero Section */}
        <section style={{ textAlign: 'center', margin: '40px 0 80px 0' }}>
          <span style={{
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--accent-indigo)',
            padding: '6px 16px',
            borderRadius: '100px',
            fontSize: '0.85rem',
            fontWeight: '600',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'inline-block',
            marginBottom: '16px'
          }}>
            Digitize Credit Sales & Collection
          </span>
          <h1 style={{ fontSize: '3.5rem', lineHeight: '1.2', marginBottom: '24px', fontStyle: 'normal' }}>
            Get Paid 3x Faster with <span style={{ background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Automated Reminders</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto 40px auto' }}>
            Hisaab360 eliminates the stress of credit collection. Issue smart invoices, configure automatic late penalty engines, and send WhatsApp payment notifications in one click.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ padding: '14px 28px' }} onClick={() => navigate('/auth?role=seller')}>
              Get Started for Free <ArrowRight size={18} />
            </button>
            <button className="btn btn-secondary" style={{ padding: '14px 28px' }} onClick={() => navigate('/auth?role=customer')}>
              Access Customer Portal
            </button>
          </div>
        </section>

        {/* Dynamic Sandbox Calculator */}
        <section className="glass-container" style={{ marginBottom: '80px', background: 'rgba(11, 15, 25, 0.6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calculator style={{ color: 'var(--accent-indigo)' }} /> Overdue Penalty Sandbox
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                wholesale buyers pay late because follow-ups lack stakes. Adjust the calculator sliders to see how Hisaab360's customized weekly late fees automatically incentivize on-time payments.
              </p>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label">Invoice Amount</label>
                  <span style={{ color: 'var(--accent-indigo)', fontWeight: '600' }}>${calcAmount.toLocaleString()}</span>
                </div>
                <input 
                  type="range" 
                  min="1000" 
                  max="100000" 
                  step="1000" 
                  value={calcAmount} 
                  onChange={(e) => setCalcAmount(Number(e.target.value))} 
                  style={{ accentColor: 'var(--accent-indigo)' }}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label">Weekly Penalty Rate</label>
                  <span style={{ color: 'var(--accent-indigo)', fontWeight: '600' }}>{calcRate}% / week</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="5" 
                  step="0.5" 
                  value={calcRate} 
                  onChange={(e) => setCalcRate(Number(e.target.value))} 
                  style={{ accentColor: 'var(--accent-indigo)' }}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label">Days Overdue</label>
                  <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{overdueDays} Days</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="90" 
                  value={overdueDays} 
                  onChange={(e) => setOverdueDays(Number(e.target.value))} 
                  style={{ accentColor: 'var(--danger)' }}
                />
              </div>
            </div>

            <div className="glass-container" style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed', padding: '30px' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>Simulated Invoice Statement</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <span>Principal Credit Amount:</span>
                  <span style={{ fontWeight: '500' }}>${calcAmount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <span>Overdue Period:</span>
                  <span>{overdueDays} days ({weeksOverdue} full weeks)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', color: 'var(--danger)' }}>
                  <span>Accrued Late penalty:</span>
                  <span style={{ fontWeight: '600' }}>+${penaltyAccrued.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontSize: '1.3rem' }}>
                  <span style={{ fontWeight: '700' }}>Total Outstanding:</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: '800' }}>${totalOutstanding.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ marginTop: '24px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem', color: 'var(--danger)' }}>
                {weeksOverdue > 0 ? (
                  <span>⚠️ Penalty calculation matches: {calcRate}% of ${calcAmount.toLocaleString()} ($${calcAmount * calcRate / 100}) multiplied by {weeksOverdue} overdue week(s).</span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>ℹ️ Late penalties start accumulating after the invoice passes 7 overdue days.</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section style={{ marginBottom: '80px' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2.2rem', marginBottom: '50px' }}>Core Platform Features</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
            <div className="glass-container glass-container-hover">
              <Shield style={{ color: 'var(--accent-indigo)', marginBottom: '16px' }} size={32} />
              <h3 style={{ marginBottom: '10px' }}>Role-Based Isolation</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Secure database structures mapping Sellers and Customers with unique cryptographical-style IDs to isolate credit ledger items.
              </p>
            </div>

            <div className="glass-container glass-container-hover">
              <MessageSquare style={{ color: 'var(--accent-cyan)', marginBottom: '16px' }} size={32} />
              <h3 style={{ marginBottom: '10px' }}>WhatsApp Click-to-Chat</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Pre-compile reminder messages with due balances and direct portal links, opening them in WhatsApp for frictionless delivery.
              </p>
            </div>

            <div className="glass-container glass-container-hover">
              <FileText style={{ color: 'var(--accent-pink)', marginBottom: '16px' }} size={32} />
              <h3 style={{ marginBottom: '10px' }}>PDF Receipt Generator</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Instantly render high-fidelity, professional receipts with line-items breakdown, penalties, and terms for offline records.
              </p>
            </div>

            <div className="glass-container glass-container-hover">
              <TrendingUp style={{ color: 'var(--success)', marginBottom: '16px' }} size={32} />
              <h3 style={{ marginBottom: '10px' }}>Live Credit Analytics</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Visualize monthly collections trends, collection rates, debt aging bands, and top customer exposures automatically.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        &copy; 2026 Hisaab360. Smart wholesale credit collection system.
      </footer>
    </div>
  );
}
