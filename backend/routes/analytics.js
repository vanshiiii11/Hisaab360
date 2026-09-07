import express from 'express';
import { readData, reconcilePenalties } from '../db.js';
import { authenticateToken, isSeller } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken, isSeller);

// Fetch seller dashboard stats and charts
router.get('/dashboard', (req, res) => {
  try {
    reconcilePenalties();
    const db = readData();
    const sellerId = req.user.id;

    // Filter invoices and customers for this seller
    const invoices = db.invoices.filter(i => i.sellerId === sellerId);
    const customers = db.customers.filter(c => c.sellerId === sellerId);

    // Initial KPI containers
    let totalOutstanding = 0;
    let totalCollected = 0;
    let totalPendingVerification = 0;
    let totalOverdue = 0;
    let collectionsToday = 0;
    let totalBilled = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    // Aging categories: 0-15, 16-30, 31-45, 46+ days overdue
    const aging = {
      current: 0,
      days_1_15: 0,
      days_16_30: 0,
      days_31_45: 0,
      days_46_plus: 0
    };

    invoices.forEach(inv => {
      // Only count verified payments toward collected/outstanding
      const invTotalPaid = inv.paymentHistory
        .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);

      // Track unconfirmed offline payments separately
      const invPending = inv.paymentHistory
        .filter(p => p.status === 'pending_verification')
        .reduce((sum, p) => sum + p.amount, 0);

      const invOutstanding = Math.max(0, inv.amount + (inv.penaltyAccrued || 0) - invTotalPaid);

      totalBilled += inv.amount;
      totalOutstanding += invOutstanding;
      totalCollected += invTotalPaid;
      totalPendingVerification += invPending;

      // Group into aging profiles if outstanding
      if (invOutstanding > 0) {
        const dueDate = new Date(inv.dueDate);
        const today = new Date();

        if (today <= dueDate) {
          aging.current += invOutstanding;
        } else {
          const diffDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
          if (diffDays <= 15) {
            aging.days_1_15 += invOutstanding;
          } else if (diffDays <= 30) {
            aging.days_16_30 += invOutstanding;
          } else if (diffDays <= 45) {
            aging.days_31_45 += invOutstanding;
          } else {
            aging.days_46_plus += invOutstanding;
          }
        }
      }

      if (inv.status === 'overdue') {
        totalOverdue += invOutstanding;
      }

      // Check payments made today (only verified ones count as collected today)
      inv.paymentHistory.forEach(pay => {
        if (pay.status === 'pending_verification' || pay.status === 'rejected') return;
        const payDateStr = pay.date.split('T')[0];
        if (payDateStr === todayStr) {
          collectionsToday += pay.amount;
        }
      });
    });

    // Compile Top Customer Credit Exposure
    const customerExposure = customers.map(cust => {
      const custInvoices = invoices.filter(i => i.customerId === cust.id);
      const outstanding = custInvoices.reduce((sum, inv) => {
        const invPaid = inv.paymentHistory
          .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
          .reduce((s, p) => s + p.amount, 0);
        return sum + Math.max(0, inv.amount + (inv.penaltyAccrued || 0) - invPaid);
      }, 0);

      return {
        id: cust.id,
        name: cust.name,
        outstanding: Math.round(outstanding * 100) / 100
      };
    })
    .filter(c => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5); // Limit to top 5 exposure

    // Compile Monthly Collection vs billing Trends (Last 6 Months)
    const monthlyTrends = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthName = d.toLocaleString('default', { month: 'short' });

      let billed = 0;
      let collected = 0;

      invoices.forEach(inv => {
        const invDate = new Date(inv.purchaseDate);
        if (invDate.getFullYear() === year && invDate.getMonth() === month) {
          billed += inv.amount;
        }
        
        inv.paymentHistory.forEach(pay => {
          // Only count verified payments in monthly collection trends
          if (pay.status === 'pending_verification' || pay.status === 'rejected') return;
          const payDate = new Date(pay.date);
          if (payDate.getFullYear() === year && payDate.getMonth() === month) {
            collected += pay.amount;
          }
        });
      });

      monthlyTrends.push({
        name: `${monthName} ${year}`,
        billed: Math.round(billed * 100) / 100,
        collected: Math.round(collected * 100) / 100
      });
    }

    res.json({
      summary: {
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        collectionsToday: Math.round(collectionsToday * 100) / 100,
        totalPendingVerification: Math.round(totalPendingVerification * 100) / 100,
        collectionRate: totalBilled > 0 ? Math.round((totalCollected / (totalBilled + totalOverdue)) * 100) : 100
      },
      aging: {
        current: Math.round(aging.current * 100) / 100,
        days_1_15: Math.round(aging.days_1_15 * 100) / 100,
        days_16_30: Math.round(aging.days_16_30 * 100) / 100,
        days_31_45: Math.round(aging.days_31_45 * 100) / 100,
        days_46_plus: Math.round(aging.days_46_plus * 100) / 100
      },
      exposure: customerExposure,
      trends: monthlyTrends
    });
  } catch (error) {
    console.error('Analytics stats error:', error);
    res.status(500).json({ error: 'Server error generating dashboard analytics' });
  }
});

export default router;
