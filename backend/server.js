import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import customerRouter from './routes/customers.js';
import invoiceRouter from './routes/invoices.js';
import notificationRouter from './routes/notifications.js';
import analyticsRouter from './routes/analytics.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';
import { startReminderScheduler, runRemindersNow } from './scheduler.js';
import { reconcilePenalties } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend communication
// FRONTEND_URL is set in Render's environment variables to your Vercel domain.
// Falls back to localhost:5173 so local dev keeps working without any config.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// RAW body parser for Razorpay webhook — MUST come before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// JSON body parser for all other routes
app.use(express.json({ limit: '10mb' }));

// Log incoming requests for debugging ease
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Seed Initial Mock Data if DB is empty on launch
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_FILE = path.resolve('database.json');
if (!fs.existsSync(DB_FILE)) {
  console.log('Seeding initial demo database data...');
  const salt = bcrypt.genSaltSync(10);
  const hashedDemoPassword = bcrypt.hashSync('demo123', salt);
  
  // Dummy Seed State
  const initialData = {
    sellers: [
      {
        id: 'SLR360',
        name: 'Hisaab360 Wholesalers Ltd',
        email: 'seller@hisaab360.com',
        password: hashedDemoPassword,
        createdAt: new Date().toISOString()
      }
    ],
    customers: [
      {
        id: 'CUST-802',
        sellerId: 'SLR360',
        name: 'Gupta Kirana Store',
        email: 'gupta.store@email.com',
        phone: '9876543210',
        createdAt: new Date().toISOString()
      },
      {
        id: 'CUST-405',
        sellerId: 'SLR360',
        name: 'Sharma General Traders',
        email: 'sharma.traders@email.com',
        phone: '9123456789',
        createdAt: new Date().toISOString()
      },
      {
        id: 'CUST-119',
        sellerId: 'SLR360',
        name: 'Verma Supermarket',
        email: 'verma.super@email.com',
        phone: '9888877777',
        createdAt: new Date().toISOString()
      }
    ],
    invoices: [
      // 1. Pending (due in future)
      {
        id: 'INV-40192',
        customerId: 'CUST-802',
        sellerId: 'SLR360',
        amount: 2500.00,
        purchaseDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days in future
        penaltyRate: 2.0, // 2% per week
        penaltyAccrued: 0,
        status: 'pending',
        description: 'Rice and Flour bulk supply',
        paymentHistory: [],
        createdAt: new Date().toISOString()
      },
      // 2. Overdue (due 10 days ago, penalty accrued)
      {
        id: 'INV-18302',
        customerId: 'CUST-405',
        sellerId: 'SLR360',
        amount: 4000.00,
        purchaseDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 25 days ago
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days ago (overdue)
        penaltyRate: 2.5, // 2.5% per week
        penaltyAccrued: 0, // Will be computed dynamically
        status: 'overdue',
        description: 'Refined Oil bulk cartoons',
        paymentHistory: [
          {
            id: 'PAY-1109',
            amount: 1000.00,
            date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
            method: 'Cash'
          }
        ],
        createdAt: new Date().toISOString()
      },
      // 3. Paid
      {
        id: 'INV-88902',
        customerId: 'CUST-119',
        sellerId: 'SLR360',
        amount: 1500.00,
        purchaseDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        penaltyRate: 1.5,
        penaltyAccrued: 0,
        status: 'paid',
        description: 'Spices and Condiments shipment',
        paymentHistory: [
          {
            id: 'PAY-2291',
            amount: 1500.00,
            date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            method: 'Bank Transfer'
          }
        ],
        createdAt: new Date().toISOString()
      }
    ],
    notifications: []
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  console.log('Seeded database successfully with credentials:\nSeller Email: seller@hisaab360.com\nSeller Pass: demo123');
}

// Ensure default admin user is seeded in DB
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const dbData = JSON.parse(raw);
    if (!Array.isArray(dbData.admins)) {
      dbData.admins = [];
    }
    if (dbData.admins.length === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hashedAdminPassword = bcrypt.hashSync('admin123', salt);
      dbData.admins.push({
        id: 'ADM-001',
        name: 'Master Platform Admin',
        email: 'admin@hisaab360.com',
        password: hashedAdminPassword,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
      console.log('Seeded initial platform admin: admin@hisaab360.com / admin123');
    }
  }
} catch (e) {
  console.error('Error ensuring admin user exists:', e);
}

// Reconcile penalties on launch
reconcilePenalties();

// Register Routers
app.use('/api/auth', authRouter);
app.use('/api/customers', customerRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);


// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Manual trigger — fires the reminder sweep immediately (for testing)
// Usage: POST http://localhost:3000/api/reminders/run-now
app.post('/api/reminders/run-now', (req, res) => {
  try {
    runRemindersNow();
    res.json({ success: true, message: 'Reminder sweep triggered manually. Check server console for output.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start automated reminder scheduler (daily at 9 AM IST)
startReminderScheduler();

app.listen(PORT, () => {
  console.log(`Hisaab360 backend API server running on port ${PORT}`);
});
