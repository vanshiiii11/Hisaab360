import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

// API_BASE_URL reads from the VITE_API_BASE_URL environment variable.
// In production (Vercel), set this to your Render backend URL, e.g.:
//   VITE_API_BASE_URL=https://hisaab360-backend.onrender.com/api
// For local dev, .env.local sets it to http://localhost:3000/api automatically.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on application load
  useEffect(() => {
    const savedToken = localStorage.getItem('h360_token');
    const savedUser = localStorage.getItem('h360_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Seller login API call
  const loginSeller = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/seller/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setSession(data.token, data.user);
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  // Seller registration API call
  const registerSeller = async (name, email, password, currency, upiId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/seller/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, currency, upiId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSession(data.token, data.user);
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  // Update seller currency setting
  const updateSellerCurrency = async (currencyObj) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/seller/currency`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(currencyObj)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update currency preference');
      }

      const updatedUser = { ...user, currency: data.currency };
      setUser(updatedUser);
      localStorage.setItem('h360_user', JSON.stringify(updatedUser));
      return data.currency;
    } catch (error) {
      throw error;
    }
  };

  // Update seller UPI ID setting
  const updateSellerUPI = async (upiId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/seller/upi`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ upiId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update UPI VPA ID');
      }

      const updatedUser = { ...user, upiId: data.upiId };
      setUser(updatedUser);
      localStorage.setItem('h360_user', JSON.stringify(updatedUser));
      return data.upiId;
    } catch (error) {
      throw error;
    }
  };

  // Customer portal login API call
  const loginCustomer = async (sellerId, customerId, phone) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/customer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, customerId, phone })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Customer authentication failed');
      }

      setSession(data.token, data.user);
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  // Admin Login API call
  const loginAdmin = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Admin login failed');
      }

      setSession(data.token, data.user);
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('h360_token');
    localStorage.removeItem('h360_user');
    setToken(null);
    setUser(null);
  };

  const setSession = (jwtToken, userData) => {
    localStorage.setItem('h360_token', jwtToken);
    localStorage.setItem('h360_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
  };

  // Helper to attach authorization header
  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || localStorage.getItem('h360_token')}`
    };
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      loginSeller,
      registerSeller,
      loginAdmin,
      updateSellerCurrency,
      updateSellerUPI,
      loginCustomer,
      logout,
      getAuthHeaders,
      role: user?.role || null,
      currency: user?.currency || { symbol: '₹', code: 'INR', name: 'Indian Rupee (₹)' },
      upiId: user?.upiId || user?.sellerUpiId || ''
    }}>

      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => useContext(AuthContext);
