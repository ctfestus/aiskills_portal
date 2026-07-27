'use client';

// Lightweight, group-members-only chat for a group assignment: ONE conversation (no topics), styled
// as a messaging app - your messages on the right, everyone else's on the left with an avatar +
// name. Talks only to /api/assignments/group-forum (DB-derived ancestry auth + RLS behind it). The
// backend still models this as a single "thread" per group+assignment; students never see topics -
// the first message quietly starts the conversation, everyone after adds to it.
//
// Replies post optimistically; polling is adaptive (fast while the tab is visible, slow when idle,
// paused when hidden/offline) via an (updatedAt,id) cursor so edits and deletions of messages
// already on screen are reflected, not just new ones.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, Loader2, Trash2, Pencil, AlertCircle, RefreshCw, Check, BarChart2, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C } from '@/lib/theme';

interface PollData { question: string; options: string[]; counts: number[]; totalVotes: number; myVote: number | null; }
interface Thread { id: string; authorId: string | null; }
interface Post { id: string; authorId: string | null; authorName: string | null; body: string | null; kind?: 'text' | 'poll'; poll?: PollData | null; createdAt: string; updatedAt: string; deleted: boolean; edited: boolean; _optimistic?: boolean; _failed?: boolean; }

const POLL_ACTIVE = 3000;
const POLL_IDLE = 15000;
const IDLE_AFTER = 60000;       // no interaction for 1 min -> idle cadence
const GROUP_WINDOW = 5 * 60000; // consecutive messages from one author within 5 min group together
const POLL_MAX_OPTIONS = 6;     // keep in step with the route/DB cap
const THREAD_TITLE = 'Group discussion'; // internal container title; never shown to students

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Plain-text with clickable URLs. Text goes through React (escaped); only whole URL tokens become
// anchors, so there is no HTML-injection surface.
function Linkified({ text, C }: { text: string; C: typeof LIGHT_C }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return <>{parts.map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: C.green, wordBreak: 'break-word', textDecoration: 'underline' }}>{p}</a>
    : <span key={i}>{p}</span>)}</>;
}

function Avatar({ name, size = 30, C }: { name?: string | null; size?: number; C: typeof LIGHT_C }) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <div className="flex-shrink-0 flex items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: C.pill, color: C.muted }}>
      {initial}
    </div>
  );
}

// A poll rendered inside the conversation: the question plus tappable options with live result bars.
// Your current choice is highlighted; tapping another option changes your vote. Counts only - who
// voted for what is never sent to the client.
function PollCard({ poll, mine, onVote, canManage, onDelete, C }: {
  poll: PollData; mine: boolean; onVote: (i: number) => void; canManage: boolean; onDelete: () => void; C: typeof LIGHT_C;
}) {
  const total = poll.totalVotes;
  const voted = poll.myVote != null;
  return (
    <div className="rounded-2xl px-3 py-3" style={{ background: mine ? `${C.green}22` : C.pill, color: C.text }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide inline-flex items-center gap-1" style={{ color: C.muted }}>
          <BarChart2 className="w-3 h-3" style={{ color: C.green }}/> Poll
        </span>
        {canManage && (
          <button onClick={onDelete} title="Delete poll" className="w-5 h-5 rounded flex items-center justify-center"
            style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}><Trash2 className="w-3 h-3"/></button>
        )}
      </div>
      <p className="text-sm font-semibold mb-2.5 break-words whitespace-pre-wrap">{poll.question}</p>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt, i) => {
          const c = poll.counts[i] ?? 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          const picked = poll.myVote === i;
          return (
            <button key={i} onClick={() => onVote(i)} className="relative w-full text-left rounded-lg overflow-hidden"
              style={{ border: `1px solid ${picked ? C.green : C.divider}`, background: C.card, padding: 0, cursor: 'pointer' }}>
              <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: `${C.green}${picked ? '3a' : '1c'}`, transition: 'width .35s ease' }}/>
              <div className="relative flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="text-[13px] inline-flex items-center gap-1.5 min-w-0" style={{ color: C.text }}>
                  {picked && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.green }}/>}
                  <span className="break-words">{opt}</span>
                </span>
                <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: C.muted }}>{pct}%{c ? ` (${c})` : ''}</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] mt-2" style={{ color: C.faint }}>
        {total} {total === 1 ? 'vote' : 'votes'}{voted ? ' - tap another to change your vote' : ' - tap an option to vote'}
      </p>
    </div>
  );
}

