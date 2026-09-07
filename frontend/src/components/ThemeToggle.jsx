import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '', style = {} }) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      className={`btn btn-secondary btn-sm theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle Color Theme"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '8px',
        cursor: 'pointer',
        ...style
      }}
    >
      {isDark ? (
        <>
          <Sun size={15} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Light</span>
        </>
      ) : (
        <>
          <Moon size={15} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Dark</span>
        </>
      )}
    </button>
  );
}
