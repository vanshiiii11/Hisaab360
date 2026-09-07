import fs from 'fs';
import path from 'path';

// Define the file path for database storage
const DB_FILE = path.resolve('database.json');

// Initialize database template
const DEFAULT_DB = {
  sellers: [],
  customers: [],
  invoices: [],
  notifications: []
};

// Default Seller Currency & UPI configuration
export const DEFAULT_CURRENCY = {
  code: 'INR',
  symbol: '₹',
  name: 'Indian Rupee (₹)'
};

export const DEFAULT_UPI_ID = '';

// Helper to safely read file data
export function readData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeData(DEFAULT_DB);
      return DEFAULT_DB;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON database:', error);
    return DEFAULT_DB;
  }
}

// Helper to write file data atomically
export function writeData(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (error) {
    console.error('Error writing JSON database:', error);
    return false;
  }
}

// Re-calculate penalties dynamically for overdue invoices
export function reconcilePenalties() {
  const db = readData();
  const today = new Date();
  let modified = false;

  db.invoices = db.invoices.map(invoice => {
    if (invoice.status === 'paid') return invoice;

    const dueDate = new Date(invoice.dueDate);
    if (today > dueDate) {
      // Calculate delay in days
      const diffTime = Math.abs(today - dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Calculate penalty: e.g., 2% of original invoice amount per week overdue, or flat $5/day
      // Let's support both percentage and flat penalties: if rate is <= 1 (flat rate per day), else percentage.
      // Let's implement custom customizable logic: penaltyRate is percentage rate per week (e.g. 2 means 2% per week)
      let penalty = 0;
      if (invoice.penaltyRate > 0) {
        // Percentage penalty per week
        const weeksOverdue = Math.floor(diffDays / 7);
        if (weeksOverdue > 0) {
          penalty = (invoice.amount * (invoice.penaltyRate / 100)) * weeksOverdue;
        }
      }
      
      const newPenalty = Math.round(penalty * 100) / 100;
      if (invoice.penaltyAccrued !== newPenalty || invoice.status !== 'overdue') {
        invoice.penaltyAccrued = newPenalty;
        invoice.status = 'overdue';
        modified = true;
      }
    } else {
      if (invoice.status === 'overdue') {
        invoice.status = 'pending';
        invoice.penaltyAccrued = 0;
        modified = true;
      }
    }
    return invoice;
  });

  if (modified) {
    writeData(db);
  }
  return db;
}

// ID Generator helper functions
export function generateSellerId() {
  const db = readData();
  let unique = false;
  let id = '';
  while (!unique) {
    id = 'SLR' + Math.floor(100 + Math.random() * 900); // SLR100 - SLR999
    if (!db.sellers.some(s => s.id === id)) {
      unique = true;
    }
  }
  return id;
}

export function generateCustomerId() {
  const db = readData();
  let unique = false;
  let id = '';
  while (!unique) {
    id = 'CUST-' + Math.floor(1000 + Math.random() * 9000); // CUST-1000 - CUST-9999
    if (!db.customers.some(c => c.id === id)) {
      unique = true;
    }
  }
  return id;
}

export function generateInvoiceId() {
  const db = readData();
  let unique = false;
  let id = '';
  while (!unique) {
    id = 'INV-' + Math.floor(10000 + Math.random() * 90000); // INV-10000 - INV-99999
    if (!db.invoices.some(i => i.id === id)) {
      unique = true;
    }
  }
  return id;
}

export function generateNotificationId() {
  return 'NOTIF-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}
