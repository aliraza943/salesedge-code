import { useState } from 'react';
import { trpc } from '../lib/trpc';

function formatCurrency(value: string | null | undefined): string {
  if (!value) return '';
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

type RfpStatus = 'draft' | 'recommended' | 'sold';

interface RfpForm {
  title: string;
  clientName: string;
  brokerContact: string;
  lives: string;
  effectiveDate: string;
  premium: string;
  status: RfpStatus;
  notes: string;
  followUpDate: string;
}

const emptyForm: RfpForm = {
  title: '', clientName: '', brokerContact: '', lives: '',
  effectiveDate: '', premium: '', status: 'draft', notes: '', followUpDate: '',
};

export default function RfpsPage() {
  const utils = trpc.useUtils();
  const { data: rfps, isLoading } = trpc.rfps.list.useQuery();
  const createMut = trpc.rfps.create.useMutation({ onSuccess: () => utils.rfps.list.invalidate() });
  const updateMut = trpc.rfps.update.useMutation({ onSuccess: () => utils.rfps.list.invalidate() });
  const deleteMut = trpc.rfps.delete.useMutation({ onSuccess: () => utils.rfps.list.invalidate() });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RfpForm>(emptyForm);
  const [filter, setFilter] = useState<'all' | RfpStatus>('all');

  const filtered = rfps?.filter(r => filter === 'all' || r.status === filter) || [];

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (rfp: any) => {
    setForm({
      title: rfp.title || '', clientName: rfp.clientName || '',
      brokerContact: rfp.brokerContact || '', lives: String(rfp.lives || ''),
      effectiveDate: rfp.effectiveDate || '', premium: rfp.premium || '',
      status: rfp.status || 'draft', notes: rfp.notes || '',
      followUpDate: rfp.followUpDate || '',
    });
    setEditingId(rfp.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title, clientName: form.clientName,
      brokerContact: form.brokerContact || undefined,
      lives: form.lives ? parseInt(form.lives) : undefined,
      effectiveDate: form.effectiveDate || undefined,
      premium: form.premium || undefined,
      status: form.status as RfpStatus,
      notes: form.notes || undefined,
      followUpDate: form.followUpDate || undefined,
    };
    if (editingId) {
      await updateMut.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this RFP?')) {
      await deleteMut.mutateAsync({ id });
    }
  };

  const advanceStatus = async (id: number, current: string) => {
    const next: Record<string, RfpStatus> = { draft: 'recommended', recommended: 'sold' };
    const nextStatus = next[current];
    if (nextStatus) {
      await updateMut.mutateAsync({ id, status: nextStatus });
    }
  };

  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading RFPs...</div>;

  const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: '#f1f5f9', text: '#64748b' },
    recommended: { bg: '#dbeafe', text: '#2563eb' },
    sold: { bg: '#dcfce7', text: '#16a34a' },
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>RFPs</h1>
        <button onClick={openCreate} style={{
          padding: '10px 20px', background: 'var(--color-primary)', color: '#fff',
          borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
        }}>+ New RFP</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'draft', 'recommended', 'sold'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            background: filter === f ? 'var(--color-primary)' : 'var(--color-surface)',
            color: filter === f ? '#fff' : 'var(--color-muted)',
            border: filter === f ? 'none' : '1px solid var(--color-border)',
          }}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? rfps?.length || 0 : rfps?.filter(r => r.status === f).length || 0})</button>
        ))}
      </div>

      {/* RFP Table */}
      <div style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Case Name', 'Brokerage', 'Contact', 'Lives', 'Premium', 'Effective Date', 'Status', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                  color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>No RFPs found</td></tr>
            ) : filtered.map(rfp => {
              const sc = statusColors[rfp.status || 'draft'] || statusColors.draft;
              return (
                <tr key={rfp.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{rfp.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>{rfp.clientName}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--color-muted)' }}>{rfp.brokerContact || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>{rfp.lives || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{formatCurrency(rfp.premium)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>{rfp.effectiveDate || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: sc.bg, color: sc.text, textTransform: 'capitalize',
                    }}>{rfp.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(rfp)} style={{
                        padding: '4px 10px', fontSize: 12, borderRadius: 6,
                        background: 'var(--color-background)', border: '1px solid var(--color-border)',
                        color: 'var(--color-foreground)',
                      }}>Edit</button>
                      {rfp.status !== 'sold' && (
                        <button onClick={() => advanceStatus(rfp.id, rfp.status || 'draft')} style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 6,
                          background: 'var(--color-primary)', color: '#fff',
                        }}>{rfp.status === 'draft' ? 'Recommend' : 'Sold'}</button>
                      )}
                      <button onClick={() => handleDelete(rfp.id)} style={{
                        padding: '4px 10px', fontSize: 12, borderRadius: 6,
                        background: '#fef2f2', color: 'var(--color-error)', border: '1px solid #fecaca',
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setShowForm(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, width: 520,
            maxHeight: '90vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
              {editingId ? 'Edit RFP' : 'New RFP'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FormField label="Case Name" value={form.title} onChange={v => setForm({ ...form, title: v })} required />
              <FormField label="Brokerage" value={form.clientName} onChange={v => setForm({ ...form, clientName: v })} required />
              <FormField label="Broker Contact" value={form.brokerContact} onChange={v => setForm({ ...form, brokerContact: v })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label="Lives" value={form.lives} onChange={v => setForm({ ...form, lives: v })} type="number" />
                <FormField label="Premium" value={form.premium} onChange={v => setForm({ ...form, premium: v })} placeholder="$0" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label="Effective Date" value={form.effectiveDate} onChange={v => setForm({ ...form, effectiveDate: v })} type="date" />
                <FormField label="Follow-up Date" value={form.followUpDate} onChange={v => setForm({ ...form, followUpDate: v })} type="date" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as RfpStatus })} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)', fontSize: 14, background: '#fff',
                }}>
                  <option value="draft">Draft</option>
                  <option value="recommended">Recommended</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)', fontSize: 14, resize: 'vertical',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14,
                border: '1px solid var(--color-border)', color: 'var(--color-foreground)',
              }}>Cancel</button>
              <button onClick={handleSave} disabled={!form.title || !form.clientName} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff',
                opacity: (!form.title || !form.clientName) ? 0.5 : 1,
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--color-error)' }}> *</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)', fontSize: 14,
        }} />
    </div>
  );
}
