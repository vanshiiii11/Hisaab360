import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { readData, writeData } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Razorpay instance (reads from env vars) ────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Razorpay order for a given invoice's outstanding amount.
// Called by the frontend before opening the Razorpay checkout popup.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ error: 'invoiceId is required' });
    }

    const db = readData();
    const invoice = db.invoices.find(i => i.id === invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Scope check — only the invoice's customer or seller can create an order
    const { id, role } = req.user;
    if (role === 'customer' && invoice.customerId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (role === 'seller' && invoice.sellerId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate outstanding balance
    const totalPaid = invoice.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.round((invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid) * 100) / 100;

    if (outstanding <= 0) {
      return res.status(400).json({ error: 'Invoice is already fully paid' });
    }

    // Razorpay expects amount in PAISE (1 INR = 100 paise)
    const amountInPaise = Math.round(outstanding * 100);

    const order = await razorpay.orders.create({
      amount:   amountInPaise,
      currency: 'INR',
      receipt:  `rcpt_${invoiceId}_${Date.now()}`,
      notes: {
        invoiceId,
        customerId: invoice.customerId,
        sellerId:   invoice.sellerId
      }
    });

    res.json({
      orderId:    order.id,
      amount:     order.amount,       // in paise
      amountINR:  outstanding,        // in rupees (for display)
      currency:   order.currency,
      invoiceId,
      keyId:      process.env.RAZORPAY_KEY_ID  // safe to expose to frontend
    });
  } catch (error) {
    console.error('Razorpay create-order error:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order', detail: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify
// Called by frontend after user completes Razorpay checkout.
// Verifies the payment signature cryptographically, then marks invoice PAID.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      invoiceId,
      amount          // in rupees
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
      return res.status(400).json({ error: 'Missing required payment verification fields' });
    }

    // ── Signature Verification ────────────────────────────────────────────
    // Razorpay signs: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('⚠️  Razorpay signature mismatch — possible tampering attempt');
      return res.status(400).json({ error: 'Payment verification failed: invalid signature' });
    }

    // ── Signature valid → record payment in DB ────────────────────────────
    const db = readData();
    const invoiceIndex = db.invoices.findIndex(i => i.id === invoiceId);

    if (invoiceIndex === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = db.invoices[invoiceIndex];
    const parsedAmount = parseFloat(amount);

    const payment = {
      id:               razorpay_payment_id,
      amount:           parsedAmount,
      date:             new Date().toISOString(),
      method:           'Razorpay UPI / Online',
      razorpayOrderId:  razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      evidenceUrl:      null,
      chequeNumber:     null,
      bankName:         null,
      referenceNo:      razorpay_payment_id
    };

    invoice.paymentHistory.push(payment);

    // Recalculate status
    const totalPaidAfter = invoice.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const remaining = invoice.amount + (invoice.penaltyAccrued || 0) - totalPaidAfter;

    if (remaining <= 0.01) {
      invoice.status = 'paid';
    } else {
      const isOverdue = new Date() > new Date(invoice.dueDate);
      invoice.status = isOverdue ? 'overdue' : 'pending';
    }

    db.invoices[invoiceIndex] = invoice;
    writeData(db);

    console.log(`✅ Razorpay payment verified & recorded: ${razorpay_payment_id} for invoice ${invoiceId}`);

    res.json({
      success:   true,
      message:   'Payment verified and recorded successfully',
      invoiceId,
      paymentId: razorpay_payment_id,
      status:    invoice.status
    });
  } catch (error) {
    console.error('Razorpay verify error:', error);
    res.status(500).json({ error: 'Payment verification server error', detail: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/webhook
// Razorpay calls this server-to-server when payment events occur.
// Provides a reliable fallback even if browser tab was closed mid-payment.
// Configure this URL in Razorpay Dashboard → Webhooks.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    const receivedSignature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)           // req.body is raw Buffer here
      .digest('hex');

    if (receivedSignature !== expectedSignature) {
      console.warn('⚠️  Webhook signature mismatch');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body.toString());
    console.log(`📩 Razorpay webhook event: ${event.event}`);

    // Handle successful payment event
    if (event.event === 'payment.captured') {
      const payment  = event.payload.payment.entity;
      const invoiceId = payment.notes?.invoiceId;

      if (!invoiceId) {
        return res.status(200).json({ received: true, note: 'No invoiceId in notes, skipping' });
      }

      const db = readData();
      const invoiceIndex = db.invoices.findIndex(i => i.id === invoiceId);

      if (invoiceIndex !== -1) {
        const invoice = db.invoices[invoiceIndex];

        // Avoid double-recording the same payment
        const alreadyRecorded = invoice.paymentHistory.some(p => p.id === payment.id);

        if (!alreadyRecorded) {
          invoice.paymentHistory.push({
            id:                payment.id,
            amount:            payment.amount / 100,   // convert paise → rupees
            date:              new Date().toISOString(),
            method:            `Razorpay (${payment.method})`,
            razorpayPaymentId: payment.id,
            referenceNo:       payment.id,
            evidenceUrl:       null,
            chequeNumber:      null,
            bankName:          null
          });

          const totalPaid = invoice.paymentHistory
            .filter(p => p.status !== 'pending_verification' && p.status !== 'rejected')
            .reduce((sum, p) => sum + p.amount, 0);
          const remaining = invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid;
          invoice.status = remaining <= 0.01 ? 'paid' : (new Date() > new Date(invoice.dueDate) ? 'overdue' : 'pending');

          db.invoices[invoiceIndex] = invoice;
          writeData(db);
          console.log(`✅ Webhook: Invoice ${invoiceId} updated via payment.captured`);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

export default router;
