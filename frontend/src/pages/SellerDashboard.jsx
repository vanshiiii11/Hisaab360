import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { formatCurrency, SUPPORTED_CURRENCIES } from '../utils/currencyFormatter';
import MobileBottomNav from '../components/MobileBottomNav';
import ThemeToggle from '../components/ThemeToggle';
import { 
  requestNotificationPermission, 
  showDesktopNotification, 
  getNotificationPermission 
} from '../utils/browserNotifications';
import { 
  Users, FileText, Plus, Search, DollarSign, AlertTriangle, 
  Send, Download, CheckCircle, LogOut, TrendingUp, RefreshCw, Copy, Check, 
  Settings, Smartphone, Monitor, Globe, QrCode, Upload, Eye, Image,
  BellRing, CheckSquare, Square, Edit, Trash2
} from 'lucide-react';



export default function SellerDashboard() {
  const { logout, getAuthHeaders, user, currency, upiId, updateSellerCurrency, updateSellerUPI } = useAuth();

  // Navigation Tabs: 'analytics' | 'customers' | 'invoices'
  const [activeTab, setActiveTab] = useState('analytics');

  // Mobile frame container preview mode on desktop
  const [isMobileFrame, setIsMobileFrame] = useState(false);

  // API Data States
  const [analytics, setAnalytics] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search/Filter states
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState('all');

  // Customer Detail Modal / Stats state
  const [selectedCustStats, setSelectedCustStats] = useState(null);
  const [custStatsLoading, setCustStatsLoading] = useState(false);

  // Copy success indicator
  const [copied, setCopied] = useState(false);

  // Modal Dialog Refs
  const addCustomerDialog = useRef(null);
  const addInvoiceDialog = useRef(null);
  const recordPaymentDialog = useRef(null);
  const whatsappReminderDialog = useRef(null);
  const settingsDialog = useRef(null);
  const proofModalDialog = useRef(null);

  // Form states
  const [newCustName, setNewCustName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const [newInvCustId, setNewInvCustId] = useState('');
  const [newInvAmount, setNewInvAmount] = useState('');
  const [newInvDueDate, setNewInvDueDate] = useState('');
  const [newInvPurchaseDate, setNewInvPurchaseDate] = useState('');
  const [newInvPenaltyRate, setNewInvPenaltyRate] = useState('2.0');
  const [newInvDesc, setNewInvDesc] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);


  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');

  // Evidence Upload states
  const [evidenceDataUrl, setEvidenceDataUrl] = useState('');
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeBank, setChequeBank] = useState('');

  // Proof Viewer Modal State
  const [selectedProofUrl, setSelectedProofUrl] = useState('');
  const [selectedProofTitle, setSelectedProofTitle] = useState('');

  // Bulk Invoice Actions State
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState('');

  // Browser Desktop Notification State
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const prevPaymentsMapRef = useRef(null);

  // Currency & UPI Setting states
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState(currency?.code || 'INR');
  const [sellerUpiInput, setSellerUpiInput] = useState(upiId || '');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // WhatsApp reminder configuration state
  const [whatsappType, setWhatsappType] = useState('before_due');
  const [whatsappPreview, setWhatsappPreview] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const [formError, setFormError] = useState('');

  // Request browser notification permission for seller
  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      showDesktopNotification('Hisaab360 Seller Alerts Enabled', {
        body: 'You will receive instant alerts whenever a payment is recorded.'
      });
    }
  };

  // Fetch all dashboard data
  const fetchDashboardData = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [analyticsRes, customersRes, invoicesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/dashboard`, { headers }),
        fetch(`${API_BASE_URL}/customers`, { headers }),
        fetch(`${API_BASE_URL}/invoices`, { headers })
      ]);

      if (analyticsRes.ok && customersRes.ok && invoicesRes.ok) {
        const analData = await analyticsRes.json();
        const custData = await customersRes.json();
        const invData = await invoicesRes.json();

        // Check for new payments to trigger desktop notification
        const currentPaymentsMap = {};
        invData.forEach(inv => {
          (inv.paymentHistory || []).forEach(p => {
            currentPaymentsMap[p.id] = { ...p, invoiceId: inv.id, customerName: inv.customerName };
          });
        });

        if (prevPaymentsMapRef.current !== null) {
          const newPaymentIds = Object.keys(currentPaymentsMap).filter(
            id => !prevPaymentsMapRef.current[id]
          );
          if (newPaymentIds.length > 0) {
            const latest = currentPaymentsMap[newPaymentIds[0]];
            showDesktopNotification('Payment Received!', {
              body: `Payment of ${formatCurrency(latest.amount, currency)} recorded on Invoice #${latest.invoiceId} (${latest.customerName}).`
            });
          }
        }

        prevPaymentsMapRef.current = currentPaymentsMap;
        setAnalytics(analData);
        setCustomers(custData);
        setInvoices(invData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Background poll every 8 seconds for real-time payments & balance sync
    const pollInterval = setInterval(() => {
      fetchDashboardData(true);
    }, 8000);
    return () => clearInterval(pollInterval);
  }, []);

  // ─── Bulk Action: Toggle Selection ──────────────────────────────────────────
  const handleToggleSelectAll = () => {
    if (selectedInvoiceIds.length === filteredInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filteredInvoices.map(i => i.id));
    }
  };

  const handleToggleSelectInvoice = (id) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // ─── Bulk Action: Send Reminders in a Loop ──────────────────────────────────
  const handleBulkSendReminders = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setBulkLoading(true);
    setBulkFeedback('');
    let sentCount = 0;

    try {
      for (const invId of selectedInvoiceIds) {
        const inv = invoices.find(i => i.id === invId);
        if (inv && inv.status !== 'paid') {
          const type = inv.status === 'overdue' ? 'overdue' : 'before_due';
          const res = await fetch(`${API_BASE_URL}/notifications/send-whatsapp`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              customerId: inv.customerId,
              invoiceId: inv.id,
              type
            })
          });
          if (res.ok) sentCount++;
        }
      }

      setBulkFeedback(`Successfully dispatched reminders for ${sentCount} invoice(s).`);
      setTimeout(() => setBulkFeedback(''), 4000);
      fetchDashboardData(true);
    } catch (err) {
      setBulkFeedback(`Failed during bulk reminders: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // ─── Bulk Action: Mark Selected as Paid in a Loop ───────────────────────────
  const handleBulkMarkAsPaid = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setBulkLoading(true);
    setBulkFeedback('');
    let paidCount = 0;

    try {
      for (const invId of selectedInvoiceIds) {
        const inv = invoices.find(i => i.id === invId);
        if (inv && inv.status !== 'paid') {
          const res = await fetch(`${API_BASE_URL}/invoices/${inv.id}/payment`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              amount: inv.outstanding,
              method: 'Bulk Settlement (Marked Paid)',
              evidenceUrl: null
            })
          });
          if (res.ok) paidCount++;
        }
      }

      setBulkFeedback(`Successfully marked ${paidCount} invoice(s) as PAID.`);
      setSelectedInvoiceIds([]);
      setTimeout(() => setBulkFeedback(''), 4000);
      fetchDashboardData();
    } catch (err) {
      setBulkFeedback(`Failed marking invoices as paid: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };


  // Sync settings inputs when user context updates
  useEffect(() => {
    if (currency?.code) {
      setSelectedCurrencyCode(currency.code);
    }
    if (upiId) {
      setSellerUpiInput(upiId);
    }
  }, [currency, upiId]);

  // Image Upload Handler converting file to Data URL
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError('Image size should be under 5MB');
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

  // Handle settings (Currency + UPI VPA) save
  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    setFormError('');
    try {
      const selected = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrencyCode);
      if (selected) {
        await updateSellerCurrency(selected);
      }
      if (sellerUpiInput) {
        await updateSellerUPI(sellerUpiInput);
      }
      settingsDialog.current.close();
      fetchDashboardData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  // Fetch individual customer payment statistics
  const fetchCustomerStats = async (customerId) => {
    setCustStatsLoading(true);
    setSelectedCustStats(null);
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${customerId}/stats`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCustStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCustStatsLoading(false);
    }
  };

  // Create Customer Form Submission
  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newCustName,
          email: newCustEmail,
          phone: newCustPhone
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }

      setNewCustName('');
      setNewCustEmail('');
      setNewCustPhone('');
      addCustomerDialog.current.close();
      fetchDashboardData();
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Open Create Invoice Modal
  const openCreateInvoiceModal = () => {
    setEditingInvoiceId(null);
    setNewInvCustId(customers[0]?.id || '');
    setNewInvAmount('');
    setNewInvDueDate('');
    setNewInvPurchaseDate(new Date().toISOString().split('T')[0]);
    setNewInvPenaltyRate('2.0');
    setNewInvDesc('');
    setFormError('');
    addInvoiceDialog.current.showModal();
  };

  // Open Edit Invoice Modal pre-filled
  const openEditInvoiceModal = (invoice) => {
    setEditingInvoiceId(invoice.id);
    setNewInvCustId(invoice.customerId);
    setNewInvAmount(invoice.amount.toString());
    setNewInvDueDate(invoice.dueDate);
    setNewInvPurchaseDate(invoice.purchaseDate);
    setNewInvPenaltyRate(invoice.penaltyRate !== undefined ? invoice.penaltyRate.toString() : '2.0');
    setNewInvDesc(invoice.description || '');
    setFormError('');
    addInvoiceDialog.current.showModal();
  };

  // Create or Update Invoice Form Submission
  const handleSaveInvoiceSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const isEditing = Boolean(editingInvoiceId);
      const url = isEditing
        ? `${API_BASE_URL}/invoices/${editingInvoiceId}`
        : `${API_BASE_URL}/invoices`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customerId: newInvCustId,
          amount: newInvAmount,
          dueDate: newInvDueDate,
          purchaseDate: newInvPurchaseDate,
          penaltyRate: newInvPenaltyRate,
          description: newInvDesc
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} invoice`);
      }

      setEditingInvoiceId(null);
      setNewInvCustId('');
      setNewInvAmount('');
      setNewInvDueDate('');
      setNewInvPurchaseDate('');
      setNewInvPenaltyRate('2.0');
      setNewInvDesc('');
      addInvoiceDialog.current.close();
      fetchDashboardData();
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Delete Invoice with Confirmation
  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm(`Are you sure you want to delete Invoice #${invoiceId}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete invoice');
      }

      // Clean up bulk selection if selected
      setSelectedInvoiceIds(prev => prev.filter(id => id !== invoiceId));
      fetchDashboardData();
    } catch (err) {
      alert(`Error deleting invoice: ${err.message}`);
    }
  };

  // Approve or Reject an offline customer payment (Cash/Cheque)
  const handleVerifyPayment = async (invoiceId, action) => {
    const actionLabel = action === 'approve' ? 'Approve' : 'Reject';
    if (!window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} this payment?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/verify-payment`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} payment`);
      }

      fetchDashboardData();
    } catch (err) {
      alert(`Error verifying payment: ${err.message}`);
    }
  };

  // Record Payment Form Submission
  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${selectedInvoice.id}/payment`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: payAmount,
          method: payMethod,
          evidenceUrl: evidenceDataUrl || null,
          chequeNumber: chequeNo || null,
          bankName: chequeBank || null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      setPayAmount('');
      setPayMethod('Cash');
      setEvidenceDataUrl('');
      setEvidenceFileName('');
      setChequeNo('');
      setChequeBank('');
      recordPaymentDialog.current.close();
      fetchDashboardData();
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Trigger WhatsApp Reminder Modal setup
  const openWhatsAppModal = async (invoice, type = 'before_due') => {
    setSelectedInvoice(invoice);
    setWhatsappType(type);
    
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/send-whatsapp`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          type: type
        })
      });

      const data = await response.json();
      if (response.ok) {
        setWhatsappPreview(data.notification.message);
        setWhatsappUrl(data.whatsappUrl);
        whatsappReminderDialog.current.showModal();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sync template change in WhatsApp Reminder Modal
  const handleWhatsappTypeChange = async (newType) => {
    setWhatsappType(newType);
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/send-whatsapp`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customerId: selectedInvoice.customerId,
          invoiceId: selectedInvoice.id,
          type: newType
        })
      });

      const data = await response.json();
      if (response.ok) {
        setWhatsappPreview(data.notification.message);
        setWhatsappUrl(data.whatsappUrl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Proof Previewer Modal
  const openProofModal = (proofUrl, title) => {
    setSelectedProofUrl(proofUrl);
    setSelectedProofTitle(title);
    proofModalDialog.current.showModal();
  };

  const copySellerId = () => {
    navigator.clipboard.writeText(user?.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter calculations
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.id.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const filteredInvoices = invoices.filter(i => {
    const matchesSearch = 
      i.id.toLowerCase().includes(invoiceSearch.toLowerCase()) || 
      i.customerName.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      i.customerId.toLowerCase().includes(invoiceSearch.toLowerCase());
    
    const matchesStatus = 
      invoiceFilterStatus === 'all' || 
      i.status === invoiceFilterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading || !analytics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-indigo)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading Hisaab360 Mobile App...</p>
      </div>
    );
  }

  const maxTrendVal = Math.max(...analytics.trends.map(t => Math.max(t.billed, t.collected)), 1000);
  const agingTotal = Object.values(analytics.aging).reduce((sum, val) => sum + val, 0);

  const dashboardContent = (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navigation */}
      <header className="navbar">
        <div className="logo">
          <TrendingUp size={24} />
          Hisaab360
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* Notification Permission Request */}
          {notifPermission !== 'granted' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleEnableNotifications}
              title="Enable Desktop Push Alerts for new payments"
              style={{ fontSize: '0.75rem', gap: '5px' }}
            >
              <BellRing size={14} style={{ color: 'var(--warning)' }} /> Alerts
            </button>
          )}

          {/* Light / Dark Theme Toggle */}
          <ThemeToggle />

          {/* Settings Button */}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => settingsDialog.current.showModal()}
            style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
            title="Configure Currency & UPI ID"
          >
            <QrCode size={14} style={{ color: 'var(--success)' }} />
            <span style={{ fontWeight: '600' }}>{currency.symbol}</span>
          </button>


          {/* Device Frame Simulator Toggle (Desktop only) */}
          <button 
            className="btn btn-secondary btn-sm desktop-only-btn"
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            title="Toggle Mobile Device Frame View"
            style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
          >
            {isMobileFrame ? <Monitor size={14} /> : <Smartphone size={14} />}
            <span>{isMobileFrame ? 'Full' : 'Mobile'}</span>
          </button>

          <div className="glass-container" style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>{user?.id}</span>
            <button onClick={copySellerId} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
            </button>
          </div>
          
          <button className="btn btn-secondary btn-sm" onClick={logout} style={{ padding: '8px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ flex: 1, padding: '24px 16px 80px 16px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Desktop Tab Header Controls */}
        <div className="desktop-tab-header" style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
          <button 
            className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button 
            className={`btn ${activeTab === 'customers' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('customers')}
          >
            Customers ({customers.length})
          </button>
          <button 
            className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('invoices')}
          >
            Credit Invoices ({invoices.length})
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: ANALYTICS                                              */}
        {/* ============================================================== */}
        {activeTab === 'analytics' && (
          <div>
            {/* KPI Cards Grid */}
            <div className="dashboard-grid">
              <div className="glass-container glass-container-hover" style={{ borderLeft: '4px solid var(--accent-indigo)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Total Outstanding Credit</span>
                  <DollarSign size={18} />
                </div>
                <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>{formatCurrency(analytics.summary.totalOutstanding, currency)}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Total billing credit extended ({currency.code})
                </div>
              </div>

              <div className="glass-container glass-container-hover" style={{ borderLeft: '4px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Collections Today</span>
                  <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                </div>
                <h2 style={{ fontSize: '1.8rem', color: 'var(--success)' }}>{formatCurrency(analytics.summary.collectionsToday, currency)}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Payments recorded today
                </div>
              </div>

              <div className="glass-container glass-container-hover" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Overdue Accounts Debt</span>
                  <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                </div>
                <h2 style={{ fontSize: '1.8rem', color: 'var(--danger)' }}>{formatCurrency(analytics.summary.totalOverdue, currency)}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Past due payment deadlines
                </div>
              </div>

              <div className="glass-container glass-container-hover" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Collection Recovery Rate</span>
                  <TrendingUp size={18} style={{ color: 'var(--accent-cyan)' }} />
                </div>
                <h2 style={{ fontSize: '1.8rem', color: 'var(--accent-cyan)' }}>{analytics.summary.collectionRate}%</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Paid vs total billed ratio
                </div>
              </div>
            </div>

            {/* Graphics Analytics Dashboard Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              
              {/* Billing vs Collections Custom Chart */}
              <div className="glass-container">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Monthly Credit Extended vs Collected</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '200px', justifyContent: 'flex-end', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end', justifyContent: 'space-around' }}>
                    {analytics.trends.map((t, idx) => {
                      const billPercent = (t.billed / maxTrendVal) * 100;
                      const collPercent = (t.collected / maxTrendVal) * 100;

                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '3px', height: '130px', alignItems: 'flex-end', width: '28px', justifyContent: 'center' }}>
                            <div 
                              style={{ 
                                height: `${Math.max(4, billPercent)}%`, 
                                width: '10px', 
                                background: 'linear-gradient(to top, var(--accent-indigo), var(--accent-violet))', 
                                borderRadius: '4px 4px 0 0'
                              }}
                              title={`Billed: ${formatCurrency(t.billed, currency)}`}
                            />
                            <div 
                              style={{ 
                                height: `${Math.max(4, collPercent)}%`, 
                                width: '10px', 
                                background: 'linear-gradient(to top, var(--success), #34d399)', 
                                borderRadius: '4px 4px 0 0'
                              }}
                              title={`Collected: ${formatCurrency(t.collected, currency)}`}
                            />
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Legends */}
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '0.75rem', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--accent-indigo)', borderRadius: '2px' }} />
                    <span>Credit Billed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '2px' }} />
                    <span>Cash Collected</span>
                  </div>
                </div>
              </div>

              {/* Debt Aging Profile Grid */}
              <div className="glass-container" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Debt Aging Profile</h3>
                
                {agingTotal === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No outstanding debts. Perfect collection rate!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
                    <div style={{ height: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                      {Object.entries(analytics.aging).map(([key, value]) => {
                        if (value === 0) return null;
                        const percent = (value / agingTotal) * 100;
                        let color = 'var(--accent-indigo)';
                        if (key === 'days_1_15') color = 'var(--accent-violet)';
                        if (key === 'days_16_30') color = 'var(--accent-cyan)';
                        if (key === 'days_31_45') color = 'var(--warning)';
                        if (key === 'days_46_plus') color = 'var(--danger)';

                        return (
                          <div 
                            key={key} 
                            style={{ width: `${percent}%`, background: color, height: '100%' }}
                            title={`${key}: ${formatCurrency(value, currency)}`}
                          />
                        );
                      })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                        <span>Current</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(analytics.aging.current, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                        <span>1-15d</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(analytics.aging.days_1_15, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                        <span>16-30d</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(analytics.aging.days_16_30, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                        <span>31-45d</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(analytics.aging.days_31_45, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--danger)' }}>46+ days (Risky)</span>
                        <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(analytics.aging.days_46_plus, currency)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Top Exposure Customers */}
            <div className="glass-container">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Top Outstanding Exposure</h3>
              {analytics.exposure.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending customer exposures.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {analytics.exposure.map((cust, idx) => {
                    const pct = (cust.outstanding / analytics.summary.totalOutstanding) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ width: '24px', fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem' }}>#{idx + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: '500' }}>{cust.name}</span>
                            <span style={{ fontWeight: '600', color: 'var(--accent-indigo)' }}>{formatCurrency(cust.outstanding, currency)}</span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-indigo)', borderRadius: '4px' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CUSTOMERS                                              */}
        {/* ============================================================== */}
        {activeTab === 'customers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search customer name, ID..." 
                  style={{ paddingLeft: '38px' }}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => addCustomerDialog.current.showModal()}>
                <Plus size={16} /> Add Customer
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
              <div className="glass-container" style={{ padding: '0px', overflow: 'hidden' }}>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Outstanding</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No customers found</td>
                        </tr>
                      ) : (
                        filteredCustomers.map(c => (
                          <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => fetchCustomerStats(c.id)}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{c.id}</td>
                            <td style={{ fontWeight: '500' }}>{c.name}</td>
                            <td>{c.phone}</td>
                            <td style={{ color: c.outstanding > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
                              {formatCurrency(c.outstanding, currency)}
                            </td>
                            <td>
                              <button className="btn btn-secondary btn-sm" onClick={(e) => {
                                e.stopPropagation();
                                fetchCustomerStats(c.id);
                              }}>
                                Stats
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Side Stats Panel */}
              <div className="glass-container">
                {custStatsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
                    <RefreshCw className="animate-spin" style={{ color: 'var(--accent-indigo)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Analyzing credit behavior...</p>
                  </div>
                ) : selectedCustStats ? (
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{selectedCustStats.customerName}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '16px' }}>ID: {selectedCustStats.customerId}</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Credit Billed:</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedCustStats.totalBilled, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Paid to Date:</span>
                        <span style={{ fontWeight: '600', color: 'var(--success)' }}>{formatCurrency(selectedCustStats.totalPaid, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Accrued Penalties:</span>
                        <span style={{ fontWeight: '600', color: 'var(--danger)' }}>+{formatCurrency(selectedCustStats.totalPenalty, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Outstanding Balance:</span>
                        <span style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>{formatCurrency(selectedCustStats.outstanding, currency)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Average Days to Pay:</span>
                        <span style={{ fontWeight: '600' }}>
                          {selectedCustStats.avgDaysToPay === null ? 'No History' : `${selectedCustStats.avgDaysToPay} Days`}
                        </span>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Payment Index:</div>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: selectedCustStats.paymentBehavior.includes('Excellent') || selectedCustStats.paymentBehavior.includes('Good') ? 'var(--success)' : 'var(--danger)' }}>
                        {selectedCustStats.paymentBehavior}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                    <Users size={32} style={{ marginBottom: '8px' }} />
                    Tap a customer to inspect payment history.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: INVOICES                                               */}
        {/* ============================================================== */}
        {activeTab === 'invoices' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Search invoice #..." 
                    style={{ paddingLeft: '38px' }}
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                  />
                </div>
                
                <select 
                  className="form-control" 
                  style={{ width: '130px' }}
                  value={invoiceFilterStatus}
                  onChange={(e) => setInvoiceFilterStatus(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="pending_verification">Pending Verification</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <button className="btn btn-primary btn-sm" onClick={openCreateInvoiceModal}>
                <Plus size={16} /> Issue Invoice
              </button>
            </div>


            {/* Bulk Feedback Message */}
            {bulkFeedback && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--success)',
                padding: '10px 16px',
                borderRadius: '10px',
                marginBottom: '14px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle size={16} /> {bulkFeedback}
              </div>
            )}

            {/* Bulk Actions Floating Bar (Visible when 1+ invoices selected) */}
            {selectedInvoiceIds.length > 0 && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                borderRadius: '12px',
                padding: '10px 16px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <CheckCircle size={16} style={{ color: 'var(--accent-indigo)' }} />
                  <span>
                    <strong>{selectedInvoiceIds.length}</strong> invoice{selectedInvoiceIds.length > 1 ? 's' : ''} selected
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedInvoiceIds([])} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '6px' }}
                  >
                    Deselect All
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleBulkSendReminders}
                    disabled={bulkLoading}
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Send WhatsApp reminder to each selected invoice's customer"
                  >
                    <Send size={14} /> Send Reminder to Selected
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleBulkMarkAsPaid}
                    disabled={bulkLoading}
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    title="Record full settlement and mark all selected invoices as PAID"
                  >
                    <CheckCircle size={14} /> Mark Selected as Paid
                  </button>
                </div>
              </div>
            )}

            <div className="glass-container" style={{ padding: '0px', overflow: 'hidden' }}>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox"
                          checked={filteredInvoices.length > 0 && selectedInvoiceIds.length === filteredInvoices.length}
                          onChange={handleToggleSelectAll}
                          title="Select All"
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </th>
                      <th>Invoice ID</th>
                      <th>Customer</th>
                      <th>Amount</th>
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
                        <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No invoices matching filters</td>
                      </tr>
                    ) : (
                      filteredInvoices.map(i => {
                        const customer = customers.find(c => c.id === i.customerId);
                        const isSelected = selectedInvoiceIds.includes(i.id);
                        return (
                          <tr key={i.id} style={{ background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined }}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectInvoice(i.id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              />
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{i.id}</td>

                            <td>
                              <div style={{ fontWeight: '500' }}>{i.customerName}</div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {i.customerId}</span>
                            </td>
                            <td>{formatCurrency(i.amount, currency)}</td>
                            <td style={{ color: i.penaltyAccrued > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                              {formatCurrency(i.penaltyAccrued, currency)}
                            </td>
                            <td style={{ fontWeight: 'bold', color: i.outstanding > 0 ? 'var(--accent-cyan)' : 'var(--success)' }}>
                              {formatCurrency(i.outstanding, currency)}
                            </td>
                            <td>{i.dueDate}</td>
                            <td>
                              <span className={`badge badge-${i.status}`}>
                                {i.status === 'pending_verification' ? 'Pending Verification' : i.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {i.status === 'pending_verification' && (
                                  <>
                                    <button 
                                      className="btn btn-sm" 
                                      style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', padding: '4px 8px', fontWeight: '500' }}
                                      onClick={() => handleVerifyPayment(i.id, 'approve')}
                                      title="Approve Payment"
                                    >
                                      Approve Payment
                                    </button>
                                    <button 
                                      className="btn btn-sm" 
                                      style={{ background: '#f43f5e', color: '#fff', fontSize: '0.75rem', padding: '4px 8px', fontWeight: '500' }}
                                      onClick={() => handleVerifyPayment(i.id, 'reject')}
                                      title="Reject Payment"
                                    >
                                      Reject Payment
                                    </button>
                                  </>
                                )}
                                {i.status !== 'paid' && i.status !== 'pending_verification' && (
                                  <>
                                    <button 
                                      className="btn btn-primary btn-sm" 
                                      onClick={() => {
                                        setSelectedInvoice(i);
                                        setPayAmount(i.outstanding.toString());
                                        recordPaymentDialog.current.showModal();
                                      }}
                                    >
                                      Pay
                                    </button>
                                    <button 
                                      className="btn btn-secondary btn-sm" 
                                      onClick={() => openWhatsAppModal(i, i.status === 'overdue' ? 'overdue' : 'before_due')}
                                      title="WhatsApp Reminder"
                                    >
                                      <Send size={14} />
                                    </button>
                                  </>
                                )}
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  onClick={() => generateInvoicePDF(i, customer || { id: i.customerId, name: i.customerName, phone: i.customerPhone }, user)}
                                  title="Download PDF"
                                >
                                  <Download size={14} />
                                </button>
                                {/* Edit Invoice Button */}
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  onClick={() => openEditInvoiceModal(i)}
                                  title="Edit Invoice Details"
                                >
                                  <Edit size={14} />
                                </button>
                                {/* Delete Invoice Button */}
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  onClick={() => handleDeleteInvoice(i.id)}
                                  title="Delete Invoice"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <Trash2 size={14} />
                                </button>
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

      {/* Floating Action Button for Mobile screens */}
      <button 
        className="mobile-fab" 
        onClick={openCreateInvoiceModal}
        title="Issue Credit Invoice"
      >

        <Plus size={24} />
      </button>

      {/* Native Mobile App Bottom Navigation Bar */}
      <MobileBottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenSettings={() => settingsDialog.current.showModal()}
      />

      {/* ============================================================== */}
      {/* DIALOG 0: CURRENCY & UPI VPA SETTINGS                          */}
      {/* ============================================================== */}
      <dialog ref={settingsDialog} className="modal" closedby="any">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings style={{ color: 'var(--accent-indigo)' }} size={22} /> Business Settings
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={() => settingsDialog.current.close()}>&times;</button>
        </div>

        {formError && <div style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>{formError}</div>}

        <form onSubmit={handleSettingsSave}>
          <div className="form-group">
            <label className="form-label" htmlFor="selectedCurrencyCode">Select Business Currency</label>
            <select 
              id="selectedCurrencyCode"
              className="form-control"
              value={selectedCurrencyCode}
              onChange={(e) => setSelectedCurrencyCode(e.target.value)}
              required
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sellerUpiInput">Seller UPI ID / VPA (For Google Pay, PhonePe, Paytm)</label>
            <input 
              id="sellerUpiInput"
              type="text" 
              className="form-control" 
              placeholder="Enter your UPI ID (e.g. yourname@okhdfcbank)" 
              value={sellerUpiInput}
              onChange={(e) => setSellerUpiInput(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Your buyers can scan your dynamic UPI QR code or tap to pay directly into this UPI ID.
            </span>
          </div>

          {/* Live Seller QR Preview */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>Live Seller UPI QR Preview:</div>
            {sellerUpiInput ? (
              <>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=${sellerUpiInput}&pn=${user?.name || 'Seller'}`)}`}
                  alt="UPI QR Code" 
                  style={{ width: '120px', height: '120px', borderRadius: '8px', border: '2px solid #fff' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '8px', fontFamily: 'monospace' }}>
                  {sellerUpiInput}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
                Enter your UPI ID above to preview your payment QR code.
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={settingsSaving}>
            {settingsSaving ? 'Updating...' : 'Save Business Settings'}
          </button>
        </form>
      </dialog>

      {/* DIALOG 1: ADD CUSTOMER */}
      <dialog ref={addCustomerDialog} className="modal" closedby="any">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Add New Customer</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => addCustomerDialog.current.close()}>&times;</button>
        </div>
        
        {formError && <div style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>{formError}</div>}

        <form onSubmit={handleAddCustomerSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="newCustName">Customer Business Name</label>
            <input 
              id="newCustName"
              type="text" 
              className="form-control" 
              placeholder="e.g. Acme Stores" 
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="newCustEmail">Email Address (Optional)</label>
            <input 
              id="newCustEmail"
              type="email" 
              className="form-control" 
              placeholder="customer@email.com" 
              value={newCustEmail}
              onChange={(e) => setNewCustEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="newCustPhone">WhatsApp Phone Number</label>
            <input 
              id="newCustPhone"
              type="text" 
              className="form-control" 
              placeholder="e.g. 9876543210" 
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>Add Customer</button>
        </form>
      </dialog>

      {/* DIALOG 2: ISSUE / EDIT CREDIT INVOICE */}
      <dialog ref={addInvoiceDialog} className="modal" closedby="any">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>{editingInvoiceId ? `Edit Invoice #${editingInvoiceId}` : 'Issue Credit Invoice'}</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => addInvoiceDialog.current.close()}>&times;</button>
        </div>

        {formError && <div style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>{formError}</div>}

        <form onSubmit={handleSaveInvoiceSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="newInvCustId">
              Select Customer {editingInvoiceId && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Locked)</span>}
            </label>
            <select 
              id="newInvCustId"
              className="form-control" 
              value={newInvCustId} 
              onChange={(e) => setNewInvCustId(e.target.value)}
              disabled={Boolean(editingInvoiceId)}
              required
            >
              <option value="">-- Choose Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newInvAmount">Invoice Amount ({currency.symbol})</label>
            <input 
              id="newInvAmount"
              type="number" 
              step="0.01" 
              className="form-control" 
              placeholder="0.00" 
              value={newInvAmount}
              onChange={(e) => setNewInvAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newInvPurchaseDate">Purchase Date</label>
            <input 
              id="newInvPurchaseDate"
              type="date" 
              className="form-control" 
              value={newInvPurchaseDate}
              onChange={(e) => setNewInvPurchaseDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newInvDueDate">Payment Due Date</label>
            <input 
              id="newInvDueDate"
              type="date" 
              className="form-control" 
              value={newInvDueDate}
              onChange={(e) => setNewInvDueDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newInvPenaltyRate">Weekly Late Penalty Rate (%)</label>
            <input 
              id="newInvPenaltyRate"
              type="number" 
              step="0.1" 
              className="form-control" 
              placeholder="e.g. 2.0" 
              value={newInvPenaltyRate}
              onChange={(e) => setNewInvPenaltyRate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newInvDesc">Goods Description</label>
            <input 
              id="newInvDesc"
              type="text" 
              className="form-control" 
              placeholder="e.g. Bulk flour grains bags" 
              value={newInvDesc}
              onChange={(e) => setNewInvDesc(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            {editingInvoiceId ? 'Save Changes' : 'Issue Invoice'}
          </button>
        </form>
      </dialog>


      {/* DIALOG 3: SELLER RECORD PAYMENT WITH SCREENSHOT UPLOAD */}
      <dialog ref={recordPaymentDialog} className="modal" closedby="any" style={{ maxWidth: '550px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Record Customer Payment</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => recordPaymentDialog.current.close()}>&times;</button>
        </div>

        {formError && <div style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>{formError}</div>}

        {selectedInvoice && (
          <form onSubmit={handleRecordPaymentSubmit}>
            <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
              <div>Invoice: <strong style={{ fontFamily: 'monospace' }}>#{selectedInvoice.id}</strong></div>
              <div>Outstanding: <strong>{formatCurrency(selectedInvoice.outstanding, currency)}</strong></div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="payAmount">Payment Amount ({currency.symbol})</label>
              <input 
                id="payAmount"
                type="number" 
                step="0.01" 
                className="form-control" 
                max={selectedInvoice.outstanding} 
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="payMethod">Payment Method</label>
              <select 
                id="payMethod"
                className="form-control" 
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                required
              >
                <option value="UPI">UPI / Google Pay / PhonePe / Paytm</option>
                <option value="Cash">Cash Handover</option>
                <option value="Cheque">Cheque Deposit</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Digital Wallet">Digital Wallet</option>
              </select>
            </div>

            {payMethod === 'Cheque' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Cheque Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. CHQ-49012" 
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
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

            {/* Screenshot Upload Dropzone */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Attach Screenshot / Photo Receipt Proof (Optional for Cash/Cheque audit)</label>
              <div style={{ border: '2px dashed var(--glass-border)', padding: '14px', borderRadius: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }} 
                  id="sellerEvidenceInput"
                />
                <label htmlFor="sellerEvidenceInput" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <Upload size={20} style={{ color: 'var(--accent-indigo)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {evidenceFileName ? `Attached: ${evidenceFileName}` : 'Upload Payment Screenshot or Photo Receipt'}
                  </span>
                </label>
              </div>
            </div>

            {evidenceDataUrl && (
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                <img src={evidenceDataUrl} alt="Preview" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--success)', flex: 1 }}>Payment receipt evidence attached!</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>Record Payment</button>
          </form>
        )}
      </dialog>

      {/* DIALOG 4: WHATSAPP REMINDER CONFIG */}
      <dialog ref={whatsappReminderDialog} className="modal" closedby="any" style={{ maxWidth: '550px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>WhatsApp Reminder Center</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => whatsappReminderDialog.current.close()}>&times;</button>
        </div>

        {selectedInvoice && (
          <div>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '4px', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
              <button 
                className="btn btn-sm" 
                style={{ flex: 1, background: whatsappType === 'before_due' ? 'var(--accent-indigo)' : 'transparent', color: '#fff', border: 'none' }}
                onClick={() => handleWhatsappTypeChange('before_due')}
              >
                Before Due
              </button>
              <button 
                className="btn btn-sm" 
                style={{ flex: 1, background: whatsappType === 'due_date' ? 'var(--accent-indigo)' : 'transparent', color: '#fff', border: 'none' }}
                onClick={() => handleWhatsappTypeChange('due_date')}
              >
                Due Today
              </button>
              <button 
                className="btn btn-sm" 
                style={{ flex: 1, background: whatsappType === 'overdue' ? 'var(--accent-indigo)' : 'transparent', color: '#fff', border: 'none' }}
                onClick={() => handleWhatsappTypeChange('overdue')}
              >
                Overdue Alert
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Message Preview:</label>
              <div style={{ background: '#075E54', padding: '16px', borderRadius: '12px', fontSize: '0.95rem', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>WhatsApp Template Output ({currency.code})</span>
                {whatsappPreview}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => whatsappReminderDialog.current.close()}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 2, background: 'linear-gradient(135deg, #25D366, #128C7E)', boxShadow: '0 4px 14px rgba(37,211,102,0.3)' }} 
                onClick={() => {
                  window.open(whatsappUrl, '_blank');
                  whatsappReminderDialog.current.close();
                }}
              >
                <Send size={16} /> Send in WhatsApp
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* PROOF / SCREENSHOT PREVIEW MODAL */}
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

  if (isMobileFrame) {
    return (
      <div style={{ padding: '20px 0', background: '#000' }}>
        <div className="device-frame-shell">
          <div className="device-frame-notch" />
          <div style={{ paddingTop: '20px' }}>
            {dashboardContent}
          </div>
        </div>
      </div>
    );
  }

  return dashboardContent;
}
