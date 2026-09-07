import express from 'express';
import { readData, writeData, generateNotificationId } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Record that a WhatsApp reminder was sent (Seller triggers this when sending)
router.post('/send-whatsapp', (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can send notifications' });
    }

    const { customerId, invoiceId, type } = req.body;
    const sellerId = req.user.id;

    if (!customerId || !invoiceId || !type) {
      return res.status(400).json({ error: 'Customer ID, Invoice ID, and notification type are required' });
    }

    const db = readData();

    // Verify entities
    const customer = db.customers.find(c => c.id === customerId && c.sellerId === sellerId);
    const invoice = db.invoices.find(i => i.id === invoiceId && i.sellerId === sellerId);
    const seller = db.sellers.find(s => s.id === sellerId);

    if (!customer || !invoice) {
      return res.status(400).json({ error: 'Invalid Customer or Invoice references' });
    }

    // Compute template message
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const totalPaid = invoice.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.round((invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid) * 100) / 100;
    
    let messageTemplate = '';
    const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Portal link (relative or absolute local host portal link)
    const portalLink = `http://localhost:5173/portal?seller=${sellerId}&cust=${customerId}`;

    const sym = seller?.currency?.symbol || '₹';

    if (type === 'before_due') {
      messageTemplate = `Dear ${customer.name}, this is a gentle reminder from ${seller.name} that your invoice #${invoice.id} of ${sym}${invoice.amount} is due on ${formattedDueDate}. Outstanding balance: ${sym}${outstanding}. Please clear it at your earliest convenience. Direct Link: ${portalLink}`;
    } else if (type === 'due_date') {
      messageTemplate = `URGENT: Dear ${customer.name}, your payment of ${sym}${outstanding} for invoice #${invoice.id} to ${seller.name} is due TODAY (${formattedDueDate}). Please make the payment immediately to avoid late fees. Direct Link: ${portalLink}`;
    } else if (type === 'overdue') {
      const penaltyText = invoice.penaltyAccrued > 0 ? ` (includes accrued penalty of ${sym}${invoice.penaltyAccrued})` : '';
      messageTemplate = `ALERT: Dear ${customer.name}, invoice #${invoice.id} from ${seller.name} is OVERDUE since ${formattedDueDate}. The current outstanding balance is ${sym}${outstanding}${penaltyText}. Please clear this immediately to prevent further penalty charges. Pay here: ${portalLink}`;
    }


    // Log the notification
    const notification = {
      id: generateNotificationId(),
      customerId,
      sellerId,
      invoiceId,
      type,
      message: messageTemplate,
      sentAt: new Date().toISOString(),
      channel: 'whatsapp',
      status: 'sent'
    };

    db.notifications.push(notification);
    writeData(db);

    res.status(201).json({
      message: 'Notification logged successfully',
      notification,
      whatsappUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageTemplate)}`
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Server error processing notification' });
  }
});

// Fetch notification history for a customer
router.get('/history/:customerId', (req, res) => {
  try {
    const { id, role } = req.user;
    const targetCustomerId = req.params.customerId;

    const db = readData();

    // Verify auth scoping
    if (role === 'seller') {
      const customer = db.customers.find(c => c.id === targetCustomerId && c.sellerId === id);
      if (!customer) {
        return res.status(403).json({ error: 'Access denied to this customer history' });
      }
    } else if (role === 'customer') {
      if (targetCustomerId !== id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const history = db.notifications
      .filter(n => n.customerId === targetCustomerId)
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    res.json(history);
  } catch (error) {
    console.error('Fetch notification history error:', error);
    res.status(500).json({ error: 'Server error fetching notification logs' });
  }
});

export default router;
