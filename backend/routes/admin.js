import express from 'express';
import { readData, reconcilePenalties } from '../db.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Enforce Admin Authentication
router.use(authenticateToken, isAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/overview — Platform-wide metrics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overview', (req, res) => {
  try {
    reconcilePenalties();
    const db = readData();

    const sellers = db.sellers || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];

    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    invoices.forEach(inv => {
      const invPaid = (inv.paymentHistory || [])
        .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);
      const invOutstanding = Math.max(0, (inv.amount || 0) + (inv.penaltyAccrued || 0) - invPaid);

      totalBilled += (inv.amount || 0);
      totalCollected += invPaid;
      totalOutstanding += invOutstanding;

      if (inv.status === 'overdue') {
        totalOverdue += invOutstanding;
        overdueCount++;
      }
    });

    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    res.json({
      totalSellers: sellers.length,
      totalCustomers: customers.length,
      totalInvoices: invoices.length,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      overdueCount,
      collectionRate
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Server error fetching admin overview' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sellers — List all sellers with individual aggregated metrics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sellers', (req, res) => {
  try {
    reconcilePenalties();
    const db = readData();

    const sellers = db.sellers || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];

    const enrichedSellers = sellers.map(seller => {
      const sellerCustomers = customers.filter(c => c.sellerId === seller.id);
      const sellerInvoices = invoices.filter(i => i.sellerId === seller.id);

      let totalBilled = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;
      let overdueCount = 0;

      sellerInvoices.forEach(inv => {
        const invPaid = (inv.paymentHistory || [])
          .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
          .reduce((sum, p) => sum + p.amount, 0);
        const invOutstanding = Math.max(0, (inv.amount || 0) + (inv.penaltyAccrued || 0) - invPaid);

        totalBilled += (inv.amount || 0);
        totalCollected += invPaid;
        totalOutstanding += invOutstanding;

        if (inv.status === 'overdue') {
          overdueCount++;
        }
      });

      return {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        currency: seller.currency,
        upiId: seller.upiId,
        createdAt: seller.createdAt,
        totalCustomers: sellerCustomers.length,
        totalInvoices: sellerInvoices.length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        overdueCount
      };
    });

    res.json(enrichedSellers);
  } catch (error) {
    console.error('Admin fetch sellers error:', error);
    res.status(500).json({ error: 'Server error fetching sellers list' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sellers/:id — View specific seller's entire data (read-only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sellers/:id', (req, res) => {
  try {
    reconcilePenalties();
    const db = readData();
    const sellerId = req.params.id;

    const seller = db.sellers.find(s => s.id === sellerId);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const sellerCustomers = db.customers.filter(c => c.sellerId === sellerId);
    const sellerInvoices = db.invoices.filter(i => i.sellerId === sellerId).map(inv => {
      const customer = sellerCustomers.find(c => c.id === inv.customerId);
      const totalPaid = (inv.paymentHistory || [])
        .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);
      const outstanding = Math.round(((inv.amount || 0) + (inv.penaltyAccrued || 0) - totalPaid) * 100) / 100;
      return {
        ...inv,
        customerName: customer ? customer.name : 'Unknown Customer',
        customerPhone: customer ? customer.phone : '',
        outstanding
      };
    });

    // Compute metrics
    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;

    sellerInvoices.forEach(inv => {
      const invPaid = (inv.paymentHistory || [])
        .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);
      totalBilled += inv.amount;
      totalCollected += invPaid;
      totalOutstanding += inv.outstanding;
      if (inv.status === 'overdue') totalOverdue += inv.outstanding;
    });

    res.json({
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        currency: seller.currency,
        upiId: seller.upiId,
        createdAt: seller.createdAt
      },
      stats: {
        totalCustomers: sellerCustomers.length,
        totalInvoices: sellerInvoices.length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100
      },
      customers: sellerCustomers,
      invoices: sellerInvoices
    });
  } catch (error) {
    console.error('Admin get seller detail error:', error);
    res.status(500).json({ error: 'Server error fetching seller details' });
  }
});

export default router;
