import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import SellerDashboard from './pages/SellerDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';

// Route guard for Sellers
function SellerRoute({ children }) {
  const { user, loading, role } = useAuth();
  
  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '100px' }}>Loading Portal...</div>;
  }
  
  if (!user || role !== 'seller') {
    return <Navigate to="/auth?role=seller" replace />;
  }
  
  return children;
}

// Route guard for Customers
function CustomerRoute({ children }) {
  const { user, loading, role } = useAuth();
  
  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '100px' }}>Loading Portal...</div>;
  }
  
  if (!user || role !== 'customer') {
    return <Navigate to="/auth?role=customer" replace />;
  }
  
  return children;
}

// Route guard for Platform Admin
function AdminRoute({ children }) {
  const { user, loading, role } = useAuth();

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '100px' }}>Verifying Admin Credentials...</div>;
  }

  if (!user || role !== 'admin') {
    return <Navigate to="/auth?role=admin" replace />;
  }

  return children;
}


export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected Seller Console */}
            <Route 
              path="/seller" 
              element={
                <SellerRoute>
                  <SellerDashboard />
                </SellerRoute>
              } 
            />

            {/* Protected Customer Statement Portal */}
            <Route 
              path="/customer" 
              element={
                <CustomerRoute>
                  <CustomerDashboard />
                </CustomerRoute>
              } 
            />

            {/* Protected Platform Admin Console */}
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />

            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

