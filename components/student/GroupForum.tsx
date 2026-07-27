'use client';

// Group-members-only discussion forum for a group assignment: threaded topics + replies. Talks only
// to /api/assignments/group-forum (DB-derived ancestry auth + RLS behind it). Replies post
// optimistically; polling is adaptive (fast while a thread is open and the tab is visible, slow when
// idle, paused when hidden or offline) and uses an (updatedAt,id) cursor so edits and deletions of
// posts already on screen are reflected, not just new ones.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Plus, Send, Loader2, ChevronLeft, Trash2, Pencil, AlertCircle, RefreshCw, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C } from '@/lib/theme';

interface Thread { id: string; title: string; authorId: string | null; authorName?: string | null; createdAt: string; lastPostAt: string; replyCount: number; }
interface Post { id: string; threadId?: string; authorId: string | null; authorName: string | null; body: string | null; createdAt: string; updatedAt: string; deleted: boolean; edited: boolean; _optimistic?: boolean; _failed?: boolean; }

const POLL_ACTIVE = 3000;
const POLL_IDLE = 15000;
const IDLE_AFTER = 60000; // no interaction for 1 min -> idle cadence

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Render plain-text with clickable URLs. Text goes through React (escaped); only whole URL tokens
// become anchors, so there is no HTML injection surface.
function Linkified({ text, C }: { text: string; C: typeof LIGHT_C }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p)
          ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: C.green, wordBreak: 'break-word' }}>{p}</a>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function GroupForum({ assignmentId, groupId, userId, C }: { assignmentId: string; groupId: string; userId: string; C: typeof LIGHT_C }) {
  const [view, setView] = useState<'list' | 'thread'>('list');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsCursor, setThreadsCursor] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const [openThread, setOpenThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [hasMoreEarlier, setHasMoreEarlier] = useState(false);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const pollCursor = useRef<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [online, setOnline] = useState(true);

  const lastActivity = useRef<number>(Date.now());
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const mounted = useRef(true);
  // Set true on (re)mount, not just once: React StrictMode (dev) mounts -> unmounts -> remounts, and
  // without re-setting here the ref would stay false after that first unmount, so every post-await
  // setState (loading off, etc.) gets skipped and the UI hangs on "Loading...".
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const touch = () => { lastActivity.current = Date.now(); };

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/assignments/group-forum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json?.error || 'Request failed'), { status: res.status });
    return json;
  }, []);

  // ---- thread list ----
  const loadThreads = useCallback(async (cursor?: string | null) => {
    try {
      if (!cursor) setLoadingList(true);
      const json = await call({ action: 'listThreads', assignmentId, groupId, cursor: cursor ?? undefined });
      if (!mounted.current) return;
      setThreads(prev => cursor ? [...prev, ...json.threads] : json.threads);
      setThreadsCursor(json.nextCursor ?? null);
      setListError('');
    } catch (e: any) {
      if (mounted.current) setListError(e?.message || 'Could not load the discussion.');
    } finally {
      if (mounted.current) setLoadingList(false);
    }
  }, [assignmentId, groupId, call]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Refresh the list quietly (used by polling + after mutations) without the loading state.
  const refreshList = useCallback(async () => {
    try {
      const json = await call({ action: 'listThreads', assignmentId, groupId });
      if (mounted.current) { setThreads(json.threads); setThreadsCursor(json.nextCursor ?? null); }
    } catch { /* keep the current list on a transient error */ }
  }, [assignmentId, groupId, call]);

  // ---- one thread ----
  const openThreadById = useCallback(async (t: Thread) => {
    touch();
    setOpenThread(t); setView('thread'); setPosts([]); setThreadError(''); setActionError('');
    setLoadingThread(true); setEditingId(null); setReply('');
    pollCursor.current = null;
    try {
      const json = await call({ action: 'listPosts', threadId: t.id, mode: 'initial' });
      if (!mounted.current) return;
      setPosts(json.posts); setHasMoreEarlier(!!json.hasMoreEarlier); setOlderCursor(json.olderCursor ?? null);
      pollCursor.current = json.pollCursor ?? null;
    } catch (e: any) {
      if (mounted.current) setThreadError(e?.message || 'Could not load this topic.');
    } finally {
      if (mounted.current) setLoadingThread(false);
    }
  }, [call]);

  useEffect(() => { if (view === 'thread' && !loadingThread) headingRef.current?.focus(); }, [view, loadingThread]);
  useEffect(() => { if (view === 'list') listHeadingRef.current?.focus(); }, [view]);

  const loadEarlier = useCallback(async () => {
    if (!openThread || !olderCursor) return;
    touch();
    try {
      const json = await call({ action: 'listPosts', threadId: openThread.id, mode: 'earlier', cursor: olderCursor });
      if (!mounted.current) return;
      setPosts(prev => [...json.posts, ...prev]);
      setHasMoreEarlier(!!json.hasMoreEarlier); setOlderCursor(json.olderCursor ?? null);
    } catch { /* leave as-is */ }
  }, [openThread, olderCursor, call]);

  // Merge polled posts (new + edited + deleted) into the current list by id.
  const pollThread = useCallback(async () => {
    if (!openThread) return;
    try {
      const json = await call({ action: 'listPosts', threadId: openThread.id, mode: 'poll', cursor: pollCursor.current ?? undefined });
      if (!mounted.current || !json.posts?.length) { if (json?.pollCursor) pollCursor.current = json.pollCursor; return; }
      setPosts(prev => {
        const byId = new Map(prev.map(p => [p.id, p]));
        for (const p of json.posts as Post[]) byId.set(p.id, p);
        return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      });
      pollCursor.current = json.pollCursor ?? pollCursor.current;
    } catch { /* transient */ }
  }, [openThread, call]);

  // ---- adaptive polling ----
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') touch(); };
    const onOnline = () => setOnline(navigator.onLine);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOnline);
    setOnline(navigator.onLine);
    let timer: any;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        if (view === 'thread') await pollThread(); else await refreshList();
      }
      const idle = Date.now() - lastActivity.current > IDLE_AFTER || document.visibilityState !== 'visible';
      timer = setTimeout(tick, idle ? POLL_IDLE : POLL_ACTIVE);
    };
    timer = setTimeout(tick, POLL_ACTIVE);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); };
  }, [view, pollThread, refreshList]);

  // ---- mutations ----
  async function createTopic() {
    const title = newTitle.trim(); const body = newBody.trim();
    if (!title || !body || busy) return;
    touch(); setBusy(true); setActionError('');
    try {
      const json = await call({ action: 'createThread', assignmentId, groupId, title, body });
      if (!mounted.current) return;
      setComposing(false); setNewTitle(''); setNewBody('');
      setThreads(prev => [{ ...json.thread }, ...prev]);
      await openThreadById(json.thread);
    } catch (e: any) {
      if (mounted.current) setActionError(e?.message || 'Could not create the topic.');
    } finally { if (mounted.current) setBusy(false); }
  }

  async function sendReply() {
    const body = reply.trim();
    if (!body || !openThread || busy) return;
    touch();
    const tempId = `temp-${Date.now()}`;
    const optimistic: Post = { id: tempId, authorId: userId, authorName: 'You', body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deleted: false, edited: false, _optimistic: true };
    setPosts(prev => [...prev, optimistic]); setReply(''); setActionError('');
    try {
      const json = await call({ action: 'createPost', threadId: openThread.id, body });
      if (!mounted.current) return;
      setPosts(prev => prev.map(p => p.id === tempId ? json.post : p));
      // Do NOT advance pollCursor here. If another member edited or deleted a post since the last
      // poll, that change carries an earlier timestamp; the next poll (cursor unchanged) fetches both
      // this new reply and that intervening change, and merges them by id.
    } catch (e: any) {
      if (!mounted.current) return;
      setPosts(prev => prev.map(p => p.id === tempId ? { ...p, _failed: true } : p)); // keep it, flagged, so the text is not lost
      setActionError(e?.message || 'Your reply did not send. Tap retry.');
    }
  }

  async function retryFailed(p: Post) {
    if (!openThread || !p.body) return;
    setPosts(prev => prev.filter(x => x.id !== p.id));
    setReply(p.body);
  }

  async function saveEdit(p: Post) {
    const body = editDraft.trim();
    if (!body) return;
    touch(); setBusy(true); setActionError('');
    try {
      const json = await call({ action: 'editPost', postId: p.id, body, expectedUpdatedAt: p.updatedAt });
      if (!mounted.current) return;
      setPosts(prev => prev.map(x => x.id === p.id ? json.post : x));
      setEditingId(null); setEditDraft('');
    } catch (e: any) {
      if (!mounted.current) return;
      if (e?.status === 409 && openThread) { setActionError('That post changed - reloading.'); await openThreadById(openThread); }
      else setActionError(e?.message || 'Could not save your edit.');
    } finally { if (mounted.current) setBusy(false); }
  }

  async function removePost(p: Post) {
    touch(); setActionError('');
    const prev = posts;
    setPosts(cur => cur.map(x => x.id === p.id ? { ...x, deleted: true, body: null } : x)); // optimistic
    try {
      await call({ action: 'deletePost', postId: p.id, expectedUpdatedAt: p.updatedAt });
    } catch (e: any) {
      if (!mounted.current) return;
      setPosts(prev); // rollback
      if (e?.status === 409 && openThread) { setActionError('That post changed - reloading.'); await openThreadById(openThread); }
      else setActionError(e?.message || 'Could not delete the post.');
    }
  }

  async function removeTopic() {
    if (!openThread) return;
    if (!window.confirm('Delete this topic? This only works while no one else has replied.')) return;
    touch(); setBusy(true); setActionError('');
    try {
      await call({ action: 'deleteThread', threadId: openThread.id });
      if (!mounted.current) return;
      setView('list'); setOpenThread(null);
      await refreshList();
    } catch (e: any) {
      if (mounted.current) setActionError(e?.message || 'Could not delete the topic.');
    } finally { if (mounted.current) setBusy(false); }
  }

  const inputStyle = useMemo(() => ({ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.input, color: C.text, fontSize: 14, outline: 'none', border: `1px solid ${C.divider}` } as const), [C]);

  // ============================ render ============================
  if (view === 'thread' && openThread) {
    return (
      <div className="pt-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={() => { setView('list'); setOpenThread(null); }} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>
            <ChevronLeft className="w-4 h-4"/> All topics
          </button>
          {openThread.authorId === userId && (
            <button onClick={removeTopic} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}>
              <Trash2 className="w-3.5 h-3.5"/> Delete topic
            </button>
          )}
        </div>
        <h3 ref={headingRef} tabIndex={-1} className="text-base font-bold mb-1 outline-none" style={{ color: C.text }}>{openThread.title}</h3>
        <p className="text-[11px] mb-4" style={{ color: C.faint }}>Started by {openThread.authorName || 'a member'}</p>

        {loadingThread ? (
          <div className="flex items-center gap-2 text-sm py-6" style={{ color: C.muted }}><Loader2 className="w-4 h-4 animate-spin"/> Loading...</div>
        ) : threadError ? (
          <div className="flex items-center gap-2 text-sm py-4" style={{ color: '#ef4444' }}>
            <AlertCircle className="w-4 h-4"/> {threadError}
            <button onClick={() => openThreadById(openThread)} className="inline-flex items-center gap-1 ml-2" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer' }}><RefreshCw className="w-3.5 h-3.5"/> Retry</button>
          </div>
        ) : (
          <>
            {hasMoreEarlier && (
              <button onClick={loadEarlier} className="text-xs font-medium mb-3" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', padding: 0 }}>Load earlier replies</button>
            )}
            <div className="flex flex-col gap-3 mb-4">
              {posts.map(p => {
                const mine = p.authorId === userId;
                if (p.deleted) return <div key={p.id} className="text-xs italic px-3 py-2 rounded-lg" style={{ background: C.thumbBg, color: C.faint }}>message deleted</div>;
                if (editingId === p.id) return (
                  <div key={p.id} className="flex flex-col gap-2">
                    <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} rows={3} style={inputStyle}/>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(p)} disabled={busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}><Check className="w-3.5 h-3.5"/> Save</button>
                      <button onClick={() => { setEditingId(null); setEditDraft(''); }} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: C.pill, color: C.muted, border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                );
                return (
                  <div key={p.id} className="rounded-xl px-3 py-2.5" style={{ background: mine ? `${C.green}0f` : C.pill, opacity: p._optimistic && !p._failed ? 0.6 : 1 }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[12px] font-semibold" style={{ color: C.text }}>{mine ? 'You' : (p.authorName || 'Former member')}</span>
                      <span className="text-[10px]" style={{ color: C.faint }}>{p._failed ? 'not sent' : timeAgo(p.createdAt)}{p.edited ? ' (edited)' : ''}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: C.text }}><Linkified text={p.body || ''} C={C}/></p>
                    {p._failed ? (
                      <button onClick={() => retryFailed(p)} className="text-[11px] font-semibold mt-1" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', padding: 0 }}>Retry</button>
                    ) : mine && !p._optimistic && (
                      <div className="flex gap-3 mt-1">
                        <button onClick={() => { setEditingId(p.id); setEditDraft(p.body || ''); }} className="text-[11px] inline-flex items-center gap-1" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: 0 }}><Pencil className="w-3 h-3"/> Edit</button>
                        <button onClick={() => removePost(p)} className="text-[11px] inline-flex items-center gap-1" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: 0 }}><Trash2 className="w-3 h-3"/> Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-end gap-2">
              <textarea value={reply} onChange={e => { setReply(e.target.value); touch(); }} placeholder="Write a reply..." rows={2} style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}/>
              <button onClick={sendReply} disabled={!reply.trim()} className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40" style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: reply.trim() ? 'pointer' : 'not-allowed' }}><Send className="w-4 h-4"/></button>
            </div>
            {!online && <p className="text-[11px] mt-2" style={{ color: C.faint }}>You are offline - replies will send when you reconnect.</p>}
            {actionError && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{actionError}</p>}
          </>
        )}
      </div>
    );
  }

  // list view
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 ref={listHeadingRef} tabIndex={-1} className="text-sm font-bold outline-none inline-flex items-center gap-1.5" style={{ color: C.text }}><MessageSquare className="w-4 h-4" style={{ color: C.green }}/> Discussion</h3>
        {!composing && (
          <button onClick={() => { setComposing(true); setActionError(''); }} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}><Plus className="w-3.5 h-3.5"/> New topic</button>
        )}
      </div>

      {composing && (
        <div className="rounded-xl p-3 mb-4 flex flex-col gap-2" style={{ background: C.pill }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Topic title" maxLength={200} style={inputStyle}/>
          <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Start the discussion..." rows={3} maxLength={4000} style={inputStyle}/>
          <div className="flex gap-2">
            <button onClick={createTopic} disabled={busy || !newTitle.trim() || !newBody.trim()} className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50" style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-3.5 h-3.5"/>} Post topic</button>
            <button onClick={() => { setComposing(false); setNewTitle(''); setNewBody(''); }} className="text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ background: C.card, color: C.muted, border: 'none', cursor: 'pointer' }}><X className="w-3.5 h-3.5"/> Cancel</button>
          </div>
          {actionError && <p className="text-xs" style={{ color: '#ef4444' }}>{actionError}</p>}
        </div>
      )}

      {loadingList ? (
        <div className="flex items-center gap-2 text-sm py-6" style={{ color: C.muted }}><Loader2 className="w-4 h-4 animate-spin"/> Loading discussion...</div>
      ) : listError ? (
        <div className="flex items-center gap-2 text-sm py-4" style={{ color: '#ef4444' }}>
          <AlertCircle className="w-4 h-4"/> {listError}
          <button onClick={() => loadThreads()} className="inline-flex items-center gap-1 ml-2" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer' }}><RefreshCw className="w-3.5 h-3.5"/> Retry</button>
        </div>
      ) : threads.length === 0 && !composing ? (
        <p className="text-sm rounded-lg px-3 py-4 text-center" style={{ background: C.thumbBg, color: C.muted }}>No topics yet. Start one to discuss the assignment with your group.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {threads.map(t => (
            <button key={t.id} onClick={() => openThreadById(t)} className="text-left rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80" style={{ background: C.pill, border: `1px solid ${C.divider}`, cursor: 'pointer' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate" style={{ color: C.text }}>{t.title}</span>
                <span className="text-[10px] flex-shrink-0" style={{ color: C.faint }}>{timeAgo(t.lastPostAt)}</span>
              </div>
              <span className="text-[11px]" style={{ color: C.faint }}>{t.authorName || 'a member'} - {t.replyCount} {t.replyCount === 1 ? 'reply' : 'replies'}</span>
            </button>
          ))}
          {threadsCursor && (
            <button onClick={() => loadThreads(threadsCursor)} className="text-xs font-medium mt-1" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', padding: 0 }}>Load more topics</button>
          )}
        </div>
      )}
    </div>
  );
}
