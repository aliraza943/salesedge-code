import { trpc } from '../lib/trpc';

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : (value || 0);
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function getWorkdaysRemaining(deadline: string): number {
  const today = new Date();
  const end = new Date(deadline + 'T23:59:59');
  let count = 0;
  const d = new Date(today);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(count, 1);
}

export default function DashboardPage() {
  const { data: rfps, isLoading: rfpsLoading } = trpc.rfps.list.useQuery();
  const { data: events, isLoading: eventsLoading } = trpc.events.list.useQuery();
  const { data: salesGoal, isLoading: goalLoading } = trpc.salesGoal.get.useQuery();
  const { data: brokers } = trpc.brokers.list.useQuery();

  const today = new Date().toISOString().split('T')[0];
  const todayEvents = events?.filter(e => e.date === today) || [];
  const soldRfps = rfps?.filter(r => r.status === 'sold') || [];
  const activeRfps = rfps?.filter(r => r.status !== 'sold') || [];

  const currentSales = parseFloat(salesGoal?.currentSales?.replace(/[^0-9.-]/g, '') || '0') || 0;
  const goalAmount = parseFloat(salesGoal?.goalAmount?.replace(/[^0-9.-]/g, '') || '0') || 0;
  const goalDeadline = salesGoal?.goalDeadline || new Date().toISOString().split('T')[0];
  const remaining = goalAmount - currentSales;
  const workdays = getWorkdaysRemaining(goalDeadline);
  const dailyTarget = remaining > 0 ? remaining / workdays : 0;
  const progress = goalAmount > 0 ? Math.min((currentSales / goalAmount) * 100, 100) : 0;

  const pipelineValue = activeRfps.reduce((sum, r) => {
    const v = parseFloat(r.premium?.replace(/[^0-9.-]/g, '') || '0');
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const isLoading = rfpsLoading || eventsLoading || goalLoading;

  if (isLoading) {
    return <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading dashboard...</div>;
  }

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Current Sales" value={formatCurrency(currentSales)} color="var(--color-success)" />
        <StatCard label="Sales Goal" value={formatCurrency(goalAmount)} color="var(--color-primary)" />
        <StatCard label="Daily Target" value={formatCurrency(dailyTarget)} color="var(--color-warning)" />
        <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} color="var(--color-primary)" />
      </div>

      {/* Sales Goal Progress */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        marginBottom: 24,
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Sales Goal Progress</h2>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{progress.toFixed(1)}%</span>
        </div>
        <div style={{
          height: 12,
          background: 'var(--color-border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
            borderRadius: 6,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}>
          <span>{formatCurrency(currentSales)} earned</span>
          <span>{formatCurrency(remaining)} remaining &middot; {workdays} workdays left</span>
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Today's Schedule */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          border: '1px solid var(--color-border)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Today's Schedule</h2>
          {todayEvents.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>No events scheduled for today</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayEvents.map((event) => (
                <div key={event.id} style={{
                  padding: '10px 12px',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius)',
                  borderLeft: '3px solid var(--color-primary)',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{event.title}</p>
                  {event.startTime && (
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                      {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent RFPs */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          border: '1px solid var(--color-border)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Active RFPs</h2>
          {activeRfps.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>No active RFPs</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeRfps.slice(0, 5).map((rfp) => (
                <div key={rfp.id} style={{
                  padding: '10px 12px',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{rfp.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>{rfp.clientName}</p>
                  </div>
                  <StatusBadge status={rfp.status || 'draft'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
        <StatCard label="Active RFPs" value={String(activeRfps.length)} color="var(--color-primary)" />
        <StatCard label="Deals Sold" value={String(soldRfps.length)} color="var(--color-success)" />
        <StatCard label="Brokers" value={String(brokers?.length || 0)} color="var(--color-warning)" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px',
      border: '1px solid var(--color-border)',
    }}>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: '#f1f5f9', text: '#64748b' },
    recommended: { bg: '#dbeafe', text: '#2563eb' },
    sold: { bg: '#dcfce7', text: '#16a34a' },
  };
  const c = colors[status] || colors.draft;
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: c.bg,
      color: c.text,
      textTransform: 'capitalize',
    }}>{status}</span>
  );
}
