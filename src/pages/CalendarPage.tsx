import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, MapPin, Video, Bell } from 'lucide-react';

interface CalEvent {
  id: string; title: string; description: string | null; start_at: string; end_at: string;
  all_day: boolean; calendar_id: string | null; location: string | null; meet_link: string | null; status: string | null;
}
interface Reminder {
  id: string; title: string; status: string; metadata: any; created_at: string;
}

const B = '#4B9EFF';
const card = { background: 'var(--s-card)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--s-card-b)', borderRadius: '20px', boxShadow: 'var(--s-card-shadow)' } as React.CSSProperties;

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

export default function CalendarPage() {
  const [events, setEvents]       = useState<CalEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]     = useState(true);

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
      supabase.from('calendar_events').select('*').gte('start_at', new Date(Date.now()-3600000).toISOString()).order('start_at', { ascending: true }).limit(20),
      supabase.from('notifications').select('*').eq('type', 'reminder').eq('status', 'unread').order('created_at', { ascending: true }),
    ]);
    if (evRes.data) setEvents(evRes.data as CalEvent[]);
    if (remRes.data) setReminders(remRes.data as Reminder[]);
    setLoading(false);
  };

  const grouped: Record<string, CalEvent[]> = {};
  events.forEach(ev => { const l = fmtDate(ev.start_at); if (!grouped[l]) grouped[l] = []; grouped[l].push(ev); });

  const pending = reminders.filter(r => { const d = r.metadata?.due; return d && new Date(d) > new Date(Date.now()-3600000); });

  if (loading) return <div className="flex justify-center py-12"><div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} /></div>;

  return (
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
    </div>
  );
}
