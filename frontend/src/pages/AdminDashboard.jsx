import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { formatCurrency } from '../utils/currencyFormatter';
import { 
  ShieldCheck, Users, FileText, DollarSign, AlertTriangle, 
  CheckCircle, LogOut, TrendingUp, RefreshCw, Eye, ArrowLeft, 
  Search, Building2, Clock, Landmark
} from 'lucide-react';

export default function AdminDashboard() {
  const { logout, getAuthHeaders, user } = useAuth();

  const [overview, setOverview] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Seller for Read-Only Drill-down
  const [selectedSellerDetail, setSelectedSellerDetail] = useState(null);
  const [sellerLoading, setSellerLoading] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [overviewRes, sellersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/overview`, { headers }),
        fetch(`${API_BASE_URL}/admin/sellers`, { headers })
      ]);

      if (overviewRes.ok && sellersRes.ok) {
        const ovData = await overviewRes.json();
        const selData = await sellersRes.json();
        setOverview(ovData);
        setSellers(selData);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Fetch individual seller snapshot (read-only)
  const viewSellerDetail = async (sellerId) => {
    setSellerLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/sellers/${sellerId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedSellerDetail(data);
      }
    } catch (err) {
      console.error('Error fetching seller details:', err);
    } finally {
      setSellerLoading(false);
    }
  };

  const filteredSellers = sellers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || !overview) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-cyan)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading Platform Administrator Console...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <header className="navbar">
        <div className="logo" style={{ background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <ShieldCheck size={24} style={{ color: 'var(--accent-cyan)' }} />
          Hisaab360 Admin
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{user?.name || 'Administrator'}</span>
            <span style={{ color: 'var(--accent-cyan)' }}>Platform Super Admin</span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={logout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '24px 20px 40px 20px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>

        {/* ─── READ-ONLY SELLER DRILL-DOWN VIEW ────────────────────────────── */}
        {selectedSellerDetail ? (
          <div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setSelectedSellerDetail(null)}
              style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowLeft size={16} /> Back to All Sellers
            </button>

            {/* Read-Only Notice Banner */}
            <div style={{ background: 'rgba(2,132,199,0.12)', border: '1px solid rgba(2,132,199,0.3)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Eye size={20} style={{ color: 'var(--accent-cyan)' }} />
                <div>
                  <strong>Inspecting Seller Account (Read-Only Mode):</strong> {selectedSellerDetail.seller.name} ({selectedSellerDetail.seller.id})
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px' }}>
                Currency: {selectedSellerDetail.seller.currency?.code || 'INR'}
              </span>
            </div>

            {/* Seller KPIs */}
            <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
              <div className="glass-container" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Total Credit Billed</span>
                  <DollarSign size={18} />
                </div>
                <h2 style={{ fontSize: '1.6rem' }}>{formatCurrency(selectedSellerDetail.stats.totalBilled, selectedSellerDetail.seller.currency)}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Across {selectedSellerDetail.stats.totalInvoices} issued invoices</div>
              </div>

              <div className="glass-container" style={{ borderLeft: '4px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Total Collected</span>
                  <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                </div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--success)' }}>{formatCurrency(selectedSellerDetail.stats.totalCollected, selectedSellerDetail.seller.currency)}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Cleared payments</div>
              </div>

              <div className="glass-container" style={{ borderLeft: '4px solid var(--warning)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Outstanding Balance</span>
                  <Clock size={18} style={{ color: 'var(--warning)' }} />
                </div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--warning)' }}>{formatCurrency(selectedSellerDetail.stats.totalOutstanding, selectedSellerDetail.seller.currency)}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Active credit exposure</div>
              </div>

              <div className="glass-container" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Overdue Exposure</span>
                  <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                </div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--danger)' }}>{formatCurrency(selectedSellerDetail.stats.totalOverdue, selectedSellerDetail.seller.currency)}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Past due deadline</div>
              </div>
            </div>

            {/* Invoices List Table */}
            <div className="glass-container" style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Issued Invoices ({selectedSellerDetail.invoices.length})</h3>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Penalty</th>
                      <th>Outstanding</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSellerDetail.invoices.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No invoices recorded for this seller.</td>
                      </tr>
                    ) : (
                      selectedSellerDetail.invoices.map(i => (
                        <tr key={i.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{i.id}</td>
                          <td>
                            <div style={{ fontWeight: '500' }}>{i.customerName}</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {i.customerId}</span>
                          </td>
                          <td>{formatCurrency(i.amount, selectedSellerDetail.seller.currency)}</td>
                          <td style={{ color: i.penaltyAccrued > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {formatCurrency(i.penaltyAccrued, selectedSellerDetail.seller.currency)}
                          </td>
                          <td style={{ fontWeight: 'bold', color: i.outstanding > 0 ? 'var(--accent-cyan)' : 'var(--success)' }}>
                            {formatCurrency(i.outstanding, selectedSellerDetail.seller.currency)}
                          </td>
                          <td>{i.dueDate}</td>
                          <td>
                            <span className={`badge badge-${i.status}`}>{i.status}</span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {(i.paymentHistory || []).length} payment(s)
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Customers List Table */}
            <div className="glass-container">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Registered Customers ({selectedSellerDetail.customers.length})</h3>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSellerDetail.customers.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No customers mapped to this seller.</td>
                      </tr>
                    ) : (
                      selectedSellerDetail.customers.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{c.id}</td>
                          <td style={{ fontWeight: '500' }}>{c.name}</td>
                          <td>{c.phone}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{c.email || '-'}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ─── PLATFORM OVERVIEW & ALL SELLERS LIST ───────────────────────── */
          <div>
            {/* Global Platform KPIs */}
            <div className="dashboard-grid" style={{ marginBottom: '28px' }}>
              <div className="glass-container" style={{ borderLeft: '4px solid var(--accent-indigo)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Total Sellers</span>
                  <Building2 size={18} style={{ color: 'var(--accent-indigo)' }} />
                </div>
                <h2 style={{ fontSize: '1.8rem' }}>{overview.totalSellers}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Active wholesale sellers</div>
              </div>

              <div className="glass-container" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Total Buyers</span>
                  <Users size={18} style={{ color: 'var(--accent-cyan)' }} />
                </div>
                <h2 style={{ fontSize: '1.8rem' }}>{overview.totalCustomers}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Registered customer accounts</div>
              </div>

              <div className="glass-container" style={{ borderLeft: '4px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Platform Volume</span>
                  <TrendingUp size={18} style={{ color: 'var(--success)' }} />
                </div>
                <h2 style={{ fontSize: '1.8rem', color: 'var(--success)' }}>₹{overview.totalBilled.toLocaleString()}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Total credit invoiced</div>
              </div>

              <div className="glass-container" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Total Outstanding</span>
                  <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                </div>
                <h2 style={{ fontSize: '1.8rem', color: 'var(--danger)' }}>₹{overview.totalOutstanding.toLocaleString()}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {overview.overdueCount} overdue invoices (₹{overview.totalOverdue.toLocaleString()})
                </div>
              </div>
            </div>

            {/* Sellers Management Section */}
            <div className="glass-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '4px' }}>All Wholesale Sellers ({sellers.length})</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    Select any seller to inspect customer relations, credit aging, and transactions.
                  </p>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '260px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search seller by name, ID, or email..."
                    style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Sellers Table */}
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Seller ID</th>
                      <th>Business Name</th>
                      <th>Email</th>
                      <th>Customers</th>
                      <th>Invoices</th>
                      <th>Total Billed</th>
                      <th>Collected</th>
                      <th>Outstanding</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSellers.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                          No sellers found matching search query.
                        </td>
                      </tr>
                    ) : (
                      filteredSellers.map(s => {
                        const currencyObj = s.currency || { symbol: '₹', code: 'INR' };
                        return (
                          <tr key={s.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{s.id}</td>
                            <td>
                              <div style={{ fontWeight: '600' }}>{s.name}</div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>UPI: {s.upiId || 'N/A'}</span>
                            </td>
                            <td>{s.email}</td>
                            <td>
                              <span style={{ fontWeight: '500' }}>{s.totalCustomers}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: '500' }}>{s.totalInvoices}</span>
                            </td>
                            <td>{formatCurrency(s.totalBilled, currencyObj)}</td>
                            <td style={{ color: 'var(--success)', fontWeight: '500' }}>
                              {formatCurrency(s.totalCollected, currencyObj)}
                            </td>
                            <td style={{ color: s.totalOutstanding > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                              {formatCurrency(s.totalOutstanding, currencyObj)}
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => viewSellerDetail(s.id)}
                                title="View Seller Account in Read-Only Mode"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                              >
                                <Eye size={14} style={{ color: 'var(--accent-cyan)' }} /> Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
