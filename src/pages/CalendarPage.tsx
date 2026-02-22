import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, MapPin, Video, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  calendar_id: string | null;
  location: string | null;
  meet_link: string | null;
  status: string | null;
}

interface Reminder {
  id: string;
  title: string;
  status: string;
  metadata: any;
  created_at: string;
}

function formatTime(iso: string, allDay: boolean) {
  if (allDay) return 'All day';
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (eventDay.getTime() === today.getTime()) return 'Today';
  if (eventDay.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isHoliday(cal: string | null) {
  return cal?.includes('holiday') ?? false;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const ch1 = supabase.channel('cal_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch1); };
  }, []);

  const fetchAll = async () => {
    const now = new Date().toISOString();
    const [evRes, remRes] = await Promise.all([
      supabase.from('calendar_events')
        .select('*')
        .gte('start_at', new Date(Date.now() - 3600000).toISOString()) // include events starting up to 1h ago
        .order('start_at', { ascending: true })
        .limit(20),
      supabase.from('notifications')
        .select('*')
        .eq('type', 'reminder')
        .eq('status', 'unread')
        .order('created_at', { ascending: true }),
    ]);
    if (evRes.data) setEvents(evRes.data as CalEvent[]);
    if (remRes.data) setReminders(remRes.data as Reminder[]);
    setLoading(false);
  };

  // Group events by day label
  const grouped: Record<string, CalEvent[]> = {};
  events.forEach(ev => {
    const label = formatDate(ev.start_at);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(ev);
  });

  const pendingReminders = reminders.filter(r => {
    const due = r.metadata?.due;
    if (!due) return false;
    return new Date(due) > new Date(Date.now() - 3600000); // show if due within last hour or future
  });

  if (loading) return <div className="text-sm text-muted-foreground animate-pulse">Loading calendar...</div>;

  return (
    <div className="space-y-6">
      {/* Pending reminders */}
      {pendingReminders.length > 0 && (
        <div className="rounded-2xl bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-warning" />
            <p className="text-xs font-semibold text-warning uppercase tracking-wider">
              Reminders ({pendingReminders.length})
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {pendingReminders.map(r => {
              const due = r.metadata?.due ? new Date(r.metadata.due) : null;
              const overdue = due && due < new Date();
              return (
                <div key={r.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-2 w-2 rounded-full', overdue ? 'bg-destructive' : 'bg-warning')} />
                    <p className="text-sm text-card-foreground">{r.title}</p>
                  </div>
                  {due && (
                    <p className={cn('text-xs shrink-0 ml-4', overdue ? 'text-destructive' : 'text-warning')}>
                      {overdue ? 'Overdue · ' : ''}{due.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Events grouped by day */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center">
          <Calendar className="h-8 w-8 text-primary/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No upcoming events</p>
        </div>
      ) : (
        Object.entries(grouped).map(([dayLabel, dayEvents]) => (
          <div key={dayLabel} className="rounded-2xl bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className={cn(
                'text-xs font-semibold uppercase tracking-wider',
                dayLabel === 'Today' ? 'text-primary' : 'text-card-foreground/50'
              )}>
                {dayLabel}
              </p>
            </div>
            <div className="divide-y divide-white/5">
              {dayEvents.map(ev => {
                const holiday = isHoliday(ev.calendar_id);
                return (
                  <div key={ev.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          'h-2 w-2 rounded-full mt-1.5 shrink-0',
                          holiday ? 'bg-muted-foreground' : dayLabel === 'Today' ? 'bg-primary' : 'bg-card-foreground/40'
                        )} />
                        <div className="min-w-0">
                          <p className={cn('text-sm font-medium', holiday ? 'text-muted-foreground' : 'text-card-foreground')}>
                            {ev.title}
                          </p>
                          {ev.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {ev.all_day ? 'All day' : `${formatTime(ev.start_at, false)} – ${formatTime(ev.end_at, false)}`}
                            </div>
                            {ev.location && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5" />
                                {ev.location}
                              </div>
                            )}
                            {ev.meet_link && (
                              <div className="flex items-center gap-1 text-[10px] text-primary">
                                <Video className="h-2.5 w-2.5" />
                                Meet
                              </div>
                            )}
                          </div>
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
