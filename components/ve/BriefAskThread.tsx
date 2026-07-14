'use client';

// Session-only clarification thread inside a manager brief. The student asks a
// question; the AI answers in the manager's persona via /api/ve-brief-chat.
// Nothing is persisted anywhere -- the thread lives in component state and is
// gone when the player unmounts. That is the intended behavior, not a gap.

import React, { useState } from 'react';
import { HelpCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Person, firstNameOf } from './workplace';
import { MailThreadMsg, MailTypingRow } from './MailCard';

export interface BriefChatContext {
  managerName?: string;
  managerTitle?: string;
  company?: string;
  role?: string;
  industry?: string;
  missionTitle?: string;
  briefSubject?: string;
  briefBody?: string;
  background?: string;
  studentName?: string;
}

type Msg = { who: 'me' | 'manager'; text: string };

export function BriefAskThread({ isDark, accent, manager, studentName, context }: {
  isDark: boolean;
  accent: string;
  manager: Person;
  studentName: string;
  context: BriefChatContext;
}) {
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState('');
  const [open, setOpen]       = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError]     = useState('');

  const line   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const tFaint = isDark ? '#6b7075' : '#9aa0a6';

  const send = async () => {
    const question = input.trim();
    if (!question || waiting) return;
    setError('');
    setInput('');
    const history = msgs;
    setMsgs(prev => [...prev, { who: 'me', text: question }]);
    setWaiting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ve-brief-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ question, history, context: { ...context, studentName } }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMsgs(prev => [...prev, { who: 'manager', text: json.reply || '' }]);
    } catch (err: any) {
      setError(err.message || 'Could not send your question right now. Please try again.');
    } finally {
      setWaiting(false);
    }
  };

  if (!open && msgs.length === 0) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 18, border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`, background: 'transparent', fontSize: 13.5, fontWeight: 600, color: isDark ? '#ddd' : '#444', cursor: 'pointer' }}>
        <HelpCircle className="w-4 h-4" /> Ask a question
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msgs.map((m, i) => (
        <MailThreadMsg key={i} isDark={isDark} from={m.who === 'me' ? 'me' : manager} meName={studentName}>
          {m.text}
        </MailThreadMsg>
      ))}
      {waiting && <MailTypingRow isDark={isDark} person={manager} />}
      {error && <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{error}</p>}
      {!waiting && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              maxLength={500}
              placeholder={`Ask ${firstNameOf(manager.name)} a clarifying question...`}
              style={{ flex: 1, padding: '9px 14px', borderRadius: 18, border: `1px solid ${line}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', color: isDark ? '#e8eaed' : '#202124', fontSize: 13.5, outline: 'none' }} />
            <button onClick={send} disabled={!input.trim()} title="Send question"
              style={{ width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: input.trim() ? accent : (isDark ? '#333' : '#e0e0e0'), color: input.trim() ? '#fff' : (isDark ? '#666' : '#aaa'), cursor: input.trim() ? 'pointer' : 'not-allowed' }}>
              <Send size={14} />
            </button>
          </div>
          <p style={{ margin: '6px 2px 0', fontSize: 11, color: tFaint }}>
            Quick clarifications only. This chat is not saved and clears when you leave.
          </p>
        </div>
      )}
    </div>
  );
}
