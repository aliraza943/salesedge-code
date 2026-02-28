import { useState } from 'react';
import { trpc } from '../lib/trpc';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface EventForm {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
}

const emptyForm: EventForm = { title: '', date: '', startTime: '', endTime: '', notes: '' };

export default function CalendarPage() {
  const utils = trpc.useUtils();
  const { data: events, isLoading } = trpc.events.list.useQuery();
  const createMut = trpc.events.create.useMutation({ onSuccess: () => utils.events.list.invalidate() });
  const deleteMut = trpc.events.delete.useMutation({ onSuccess: () => utils.events.list.invalidate() });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const eventsForDate = (dateStr: string) => events?.filter(e => e.date === dateStr) || [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const openCreate = (date?: string) => {
    setForm({ ...emptyForm, date: date || today });
    setShowForm(true);
  };

  const handleSave = async () => {
    await createMut.mutateAsync({
      title: form.title,
      date: form.date,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      description: form.notes || undefined,
    });
    setShowForm(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this event?')) {
      await deleteMut.mutateAsync({ id });
    }
  };

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>Loading calendar...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Calendar</h1>
        <button onClick={() => openCreate()} style={{
          padding: '10px 20px', background: 'var(--color-primary)', color: '#fff',
          borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
        }}>+ New Event</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Calendar Grid */}
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 24, border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button onClick={prevMonth} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: 14 }}>&larr;</button>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: 14 }}>&rarr;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)' }}>{d}</div>
            ))}
            {days.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dateStr = getDateStr(day);
              const dayEvents = eventsForDate(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              return (
                <div key={dateStr} onClick={() => setSelectedDate(dateStr)} style={{
                  padding: '8px', minHeight: 60, borderRadius: 'var(--radius)',
                  cursor: 'pointer', position: 'relative',
                  background: isSelected ? 'rgba(10,126,164,0.08)' : isToday ? 'rgba(10,126,164,0.04)' : 'transparent',
                  border: isSelected ? '2px solid var(--color-primary)' : isToday ? '2px solid rgba(10,126,164,0.3)' : '1px solid var(--color-border)',
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--color-primary)' : 'var(--color-foreground)',
                  }}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {dayEvents.slice(0, 2).map(e => (
                        <div key={e.id} style={{
                          fontSize: 10, padding: '1px 4px', borderRadius: 3,
                          background: 'var(--color-primary)', color: '#fff',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 1,
                        }}>{e.title}</div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Events */}
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 24, border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>
              {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
            </h3>
            {selectedDate && (
              <button onClick={() => openCreate(selectedDate)} style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 6,
                background: 'var(--color-primary)', color: '#fff', fontWeight: 600,
              }}>+</button>
            )}
          </div>
          {!selectedDate ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>Click a date to view events</p>
          ) : selectedEvents.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>No events on this date</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedEvents.map(event => (
                <div key={event.id} style={{
                  padding: '12px', background: 'var(--color-background)',
                  borderRadius: 'var(--radius)', borderLeft: '3px solid var(--color-primary)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{event.title}</p>
                      {event.startTime && (
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                          {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                        </p>
                      )}
                      {event.description && (
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>{event.description}</p>
                      )}
                    </div>
                    <button onClick={() => handleDelete(event.id)} style={{
                      padding: '2px 8px', fontSize: 11, borderRadius: 4,
                      background: '#fef2f2', color: 'var(--color-error)', border: '1px solid #fecaca',
                    }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setShowForm(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, width: 440,
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>New Event</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Title <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Start Time</label>
                  <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>End Time</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14,
                  }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: 14, resize: 'vertical',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14,
                border: '1px solid var(--color-border)', color: 'var(--color-foreground)',
              }}>Cancel</button>
              <button onClick={handleSave} disabled={!form.title} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff',
                opacity: !form.title ? 0.5 : 1,
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
