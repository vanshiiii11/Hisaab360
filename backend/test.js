import fs from 'fs';
import path from 'path';
import { readData, writeData, reconcilePenalties, generateSellerId, generateCustomerId, generateInvoiceId } from './db.js';

console.log('🧪 Starting Hisaab360 Backend Core Verification Tests...\n');

const DB_FILE = path.resolve('database.json');
let backupDB = null;

// Backup database.json if it exists to preserve user sandbox data
if (fs.existsSync(DB_FILE)) {
  backupDB = fs.readFileSync(DB_FILE, 'utf8');
}

try {
  // Test 1: ID Generation format & uniqueness
  console.log('Test 1: Verifying unique ID generation schemas...');
  const sellerId = generateSellerId();
  if (!sellerId.startsWith('SLR') || sellerId.length !== 6) {
    throw new Error(`Invalid Seller ID format generated: ${sellerId}`);
  }
  console.log('✓ Seller ID format is valid:', sellerId);

  const customerId = generateCustomerId();
  if (!customerId.startsWith('CUST-') || customerId.length !== 9) {
    throw new Error(`Invalid Customer ID format generated: ${customerId}`);
  }
  console.log('✓ Customer ID format is valid:', customerId);

  const invoiceId = generateInvoiceId();
  if (!invoiceId.startsWith('INV-') || invoiceId.length !== 9) {
    throw new Error(`Invalid Invoice ID format generated: ${invoiceId}`);
  }
  console.log('✓ Invoice ID format is valid:', invoiceId);

  // Test 2: Dynamic Penalty Reconciliation calculations
  console.log('\nTest 2: Verifying late payment penalty calculations...');
  
  // Set up dummy database state for testing
  const dummyState = {
    sellers: [{ id: 'SLR-TEST', name: 'Test Seller', email: 'test@email.com', password: 'hash' }],
    customers: [{ id: 'CUST-TEST', sellerId: 'SLR-TEST', name: 'Test Customer', phone: '123' }],
    invoices: [
      {
        id: 'INV-TEST-OVERDUE',
        customerId: 'CUST-TEST',
        sellerId: 'SLR-TEST',
        amount: 1000.00,
        purchaseDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 20 days ago
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days ago (overdue)
        penaltyRate: 5.0, // 5% per week
        penaltyAccrued: 0,
        status: 'pending',
        description: 'Test invoice',
        paymentHistory: []
      },
      {
        id: 'INV-TEST-PAID',
        customerId: 'CUST-TEST',
        sellerId: 'SLR-TEST',
        amount: 2000.00,
        purchaseDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        penaltyRate: 5.0,
        penaltyAccrued: 0,
        status: 'paid', // fully paid invoice should NOT accrue penalty
        description: 'Test paid invoice',
        paymentHistory: [{ id: 'PAY-1', amount: 2000, date: new Date().toISOString(), method: 'Cash' }]
      }
    ],
    notifications: []
  };

  writeData(dummyState);

  // Run the penalty reconciliation engine
  const updatedDb = reconcilePenalties();

  // Test overdue penalty
  const overdueInvoice = updatedDb.invoices.find(i => i.id === 'INV-TEST-OVERDUE');
  
  // Overdue by 10 days -> 1 full week -> 1 * 5% of $1000 = $50 penalty.
  if (overdueInvoice.status !== 'overdue') {
    throw new Error(`Expected overdue status, got: ${overdueInvoice.status}`);
  }
  if (overdueInvoice.penaltyAccrued !== 50.00) {
    throw new Error(`Expected accrued penalty to be $50.00, got: $${overdueInvoice.penaltyAccrued}`);
  }
  console.log('✓ Overdue invoice penalty correctly accrued:', overdueInvoice.penaltyAccrued);

  // Test paid invoice penalty
  const paidInvoice = updatedDb.invoices.find(i => i.id === 'INV-TEST-PAID');
  if (paidInvoice.penaltyAccrued !== 0.00) {
    throw new Error(`Expected paid invoice penalty to remain $0.00, got: $${paidInvoice.penaltyAccrued}`);
  }
  console.log('✓ Paid invoice did not accrue penalty, status remains paid.');

  console.log('\n🎉 ALL CORE LOGIC TESTS PASSED SUCCESSFULLY! Hisaab360 database layer is solid.');

} catch (error) {
  console.error('\n❌ VERIFICATION TEST FAILED:');
  console.error(error.message);
  process.exit(1);
} finally {
  // Restore original database.json if existed
  if (backupDB) {
    fs.writeFileSync(DB_FILE, backupDB, 'utf8');
  } else {
    try {
      fs.unlinkSync(DB_FILE);
    } catch (e) {}
  }
}
