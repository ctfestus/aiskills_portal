'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Trophy, CalendarDays, FileText, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';

interface Notification {
  id: string;
  form_id: string | null;
  type: 'response' | 'registration' | 'course_pass' | 'course_fail';
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

function typeIcon(type: Notification['type']) {
  switch (type) {
    case 'course_pass':   return <Trophy className="w-4 h-4 text-amber-400" />;
    case 'course_fail':   return <Trophy className="w-4 h-4 text-zinc-500" />;
    case 'registration':  return <CalendarDays className="w-4 h-4 text-blue-400" />;
    default:              return <FileText className="w-4 h-4 text-emerald-400" />;
  }
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  const [open, setOpen]     = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const unread = notifs.filter(n => !n.read).length;

  // ── Load user + initial notifications ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setUserId(session.user.id);
      fetchNotifs(session.user.id);
    });
  }, []);

  const fetchNotifs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotifs(data as Notification[]);
  }, []);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifs(prev => [payload.new as Notification, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Mark all read when opening ──
  const handleOpen = useCallback(async () => {
    setOpen(true);
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);
  }, [notifs]);

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const bg     = isDark ? 'bg-zinc-900 border-zinc-800'   : 'bg-white border-zinc-200';
  const itemBg = isDark ? 'hover:bg-zinc-800/60'           : 'hover:bg-zinc-50';
  const unreadBg = isDark ? 'bg-zinc-800/80'               : 'bg-blue-50';
  const textPrimary   = isDark ? 'text-white'   : 'text-zinc-900';
  const textSecondary = isDark ? 'text-zinc-400' : 'text-zinc-500';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={open ? () => setOpen(false) : handleOpen}
        className={`relative p-2 rounded-xl transition-colors ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-2xl shadow-black/30 z-50 overflow-hidden ${bg}`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
            <span className={`text-sm font-semibold ${textPrimary}`}>Notifications</span>
            <div className="flex items-center gap-2">
              {notifs.some(n => n.read === false) && (
                <button
                  onClick={async () => {
                    const ids = notifs.map(n => n.id);
                    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
                    await supabase.from('notifications').update({ read: true }).in('id', ids);
                  }}
                  className={`flex items-center gap-1 text-[11px] ${textSecondary} hover:text-blue-400 transition-colors`}
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className={`${textSecondary} hover:text-red-400 transition-colors`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className={`py-12 text-center ${textSecondary}`}>
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => (
                <Link
                  key={n.id}
                  href={n.form_id ? `/dashboard/${n.form_id}?tab=responses` : '/dashboard'}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3.5 transition-colors cursor-pointer ${itemBg} ${!n.read ? unreadBg : ''}`}
                >
                  <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center bg-zinc-800/50">
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${textPrimary}`}>{n.title}</p>
                    {n.body && <p className={`text-xs mt-0.5 truncate ${textSecondary}`}>{n.body}</p>}
                    <p className={`text-[11px] mt-1 ${textSecondary}`}>{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
