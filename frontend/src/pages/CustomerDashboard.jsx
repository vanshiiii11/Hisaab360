import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { generateInvoicePDF, generateStatementPDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/currencyFormatter';
import ThemeToggle from '../components/ThemeToggle';
import { 
  requestNotificationPermission, 
  showDesktopNotification, 
  getNotificationPermission 
} from '../utils/browserNotifications';
import { 
  FileText, DollarSign, AlertTriangle, Download, 
  CheckCircle, LogOut, TrendingUp, RefreshCw, CreditCard, Clock, Bell,
  QrCode, Building2, Wallet, Landmark, Image, Upload, Eye, Send, Check,
  Zap, Search, BellRing, FileSpreadsheet
} from 'lucide-react';


// Dynamically load Razorpay checkout script
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id  = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CustomerDashboard() {
  const { logout, getAuthHeaders, user } = useAuth();

  // Data states
  const [invoices, setInvoices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Payments simulator & gateways dialog state
  const payModalDialog = useRef(null);
  const proofModalDialog = useRef(null);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payGatewayTab, setPayGatewayTab] = useState('upi'); // 'upi' | 'netbanking' | 'card' | 'debit' | 'wallet' | 'cash_cheque'

  // Gateway form fields
  const [selectedBank, setSelectedBank] = useState('SBI');
  const [bankRefNo, setBankRefNo] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('Paytm Wallet');
  
  // Cash/Cheque Evidence Upload states
  const [paymentType, setPaymentType] = useState('Cash'); // 'Cash' | 'Cheque'
  const [chequeNo, setChequeNo] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [evidenceDataUrl, setEvidenceDataUrl] = useState('');
  const [evidenceFileName, setEvidenceFileName] = useState('');

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Proof Viewer Modal State
  const [selectedProofUrl, setSelectedProofUrl] = useState('');
  const [selectedProofTitle, setSelectedProofTitle] = useState('');

  // Table Search and Status Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Browser Notification State
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const prevInvoicesRef = useRef(null);

  const currencyObj = user?.sellerCurrency || { symbol: '₹', code: 'INR' };
  const sellerUpi = user?.sellerUpiId || '';

  // Request browser notification permission
  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      showDesktopNotification('Hisaab360 Notifications Enabled', {
        body: 'You will receive instant alerts when new invoices are issued.'
      });
    }
  };

  // Fetch customer statement
  const fetchCustomerData = async (isPoll = false) => {
    try {
      const headers = getAuthHeaders();
      const [invRes, notifRes] = await Promise.all([
        fetch(`${API_BASE_URL}/invoices`, { headers }),
        fetch(`${API_BASE_URL}/notifications/history/${user.id}`, { headers })
      ]);

      if (invRes.ok && notifRes.ok) {
        const invData = await invRes.json();
        const notifData = await notifRes.json();

        // Detect new invoices issued to notify customer
        if (prevInvoicesRef.current !== null && invData.length > prevInvoicesRef.current.length) {
          const newInvoices = invData.filter(
            newInv => !prevInvoicesRef.current.some(oldInv => oldInv.id === newInv.id)
          );
          if (newInvoices.length > 0) {
            const latest = newInvoices[0];
            showDesktopNotification(`New Credit Invoice Issued!`, {
              body: `Invoice #${latest.id} of ${formatCurrency(latest.amount, currencyObj)} from ${latest.sellerName || 'Seller'} is now available in your portal.`
            });
          }
        }

        prevInvoicesRef.current = invData;
        setInvoices(invData);
        setNotifications(notifData);
      }
    } catch (err) {
      console.error('Error fetching customer portal data:', err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchCustomerData();
      // Background poll every 8 seconds for live updates & push notifications
      const interval = setInterval(() => {
        fetchCustomerData(true);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [user]);


  // Image Upload Handler converting file to Data URL for evidence
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setPaymentError('Image size should be under 5MB');
        return;
      }
      setEvidenceFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidenceDataUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ─── Razorpay UPI / Online Payment Flow ────────────────────────────────────
  const openRazorpayCheckout = async () => {
    setPaymentError('');
    setPaymentLoading(true);

    try {
      // 1. Load Razorpay checkout.js
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay SDK. Check your internet connection.');

      // 2. Create order on backend
      const orderRes = await fetch(`${API_BASE_URL}/payments/create-order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ invoiceId: selectedInvoice.id })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Could not create Razorpay order');

      // 3. Open Razorpay checkout popup
      const options = {
        key:         orderData.keyId,
        amount:      orderData.amount,           // in paise
        currency:    orderData.currency,
        name:        'Hisaab360',
        description: `Payment for Invoice #${selectedInvoice.id}`,
        order_id:    orderData.orderId,
        prefill: {
          name:    user?.name  || '',
          contact: user?.phone || ''
        },
        theme: { color: '#6366f1' },

        // 4. On successful payment, verify with backend
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API_BASE_URL}/payments/verify`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                invoiceId:           selectedInvoice.id,
                amount:              orderData.amountINR
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');

            setPaymentSuccess(true);
            setTimeout(() => {
              setPaymentSuccess(false);
              payModalDialog.current.close();
              fetchCustomerData();
            }, 2000);
          } catch (verifyErr) {
            setPaymentError(`Verification error: ${verifyErr.message}`);
          }
        },

        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            setPaymentError('Payment was cancelled. You can try again.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      setPaymentError(err.message);
      setPaymentLoading(false);
    }
    // Note: setPaymentLoading(false) is NOT called here on success —
    // the Razorpay popup handles its own loading state.
  };

  // ─── Handles non-Razorpay gateways (Net Banking, Cards, Wallet, Cash/Cheque)
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();

    // UPI goes through Razorpay — handled separately
    if (payGatewayTab === 'upi') {
      await openRazorpayCheckout();
      return;
    }

    setPaymentError('');
    setPaymentLoading(true);

    try {
      let finalMethod = '';
      let payloadExtra = {};

      if (payGatewayTab === 'netbanking') {
        finalMethod = `Net Banking (${selectedBank})`;
        payloadExtra.referenceNo = bankRefNo || 'NB-' + Math.floor(Math.random() * 1000000);
      } else if (payGatewayTab === 'card') {
        finalMethod = 'Credit Card';
      } else if (payGatewayTab === 'debit') {
        finalMethod = 'Debit Card';
      } else if (payGatewayTab === 'wallet') {
        finalMethod = `Digital Wallet (${selectedWallet})`;
      } else if (payGatewayTab === 'cash_cheque') {
        finalMethod = paymentType === 'Cheque' ? `Cheque (#${chequeNo || 'N/A'})` : 'Cash Handover';
        payloadExtra.chequeNumber = chequeNo;
        payloadExtra.bankName = chequeBank;
        payloadExtra.evidenceUrl = evidenceDataUrl;

        if (!evidenceDataUrl) {
          throw new Error('Please upload a screenshot or photo proof of your Cash or Cheque payment');
        }
      }

      const response = await fetch(`${API_BASE_URL}/invoices/${selectedInvoice.id}/payment`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: paymentAmount,
          method: finalMethod,
          evidenceUrl: evidenceDataUrl || null,
          ...payloadExtra
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payment transaction failed');

      setPaymentSuccess(true);
      setTimeout(() => {
        setPaymentSuccess(false);
        setEvidenceDataUrl('');
        setEvidenceFileName('');
        setChequeNo('');
        setBankRefNo('');
        payModalDialog.current.close();
        fetchCustomerData();
      }, 1500);

    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  };


  // Open Proof Previewer Modal
  const openProofModal = (proofUrl, title) => {
    setSelectedProofUrl(proofUrl);
    setSelectedProofTitle(title);
    proofModalDialog.current.showModal();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-indigo)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Entering Customer App Portal...</p>
      </div>
    );
  }

  // Aggregate statement totals
  let totalBilled = 0;
  let totalPaid = 0;
  let totalPenalty = 0;
  let pendingCount = 0;

  invoices.forEach(inv => {
    const invPaid = inv.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    totalBilled += inv.amount;
    totalPaid += invPaid;
    totalPenalty += inv.penaltyAccrued || 0;
    if (inv.status !== 'paid') {
      pendingCount++;
    }
  });

  const totalOutstanding = Math.max(0, totalBilled + totalPenalty - totalPaid);

  // Filter invoices based on Search ID / keyword and Status
  const filteredInvoices = invoices.filter(i => {
    const matchesSearch = 
      i.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (i.description && i.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <header className="navbar">
        <div className="logo">
          <TrendingUp size={24} />
          Hisaab360 Portal
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Notification Permission Prompt if not yet granted */}
          {notifPermission !== 'granted' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleEnableNotifications}
              title="Enable Desktop Push Alerts for new invoices"
              style={{ fontSize: '0.75rem', gap: '5px' }}
            >
              <BellRing size={14} style={{ color: 'var(--warning)' }} /> Alerts
            </button>
          )}

          {/* Light / Dark Theme Toggle Button */}
          <ThemeToggle />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{user?.name}</span>
            <span style={{ color: 'var(--text-secondary)' }}>ID: {user?.id}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={logout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ flex: 1, padding: '24px 16px 40px 16px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Banner Alert if Overdue */}
        {invoices.some(i => i.status === 'overdue') && (
          <div className="alert-banner alert-banner-warning">
            <AlertTriangle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div>
              <strong>Overdue Balance Alert:</strong> You have invoices past their payment deadline. Late penalties are accumulating. Please clear your balance below.
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
          <div className="glass-container" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Total Outstanding Balance</span>
              <DollarSign size={18} />
            </div>
            <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>{formatCurrency(totalOutstanding, currencyObj)}</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Statement balance ({currencyObj.code})
            </div>
          </div>

          <div className="glass-container" style={{ borderLeft: '4px solid var(--danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Accrued Penalties</span>
              <Clock size={18} style={{ color: 'var(--danger)' }} />
            </div>
            <h2 style={{ fontSize: '1.8rem', color: 'var(--danger)' }}>{formatCurrency(totalPenalty, currencyObj)}</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Late fees due to overdue delays
            </div>
          </div>

          <div className="glass-container" style={{ borderLeft: '4px solid var(--success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Total Paid to Date</span>
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            </div>
            <h2 style={{ fontSize: '1.8rem', color: 'var(--success)' }}>{formatCurrency(totalPaid, currencyObj)}</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Cleared credit payments
            </div>
          </div>

          <div className="glass-container" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Pending Invoices</span>
              <FileText size={18} style={{ color: 'var(--warning)' }} />
            </div>
            <h2 style={{ fontSize: '1.8rem', color: 'var(--warning)' }}>{pendingCount}</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Invoices requiring settlement
            </div>
          </div>
        </div>

        {/* Invoices List Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
          
          {/* Invoice Table */}
          <div className="glass-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>
                Invoices Received from {user?.sellerName || 'Seller'}
              </h3>
              
              {/* Download Combined Account Statement Button */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const sellerInfo = {
                    id: invoices[0]?.sellerId || 'SLR360',
                    name: user?.sellerName || invoices[0]?.sellerName || 'Wholesale Supplier',
                    currency: currencyObj
                  };
                  generateStatementPDF(user, sellerInfo, invoices);
                }}
                title="Download consolidated PDF of all invoices and payments"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={15} /> Download Full Statement
              </button>
            </div>

            {/* Search Input & Status Filter Controls */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search by Invoice ID (#INV-...)" 
                  style={{ paddingLeft: '34px', height: '36px', fontSize: '0.85rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="form-control" 
                style={{ width: '130px', height: '36px', fontSize: '0.85rem' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Base Amount</th>
                    <th>Penalty</th>
                    <th>Outstanding</th>
                    <th>Due Date</th>

                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        {invoices.length === 0 ? 'No invoices received.' : 'No invoices match the search or filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map(i => (

                      <tr key={i.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{i.id}</td>
                        <td>{formatCurrency(i.amount, currencyObj)}</td>
                        <td style={{ color: i.penaltyAccrued > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {formatCurrency(i.penaltyAccrued, currencyObj)}
                        </td>
                        <td style={{ fontWeight: 'bold', color: i.outstanding > 0 ? 'var(--accent-cyan)' : 'var(--success)' }}>
                          {formatCurrency(i.outstanding, currencyObj)}
                        </td>
                        <td>{i.dueDate}</td>
                        <td>
                          <span className={`badge badge-${i.status}`}>
                            {i.status === 'pending_verification' ? 'Pending Verification' : i.status}
                          </span>
                          {i.status === 'pending_verification' && (
                            <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '4px', lineHeight: '1.2' }}>
                              Payment submitted — awaiting seller confirmation
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {i.status !== 'paid' && (
                              i.status === 'pending_verification' ? (
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  disabled
                                  title="Payment submitted — awaiting seller confirmation"
                                  style={{ opacity: 0.6, cursor: 'not-allowed', fontSize: '0.75rem' }}
                                >
                                  Under Review
                                </button>
                              ) : (
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => {
                                    setSelectedInvoice(i);
                                    setPaymentAmount(i.outstanding.toString());
                                    payModalDialog.current.showModal();
                                  }}
                                >
                                  <CreditCard size={14} /> Pay
                                </button>
                              )
                            )}
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => generateInvoicePDF(i, user, { id: i.sellerId, name: i.sellerName, email: '', currency: currencyObj })}
                              title="Download PDF"
                            >
                              <Download size={14} />
                            </button>
                            {/* Check if any payment history has evidence */}
                            {i.paymentHistory.some(p => p.evidenceUrl) && (
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  const p = i.paymentHistory.find(pay => pay.evidenceUrl);
                                  openProofModal(p.evidenceUrl, `Payment Proof - Invoice #${i.id}`);
                                }}
                                title="View Receipt Proof Screenshot"
                              >
                                <Eye size={14} style={{ color: 'var(--accent-cyan)' }} /> Proof
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reminder History logs */}
          <div className="glass-container">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} style={{ color: 'var(--accent-indigo)' }} /> Reminder History
            </h3>
            
            {notifications.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '30px 0' }}>
                No reminder notifications logged.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.map(notif => {
                  const formattedDate = new Date(notif.sentAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div 
                      key={notif.id} 
                      style={{ 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '10px', 
                        padding: '10px' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: '600', color: notif.type === 'overdue' ? 'var(--danger)' : 'var(--warning)' }}>
                          {notif.type.toUpperCase().replace('_', ' ')}
                        </span>
                        <span>{formattedDate}</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {notif.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ============================================================== */}
      {/* DIALOG 1: COMPREHENSIVE PAYMENT GATEWAYS CHECKOUT              */}
      {/* ============================================================== */}
      <dialog ref={payModalDialog} className="modal" closedby="any" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Authorized Payment Gateway</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => payModalDialog.current.close()}>&times;</button>
        </div>

        {paymentError && <div style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>{paymentError}</div>}

        {paymentSuccess ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <CheckCircle size={54} style={{ color: 'var(--success)', marginBottom: '16px' }} />
            <h3>{payGatewayTab === 'cash_cheque' ? 'Payment Submitted!' : 'Transaction Successful!'}</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              {payGatewayTab === 'cash_cheque' 
                ? 'Payment submitted for verification. Awaiting seller confirmation...' 
                : 'Payment processed and evidence logged. Updating credit statement...'}
            </p>
          </div>
        ) : selectedInvoice && (
          <form onSubmit={handlePaymentSubmit}>
            <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>Invoice: <strong style={{ fontFamily: 'monospace' }}>#{selectedInvoice.id}</strong></div>
              <div>Outstanding: <strong style={{ color: 'var(--accent-cyan)' }}>{formatCurrency(selectedInvoice.outstanding, currencyObj)}</strong></div>
            </div>

            {/* Payment Amount Input */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="paymentAmount">Payment Amount ({currencyObj.symbol})</label>
              <input 
                id="paymentAmount"
                type="number" 
                step="0.01" 
                className="form-control" 
                max={selectedInvoice.outstanding}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </div>

            {/* Payment Gateway Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <button 
                type="button"
                className={`btn btn-sm ${payGatewayTab === 'upi' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayGatewayTab('upi')}
                style={{ fontSize: '0.75rem' }}
              >
                <QrCode size={14} /> UPI
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${payGatewayTab === 'netbanking' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayGatewayTab('netbanking')}
                style={{ fontSize: '0.75rem' }}
              >
                <Landmark size={14} /> Net Banking
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${payGatewayTab === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayGatewayTab('card')}
                style={{ fontSize: '0.75rem' }}
              >
                <CreditCard size={14} /> Credit Card
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${payGatewayTab === 'debit' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayGatewayTab('debit')}
                style={{ fontSize: '0.75rem' }}
              >
                <CreditCard size={14} /> Debit Card
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${payGatewayTab === 'wallet' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayGatewayTab('wallet')}
                style={{ fontSize: '0.75rem' }}
              >
                <Wallet size={14} /> Wallet
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${payGatewayTab === 'cash_cheque' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayGatewayTab('cash_cheque')}
                style={{ fontSize: '0.75rem' }}
              >
                <Image size={14} /> Cash/Cheque
              </button>
            </div>

            {/* TAB 1: UPI — Powered by Razorpay (Real Payment Confirmation) */}
            {payGatewayTab === 'upi' && (
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', marginBottom: '20px', overflow: 'hidden' }}>
                {/* Razorpay CTA — primary recommended path */}
                <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', color: 'var(--accent-indigo)', marginBottom: '14px' }}>
                    <Zap size={12} /> Powered by Razorpay — Payment Confirmed Instantly
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Pay via <strong>UPI, GPay, PhonePe, Paytm, NetBanking, or Card</strong> through our secure payment gateway. Invoice marked paid automatically on success.
                  </p>
                  <button
                    type="button"
                    onClick={openRazorpayCheckout}
                    disabled={paymentLoading || !paymentAmount}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    {paymentLoading
                      ? <><RefreshCw size={18} className="animate-spin" /> Opening Razorpay...</>
                      : <><Zap size={18} /> Pay {formatCurrency(paymentAmount || 0, currencyObj)} via Razorpay</>
                    }
                  </button>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    🔒 256-bit SSL secured · PCI DSS compliant · Powered by Razorpay
                  </p>
                </div>

                {/* Static QR fallback */}
                <div style={{ padding: '14px', textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                  {sellerUpi ? (
                    <>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Or scan directly with any UPI app (no auto-confirmation):
                      </div>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${sellerUpi}&pn=${user?.sellerName || 'Seller'}&am=${paymentAmount || selectedInvoice.outstanding}&cu=INR`)}`}
                        alt="UPI QR fallback"
                        style={{ width: '80px', height: '80px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.2)', opacity: 0.7 }}
                      />
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>{sellerUpi}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '10px 14px' }}>
                      This seller hasn't configured UPI payments yet. Please use another payment method.
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* TAB 2: NET BANKING — via Razorpay */}
            {payGatewayTab === 'netbanking' && (
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Landmark size={20} style={{ color: 'var(--accent-indigo)' }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Net Banking</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SBI · HDFC · ICICI · Axis · Kotak · PNB · 50+ banks via Razorpay</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--accent-indigo)', background: 'rgba(99,102,241,0.1)', padding: '3px 8px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.3)' }}>
                    🔒 Razorpay Secured
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                    You will be redirected to your bank's secure net banking portal inside the Razorpay checkout. Your credentials are never shared with us.
                  </p>
                  <button
                    type="button"
                    onClick={openRazorpayCheckout}
                    disabled={paymentLoading || !paymentAmount}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {paymentLoading ? <><RefreshCw size={16} className="animate-spin" /> Opening...</> : <><Zap size={16} /> Pay via Net Banking — {formatCurrency(paymentAmount || 0, currencyObj)}</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: CREDIT CARD — via Razorpay */}
            {payGatewayTab === 'card' && (
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CreditCard size={20} style={{ color: '#22c55e' }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Credit Card</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Visa · Mastercard · RuPay · Amex · Diners</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    {['VISA', 'MC', 'RP'].map(b => (
                      <span key={b} style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '2px 5px', color: 'var(--text-secondary)' }}>{b}</span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                    Enter your card details securely inside the Razorpay checkout. PCI DSS compliant — we never see your card number.
                  </p>
                  <button
                    type="button"
                    onClick={openRazorpayCheckout}
                    disabled={paymentLoading || !paymentAmount}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {paymentLoading ? <><RefreshCw size={16} className="animate-spin" /> Opening...</> : <><Zap size={16} /> Pay via Credit Card — {formatCurrency(paymentAmount || 0, currencyObj)}</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: DEBIT CARD — via Razorpay */}
            {payGatewayTab === 'debit' && (
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CreditCard size={20} style={{ color: '#f59e0b' }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Debit Card</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Visa Debit · Mastercard Debit · RuPay Debit</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    {['VISA', 'MC', 'RP'].map(b => (
                      <span key={b} style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '2px 5px', color: 'var(--text-secondary)' }}>{b}</span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                    Pay using your bank debit card. 3D Secure / OTP verified via your bank inside the Razorpay checkout window.
                  </p>
                  <button
                    type="button"
                    onClick={openRazorpayCheckout}
                    disabled={paymentLoading || !paymentAmount}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {paymentLoading ? <><RefreshCw size={16} className="animate-spin" /> Opening...</> : <><Zap size={16} /> Pay via Debit Card — {formatCurrency(paymentAmount || 0, currencyObj)}</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: DIGITAL WALLET — via Razorpay */}
            {payGatewayTab === 'wallet' && (
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Wallet size={20} style={{ color: '#a855f7' }} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Digital Wallet</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Paytm · PhonePe · Amazon Pay · Mobikwik · Freecharge</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                    Choose your digital wallet inside the Razorpay checkout and complete payment with one tap.
                  </p>
                  <button
                    type="button"
                    onClick={openRazorpayCheckout}
                    disabled={paymentLoading || !paymentAmount}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {paymentLoading ? <><RefreshCw size={16} className="animate-spin" /> Opening...</> : <><Zap size={16} /> Pay via Wallet — {formatCurrency(paymentAmount || 0, currencyObj)}</>}
                  </button>
                </div>
              </div>
            )}


            {/* TAB 6: CASH / CHEQUE WITH SCREENSHOT EVIDENCE UPLOAD */}
            {payGatewayTab === 'cash_cheque' && (
              <div style={{ border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', marginBottom: '20px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Payment Type</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="payType" value="Cash" checked={paymentType === 'Cash'} onChange={() => setPaymentType('Cash')} /> Cash Handover
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="payType" value="Cheque" checked={paymentType === 'Cheque'} onChange={() => setPaymentType('Cheque')} /> Cheque Deposit
                    </label>
                  </div>
                </div>

                {paymentType === 'Cheque' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label">Cheque Number</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. CHQ-49012" 
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label">Drawn Bank Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. SBI Bank" 
                        value={chequeBank}
                        onChange={(e) => setChequeBank(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Screenshot Upload Dropzone Box */}
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Attach Payment Screenshot / Receipt Evidence (Required for Cheque/Cash)</label>
                  <div style={{ border: '2px dashed var(--glass-border)', padding: '16px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      style={{ display: 'none' }} 
                      id="evidenceInput"
                    />
                    <label htmlFor="evidenceInput" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <Upload size={24} style={{ color: 'var(--accent-indigo)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {evidenceFileName ? `Selected: ${evidenceFileName}` : 'Click to Upload Screenshot / Receipt Photo'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Supports JPG, PNG, WEBP up to 5MB</span>
                    </label>
                  </div>
                </div>

                {/* Image Upload Thumbnail Preview */}
                {evidenceDataUrl && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <img src={evidenceDataUrl} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--success)', flex: 1 }}>Screenshot attached successfully!</span>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={paymentLoading}>
              {paymentLoading ? 'Processing Transaction...' : `Confirm Payment (${formatCurrency(paymentAmount || 0, currencyObj)})`}
            </button>
          </form>
        )}
      </dialog>

      {/* ============================================================== */}
      {/* DIALOG 2: PROOF / SCREENSHOT PREVIEW MODAL                    */}
      {/* ============================================================== */}
      <dialog ref={proofModalDialog} className="modal" closedby="any" style={{ maxWidth: '650px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>{selectedProofTitle || 'Payment Receipt Proof'}</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => proofModalDialog.current.close()}>&times;</button>
        </div>

        {selectedProofUrl ? (
          <div style={{ textAlign: 'center', background: '#000', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <img 
              src={selectedProofUrl} 
              alt="Payment Screenshot Evidence" 
              style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '8px' }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              Verified payment receipt screenshot stored on database ledger.
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No proof image available.</p>
        )}
      </dialog>

    </div>
  );
}
