'use client';

// Extracted verbatim from app/dashboard/page.tsx -- no behavior or styling changes.

import { useState, useEffect, useContext } from 'react';
import { AlertTriangle, Check, CheckCircle, Clock, Download, Loader2, MinusCircle, Search, Send, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { reportExportCSV } from '@/lib/dashboard-export';
import { IsStaffContext } from '@/components/dashboard/context';
import { LIGHT_C, cardStyle } from '@/lib/theme';

const STATUS_META = {
  not_started: { label: 'Not Started', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', Icon: MinusCircle },
  in_progress:  { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  Icon: Clock },
  stalled:      { label: 'Stalled',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   Icon: AlertTriangle },
  failed:       { label: 'Failed',      color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   Icon: XCircle },
  completed:    { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   Icon: CheckCircle },
} as const;

export function StudentTrackingSection({ C }: { C: typeof LIGHT_C }) {
  const isStaff = useContext(IsStaffContext);
  const [rows, setRows]           = useState<any[]>([]);
  const [cohorts, setCohorts]     = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [cohortFilter, setCohortFilter]   = useState('all');
  const [typeFilter, setTypeFilter]       = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [search, setSearch]               = useState('');
  const [nudging, setNudging]             = useState<string | null>(null);
  const [nudged, setNudged]               = useState<Set<string>>(new Set());

  // Bulk message compose state
  const [composing, setComposing]         = useState(false);
  const [msgSegment, setMsgSegment]       = useState<string>('not_started');
  const [msgCohort, setMsgCohort]         = useState('all');
  const [msgFormId, setMsgFormId]         = useState('all');
  const [msgSubject, setMsgSubject]       = useState('');
  const [msgBody, setMsgBody]             = useState('');
  const [msgSending, setMsgSending]       = useState(false);
  const [msgResult, setMsgResult]         = useState<{ sent: number } | null>(null);

  const load = async (cohortId = cohortFilter) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const params = new URLSearchParams({ cohortId, contentType: 'all' });
    const res = await fetch(`/api/tracking?${params}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setRows(json.rows ?? []);
      setCohorts(json.cohorts ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCohortChange = (id: string) => { setCohortFilter(id); load(id); };
  const handleTypeChange   = (t: string)  => { setTypeFilter(t); };

  const filtered = rows.filter(r => {
    if (typeFilter !== 'all' && r.contentType !== typeFilter) return false;
    if (statusFilter === 'at_risk') { if (!r.isAtRisk) return false; }
    else if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.studentName.toLowerCase().includes(q) && !r.studentEmail.toLowerCase().includes(q) && !r.formTitle.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total:       rows.length,
    not_started: rows.filter(r => r.status === 'not_started').length,
    stalled:     rows.filter(r => r.status === 'stalled').length,
    failed:      rows.filter(r => r.status === 'failed').length,
    in_progress: rows.filter(r => r.status === 'in_progress').length,
    completed:   rows.filter(r => r.status === 'completed').length,
    at_risk:     rows.filter(r => r.isAtRisk).length,
  };

  const sendNudge = async (row: any) => {
    const nudgeKey = `${row.studentEmail}|${row.formId}`;
    setNudging(nudgeKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/nudge-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          studentEmail: row.studentEmail,
          studentName:  row.studentName,
          formId:       row.formId,
          status:       row.status,
        }),
      });
      if (res.ok) {
        setNudged(prev => new Set([...prev, nudgeKey]));
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Failed to send nudge. Please try again.');
      }
    } catch {
      alert('Failed to send nudge. Please check your connection.');
    } finally {
      setNudging(null);
    }
  };

  const sendBulkMessage = async () => {
    if (!msgSubject.trim() || !msgBody.trim()) return;
    setMsgSending(true);
    setMsgResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          segment:     msgSegment,
          cohortId:    msgCohort,
          formId:      msgFormId !== 'all' ? msgFormId : undefined,
          subject:     msgSubject,
          messageBody: msgBody,
        }),
      });
      const json = await res.json();
      setMsgResult({ sent: json.sent ?? 0 });
      if (json.sent > 0) { setMsgSubject(''); setMsgBody(''); }
    } finally {
      setMsgSending(false);
    }
  };

  // Unique forms available in rows, optionally filtered by cohort
  const composeForms = [...new Map(
    rows
      .filter(r => msgCohort === 'all' || r.cohortId === msgCohort)
      .map(r => [r.formId, { id: r.formId, title: r.formTitle }])
  ).values()];

  // Count unique student emails matching segment + compose filters
  const segmentCount = (seg: string) => {
    const emails = new Set<string>();
    rows.forEach(r => {
      if (msgCohort !== 'all' && r.cohortId !== msgCohort) return;
      if (msgFormId !== 'all' && r.formId !== msgFormId) return;
      if (seg !== 'all' && r.status !== seg) return;
      emails.add(r.studentEmail);
    });
    return emails.size;
  };

  const sel = { fontSize: 13, padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, outline: 'none', cursor: 'pointer' } as React.CSSProperties;
  const typeLabel = (t: string) => t === 'virtual_experience' ? 'Virtual Experience' : t === 'course' ? 'Course' : t;

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="rounded-2xl overflow-hidden" style={{ ...cardStyle(C) }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${C.divider}` }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Student Tracking</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Monitor student progress across all your content. Flag stalled or inactive learners.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              reportExportCSV(
                ['Student', 'Email', 'Cohort', 'Content', 'Type', 'Progress %', 'Status', 'Last Active', 'Score'],
                filtered.map((r: any) => [
                  r.studentName, r.studentEmail, r.cohortName, r.formTitle, r.contentType,
                  `${r.progressPct}%`, r.status,
                  r.lastActive
                    ? (r.daysSinceActivity === 0 ? 'Today' : r.daysSinceActivity === 1 ? 'Yesterday' : `${r.daysSinceActivity}d ago`)
                    : '--',
                  r.score ?? '--',
                ]),
                'student_tracking.csv'
              );
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: C.pill, color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            <Download style={{ width: 14, height: 14 }} />
            Export CSV
          </button>
          {!isStaff && (
          <button
            onClick={() => { setComposing(v => !v); setMsgResult(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: composing ? C.cta : C.pill, color: composing ? C.ctaText : C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            <Send style={{ width: 14, height: 14 }} />
            Message Segment
          </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 24 }}>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" style={{ marginBottom: 24 }}>
        {([
          { key: 'total',       label: 'Total',       value: stats.total,       color: C.text    },
          { key: 'not_started', label: 'Not Started', value: stats.not_started, color: '#6b7280' },
          { key: 'in_progress', label: 'In Progress', value: stats.in_progress, color: '#f59e0b' },
          { key: 'stalled',     label: 'Stalled',     value: stats.stalled,     color: '#ef4444' },
          { key: 'completed',   label: 'Completed',   value: stats.completed,   color: '#22c55e' },
          { key: 'at_risk',     label: 'At Risk',     value: stats.at_risk,     color: '#dc2626' },
        ] as const).map(s => {
          const active = statusFilter === s.key;
          return (
            <button key={s.key}
              onClick={() => setStatusFilter(active ? 'all' : s.key)}
              className="text-left"
              style={{
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
                border: 'none',
                background: active ? `${s.color}1f` : C.pill,
              }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Compose panel */}
      {composing && (
        <div style={{ background: C.pill, border: 'none', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Compose Message</p>

          {/* Cohort + Content filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: '1 1 180px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cohort</p>
              <select value={msgCohort} onChange={e => { setMsgCohort(e.target.value); setMsgFormId('all'); }} style={{ ...sel, width: '100%' }}>
                <option value="all">All Cohorts</option>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Course / Content</p>
              <select value={msgFormId} onChange={e => setMsgFormId(e.target.value)} style={{ ...sel, width: '100%' }}>
                <option value="all">All Content</option>
                {composeForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </div>
          </div>

          {/* Segment selector */}
          <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send to</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {([
              { key: 'not_started', label: 'Not Started', color: '#6b7280' },
              { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
              { key: 'stalled',     label: 'Stalled',     color: '#ef4444' },
              { key: 'failed',      label: 'Failed',      color: '#dc2626' },
              { key: 'completed',   label: 'Completed',   color: '#22c55e' },
              { key: 'all',         label: 'Everyone',    color: C.cta    },
            ] as const).map(s => {
              const count = segmentCount(s.key);
              const active = msgSegment === s.key;
              return (
                <button key={s.key} onClick={() => setMsgSegment(s.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? s.color : C.cardBorder}`, background: active ? `${s.color}18` : 'transparent', color: active ? s.color : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {s.label}
                  <span style={{ fontSize: 11, background: active ? s.color : C.divider, color: active ? '#fff' : C.faint, borderRadius: 10, padding: '1px 6px' }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</p>
            <input
              value={msgSubject} onChange={e => setMsgSubject(e.target.value)}
              placeholder="e.g. A message from the team"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message <span style={{ fontWeight: 400, textTransform: 'none' }}>-- use {'{{name}}'} for personalisation</span></p>
            <textarea
              value={msgBody} onChange={e => setMsgBody(e.target.value)}
              rows={5}
              placeholder="Hi {{name}}, ..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const, lineHeight: 1.6 }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={sendBulkMessage}
              disabled={msgSending || !msgSubject.trim() || !msgBody.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: C.cta, color: C.ctaText, fontSize: 14, fontWeight: 700, border: 'none', cursor: msgSending || !msgSubject.trim() || !msgBody.trim() ? 'not-allowed' : 'pointer', opacity: msgSending || !msgSubject.trim() || !msgBody.trim() ? 0.6 : 1 }}>
              {msgSending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
              {msgSending ? 'Sending…' : `Send to ${segmentCount(msgSegment)} student${segmentCount(msgSegment) !== 1 ? 's' : ''}`}
            </button>
            <button onClick={() => { setComposing(false); setMsgResult(null); }} style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            {msgResult && (
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
                <Check style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />
                {msgResult.sent} email{msgResult.sent !== 1 ? 's' : ''} sent
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.faint }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student or content…"
            style={{ ...sel, paddingLeft: 30, width: '100%', boxSizing: 'border-box' as const }}
          />
        </div>
        <select value={cohortFilter} onChange={e => handleCohortChange(e.target.value)} style={sel}>
          <option value="all">All Cohorts</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => handleTypeChange(e.target.value)} style={sel}>
          <option value="all">All Types</option>
          <option value="course">Courses</option>
          <option value="virtual_experience">Virtual Experiences</option>
          <option value="assignment">Assignments</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="all">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="stalled">Stalled (7+ days)</option>
          <option value="failed">Failed</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div>
        {/* Table header */}
        <div className="grid grid-cols-[1fr_110px_90px] sm:grid-cols-[1fr_1fr_70px_110px_110px_90px]"
          style={{ gap: 0, padding: '14px 4px', borderBottom: `1px solid ${C.divider}` }}>
          {['Student', 'Content', 'Progress', 'Status', 'Last Active', ''].map((h, i) => (
            <div key={i} className={[1, 2, 4].includes(i) ? 'hidden sm:block' : ''} style={{ fontSize: 10, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Loader2 style={{ width: 24, height: 24, color: C.faint, margin: '0 auto' }} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.muted, fontSize: 14 }}>
            {rows.length === 0 ? 'No students assigned to your content yet.' : 'No results match your filters.'}
          </div>
        ) : (
          filtered.map((row, i) => {
            const meta = STATUS_META[row.status as keyof typeof STATUS_META];
            const nudgeKey = `${row.studentEmail}|${row.formId}`;
            const isNudged = nudged.has(nudgeKey);
            const canNudge = row.status === 'not_started' || row.status === 'stalled' || row.status === 'in_progress' || row.status === 'failed';
            return (
              <div key={nudgeKey}
                className="grid grid-cols-[1fr_110px_90px] sm:grid-cols-[1fr_1fr_70px_110px_110px_90px]"
                style={{ gap: 0, padding: '14px 4px', borderBottom: i < filtered.length - 1 ? `1px solid ${C.divider}` : 'none', alignItems: 'center' }}>
                {/* Student */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.studentName || '--'}</div>
                  <div style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.studentEmail}</div>
                </div>
                {/* Content */}
                <div className="hidden sm:block" style={{ fontSize: 13, color: C.text, paddingRight: 8, wordBreak: 'break-word' }}>{row.formTitle}</div>
                {/* Progress % */}
                <div className="hidden sm:block">
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.status === 'failed' ? '#dc2626' : row.progressPct === 100 ? C.green : row.progressPct > 0 ? '#f59e0b' : C.faint }}>
                    {row.progressPct}%
                  </span>
                </div>
                {/* Status */}
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
                    <meta.Icon style={{ width: 11, height: 11 }} />
                    {meta.label}
                  </span>
                </div>
                {/* Last Active */}
                <div className="hidden sm:block">
                  <div style={{ fontSize: 12, color: C.faint }}>
                    {row.lastActive
                      ? row.daysSinceActivity === 0 ? 'Today'
                        : row.daysSinceActivity === 1 ? 'Yesterday'
                        : `${row.daysSinceActivity}d ago`
                      : '--'}
                  </div>
                  {row.deadline && row.status !== 'completed' && (
                    <div style={{ marginTop: 3 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: row.isAtRisk ? (row.daysUntilDeadline < 0 ? '#fef2f2' : '#fffbeb') : C.pill,
                        color: row.isAtRisk ? (row.daysUntilDeadline < 0 ? '#dc2626' : '#b45309') : C.faint,
                        whiteSpace: 'nowrap',
                      }}>
                        {row.daysUntilDeadline < 0 ? '⚠ Overdue'
                          : row.daysUntilDeadline === 0 ? '⚠ Due today'
                          : `${row.daysUntilDeadline}d left`}
                      </span>
                    </div>
                  )}
                </div>
                {/* Nudge */}
                <div>
                  {canNudge && (
                    <button
                      onClick={() => sendNudge(row)}
                      disabled={nudging === nudgeKey || isNudged}
                      title={isNudged ? 'Nudge sent' : row.status === 'not_started' ? 'Encourage to start' : 'Encourage to continue'}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, border: `1px solid ${isNudged ? 'rgba(34,197,94,0.3)' : C.cardBorder}`, background: 'transparent', color: isNudged ? '#22c55e' : C.muted, cursor: nudging === nudgeKey || isNudged ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                      {nudging === nudgeKey
                        ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
                        : isNudged
                          ? <Check style={{ width: 11, height: 11 }} />
                          : <Send style={{ width: 11, height: 11 }} />}
                      {isNudged ? 'Sent' : 'Nudge'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ fontSize: 12, color: C.faint, marginTop: 12, textAlign: 'right' }}>
          Showing {filtered.length} of {rows.length} records
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
