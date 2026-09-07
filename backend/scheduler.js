/**
 * scheduler.js — Automated Daily WhatsApp Reminder Engine
 *
 * Runs once daily at 9:00 AM (configurable via REMINDER_CRON env var).
 * For every unpaid invoice across all sellers, it:
 *   1. Calculates how many days until / since the due date
 *   2. Picks the correct template (before_due / due_date / overdue)
 *   3. Logs the notification to database.json (same format as manual reminders)
 *   4. Generates the wa.me link (printed to console for audit trail)
 *   5. Skips invoices that already received the same reminder type TODAY
 *      (deduplication prevents spamming if server restarts during the day)
 */

import cron from 'node-cron';
import { readData, writeData, generateNotificationId } from './db.js';

// ── Config ────────────────────────────────────────────────────────────────────
const REMINDER_CRON = process.env.REMINDER_CRON || '0 9 * * *'; // Daily at 09:00
const BEFORE_DUE_DAYS_WINDOW = [7, 3, 1]; // Remind 7 days, 3 days, and 1 day before due

// ── Template Generator (mirrors the manual notification route logic) ───────────
function buildMessage({ type, customer, seller, invoice, outstanding, formattedDueDate }) {
  const portalLink = `http://localhost:5173/portal?seller=${seller.id}&cust=${customer.id}`;
  const sym = seller.currency?.symbol || '₹';

  if (type === 'before_due') {
    return `Dear ${customer.name}, this is a gentle reminder from ${seller.name} that your invoice #${invoice.id} of ${sym}${invoice.amount} is due on ${formattedDueDate}. Outstanding balance: ${sym}${outstanding}. Please clear it at your earliest convenience. Direct Link: ${portalLink}`;
  }
  if (type === 'due_date') {
    return `URGENT: Dear ${customer.name}, your payment of ${sym}${outstanding} for invoice #${invoice.id} to ${seller.name} is due TODAY (${formattedDueDate}). Please make the payment immediately to avoid late fees. Direct Link: ${portalLink}`;
  }
  if (type === 'overdue') {
    const penaltyText = invoice.penaltyAccrued > 0
      ? ` (includes accrued penalty of ${sym}${invoice.penaltyAccrued.toFixed(2)})`
      : '';
    return `ALERT: Dear ${customer.name}, invoice #${invoice.id} from ${seller.name} is OVERDUE since ${formattedDueDate}. The current outstanding balance is ${sym}${outstanding}${penaltyText}. Please clear this immediately to prevent further penalty charges. Pay here: ${portalLink}`;
  }
  return '';
}

// ── Deduplication check: has this exact type already been sent today? ─────────
function alreadySentToday(db, invoiceId, customerId, type) {
  const todayStr = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  return db.notifications.some(n =>
    n.invoiceId   === invoiceId &&
    n.customerId  === customerId &&
    n.type        === type &&
    n.sentAt.startsWith(todayStr) &&
    n.channel     === 'whatsapp' &&
    n.auto        === true        // only block auto-sent ones; manual can still be resent
  );
}

// ── Core reminder processing logic ────────────────────────────────────────────
function processReminders() {
  const db = readData();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to midnight for day comparison

  const todayStr = today.toISOString().split('T')[0];
  let totalSent = 0;
  let totalSkipped = 0;

  console.log(`\n🔔 [Scheduler] Running auto-reminder sweep — ${todayStr}`);

  for (const invoice of db.invoices) {
    // Skip already paid or pending verification invoices
    if (invoice.status === 'paid' || invoice.status === 'pending_verification') continue;

    const customer = db.customers.find(c => c.id === invoice.customerId);
    const seller   = db.sellers.find(s => s.id === invoice.sellerId);
    if (!customer || !seller) continue;

    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const diffMs   = dueDate - today;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)); // negative = overdue

    // Determine which template applies
    let reminderType = null;

    if (diffDays === 0) {
      reminderType = 'due_date';
    } else if (diffDays < 0) {
      reminderType = 'overdue';
    } else if (BEFORE_DUE_DAYS_WINDOW.includes(diffDays)) {
      reminderType = 'before_due';
    }

    if (!reminderType) continue; // Not a reminder day for this invoice

    // Deduplication — skip if already auto-sent this type today
    if (alreadySentToday(db, invoice.id, customer.id, reminderType)) {
      console.log(`  ⏭  Skipped (already sent today): Invoice ${invoice.id} → ${reminderType}`);
      totalSkipped++;
      continue;
    }

    // Build message
    const totalPaid   = invoice.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.round((invoice.amount + (invoice.penaltyAccrued || 0) - totalPaid) * 100) / 100;
    const formattedDueDate = dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const message = buildMessage({ type: reminderType, customer, seller, invoice, outstanding, formattedDueDate });
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // Log to DB — marked as auto: true for deduplication
    const notification = {
      id:         generateNotificationId(),
      customerId: customer.id,
      sellerId:   seller.id,
      invoiceId:  invoice.id,
      type:       reminderType,
      message,
      sentAt:     new Date().toISOString(),
      channel:    'whatsapp',
      status:     'auto_sent',
      auto:       true,           // flag: sent by scheduler, not manually
      whatsappUrl
    };

    db.notifications.push(notification);
    totalSent++;

    // Console audit trail (in production, you'd POST to WhatsApp Business API here)
    console.log(`  ✅ Auto-reminder [${reminderType.toUpperCase()}] → ${customer.name} (${customer.phone})`);
    console.log(`     Invoice: ${invoice.id} | Outstanding: ${seller.currency?.symbol || '₹'}${outstanding} | Due: ${formattedDueDate}`);
    console.log(`     WA Link: ${whatsappUrl}\n`);
  }

  // Persist all new notifications in a single write
  if (totalSent > 0) {
    writeData(db);
  }

  console.log(`🔔 [Scheduler] Sweep complete — Sent: ${totalSent} | Skipped (duplicate): ${totalSkipped}\n`);
}

// ── Register cron job ─────────────────────────────────────────────────────────
export function startReminderScheduler() {
  if (!cron.validate(REMINDER_CRON)) {
    console.error(`❌ [Scheduler] Invalid cron expression: "${REMINDER_CRON}". Scheduler NOT started.`);
    return;
  }

  cron.schedule(REMINDER_CRON, processReminders, {
    timezone: 'Asia/Kolkata'  // IST — change to your seller's timezone
  });

  console.log(`⏰ [Scheduler] Auto-reminder cron registered → "${REMINDER_CRON}" (Asia/Kolkata)`);
  console.log(`   Reminder windows: Due Day + ${BEFORE_DUE_DAYS_WINDOW.join('d / ')}d before + all overdue days`);
}

// ── Manual trigger (for testing without waiting for cron) ────────────────────
export { processReminders as runRemindersNow };
