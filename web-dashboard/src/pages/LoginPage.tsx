interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '48px 40px',
        width: 400,
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>SalesEdge</h1>
        <p style={{
          color: '#64748b',
          fontSize: 15,
          marginBottom: 32,
        }}>Sales Command Center</p>

        <button
          onClick={onLogin}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: '#0a7ea4',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Sign In
        </button>

        <p style={{
          color: '#94a3b8',
          fontSize: 12,
          marginTop: 24,
        }}>
          Sign in with your Manus account to access your dashboard
        </p>
      </div>
    </div>
  );
}
