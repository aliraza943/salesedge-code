import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/trpc/auth.deleteAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include'
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        alert('Failed to delete account');
        setIsDeleting(false);
      }
    } catch (err) {
      alert('An error occurred');
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: 'var(--color-foreground)' }}>
        Profile Settings
      </h2>

      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid var(--color-border)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '32px',
            fontWeight: '700'
          }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--color-foreground)' }}>{user.name}</h3>
            <p style={{ color: 'var(--color-muted)' }}>{user.email}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Account ID
            </label>
            <p style={{ color: 'var(--color-foreground)', fontSize: '14px', fontFamily: 'monospace' }}>{user.id}</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Member Since
            </label>
            <p style={{ color: 'var(--color-foreground)', fontSize: '14px' }}>
              {new Date(user.lastSignedIn).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid #fee2e2',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ef4444', marginBottom: '12px' }}>Danger Zone</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '24px' }}>
          Once you delete your account, there is no going back. Please be certain.
        </p>

        {showConfirm && (
          <div style={{
            padding: '16px',
            background: '#fff1f2',
            borderRadius: '12px',
            border: '1px solid #fecaca',
            marginBottom: '24px',
            fontSize: '14px',
            color: '#991b1b'
          }}>
            <strong>Are you absolutely sure?</strong> This will permanently delete your profile and all associated data including RFPs, deals, and history.
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Delete Account
            </button>
          ) : (
            <>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: isDeleting ? 0.7 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'var(--color-background)',
                  color: 'var(--color-foreground)',
                  border: '1px solid var(--color-border)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
