import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !name)) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--color-surface)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '800', 
            color: 'var(--color-foreground)',
            marginBottom: '8px',
            letterSpacing: '-0.02em'
          }}>SalesEdge</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '16px' }}>
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            borderRadius: '12px',
            fontSize: '14px',
            marginBottom: '24px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isSignUp && (
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: 'var(--color-muted)',
                marginBottom: '8px',
                marginLeft: '4px'
              }}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-background)',
                  color: 'var(--color-foreground)',
                  padding: '0 16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'var(--color-muted)',
              marginBottom: '8px',
              marginLeft: '4px'
            }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-background)',
                color: 'var(--color-foreground)',
                padding: '0 16px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'var(--color-muted)',
              marginBottom: '8px',
              marginLeft: '4px'
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-background)',
                color: 'var(--color-foreground)',
                padding: '0 16px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '16px',
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              marginTop: '12px',
              transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span style={{ color: 'var(--color-primary)', fontWeight: '700' }}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
