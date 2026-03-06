import { NavLink, useLocation, Link } from 'react-router-dom';
import React from 'react';

interface User {
  name: string | null;
  email: string | null;
}

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/rfps', label: 'RFPs', icon: '📋' },
  { path: '/calendar', label: 'Calendar', icon: '📅' },
  { path: '/brokers', label: 'Brokers', icon: '🤝' },
  { path: '/sales', label: 'Sales', icon: '💰' },
  { path: '/chat', label: 'AI Chat', icon: '🤖' },
];

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        background: 'var(--color-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <h1 style={{
            color: '#fff',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}>SalesEdge</h1>
          <p style={{
            color: 'var(--color-sidebar-text)',
            fontSize: 12,
            marginTop: 4,
            opacity: 0.7,
          }}>Sales Command Center</p>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  marginBottom: 2,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : 'var(--color-sidebar-text)',
                  background: isActive ? 'var(--color-sidebar-active)' : 'transparent',
                  transition: 'all 0.15s ease',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Link 
            to="/profile" 
            style={{ 
              textDecoration: 'none', 
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              padding: '8px',
              borderRadius: 'var(--radius)',
              background: location.pathname === '/profile' ? 'var(--color-sidebar-active)' : 'transparent',
              transition: 'background 0.2s'
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                margin: 0
              }}>{user?.name || 'User'}</p>
              <p style={{
                color: 'var(--color-sidebar-text)',
                fontSize: 11,
                opacity: 0.7,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                margin: 0
              }}>{user?.email || ''}</p>
            </div>
          </Link>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 'var(--radius)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--color-sidebar-text)',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.15s ease',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--color-background)',
      }}>
        <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
