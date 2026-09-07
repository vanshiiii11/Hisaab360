import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readData, writeData, generateSellerId, DEFAULT_CURRENCY, DEFAULT_UPI_ID } from '../db.js';
import { JWT_SECRET, authenticateToken, isSeller } from '../middleware/auth.js';

const router = express.Router();

// Seller Registration
router.post('/seller/register', async (req, res) => {
  try {
    const { name, email, password, currency, upiId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = readData();

    // Check if seller already exists
    if (db.sellers.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sellerId = generateSellerId();

    const newSeller = {
      id: sellerId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      currency: currency || DEFAULT_CURRENCY,
      upiId: upiId || DEFAULT_UPI_ID,
      createdAt: new Date().toISOString()
    };

    db.sellers.push(newSeller);
    writeData(db);

    const token = jwt.sign(
      { id: sellerId, email: newSeller.email, role: 'seller' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: sellerId,
        name: newSeller.name,
        email: newSeller.email,
        currency: newSeller.currency,
        upiId: newSeller.upiId,
        role: 'seller'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Seller Login
router.post('/seller/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = readData();
    const seller = db.sellers.find(s => s.email.toLowerCase() === email.toLowerCase());

    if (!seller) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Ensure currency & upiId exist on legacy accounts
    let updated = false;
    if (!seller.currency) {
      seller.currency = DEFAULT_CURRENCY;
      updated = true;
    }
    if (!seller.upiId) {
      seller.upiId = DEFAULT_UPI_ID;
      updated = true;
    }
    if (updated) {
      writeData(db);
    }

    const token = jwt.sign(
      { id: seller.id, email: seller.email, role: 'seller' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        currency: seller.currency,
        upiId: seller.upiId,
        role: 'seller'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Update Seller Preferred Currency
router.put('/seller/currency', authenticateToken, isSeller, (req, res) => {
  try {
    const { code, symbol, name } = req.body;
    const sellerId = req.user.id;

    if (!code || !symbol) {
      return res.status(400).json({ error: 'Currency code and symbol are required' });
    }

    const db = readData();
    const sellerIndex = db.sellers.findIndex(s => s.id === sellerId);

    if (sellerIndex === -1) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const updatedCurrency = { code, symbol, name: name || `${code} (${symbol})` };
    db.sellers[sellerIndex].currency = updatedCurrency;
    writeData(db);

    res.json({
      message: 'Currency preference updated successfully',
      currency: updatedCurrency,
      user: {
        id: db.sellers[sellerIndex].id,
        name: db.sellers[sellerIndex].name,
        email: db.sellers[sellerIndex].email,
        currency: updatedCurrency,
        upiId: db.sellers[sellerIndex].upiId || DEFAULT_UPI_ID,
        role: 'seller'
      }
    });
  } catch (error) {
    console.error('Update currency error:', error);
    res.status(500).json({ error: 'Server error updating seller currency' });
  }
});

// Update Seller UPI VPA ID
router.put('/seller/upi', authenticateToken, isSeller, (req, res) => {
  try {
    const { upiId } = req.body;
    const sellerId = req.user.id;

    if (!upiId) {
      return res.status(400).json({ error: 'UPI ID is required' });
    }

    const db = readData();
    const sellerIndex = db.sellers.findIndex(s => s.id === sellerId);

    if (sellerIndex === -1) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const cleanUpiId = upiId.trim();
    db.sellers[sellerIndex].upiId = cleanUpiId;
    writeData(db);

    res.json({
      message: 'UPI VPA updated successfully',
      upiId: cleanUpiId,
      user: {
        id: db.sellers[sellerIndex].id,
        name: db.sellers[sellerIndex].name,
        email: db.sellers[sellerIndex].email,
        currency: db.sellers[sellerIndex].currency || DEFAULT_CURRENCY,
        upiId: cleanUpiId,
        role: 'seller'
      }
    });
  } catch (error) {
    console.error('Update UPI error:', error);
    res.status(500).json({ error: 'Server error updating seller UPI ID' });
  }
});

// Customer Portal Login
router.post('/customer/login', async (req, res) => {
  try {
    const { sellerId, customerId, phone } = req.body;

    if (!sellerId || !customerId || !phone) {
      return res.status(400).json({ error: 'Seller ID, Customer ID, and Phone Number are required' });
    }

    const db = readData();
    
    // Find customer by ID, matching Seller ID and clean Phone format
    const customer = db.customers.find(c => 
      c.id.toUpperCase() === customerId.toUpperCase().trim() && 
      c.sellerId.toUpperCase() === sellerId.toUpperCase().trim()
    );

    if (!customer) {
      return res.status(400).json({ error: 'Customer record not found. Check Seller and Customer IDs.' });
    }

    // Verify phone number (simple clean matching)
    const cleanInputPhone = phone.replace(/\D/g, '');
    const cleanDbPhone = customer.phone.replace(/\D/g, '');

    if (cleanInputPhone !== cleanDbPhone) {
      return res.status(400).json({ error: 'Phone number does not match record' });
    }

    const seller = db.sellers.find(s => s.id === customer.sellerId);
    const sellerCurrency = seller?.currency || DEFAULT_CURRENCY;
    const sellerUpiId = seller?.upiId || DEFAULT_UPI_ID;

    const token = jwt.sign(
      { id: customer.id, sellerId: customer.sellerId, phone: customer.phone, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: customer.id,
        sellerId: customer.sellerId,
        sellerName: seller?.name || 'Seller',
        sellerCurrency,
        sellerUpiId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: 'customer'
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({ error: 'Server error during customer login' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Admin email and password are required' });
    }

    const db = readData();
    const admins = db.admins || [];
    const admin = admins.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!admin) {
      return res.status(400).json({ error: 'Invalid admin credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error during admin login' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Registration (Protected by setup key or open in local dev)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/register', async (req, res) => {
  try {
    const { name, email, password, adminKey } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Optional admin authorization key check (default: 'hisaab360admin' or open in dev)
    const requiredKey = process.env.ADMIN_REGISTRATION_KEY || 'hisaab360admin';
    if (adminKey && adminKey !== requiredKey) {
      return res.status(403).json({ error: 'Invalid admin setup key' });
    }

    const db = readData();
    if (!Array.isArray(db.admins)) {
      db.admins = [];
    }

    if (db.admins.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Admin email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = 'ADM-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    const newAdmin = {
      id: adminId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    db.admins.push(newAdmin);
    writeData(db);

    const token = jwt.sign(
      { id: adminId, email: newAdmin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: adminId,
        name: newAdmin.name,
        email: newAdmin.email,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Server error during admin registration' });
  }
});

export default router;