export function GroupForum({ assignmentId, groupId, userId, C }: { assignmentId: string; groupId: string; userId: string; C: typeof LIGHT_C }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMoreEarlier, setHasMoreEarlier] = useState(false);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const pollCursor = useRef<string | null>(null);

  const [reply, setReply] = useState('');
  const [actionError, setActionError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [online, setOnline] = useState(true);

  // poll composer
  const [showPoll, setShowPoll] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState<string[]>(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);

  const lastActivity = useRef<number>(Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true); // keep pinned to the newest message unless the user scrolls up
  const mounted = useRef(true);
  // Set true on (re)mount, not just once: React StrictMode (dev) mounts -> unmounts -> remounts, and
  // without re-setting here the ref stays false after that first unmount, so every post-await setState
  // is skipped and the UI hangs on "Loading...".
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const touch = () => { lastActivity.current = Date.now(); };
  const scrollToBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
  const onScroll = () => { const el = scrollRef.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

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

  const loadPosts = useCallback(async (t: Thread) => {
    const json = await call({ action: 'listPosts', threadId: t.id, mode: 'initial' });
    if (!mounted.current) return;
    setPosts(json.posts); setHasMoreEarlier(!!json.hasMoreEarlier); setOlderCursor(json.olderCursor ?? null);
    pollCursor.current = json.pollCursor ?? null;
    setTimeout(scrollToBottom, 0);
  }, [call]);

  // The group's single conversation lives in the most-recent (only) thread; adopt it if present.
  const findThread = useCallback(async (): Promise<Thread | null> => {
    const json = await call({ action: 'listThreads', assignmentId, groupId });
    const t = (json.threads ?? [])[0];
    return t ? { id: t.id, authorId: t.authorId } : null;
  }, [assignmentId, groupId, call]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const t = await findThread();
        if (!mounted.current) return;
        setThread(t);
        if (t) await loadPosts(t);
        if (mounted.current) setError('');
      } catch (e: any) {
        if (mounted.current) setError(e?.message || 'Could not load the discussion.');
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
  }, [findThread, loadPosts]);

  const loadEarlier = useCallback(async () => {
    if (!thread || !olderCursor) return;
    touch();
    try {
      const json = await call({ action: 'listPosts', threadId: thread.id, mode: 'earlier', cursor: olderCursor });
      if (!mounted.current) return;
      setPosts(prev => [...json.posts, ...prev]);
      setHasMoreEarlier(!!json.hasMoreEarlier); setOlderCursor(json.olderCursor ?? null);
    } catch { /* leave as-is */ }
  }, [thread, olderCursor, call]);

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
        try {
          if (thread) {
            const json = await call({ action: 'listPosts', threadId: thread.id, mode: 'poll', cursor: pollCursor.current ?? undefined });
            if (mounted.current && json.posts?.length) {
              setPosts(prev => {
                const byId = new Map(prev.map(p => [p.id, p]));
                for (const p of json.posts as Post[]) byId.set(p.id, p);
                return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
              });
              if (stick.current) setTimeout(scrollToBottom, 0);
            }
            if (json?.pollCursor) pollCursor.current = json.pollCursor;
          } else {
            // No conversation yet - has a groupmate just started one?
            const t = await findThread();
            if (t && mounted.current) { setThread(t); await loadPosts(t); }
          }
        } catch { /* transient */ }
      }
      const idle = Date.now() - lastActivity.current > IDLE_AFTER || document.visibilityState !== 'visible';
      timer = setTimeout(tick, idle ? POLL_IDLE : POLL_ACTIVE);
    };
    timer = setTimeout(tick, POLL_ACTIVE);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); };
  }, [thread, call, findThread, loadPosts]);

  // ---- send (starts the conversation on the first message) ----
  async function send() {
    const body = reply.trim();
    if (!body) return;
    touch();
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: Post = { id: tempId, authorId: userId, authorName: 'You', body, createdAt: now, updatedAt: now, deleted: false, edited: false, _optimistic: true };
    setPosts(prev => [...prev, optimistic]); setReply(''); setActionError(''); stick.current = true; setTimeout(scrollToBottom, 0);
    try {
      if (!thread) {
        const json = await call({ action: 'createThread', assignmentId, groupId, title: THREAD_TITLE, body });
        if (!mounted.current) return;
        setThread({ id: json.thread.id, authorId: json.thread.authorId });
        setPosts([json.post]);
        pollCursor.current = null; // next poll re-syncs from the opening message
      } else {
        const json = await call({ action: 'createPost', threadId: thread.id, body });
        if (!mounted.current) return;
        setPosts(prev => prev.map(p => p.id === tempId ? json.post : p));
        // Do NOT advance pollCursor here: the next poll should still pick up any edit/deletion made
        // by someone else since the last poll (those carry earlier timestamps) alongside this message.
      }
    } catch (e: any) {
      if (!mounted.current) return;
      setPosts(prev => prev.map(p => p.id === tempId ? { ...p, _failed: true } : p)); // keep the text, flagged
      setActionError(e?.message || 'Your message did not send. Tap retry.');
    }
  }

  function retryFailed(p: Post) {
    if (!p.body) return;
    setPosts(prev => prev.filter(x => x.id !== p.id));
    setReply(p.body);
  }

  async function saveEdit(p: Post) {
    const body = editDraft.trim();
    if (!body) return;
    touch(); setSavingEdit(true); setActionError('');
    try {
      const json = await call({ action: 'editPost', postId: p.id, body, expectedUpdatedAt: p.updatedAt });
      if (!mounted.current) return;
      setPosts(prev => prev.map(x => x.id === p.id ? json.post : x));
      setEditingId(null); setEditDraft('');
    } catch (e: any) {
      if (!mounted.current) return;
      if (e?.status === 409 && thread) { setActionError('That message changed - reloading.'); await loadPosts(thread); }
      else setActionError(e?.message || 'Could not save your edit.');
    } finally { if (mounted.current) setSavingEdit(false); }
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
      if (e?.status === 409 && thread) { setActionError('That message changed - reloading.'); await loadPosts(thread); }
      else setActionError(e?.message || 'Could not delete the message.');
    }
  }

  // ---- polls ----
  const setOpt = (i: number, v: string) => setPollOpts(o => o.map((x, xi) => (xi === i ? v : x)));
  const addOpt = () => setPollOpts(o => (o.length < POLL_MAX_OPTIONS ? [...o, ''] : o));
  const removeOpt = (i: number) => setPollOpts(o => (o.length > 2 ? o.filter((_, xi) => xi !== i) : o));
  const cancelPoll = () => { setShowPoll(false); setPollQ(''); setPollOpts(['', '']); setActionError(''); };

  async function createPoll() {
    const question = pollQ.trim();
    const options = [...new Set(pollOpts.map(o => o.trim()).filter(Boolean))]; // drop blanks + duplicates
    if (!question || options.length < 2) { setActionError('A poll needs a question and at least 2 options.'); return; }
    touch(); setCreatingPoll(true); setActionError('');
    try {
      const json = await call({ action: 'createPoll', assignmentId, groupId, question, options });
      if (!mounted.current) return;
      if (json.thread) { setThread({ id: json.thread.id, authorId: json.thread.authorId }); pollCursor.current = null; }
      setPosts(prev => (prev.some(p => p.id === json.post.id) ? prev : [...prev, json.post]));
      cancelPoll();
      stick.current = true; setTimeout(scrollToBottom, 0);
    } catch (e: any) {
      if (mounted.current) setActionError(e?.message || 'Could not create the poll.');
    } finally { if (mounted.current) setCreatingPoll(false); }
  }

  async function vote(p: Post, optionIdx: number) {
    const poll = p.poll;
    if (!poll || poll.myVote === optionIdx) return; // re-tapping the same option is a no-op (no unvote in v1)
    touch(); setActionError('');
    const prevMy = poll.myVote;
    setPosts(cur => cur.map(x => { // optimistic: shift my vote, real tallies arrive on the next poll
      if (x.id !== p.id || !x.poll) return x;
      const counts = x.poll.counts.slice();
      if (prevMy != null && counts[prevMy] != null) counts[prevMy] = Math.max(0, counts[prevMy] - 1);
      counts[optionIdx] = (counts[optionIdx] ?? 0) + 1;
      return { ...x, poll: { ...x.poll, counts, totalVotes: x.poll.totalVotes + (prevMy == null ? 1 : 0), myVote: optionIdx } };
    }));
    try {
      await call({ action: 'vote', postId: p.id, optionIdx });
    } catch (e: any) {
      if (!mounted.current) return;
      setActionError(e?.message || 'Could not record your vote.');
      if (thread) await loadPosts(thread); // resync authoritative tallies
    }
  }

  const editStyle = useMemo(() => ({ width: '100%', padding: '10px 12px', borderRadius: 12, background: C.input, color: C.text, fontSize: 14, outline: 'none', border: `1px solid ${C.divider}`, resize: 'none' } as const), [C]);
  const fieldStyle = useMemo(() => ({ width: '100%', padding: '8px 10px', borderRadius: 10, background: C.card, color: C.text, fontSize: 14, outline: 'none', border: `1px solid ${C.divider}` } as const), [C]);

  const styleTag = (
    <style>{`
      .gf-msg .gf-actions { opacity: 0; transition: opacity .12s; }
      .gf-msg:hover .gf-actions { opacity: 1; }
      /* Show focus on the whole composer pill (subtle), not the harsh global green textarea outline
         (globals.css forces a 2px !important ring that looks bad boxed inside the rounded field). */
      .gf-composer:focus-within { border-color: ${C.green} !important; box-shadow: 0 0 0 3px ${C.green}22; }
      .gf-composer textarea:focus-visible { outline: none !important; }
    `}</style>
  );

  return (
    <div>
      {styleTag}
      <h3 className="text-sm font-bold inline-flex items-center gap-1.5 mb-3" style={{ color: C.text }}>
        <MessageSquare className="w-4 h-4" style={{ color: C.green }}/> Group discussion
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: C.muted }}><Loader2 className="w-4 h-4 animate-spin"/> Loading...</div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm py-6 justify-center" style={{ color: '#ef4444' }}>
          <AlertCircle className="w-4 h-4"/> {error}
          <button onClick={() => location.reload()} className="inline-flex items-center gap-1 ml-2" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer' }}><RefreshCw className="w-3.5 h-3.5"/> Retry</button>
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={onScroll} className="flex flex-col py-1" style={{ maxHeight: '55vh', minHeight: 180, overflowY: 'auto', overflowX: 'hidden' }}>
            {hasMoreEarlier && (
              <button onClick={loadEarlier} className="text-xs font-medium mb-2 self-center" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', padding: '4px 8px' }}>Load earlier messages</button>
            )}

            {posts.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-2 py-10 m-auto">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${C.green}18` }}><MessageSquare className="w-6 h-6" style={{ color: C.green }}/></div>
                <p className="text-sm font-semibold" style={{ color: C.text }}>No messages yet</p>
                <p className="text-xs max-w-xs" style={{ color: C.muted }}>Say hello, ask a question, share a link, or run a quick poll to get started.</p>
              </div>
            ) : posts.map((p, i) => {
              const mine = p.authorId === userId;
              const prev = posts[i - 1];
              const grouped = !!prev && !prev.deleted && !p.deleted && prev.authorId === p.authorId
                && new Date(p.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW;

              if (editingId === p.id) return (
                <div key={p.id} className="flex flex-col gap-2 px-1 py-2 w-full">
                  <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} rows={3} style={editStyle}/>
                  <div className="flex gap-2 self-end">
                    <button onClick={() => saveEdit(p)} disabled={savingEdit} className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}><Check className="w-3.5 h-3.5"/> Save</button>
                    <button onClick={() => { setEditingId(null); setEditDraft(''); }} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: C.pill, color: C.muted, border: 'none', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              );

              if (p.deleted) return (
                <div key={p.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} style={{ marginTop: 6, paddingLeft: mine ? 0 : 38 }}>
                  <span className="text-xs italic px-3 py-1.5 rounded-2xl" style={{ background: C.pill, color: C.faint }}>message deleted</span>
                </div>
              );

              const isPoll = !!p.poll;
              return (
                <div key={p.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`} style={{ marginTop: grouped ? 2 : 10 }}>
                  {!mine && (grouped ? <div style={{ width: 30, flexShrink: 0 }}/> : <Avatar name={p.authorName} C={C}/>)}
                  <div className={`flex flex-col min-w-0 ${mine ? 'items-end' : 'items-start'}`} style={{ maxWidth: isPoll ? '92%' : '78%', width: isPoll ? 320 : undefined }}>
                    {!mine && !grouped && <span className="text-[11px] font-semibold mb-0.5 px-1" style={{ color: C.muted }}>{p.authorName || 'Former member'}</span>}
                    {isPoll ? (
                      <div className="w-full" style={{ opacity: p._optimistic && !p._failed ? 0.6 : 1 }}>
                        <PollCard poll={p.poll!} mine={mine} onVote={i => vote(p, i)} canManage={mine && !p._optimistic} onDelete={() => removePost(p)} C={C}/>
                      </div>
                    ) : (
                      <div className="gf-msg relative rounded-2xl px-3 py-2"
                        style={{ background: mine ? `${C.green}22` : C.pill, color: C.text, opacity: p._optimistic && !p._failed ? 0.6 : 1,
                          borderTopRightRadius: mine && grouped ? 6 : 16, borderTopLeftRadius: !mine && grouped ? 6 : 16 }}>
                        <p className="text-sm whitespace-pre-wrap break-words"><Linkified text={p.body || ''} C={C}/></p>
                        {mine && !p._optimistic && (
                          <div className="gf-actions absolute top-1 flex gap-1" style={{ right: 'calc(100% + 6px)' }}>
                            <button onClick={() => { setEditingId(p.id); setEditDraft(p.body || ''); }} title="Edit" className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.card, border: `1px solid ${C.divider}`, color: C.faint, cursor: 'pointer' }}><Pencil className="w-3 h-3"/></button>
                            <button onClick={() => removePost(p)} title="Delete" className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.card, border: `1px solid ${C.divider}`, color: C.faint, cursor: 'pointer' }}><Trash2 className="w-3 h-3"/></button>
                          </div>
                        )}
                      </div>
                    )}
                    <span className="text-[10px] mt-0.5 px-1" style={{ color: C.faint }}>{p._failed ? 'not sent' : timeAgo(p.createdAt)}{p.edited ? ' (edited)' : ''}</span>
                    {p._failed && <button onClick={() => retryFailed(p)} className="text-[11px] font-semibold px-1" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer' }}>Retry</button>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 mt-1" style={{ borderTop: `1px solid ${C.divider}` }}>
            {showPoll ? (
              <div className="rounded-2xl px-3 py-3" style={{ background: C.input, border: `1px solid ${C.divider}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: C.text }}><BarChart2 className="w-3.5 h-3.5" style={{ color: C.green }}/> New poll</span>
                  <button onClick={cancelPoll} title="Cancel" className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}><X className="w-4 h-4"/></button>
                </div>
                <input value={pollQ} onChange={e => { setPollQ(e.target.value); touch(); }} placeholder="Ask a question..." className="mb-2" style={{ ...fieldStyle, fontWeight: 600 }}/>
                <div className="flex flex-col gap-1.5 mb-2">
                  {pollOpts.map((opt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={opt} onChange={e => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} style={fieldStyle}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (i === pollOpts.length - 1 && pollOpts.length < POLL_MAX_OPTIONS) addOpt(); } }}/>
                      {pollOpts.length > 2 && <button onClick={() => removeOpt(i)} title="Remove option" className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.pill, border: 'none', color: C.faint, cursor: 'pointer' }}><X className="w-3.5 h-3.5"/></button>}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  {pollOpts.length < POLL_MAX_OPTIONS
                    ? <button onClick={addOpt} className="text-xs font-medium inline-flex items-center gap-1" style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer' }}><Plus className="w-3.5 h-3.5"/> Add option</button>
                    : <span className="text-[10px]" style={{ color: C.faint }}>Up to {POLL_MAX_OPTIONS} options</span>}
                  <button onClick={createPoll} disabled={creatingPoll || !pollQ.trim() || pollOpts.filter(o => o.trim()).length < 2}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-40"
                    style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}>
                    {creatingPoll ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <BarChart2 className="w-3.5 h-3.5"/>} Create poll
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="gf-composer flex items-end gap-1 rounded-2xl px-2 py-1.5" style={{ background: C.input, border: `1px solid ${C.divider}`, transition: 'border-color .12s, box-shadow .12s' }}>
                  <button onClick={() => { setShowPoll(true); touch(); }} title="Create a poll" className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}><BarChart2 className="w-4 h-4"/></button>
                  <textarea value={reply} onChange={e => { setReply(e.target.value); touch(); }} placeholder="Message your group..." rows={1}
                    className="flex-1" style={{ background: 'transparent', color: C.text, fontSize: 14, outline: 'none', border: 'none', resize: 'none', padding: '8px 6px', maxHeight: 120 }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}/>
                  <button onClick={send} disabled={!reply.trim()} className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40" style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: reply.trim() ? 'pointer' : 'not-allowed' }}><Send className="w-4 h-4"/></button>
                </div>
                <p className="text-[10px] mt-1.5 pl-1" style={{ color: C.faint }}>Enter to send, Shift+Enter for a new line{!online ? ' - you are offline' : ''}</p>
              </>
            )}
            {actionError && <p className="text-xs mt-1 pl-1" style={{ color: '#ef4444' }}>{actionError}</p>}
          </div>
        </>
      )}
    </div>
  );
}
