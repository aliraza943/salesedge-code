import { useState } from 'react';
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

export default function SalesPage() {
  const utils = trpc.useUtils();
  const { data: rfps, isLoading: rfpsLoading } = trpc.rfps.list.useQuery();
  const { data: salesGoal, isLoading: goalLoading } = trpc.salesGoal.get.useQuery();
  const upsertGoal = trpc.salesGoal.upsert.useMutation({ onSuccess: () => utils.salesGoal.get.invalidate() });

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ goalAmount: '', currentSales: '', goalDeadline: '' });

  const soldRfps = rfps?.filter(r => r.status === 'sold') || [];

  const currentSales = parseFloat(salesGoal?.currentSales?.replace(/[^0-9.-]/g, '') || '0') || 0;
  const goalAmount = parseFloat(salesGoal?.goalAmount?.replace(/[^0-9.-]/g, '') || '0') || 0;
  const goalDeadline = salesGoal?.goalDeadline || new Date().toISOString().split('T')[0];
  const remaining = goalAmount - currentSales;
  const workdays = getWorkdaysRemaining(goalDeadline);
  const dailyTarget = remaining > 0 ? remaining / workdays : 0;
  const progress = goalAmount > 0 ? Math.min((currentSales / goalAmount) * 100, 100) : 0;

  const totalSoldPremium = soldRfps.reduce((sum, r) => {
    const v = parseFloat(r.premium?.replace(/[^0-9.-]/g, '') || '0');
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const openGoalForm = () => {
    setGoalForm({
      goalAmount: salesGoal?.goalAmount || '',
      currentSales: salesGoal?.currentSales || '',
      goalDeadline: salesGoal?.goalDeadline || '',
    });
    setShowGoalForm(true);
  };

  const handleSaveGoal = async () => {
    await upsertGoal.mutateAsync({
      goalAmount: goalForm.goalAmount,
      currentSales: goalForm.currentSales,
      goalDeadline: goalForm.goalDeadline,
    });
    setShowGoalForm(false);
  };

  const isLoading = rfpsLoading || goalLoading;
  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading sales...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Sales</h1>
        <button onClick={openGoalForm} style={{
          padding: '10px 20px', background: 'var(--color-primary)', color: '#fff',
          borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
        }}>Edit Goal</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Current Sales" value={formatCurrency(currentSales)} color="var(--color-success)" />
        <StatCard label="Goal" value={formatCurrency(goalAmount)} color="var(--color-primary)" />
        <StatCard label="Daily Target" value={formatCurrency(dailyTarget)} color="var(--color-warning)" />
        <StatCard label="Deals Closed" value={String(soldRfps.length)} color="var(--color-primary)" />
      </div>

      {/* Progress Bar */}
      <div style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        padding: 24, marginBottom: 24, border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Goal Progress</h2>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{progress.toFixed(1)}%</span>
        </div>
        <div style={{ height: 16, background: 'var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 8,
            background: progress >= 100 ? 'var(--color-success)' : 'linear-gradient(90deg, var(--color-primary), #0ea5e9)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}>
          <span>{formatCurrency(currentSales)} earned</span>
          <span>{formatCurrency(remaining)} remaining &middot; {workdays} workdays &middot; Deadline: {goalDeadline}</span>
        </div>
      </div>

      {/* Sold Deals Table */}
      <div style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Closed Deals ({soldRfps.length})</h2>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>Total premium: {formatCurrency(totalSoldPremium)}</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Case Name', 'Brokerage', 'Contact', 'Lives', 'Premium', 'Effective Date'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                  color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {soldRfps.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>No deals closed yet</td></tr>
            ) : soldRfps.map(rfp => (
              <tr key={rfp.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{rfp.title}</td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{rfp.clientName}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--color-muted)' }}>{rfp.brokerContact || '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{rfp.lives || '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(rfp.premium)}</td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{rfp.effectiveDate || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Goal Form Modal */}
      {showGoalForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setShowGoalForm(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, width: 440,
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Edit Sales Goal</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Goal Amount</label>
                <input value={goalForm.goalAmount} onChange={e => setGoalForm({ ...goalForm, goalAmount: e.target.value })} placeholder="$500,000" style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Current Sales</label>
                <input value={goalForm.currentSales} onChange={e => setGoalForm({ ...goalForm, currentSales: e.target.value })} placeholder="$125,000" style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Deadline</label>
                <input type="date" value={goalForm.goalDeadline} onChange={e => setGoalForm({ ...goalForm, goalDeadline: e.target.value })} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowGoalForm(false)} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14,
                border: '1px solid var(--color-border)', color: 'var(--color-foreground)',
              }}>Cancel</button>
              <button onClick={handleSaveGoal} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff',
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
      padding: '20px 24px', border: '1px solid var(--color-border)',
    }}>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
