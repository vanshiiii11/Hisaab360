import React from 'react';
import { TrendingUp, Users, FileText, Settings } from 'lucide-react';

export default function MobileBottomNav({ activeTab, setActiveTab, onOpenSettings }) {
  return (
    <nav className="mobile-bottom-nav">
      <button 
        className={`mobile-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
        onClick={() => setActiveTab('analytics')}
      >
        <TrendingUp size={20} />
        <span>Analytics</span>
      </button>

      <button 
        className={`mobile-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
        onClick={() => setActiveTab('customers')}
      >
        <Users size={20} />
        <span>Customers</span>
      </button>

      <button 
        className={`mobile-nav-item ${activeTab === 'invoices' ? 'active' : ''}`}
        onClick={() => setActiveTab('invoices')}
      >
        <FileText size={20} />
        <span>Invoices</span>
      </button>

      <button 
        className="mobile-nav-item"
        onClick={onOpenSettings}
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
