import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, MapPin, Video, Bell, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface CalEvent {
  id: string; title: string; description: string | null; start_at: string; end_at: string;
  all_day: boolean; calendar_id: string | null; location: string | null; meet_link: string | null; status: string | null;
}
interface Reminder {
  id: string; title: string; status: string; metadata: any; created_at: string;
}

const B = '#4B9EFF';
const card = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: 'rgba(255,255,255,0.85)',
  padding: '8px 12px',
  fontSize: '13px',
  width: '100%',
  outline: 'none',
} as React.CSSProperties;

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: '6px',
  display: 'block',
};

function fmtTime(iso: string, allDay: boolean) {
  if (allDay) return 'All day';
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDate(iso: string) {
  const d = new Date(iso), now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (day.getTime() === today.getTime()) return 'Today';
  if (day.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function addHour(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface EventForm {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  description: string;
}

interface ReminderForm {
  title: string;
  dueDate: string;
  dueTime: string;
  notes: string;
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<'event' | 'reminder'>('event');
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const now = nowTimeStr();
  const [eventForm, setEventForm] = useState<EventForm>({
    title: '',
    date: todayStr(),
    startTime: now,
    endTime: addHour(now),
    allDay: false,
    location: '',
    description: '',
  });

  const [reminderForm, setReminderForm] = useState<ReminderForm>({
    title: '',
    dueDate: todayStr(),
    dueTime: now,
    notes: '',
  });

  const updateEvent = (k: keyof EventForm, v: any) => setEventForm(f => ({ ...f, [k]: v }));
  const updateReminder = (k: keyof ReminderForm, v: string) => setReminderForm(f => ({ ...f, [k]: v }));

  const saveEvent = async () => {
    if (!eventForm.title.trim()) { toast.error('Title is required'); return; }
    if (!eventForm.date) { toast.error('Date is required'); return; }
    setSaving(true);
    try {
      let start_at: string, end_at: string;
      if (eventForm.allDay) {
        start_at = new Date(eventForm.date + 'T00:00:00').toISOString();
        end_at   = new Date(eventForm.date + 'T23:59:59').toISOString();
      } else {
        start_at = new Date(eventForm.date + 'T' + eventForm.startTime + ':00').toISOString();
        end_at   = new Date(eventForm.date + 'T' + eventForm.endTime   + ':00').toISOString();
      }
      const { error } = await (supabase.from('calendar_events') as any).insert({
        title:       eventForm.title.trim(),
        start_at,
        end_at,
        all_day:     eventForm.allDay,
        location:    eventForm.location.trim() || null,
        description: eventForm.description.trim() || null,
        status:      'confirmed',
        calendar_id: 'manual',
      });
      if (error) throw error;
      toast.success('Event created');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const saveReminder = async () => {
    if (!reminderForm.title.trim()) { toast.error('Title is required'); return; }
    if (!reminderForm.dueDate || !reminderForm.dueTime) { toast.error('Due date and time are required'); return; }
    setSaving(true);
    try {
      const due = new Date(reminderForm.dueDate + 'T' + reminderForm.dueTime + ':00').toISOString();
      const { error } = await supabase.from('notifications').insert({
        title:    reminderForm.title.trim(),
        type:     'reminder',
        status:   'unread',
        priority: 'normal',
        metadata: { due, notes: reminderForm.notes.trim() || null },
      });
      if (error) throw error;
      toast.success('Reminder created');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save reminder');
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0',
      }}
    >
      <div
        style={{
          ...card,
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: '520px',
          padding: '24px 20px calc(32px + env(safe-area-inset-bottom))',
          animation: 'slideUp 0.25s ease',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>New</p>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px' }}>
          {(['event', 'reminder'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                transition: 'all 0.15s',
                background: tab === t ? B : 'transparent',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                boxShadow: tab === t ? `0 0 16px ${B}55` : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'event' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Title <span style={{ color: B }}>*</span></label>
              <input
                style={inputStyle}
                placeholder="Event title"
                value={eventForm.title}
                onChange={e => updateEvent('title', e.target.value)}
                autoFocus
              />
            </div>

            {/* Date */}
            <div>
              <label style={labelStyle}>Date <span style={{ color: B }}>*</span></label>
              <input
                type="date"
                style={inputStyle}
                value={eventForm.date}
                onChange={e => updateEvent('date', e.target.value)}
              />
            </div>

            {/* All-day toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>All day</label>
              <button
                onClick={() => updateEvent('allDay', !eventForm.allDay)}
                style={{
                  width: '42px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: eventForm.allDay ? B : 'rgba(255,255,255,0.12)',
                  position: 'relative', transition: 'background 0.2s',
                  boxShadow: eventForm.allDay ? `0 0 10px ${B}66` : 'none',
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: eventForm.allDay ? '21px' : '3px',
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Start / End time */}
            {!eventForm.allDay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Start time</label>
                  <input
                    type="time"
                    style={inputStyle}
                    value={eventForm.startTime}
                    onChange={e => updateEvent('startTime', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End time</label>
                  <input
                    type="time"
                    style={inputStyle}
                    value={eventForm.endTime}
                    onChange={e => updateEvent('endTime', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Location */}
            <div>
              <label style={labelStyle}>Location <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span></label>
              <input
                style={inputStyle}
                placeholder="Add location"
                value={eventForm.location}
                onChange={e => updateEvent('location', e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span></label>
              <textarea
                style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' as const, fontFamily: 'inherit' }}
                placeholder="Add description"
                value={eventForm.description}
                onChange={e => updateEvent('description', e.target.value)}
              />
            </div>

            {/* Save */}
            <button
              onClick={saveEvent}
              disabled={saving}
              style={{
                padding: '12px', borderRadius: '12px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? 'rgba(75,158,255,0.4)' : B,
                color: '#fff', fontSize: '13px', fontWeight: 600,
                boxShadow: saving ? 'none' : `0 0 20px ${B}55`,
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'Saving...' : 'Create Event'}
            </button>
          </div>
        )}

        {tab === 'reminder' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Title <span style={{ color: B }}>*</span></label>
              <input
                style={inputStyle}
                placeholder="Reminder title"
                value={reminderForm.title}
                onChange={e => updateReminder('title', e.target.value)}
                autoFocus
              />
            </div>

            {/* Due date + time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Due date <span style={{ color: B }}>*</span></label>
                <input
                  type="date"
                  style={inputStyle}
                  value={reminderForm.dueDate}
                  onChange={e => updateReminder('dueDate', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Due time <span style={{ color: B }}>*</span></label>
                <input
                  type="time"
                  style={inputStyle}
                  value={reminderForm.dueTime}
                  onChange={e => updateReminder('dueTime', e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span></label>
              <textarea
                style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' as const, fontFamily: 'inherit' }}
                placeholder="Add notes"
                value={reminderForm.notes}
                onChange={e => updateReminder('notes', e.target.value)}
              />
            </div>

            {/* Save */}
            <button
              onClick={saveReminder}
              disabled={saving}
              style={{
                padding: '12px', borderRadius: '12px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? 'rgba(75,158,255,0.4)' : B,
                color: '#fff', fontSize: '13px', fontWeight: 600,
                boxShadow: saving ? 'none' : `0 0 20px ${B}55`,
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'Saving...' : 'Create Reminder'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(0.5);
          cursor: pointer;
        }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        input:focus, textarea:focus {
          border-color: ${B}88 !important;
          box-shadow: 0 0 0 2px ${B}22;
        }
      `}</style>
    </div>
  );
}

export default function CalendarPage() {
  const [events, setEvents]       = useState<CalEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('cal_live2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchAll = async () => {
    const [evRes, remRes] = await Promise.all([
      (supabase.from('calendar_events') as any).select('*').gte('start_at', new Date(Date.now()-3600000).toISOString()).order('start_at', { ascending: true }).limit(20),
      supabase.from('notifications').select('*').eq('type', 'reminder').eq('status', 'unread').order('created_at', { ascending: true }),
    ]);
    if (evRes.data) setEvents(evRes.data as CalEvent[]);
    if (remRes.data) setReminders(remRes.data as Reminder[]);
    setLoading(false);
  };

  const grouped: Record<string, CalEvent[]> = {};
  events.forEach(ev => { const l = fmtDate(ev.start_at); if (!grouped[l]) grouped[l] = []; grouped[l].push(ev); });

  const pending = reminders.filter(r => { const d = r.metadata?.due; return d && new Date(d) > new Date(Date.now()-3600000); });

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        {pending.length > 0 && (
          <div style={card} className="overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Bell className="h-3.5 w-3.5" style={{ color: B }} />
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: B }}>
                Reminders ({pending.length})
              </p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {pending.map(r => {
                const due = r.metadata?.due ? new Date(r.metadata.due) : null;
                const overdue = due && due < new Date();
                return (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: B, boxShadow: `0 0 5px ${B}` }} />
                      <p className="text-sm text-white/80">{r.title}</p>
                    </div>
                    {due && (
                      <p className="text-[11px] shrink-0 ml-4" style={{ color: overdue ? 'var(--tc-40)' : B }}>
                        {overdue ? 'Overdue · ' : ''}{due.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {Object.keys(grouped).length === 0 ? (
          <div style={card} className="p-12 text-center">
            <Calendar className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}40` }} />
            <p className="text-sm text-white/20">No upcoming events</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dayLabel, dayEvents]) => (
            <div key={dayLabel} style={card} className="overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <p className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: dayLabel === 'Today' ? B : 'var(--tc-30)' }}>
                  {dayLabel}
                </p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {dayEvents.map(ev => {
                  const holiday = ev.calendar_id?.includes('holiday');
                  const isToday = dayLabel === 'Today';
                  return (
                    <div key={ev.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ background: holiday ? 'var(--tc-15)' : isToday ? B : 'var(--tc-20)', boxShadow: isToday && !holiday ? `0 0 5px ${B}` : 'none' }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: holiday ? 'var(--tc-30)' : 'var(--tc-85)' }}>{ev.title}</p>
                          {ev.description && <p className="text-[11px] text-white/30 mt-0.5 truncate">{ev.description}</p>}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <div className="flex items-center gap-1 text-[10px] text-white/25">
                              <Clock className="h-2.5 w-2.5" />
                              {ev.all_day ? 'All day' : `${fmtTime(ev.start_at, false)} – ${fmtTime(ev.end_at, false)}`}
                            </div>
                            {ev.location && (
                              <div className="flex items-center gap-1 text-[10px] text-white/25">
                                <MapPin className="h-2.5 w-2.5" />{ev.location}
                              </div>
                            )}
                            {ev.meet_link && (
                              <div className="flex items-center gap-1 text-[10px]" style={{ color: B }}>
                                <Video className="h-2.5 w-2.5" />Meet
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Bottom padding so FAB doesn't overlap last card (extra on mobile for bottom nav) */}
        <div className="h-24 md:h-20" />
      </div>

      {/* Floating Action Button — bottom-20 on mobile clears the 64px nav bar */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-6 md:bottom-6"
        style={{
          position: 'fixed',
          zIndex: 900,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: B,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 24px ${B}66, 0 0 0 1px ${B}44`,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        aria-label="Create event or reminder"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* Create modal */}
      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onSaved={fetchAll}
        />
      )}
    </>
  );
}
