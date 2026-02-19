import React, { useEffect, useState } from 'react';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard, Bell, AlertTriangle, ListTodo, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    fetchCounts();
    const channel = supabase
      .channel('mobile_nav_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCounts = async () => {
    const [notifRes, approvalRes] = await Promise.all([
      supabase.from('notifications').select('id', { count: 'exact' }).eq('status', 'unread'),
      supabase.from('email_queue').select('id', { count: 'exact' }).eq('status', 'awaiting_approval'),
    ]);
    setUnreadNotifs(notifRes.count || 0);
    setPendingApprovals(approvalRes.count || 0);
  };

  const Badge = ({ count }: { count: number }) => count > 0 ? (
    <span className="absolute -top-1 -right-1 bg-primary text-black font-mono text-[8px] rounded-full h-4 w-4 flex items-center justify-center leading-none">
      {count > 9 ? '9+' : count}
    </span>
  ) : null;

  const navItems = [
    { to: '/',            icon: <LayoutDashboard className="h-5 w-5" />, label: 'Home',      badge: 0 },
    { to: '/notifications', icon: <Bell className="h-5 w-5" />,          label: 'Alerts',    badge: unreadNotifs },
    { to: '/approvals',   icon: <AlertTriangle className="h-5 w-5" />,  label: 'Approvals', badge: pendingApprovals },
    { to: '/tasks',       icon: <ListTodo className="h-5 w-5" />,        label: 'Tasks',     badge: 0 },
    { to: '/calendar',    icon: <Calendar className="h-5 w-5" />,        label: 'Calendar',  badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-t border-border/50 sm:hidden">
      <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-muted-foreground transition-colors min-w-[56px]"
            activeClassName="text-primary"
          >
            <div className="relative">
              {item.icon}
              <Badge count={item.badge} />
            </div>
            <span className="font-mono text-[8px] uppercase tracking-wider">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
