import { useState } from 'react';
import { trpc } from '../lib/trpc';

interface BrokerForm {
  name: string;
  company: string;
  email: string;
  phone: string;
}

const emptyForm: BrokerForm = { name: '', company: '', email: '', phone: '' };

export default function BrokersPage() {
  const utils = trpc.useUtils();
  const { data: brokers, isLoading } = trpc.brokers.list.useQuery();
  const createMut = trpc.brokers.create.useMutation({ onSuccess: () => utils.brokers.list.invalidate() });
  const deleteMut = trpc.brokers.delete.useMutation({ onSuccess: () => utils.brokers.list.invalidate() });
  const addNoteMut = trpc.brokers.addNote.useMutation({ onSuccess: () => utils.brokers.list.invalidate() });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BrokerForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [search, setSearch] = useState('');

  const filtered = brokers?.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.company || '').toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCreate = async () => {
    await createMut.mutateAsync({
      name: form.name,
      company: form.company || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
    });
    setShowForm(false);
    setForm(emptyForm);
  };

  const handleAddNote = async (brokerId: number) => {
    if (!noteText.trim()) return;
    await addNoteMut.mutateAsync({ brokerId, content: noteText.trim() });
    setNoteText('');
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this broker?')) {
      await deleteMut.mutateAsync({ id });
    }
  };

  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading brokers...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Brokers</h1>
        <button onClick={() => { setForm(emptyForm); setShowForm(true); }} style={{
          padding: '10px 20px', background: 'var(--color-primary)', color: '#fff',
          borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
        }}>+ New Broker</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brokers..."
          style={{
            width: '100%', maxWidth: 400, padding: '10px 16px', borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)', fontSize: 14,
          }} />
      </div>

      {/* Broker Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', padding: 20 }}>No brokers found</p>
        ) : filtered.map(broker => {
          const isExpanded = expandedId === broker.id;
          return (
            <div key={broker.id} style={{
              background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)', overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{broker.name}</h3>
                    {broker.company && <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>{broker.company}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : broker.id)} style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 6,
                      background: 'var(--color-background)', border: '1px solid var(--color-border)',
                    }}>{isExpanded ? 'Collapse' : 'Notes'}</button>
                    <button onClick={() => handleDelete(broker.id)} style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 6,
                      background: '#fef2f2', color: 'var(--color-error)', border: '1px solid #fecaca',
                    }}>Delete</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}>
                  {broker.email && <span>{broker.email}</span>}
                  {broker.phone && <span>{broker.phone}</span>}
                </div>
              </div>

              {/* Notes Section */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px', background: 'var(--color-background)' }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Conversation Notes</h4>
                  {broker.notes && broker.notes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {broker.notes.map((note: any) => (
                        <div key={note.id} style={{
                          padding: '8px 12px', background: 'var(--color-surface)',
                          borderRadius: 'var(--radius)', fontSize: 13,
                        }}>
                          <p>{note.content}</p>
                          <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                            {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 12 }}>No notes yet</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={noteText} onChange={e => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      onKeyDown={e => { if (e.key === 'Enter') handleAddNote(broker.id); }}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)',
                        border: '1px solid var(--color-border)', fontSize: 13,
                      }} />
                    <button onClick={() => handleAddNote(broker.id)} style={{
                      padding: '8px 16px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600,
                      background: 'var(--color-primary)', color: '#fff',
                    }}>Add</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Broker Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setShowForm(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, width: 440,
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>New Broker</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Brokerage Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Company</label>
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} type="tel" style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                  }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14,
                border: '1px solid var(--color-border)', color: 'var(--color-foreground)',
              }}>Cancel</button>
              <button onClick={handleCreate} disabled={!form.name} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff',
                opacity: !form.name ? 0.5 : 1,
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
