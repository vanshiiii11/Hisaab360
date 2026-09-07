import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { KeyRound, Mail, User, Phone, Briefcase, ChevronLeft, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function AuthPage() {
  const navigate = useNavigate();
  const { loginSeller, registerSeller, loginCustomer, loginAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  // Primary Role Tab: 'seller' | 'customer' | 'admin'
  const [roleTab, setRoleTab] = useState('seller');
  
  // Seller sub-tab: 'login' | 'signup'
  const [sellerMode, setSellerMode] = useState('login');

  // Input states for Seller
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');

  // Input states for Customer
  const [sellerId, setSellerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Input states for Admin
  const [adminEmail, setAdminEmail] = useState('admin@hisaab360.com');
  const [adminPassword, setAdminPassword] = useState('admin123');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync route query parameters with tab selection
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'customer') {
      setRoleTab('customer');
    } else if (roleParam === 'admin') {
      setRoleTab('admin');
    } else {
      setRoleTab('seller');
    }
    setError('');
    setSuccessMsg('');
  }, [searchParams]);

  const handleSellerSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (sellerMode === 'login') {
        await loginSeller(email, password);
        navigate('/seller');
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const user = await registerSeller(businessName, email, password);
        setSuccessMsg(`Account created! Your unique Seller ID is ${user.id}. Redirecting...`);
        setTimeout(() => {
          navigate('/seller');
        }, 2000);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginCustomer(sellerId, customerId, customerPhone);
      navigate('/customer');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginAdmin(adminEmail, adminPassword);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Admin authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <div style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={() => navigate('/')} 
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <ChevronLeft size={16} /> Back to Home
        </button>
        <ThemeToggle />
      </div>

      {/* Auth Box Container */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-container" style={{ width: '100%', maxWidth: '480px', padding: '36px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Hisaab360 Console</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Select your role to access your dedicated dashboard.
            </p>
          </div>

          {/* 3-Way Role Selector Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '4px', borderRadius: '10px', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => {
                setRoleTab('seller');
                setError('');
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: '8px',
                background: roleTab === 'seller' ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))' : 'transparent',
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              Seller
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab('customer');
                setError('');
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: '8px',
                background: roleTab === 'customer' ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))' : 'transparent',
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab('admin');
                setError('');
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: '8px',
                background: roleTab === 'admin' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              Admin
            </button>
          </div>

          {/* Feedback states */}
          {error && (
            <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(244,63,94,0.2)', padding: '12px', borderRadius: '10px', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '20px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.2)', padding: '12px', borderRadius: '10px', color: 'var(--success)', fontSize: '0.9rem', marginBottom: '20px', textAlign: 'center' }}>
              {successMsg}
            </div>
          )}

          {/* 1. SELLER FORM */}
          {roleTab === 'seller' && (
            <form onSubmit={handleSellerSubmit}>
              {/* Login / Sign Up Toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '24px', fontSize: '0.95rem' }}>
                <span 
                  onClick={() => setSellerMode('login')} 
                  style={{ cursor: 'pointer', color: sellerMode === 'login' ? 'var(--accent-indigo)' : 'var(--text-muted)', fontWeight: sellerMode === 'login' ? '600' : '400', borderBottom: sellerMode === 'login' ? '2px solid var(--accent-indigo)' : 'none', paddingBottom: '4px' }}
                >
                  Log In
                </span>
                <span 
                  onClick={() => setSellerMode('signup')} 
                  style={{ cursor: 'pointer', color: sellerMode === 'signup' ? 'var(--accent-indigo)' : 'var(--text-muted)', fontWeight: sellerMode === 'signup' ? '600' : '400', borderBottom: sellerMode === 'signup' ? '2px solid var(--accent-indigo)' : 'none', paddingBottom: '4px' }}
                >
                  Create Account
                </span>
              </div>

              {sellerMode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Business / Firm Name</label>
                  <div style={{ position: 'relative' }}>
                    <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Apex Wholesale Distro" 
                      style={{ paddingLeft: '40px' }}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required 
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="seller@example.com" 
                    style={{ paddingLeft: '40px' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="••••••••" 
                    style={{ paddingLeft: '40px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>

              {sellerMode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="••••••••" 
                      style={{ paddingLeft: '40px' }}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required 
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '12px' }}
                disabled={loading}
              >
                {loading ? 'Processing...' : sellerMode === 'login' ? 'Sign In as Seller' : 'Register Seller Account'}
                {!loading && <ArrowRight size={16} />}
              </button>

              {sellerMode === 'login' && (
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '14px' }}>
                  Demo Seller: <code style={{ color: 'var(--accent-cyan)' }}>seller@hisaab360.com</code> / <code style={{ color: 'var(--accent-cyan)' }}>demo123</code>
                </p>
              )}
            </form>
          )}

          {/* 2. CUSTOMER FORM */}
          {roleTab === 'customer' && (
            <form onSubmit={handleCustomerSubmit}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                Buyers log in using your account credentials provided on your invoice statement or WhatsApp message.
              </p>

              <div className="form-group">
                <label className="form-label">Seller ID</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. SLR360" 
                    style={{ paddingLeft: '40px', textTransform: 'uppercase' }}
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Your Customer ID</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. CUST-802" 
                    style={{ paddingLeft: '40px', textTransform: 'uppercase' }}
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Registered Mobile Phone</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input 
                    type="tel" 
                    className="form-control" 
                    placeholder="9876543210" 
                    style={{ paddingLeft: '40px' }}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '12px' }}
                disabled={loading}
              >
                {loading ? 'Verifying Account...' : 'Open Customer Statement'}
                {!loading && <ArrowRight size={16} />}
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '14px' }}>
                Demo Buyer: <code style={{ color: 'var(--accent-cyan)' }}>SLR360</code> / <code style={{ color: 'var(--accent-cyan)' }}>CUST-802</code> / <code style={{ color: 'var(--accent-cyan)' }}>9876543210</code>
              </p>
            </form>
          )}

          {/* 3. ADMIN FORM */}
          {roleTab === 'admin' && (
            <form onSubmit={handleAdminSubmit}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(2,132,199,0.1)', border: '1px solid rgba(2,132,199,0.25)', borderRadius: '10px', marginBottom: '20px' }}>
                <ShieldCheck size={20} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Administrator Console allows monitoring across <strong>all wholesale sellers</strong> and platform ledger data.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Administrator Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="admin@hisaab360.com" 
                    style={{ paddingLeft: '40px' }}
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Administrator Password</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="••••••••" 
                    style={{ paddingLeft: '40px' }}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '12px', background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Access Admin Platform'}
                {!loading && <ArrowRight size={16} />}
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '14px' }}>
                Default Admin: <code style={{ color: 'var(--accent-cyan)' }}>admin@hisaab360.com</code> / <code style={{ color: 'var(--accent-cyan)' }}>admin123</code>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
