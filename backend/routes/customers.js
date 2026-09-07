import express from 'express';
import { readData, writeData, generateCustomerId } from '../db.js';
import { authenticateToken, isSeller } from '../middleware/auth.js';

const router = express.Router();

// Apply seller authorization to all customer endpoints
router.use(authenticateToken, isSeller);

// Get all customers of current seller
router.get('/', (req, res) => {
  try {
    const db = readData();
    const sellerId = req.user.id;

    // Filter customers owned by this seller
    const sellerCustomers = db.customers.filter(c => c.sellerId === sellerId);

    // Enriched customer data with outstanding balance & total invoice counts
    const enriched = sellerCustomers.map(customer => {
      const customerInvoices = db.invoices.filter(inv => inv.customerId === customer.id);
      
      let outstanding = 0;
      let totalInvoiced = 0;
      let overdueCount = 0;

      customerInvoices.forEach(inv => {
        const totalPaid = inv.paymentHistory
          .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
          .reduce((sum, p) => sum + p.amount, 0);
        const invOutstanding = Math.max(0, inv.amount + (inv.penaltyAccrued || 0) - totalPaid);
        
        outstanding += invOutstanding;
        totalInvoiced += inv.amount;

        if (inv.status === 'overdue' || (inv.status !== 'paid' && new Date() > new Date(inv.dueDate))) {
          overdueCount++;
        }
      });

      return {
        ...customer,
        outstanding: Math.round(outstanding * 100) / 100,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        invoiceCount: customerInvoices.length,
        overdueCount
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Fetch customers error:', error);
    res.status(500).json({ error: 'Server error fetching customers' });
  }
});

// Add new customer
router.post('/', (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const sellerId = req.user.id;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }

    const db = readData();

    // Check duplicate customer in this seller's scope by phone/email
    const duplicate = db.customers.find(c => 
      c.sellerId === sellerId && 
      (c.phone === phone || (email && c.email === email))
    );

    if (duplicate) {
      return res.status(400).json({ error: 'Customer with this phone number or email already exists' });
    }

    const customerId = generateCustomerId();
    const newCustomer = {
      id: customerId,
      sellerId,
      name,
      email: email || '',
      phone,
      createdAt: new Date().toISOString()
    };

    db.customers.push(newCustomer);
    writeData(db);

    res.status(201).json(newCustomer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Server error creating customer' });
  }
});

// Update customer
router.put('/:id', (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const sellerId = req.user.id;
    const customerId = req.params.id;

    const db = readData();
    const customerIndex = db.customers.findIndex(c => c.id === customerId && c.sellerId === sellerId);

    if (customerIndex === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    db.customers[customerIndex] = {
      ...db.customers[customerIndex],
      name,
      email: email || '',
      phone
    };

    writeData(db);
    res.json(db.customers[customerIndex]);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Server error updating customer' });
  }
});

// Get individual customer payment stats and metrics
router.get('/:id/stats', (req, res) => {
  try {
    const sellerId = req.user.id;
    const customerId = req.params.id;

    const db = readData();
    const customer = db.customers.find(c => c.id === customerId && c.sellerId === sellerId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const invoices = db.invoices.filter(i => i.customerId === customerId);

    let totalBilled = 0;
    let totalPaid = 0;
    let totalPenalty = 0;
    let pendingVerificationAmount = 0;
    let paidInvoicesCount = 0;
    let payTimeDiffSum = 0; // sum of payment time differences in days

    invoices.forEach(inv => {
      // Only count verified payments in totalPaid (excludes pending_verification & rejected)
      const invVerifiedPaid = inv.paymentHistory
        .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);

      // Track unconfirmed offline payments separately
      const invPendingAmount = inv.paymentHistory
        .filter(p => p.status === 'pending_verification')
        .reduce((sum, p) => sum + p.amount, 0);

      totalBilled += inv.amount;
      totalPaid += invVerifiedPaid;
      totalPenalty += inv.penaltyAccrued || 0;
      pendingVerificationAmount += invPendingAmount;

      if (inv.status === 'paid') {
        paidInvoicesCount++;
        // Calculate payment duration from purchase date to final payment date
        if (inv.paymentHistory.length > 0) {
          const purchase = new Date(inv.purchaseDate);
          const payments = inv.paymentHistory.map(p => new Date(p.date));
          const finalPayDate = new Date(Math.max(...payments));
          
          const daysToPay = Math.ceil((finalPayDate - purchase) / (1000 * 60 * 60 * 24));
          payTimeDiffSum += daysToPay;
        }
      }
    });

    const outstanding = Math.round((totalBilled + totalPenalty - totalPaid) * 100) / 100;
    const avgDaysToPay = paidInvoicesCount > 0 ? Math.round(payTimeDiffSum / paidInvoicesCount) : null;

    res.json({
      customerId,
      customerName: customer.name,
      totalBilled,
      totalPaid,
      totalPenalty,
      outstanding,
      pendingVerificationAmount: Math.round(pendingVerificationAmount * 100) / 100,
      invoiceCount: invoices.length,
      paidInvoicesCount,
      avgDaysToPay, // null if no fully paid invoices yet
      paymentBehavior: avgDaysToPay === null 
        ? 'No history' 
        : avgDaysToPay <= 15 
        ? 'Excellent (≤15 days)' 
        : avgDaysToPay <= 30 
        ? 'Good (16-30 days)' 
        : avgDaysToPay <= 45 
        ? 'Slow (31-45 days)' 
        : 'Overdue/Risky (>45 days)'
    });
  } catch (error) {
    console.error('Customer stats error:', error);
    res.status(500).json({ error: 'Server error compiling customer stats' });
  }
});

export default router;
