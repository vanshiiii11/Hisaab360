import express from 'express';
import { readData, writeData, generateInvoiceId, reconcilePenalties } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply general token authentication
router.use(authenticateToken);

// Get invoices based on role (Seller sees all issued, Customer sees all received, Admin sees all or by sellerId)
router.get('/', (req, res) => {
  try {
    // Reconcile overdue invoice penalties dynamically on fetch
    reconcilePenalties();
    
    const db = readData();
    const { id, role } = req.user;

    let list = [];
    if (role === 'seller') {
      list = db.invoices.filter(i => i.sellerId === id);
    } else if (role === 'customer') {
      list = db.invoices.filter(i => i.customerId === id);
    } else if (role === 'admin') {
      if (req.query.sellerId) {
        list = db.invoices.filter(i => i.sellerId === req.query.sellerId);
      } else {
        list = db.invoices;
      }
    }

    // Attach customer and seller name metadata for convenience
    const enriched = list.map(inv => {
      const customer = db.customers.find(c => c.id === inv.customerId);
      const seller = db.sellers.find(s => s.id === inv.sellerId);
      
      const totalPaid = (inv.paymentHistory || [])
        .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);
      const outstanding = Math.round((inv.amount + (inv.penaltyAccrued || 0) - totalPaid) * 100) / 100;

      return {
        ...inv,
        customerName: customer ? customer.name : 'Unknown Customer',
        customerPhone: customer ? customer.phone : '',
        sellerName: seller ? seller.name : 'Unknown Seller',
        sellerCurrency: seller ? seller.currency : undefined,
        sellerUpiId: seller ? seller.upiId : undefined,
        outstanding
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Fetch invoices error:', error);
    res.status(500).json({ error: 'Server error fetching invoices' });
  }
});

// Get individual invoice details
router.get('/:id', (req, res) => {
  try {
    reconcilePenalties();
    const db = readData();
    const invoiceId = req.params.id;
    const { id, role } = req.user;

    const invoice = db.invoices.find(i => i.id === invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Scope check
    if (role === 'seller' && invoice.sellerId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (role === 'customer' && invoice.customerId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const customer = db.customers.find(c => c.id === invoice.customerId);
    const seller = db.sellers.find(s => s.id === invoice.sellerId);
    const totalPaid = (invoice.paymentHistory || [])
      .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
      .reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.round((invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid) * 100) / 100;

    res.json({
      ...invoice,
      customerName: customer ? customer.name : 'Unknown Customer',
      customerPhone: customer ? customer.phone : '',
      sellerName: seller ? seller.name : 'Unknown Seller',
      sellerCurrency: seller ? seller.currency : undefined,
      sellerUpiId: seller ? seller.upiId : undefined,
      outstanding
    });
  } catch (error) {
    console.error('Fetch single invoice error:', error);
    res.status(500).json({ error: 'Server error fetching invoice' });
  }
});

// Create credit invoice (Sellers or Admins)
router.post('/', (req, res) => {
  try {
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only sellers can create invoices' });
    }

    const { customerId, amount, dueDate, purchaseDate, penaltyRate, description, sellerId: adminTargetSellerId } = req.body;
    const sellerId = req.user.role === 'admin' && adminTargetSellerId ? adminTargetSellerId : req.user.id;

    if (!customerId || !amount || !dueDate) {
      return res.status(400).json({ error: 'Customer ID, Amount, and Due Date are required' });
    }

    const db = readData();

    // Verify customer exists and belongs to this seller
    const customer = db.customers.find(c => c.id === customerId && c.sellerId === sellerId);
    if (!customer) {
      return res.status(400).json({ error: 'Invalid Customer ID or customer is not mapped to this seller account' });
    }

    const invoiceId = generateInvoiceId();
    const purchase = purchaseDate || new Date().toISOString().split('T')[0];

    const newInvoice = {
      id: invoiceId,
      customerId,
      sellerId,
      amount: parseFloat(amount),
      purchaseDate: purchase,
      dueDate,
      penaltyRate: parseFloat(penaltyRate) || 0,
      penaltyAccrued: 0,
      status: 'pending',
      description: description || 'Credit purchase',
      paymentHistory: [],
      createdAt: new Date().toISOString()
    };

    // Auto-check if initially overdue (if past date provided)
    const today = new Date();
    const due = new Date(dueDate);
    if (today > due) {
      newInvoice.status = 'overdue';
    }

    db.invoices.push(newInvoice);
    writeData(db);

    res.status(201).json(newInvoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Server error creating invoice' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:id — Update / Edit Invoice with penalty recalculation
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { amount, dueDate, purchaseDate, penaltyRate, description } = req.body;
    const { id, role } = req.user;

    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ error: 'Only sellers or admins can edit invoices' });
    }

    const db = readData();
    const invoiceIndex = db.invoices.findIndex(i => i.id === invoiceId);

    if (invoiceIndex === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = db.invoices[invoiceIndex];

    // Authorization: Sellers can only edit their own invoices
    if (role === 'seller' && invoice.sellerId !== id) {
      return res.status(403).json({ error: 'Access denied: You can only edit your own invoices' });
    }

    // Validate that new amount doesn't drop below payments already received
    const totalPaid = (invoice.paymentHistory || [])
      .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
      .reduce((sum, p) => sum + p.amount, 0);
    const parsedAmount = amount !== undefined ? parseFloat(amount) : invoice.amount;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid invoice amount is required' });
    }

    if (parsedAmount < totalPaid) {
      return res.status(400).json({ 
        error: `Updated amount (${parsedAmount}) cannot be less than total payments already received (${totalPaid})` 
      });
    }

    // Apply updates
    invoice.amount = parsedAmount;
    if (dueDate) invoice.dueDate = dueDate;
    if (purchaseDate) invoice.purchaseDate = purchaseDate;
    if (penaltyRate !== undefined) invoice.penaltyRate = parseFloat(penaltyRate) || 0;
    if (description !== undefined) invoice.description = description;

    // Recalculate status & penalties based on updated due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.dueDate);
    due.setHours(0, 0, 0, 0);

    const isPastDue = today > due;

    if (isPastDue && invoice.status !== 'paid') {
      const diffTime = Math.abs(today - due);
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
      invoice.penaltyAccrued = Math.round(invoice.amount * ((invoice.penaltyRate / 100) * diffWeeks) * 100) / 100;
      invoice.status = 'overdue';
    } else if (!isPastDue && invoice.status === 'overdue') {
      // Due date was moved forward into the future -> reset penalty and restore pending
      invoice.penaltyAccrued = 0;
      invoice.status = 'pending';
    }

    // Check if fully paid
    const remaining = invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid;
    if (remaining <= 0.01) {
      invoice.status = 'paid';
    }

    db.invoices[invoiceIndex] = invoice;
    writeData(db);

    res.json({
      message: 'Invoice updated successfully',
      invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Server error updating invoice' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:id — Delete Invoice
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { id, role } = req.user;

    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ error: 'Only sellers or admins can delete invoices' });
    }

    const db = readData();
    const invoiceIndex = db.invoices.findIndex(i => i.id === invoiceId);

    if (invoiceIndex === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = db.invoices[invoiceIndex];

    if (role === 'seller' && invoice.sellerId !== id) {
      return res.status(403).json({ error: 'Access denied: You can only delete your own invoices' });
    }

    // Delete invoice from array
    db.invoices.splice(invoiceIndex, 1);

    // Clean up any associated reminder notifications
    if (Array.isArray(db.notifications)) {
      db.notifications = db.notifications.filter(n => n.invoiceId !== invoiceId);
    }

    writeData(db);

    res.json({
      message: `Invoice #${invoiceId} was successfully deleted`,
      deletedId: invoiceId
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Server error deleting invoice' });
  }
});

// Record a payment on an invoice with optional Payment Evidence / Screenshot
router.post('/:id/payment', (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { amount, method, evidenceUrl, chequeNumber, bankName, referenceNo } = req.body;
    const { id, role } = req.user;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const db = readData();
    const invoiceIndex = db.invoices.findIndex(i => i.id === invoiceId);

    if (invoiceIndex === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = db.invoices[invoiceIndex];

    // Authorization checks (Admin can record on any invoice)
    if (role === 'seller' && invoice.sellerId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (role === 'customer' && invoice.customerId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isOfflinePayment = method && (
      method.toLowerCase().includes('cash') || 
      method.toLowerCase().includes('cheque')
    );

    // Require screenshot/receipt evidence for BOTH Cash and Cheque payments submitted by customers
    if (role === 'customer' && isOfflinePayment && !evidenceUrl) {
      return res.status(400).json({ 
        error: 'Screenshot or receipt photo evidence is required for Cash and Cheque payments' 
      });
    }

    const parsedAmount = parseFloat(amount);
    const totalPaidBefore = (invoice.paymentHistory || [])
      .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
      .reduce((sum, p) => sum + p.amount, 0);
    const currentOutstanding = invoice.amount + (invoice.penaltyAccrued || 0) - totalPaidBefore;

    if (parsedAmount > currentOutstanding + 0.01) {
      return res.status(400).json({ error: `Payment exceeds outstanding balance` });
    }

    const isPendingVerification = role === 'customer' && isOfflinePayment;

    // Add to payment history with evidence properties
    const payment = {
      id: 'PAY-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      amount: parsedAmount,
      date: new Date().toISOString(),
      method: method || (role === 'seller' ? 'Cash' : 'Portal Payment'),
      evidenceUrl: evidenceUrl || null,
      chequeNumber: chequeNumber || null,
      bankName: bankName || null,
      referenceNo: referenceNo || null,
      status: isPendingVerification ? 'pending_verification' : 'verified'
    };

    if (!Array.isArray(invoice.paymentHistory)) {
      invoice.paymentHistory = [];
    }
    invoice.paymentHistory.push(payment);

    // Re-verify status
    if (isPendingVerification) {
      invoice.status = 'pending_verification';
    } else {
      const totalPaidAfter = totalPaidBefore + parsedAmount;
      const remaining = invoice.amount + (invoice.penaltyAccrued || 0) - totalPaidAfter;

      if (remaining <= 0.01) {
        invoice.status = 'paid';
      } else {
        const isOverdue = new Date() > new Date(invoice.dueDate);
        invoice.status = isOverdue ? 'overdue' : 'pending';
      }
    }

    db.invoices[invoiceIndex] = invoice;
    writeData(db);

    res.json({
      message: isPendingVerification
        ? 'Payment submitted successfully — awaiting seller verification'
        : 'Payment recorded successfully',
      invoice,
      payment
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Server error recording payment' });
  }
});

// Verify or Reject an offline customer payment (Cash/Cheque)
router.post('/:id/verify-payment', (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { paymentId, action } = req.body; // action: 'approve' | 'reject'
    const { id, role } = req.user;

    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ error: 'Only sellers and admins can verify payments' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    const db = readData();
    const invoiceIndex = db.invoices.findIndex(i => i.id === invoiceId);

    if (invoiceIndex === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = db.invoices[invoiceIndex];

    if (role === 'seller' && invoice.sellerId !== id) {
      return res.status(403).json({ error: 'Access denied to this invoice' });
    }

    if (!Array.isArray(invoice.paymentHistory) || invoice.paymentHistory.length === 0) {
      return res.status(400).json({ error: 'No payments found on this invoice' });
    }

    let paymentIndex = -1;
    if (paymentId) {
      paymentIndex = invoice.paymentHistory.findIndex(p => p.id === paymentId);
    } else {
      for (let i = invoice.paymentHistory.length - 1; i >= 0; i--) {
        if (invoice.paymentHistory[i].status === 'pending_verification') {
          paymentIndex = i;
          break;
        }
      }
    }

    if (paymentIndex === -1) {
      return res.status(404).json({ error: 'No pending payment found to verify' });
    }

    const targetPayment = invoice.paymentHistory[paymentIndex];

    if (action === 'approve') {
      targetPayment.status = 'verified';
      targetPayment.verifiedAt = new Date().toISOString();
      targetPayment.verifiedBy = id;
    } else {
      invoice.paymentHistory.splice(paymentIndex, 1);
    }

    // Check if there are any remaining pending verification payments
    const hasRemainingPending = invoice.paymentHistory.some(p => p.status === 'pending_verification');

    if (hasRemainingPending) {
      invoice.status = 'pending_verification';
    } else {
      const totalPaid = invoice.paymentHistory
        .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
        .reduce((sum, p) => sum + p.amount, 0);
      const remaining = invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid;

      if (remaining <= 0.01) {
        invoice.status = 'paid';
      } else {
        const isOverdue = new Date() > new Date(invoice.dueDate);
        invoice.status = isOverdue ? 'overdue' : 'pending';
      }
    }

    db.invoices[invoiceIndex] = invoice;
    writeData(db);

    res.json({
      message: action === 'approve' ? 'Payment successfully approved' : 'Payment rejected and removed',
      invoice
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Server error verifying payment' });
  }
});

export default router;
