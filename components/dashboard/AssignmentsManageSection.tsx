'use client';

// Extracted verbatim from app/dashboard/page.tsx -- no behavior or styling changes.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, ChevronDown, ClipboardList, Copy, Download, Edit2, ExternalLink, FileText, Loader2, Plus, Trash2, Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeRichText } from '@/lib/sanitize';
import { ReviewReportView, REVIEW_TYPES } from '@/components/ReviewReportView';
import { parseReviewNotes, inferReviewType } from '@/lib/reviewRecord';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useTheme } from '@/components/ThemeProvider';
import { LIGHT_C } from '@/lib/theme';
import { SYNC_ENABLED } from '@/lib/sync';
import { exportAssignment, exportAllAssignments, exportCSV, exportGroupCSV } from '@/lib/dashboard-export';
import { PushButton, PushAllButton, StudentAvatar } from '@/components/dashboard/primitives';
import { ImportButton } from '@/components/dashboard/ImportButton';

export function AssignmentsManageSection({ C }: { C: typeof LIGHT_C }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [assignments, setAssignments]       = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId]   = useState<string | null>(null);
  const [selected, setSelected]             = useState<any>(null);
  const [activeTab, setActiveTab]           = useState<'details' | 'responses'>('details');
  const [submissions, setSubmissions]       = useState<any[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs]       = useState(false);
  const [viewingSub, setViewingSub]         = useState<any>(null);
  const [subFiles, setSubFiles]             = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [score, setScore]                   = useState('');
  const [feedback, setFeedback]             = useState('');
  const [grading, setGrading]               = useState(false);
  const [gradeError, setGradeError]         = useState('');
  const [gradeSuccess, setGradeSuccess]     = useState(false);
  const [veAttemptProgress, setVeAttemptProgress] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    supabase.from('assignments').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) console.error('[assignments fetch]', error); setAssignments(data ?? []); setLoading(false); });
  }, []);

  async function openAssignment(a: any) {
    setSelected(a); setViewingSub(null); setSubFiles([]); setActiveTab('details'); setLoadingSubs(true);
    setExpandedGroups(new Set());
    const groupIds: string[] = Array.isArray(a.group_ids) && a.group_ids.length > 0 ? a.group_ids : [];
    const [{ data: subs }, { data: cohortStudents }, { data: groupMemberRows }] = await Promise.all([
      supabase.from('assignment_submissions').select('*, student:students!student_id(id, full_name, email), submitted_by_student:students!submitted_by(full_name)').eq('assignment_id', a.id).order('updated_at', { ascending: false }),
      a.cohort_ids?.length ? supabase.from('students').select('id, full_name, email').in('cohort_id', a.cohort_ids) : Promise.resolve({ data: [] }),
      groupIds.length ? supabase.from('group_members').select('group_id, is_leader, groups(id, name), students(id, full_name, email)').in('group_id', groupIds) : Promise.resolve({ data: [] }),
    ]);
    const groupStudents = (groupMemberRows ?? []).map((r: any) => ({ ...(r.students ?? {}), group_id: r.group_id, group_name: (r.groups as any)?.name ?? null, is_leader: !!r.is_leader })).filter((s: any) => s?.id);
    const seen = new Set<string>();
    const sourceStudents = groupIds.length > 0 ? [...groupStudents, ...(cohortStudents ?? [])] : [...(cohortStudents ?? []), ...groupStudents];
    const allStudents = sourceStudents.filter((s: any) => {
      if (!s?.id || seen.has(s.id)) return false;
      seen.add(s.id); return true;
    });
    setSubmissions(subs ?? []); setAssignedStudents(allStudents); setLoadingSubs(false);
  }

  function toggleExpandedGroup(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }

  async function openSubmission(sub: any) {
    setViewingSub(sub); setSubFiles([]); setScore(sub.score != null ? String(sub.score) : '');
    setFeedback(sub.feedback ?? ''); setGradeError(''); setGradeSuccess(false);
    setVeAttemptProgress(null);
    const veFormId = selected?.config?.ve_form_id;
    const isVe = selected?.type === 'virtual_experience' && veFormId && sub.student_id;

    const [{ data: files }, session] = await Promise.all([
      supabase.from('assignment_submission_files').select('*').eq('submission_id', sub.id).order('uploaded_at'),
      isVe ? supabase.auth.getSession() : Promise.resolve({ data: { session: null } }),
    ]);
    if (files) setSubFiles(files);

    if (isVe && session?.data?.session?.access_token) {
      const res = await fetch(`/api/ve-attempt?veId=${veFormId}&studentId=${sub.student_id}`, {
        headers: { Authorization: `Bearer ${session.data.session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.progress) setVeAttemptProgress(json.progress);
      }
    }
  }

  async function saveGrade() {
    if (!viewingSub) return;
    setGrading(true); setGradeError(''); setGradeSuccess(false);
    try {
      const sanitizedFeedback = sanitizeRichText(feedback).trim() || null;
      const { error } = await supabase.from('assignment_submissions')
        .update({ score: score ? parseFloat(score) : null, feedback: sanitizedFeedback, status: 'graded', graded_by: (await supabase.auth.getUser()).data.user?.id, graded_at: new Date().toISOString() })
        .eq('id', viewingSub.id);
      if (error) throw error;
      const updated = { ...viewingSub, score: score ? parseFloat(score) : null, feedback: sanitizedFeedback, status: 'graded' };
      setViewingSub(updated);
      setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
      setGradeSuccess(true);
      setTimeout(() => setGradeSuccess(false), 3000);

      // Fire-and-forget grade notification email
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        fetch('/api/assignments/grade-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ submissionId: viewingSub.id, assignmentTitle: selected?.title ?? '' }),
        }).catch(() => {});
      });
    } catch (err: any) {
      setGradeError(err?.message || 'Failed to save grade.');
    } finally {
      setGrading(false);
    }
  }

  async function duplicateAssignment(a: any) {
    setDuplicatingId(a.id);
    const { id, created_at, updated_at, ...rest } = a;
    const { data, error } = await supabase
      .from('assignments')
      .insert({ ...rest, title: `Copy of ${a.title}`, status: 'draft', cohort_ids: [], group_ids: [], deadline_date: null })
      .select('*')
      .single();
    if (error) { setDuplicatingId(null); window.alert(error.message); return; }

    // Copy resources
    const { data: resources } = await supabase
      .from('assignment_resources')
      .select('name, url, resource_type')
      .eq('assignment_id', a.id);
    if (resources?.length) {
      await supabase.from('assignment_resources').insert(
        resources.map(r => ({ ...r, assignment_id: data.id }))
      );
    }

    setDuplicatingId(null);
    setAssignments(prev => [data, ...prev]);
  }

  async function deleteAssignment(id: string) {
    if (!window.confirm('Delete this assignment? All submissions will also be removed.')) return;
    setDeletingId(id);
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    setDeletingId(null);
    if (error) { window.alert(error.message); return; }
    setAssignments(prev => prev.filter(a => a.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  if (loading) return (
    <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}</div>
  );

  // -- Grading view ---
  if (viewingSub) {
    const isPassed = viewingSub.score != null && viewingSub.score >= 85;
    const isFailed = viewingSub.score != null && viewingSub.score < 85;
    return (
      <div>
        <button onClick={() => { setViewingSub(null); setVeAttemptProgress(null); }} className="flex items-center gap-2 mb-6 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft className="w-4 h-4"/> Back to responses
        </button>

        {gradeSuccess && (
          <div className="flex items-center gap-3 rounded-2xl px-5 py-4 mb-5" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#10b981' }}/>
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Grade saved successfully.</p>
          </div>
        )}

        {/* Student card */}
        <div className="rounded-2xl p-5 mb-4" style={{ background: C.card }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <StudentAvatar name={viewingSub.student?.full_name} email={viewingSub.student?.email} size={40} C={C}/>
              <div>
                <p className="font-semibold text-sm" style={{ color: C.text }}>{viewingSub.student?.full_name || viewingSub.student?.email || 'Student'}</p>
                <p className="text-xs mt-0.5" style={{ color: C.faint }}>{viewingSub.student?.email}{viewingSub.updated_at ? ` · ${new Date(viewingSub.updated_at).toLocaleDateString()}` : ''}</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: viewingSub.status === 'graded' ? '#f0fdf4' : viewingSub.status === 'submitted' ? '#eff6ff' : '#f4f1eb', color: viewingSub.status === 'graded' ? '#16a34a' : viewingSub.status === 'submitted' ? '#2563eb' : '#888' }}>
              {viewingSub.status.charAt(0).toUpperCase() + viewingSub.status.slice(1)}
            </span>
          </div>

          {viewingSub.response_text ? (() => {
            const subAssignType = selected?.type ?? 'standard';
            if (REVIEW_TYPES.includes(subAssignType)) {
              const rec = parseReviewNotes(viewingSub.response_text);
              if (rec) {
                const type = rec.type ?? subAssignType;
                if (type === 'document_review') {
                  const isManual = rec.documentReviewMode === 'manual' || !!rec.report?.manualReview;
                  const fileUrl = rec.report?.fileUrl;
                  return (
                    <div className="mb-3 space-y-3">
                      {fileUrl && (
                        <div className="rounded-xl px-4 py-3" style={{ background: C.input }}>
                          <a href={fileUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                            style={{ color: C.green }}>
                            <Download className="w-3 h-3" /> Download submitted report
                            {rec.report?.fileName && <span className="font-normal ml-1 opacity-60">({rec.report.fileName})</span>}
                          </a>
                        </div>
                      )}
                      {isManual
                        ? <div className="rounded-xl px-4 py-3" style={{ background: C.input }}><span className="text-sm" style={{ color: C.faint }}>Submitted for instructor review.</span></div>
                        : <ReviewReportView rec={{ ...rec, type: 'document_review' }} isDark={isDark} />}
                    </div>
                  );
                }
                return (
                  <div className="mb-3">
                    <ReviewReportView rec={{ ...rec, type }} isDark={isDark} />
                  </div>
                );
              }
            }

            return (
              <div className="rounded-xl p-4 mb-3" style={{ background: C.input }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.faint }}>Response</p>
                <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(viewingSub.response_text) }}/>
              </div>
            );
          })() : (
            <p className="text-sm mb-3" style={{ color: C.faint }}>No written response.</p>
          )}

          {veAttemptProgress && (() => {
            const cards: React.ReactNode[] = [];
            for (const [reqId, entry] of Object.entries(veAttemptProgress)) {
              const rec = parseReviewNotes((entry as any)?.notes);
              if (!rec) continue;
              // Only render entries that look like AI reviews (typed, inferable, or a legacy lean with a score).
              const type = rec.type ?? inferReviewType(rec.report);
              if (!type && typeof rec.report?.overallScore !== 'number') continue;
              cards.push(
                <div key={reqId} className="mb-3">
                  <ReviewReportView rec={rec} isDark={isDark} />
                </div>
              );
            }
            return cards.length > 0 ? <>{cards}</> : null;
          })()}

          {subFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.faint }}>Attachments</p>
              {subFiles.map((f: any) => (
                <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm px-3.5 py-2.5 rounded-xl transition-opacity hover:opacity-75"
                  style={{ background: C.page, color: C.green, border: `1px solid ${C.divider}`, textDecoration: 'none' }}>
                  {f.file_name ? <FileText className="w-4 h-4 flex-shrink-0"/> : <ExternalLink className="w-4 h-4 flex-shrink-0"/>}
                  <span className="truncate font-medium">{f.file_name || f.file_url}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Grade panel */}
        <div className="rounded-2xl p-5" style={{ background: C.card }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: C.text }}>Grade Submission</h3>
            <span className="text-xs" style={{ color: C.faint }}>Passmark: 85%</span>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.faint }}>Score <span style={{ color: C.faint, fontWeight: 400 }}>(out of 100)</span></label>
            <input type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} placeholder="e.g. 90"
              style={{ width: '100%', maxWidth: 160, padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' as const }}/>
            {score && (
              <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: parseFloat(score) >= 85 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: parseFloat(score) >= 85 ? '#10b981' : '#ef4444' }}>
                {parseFloat(score) >= 85 ? '✓ Pass' : '✗ Fail'}
              </span>
            )}
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.faint }}>Feedback to student</label>
            <RichTextEditor value={feedback} onChange={setFeedback} placeholder="Write feedback for the student…" bgOverride={C.input} fontFamily="var(--font-mono)"/>
          </div>

          {gradeError && <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{gradeError}</p>}

          <button onClick={saveGrade} disabled={grading || gradeSuccess}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: gradeSuccess ? '#10b981' : C.cta, color: C.ctaText, border: 'none', cursor: (grading || gradeSuccess) ? 'not-allowed' : 'pointer', opacity: grading ? 0.6 : 1 }}>
            {grading ? 'Saving…' : gradeSuccess ? '✓ Grade Saved' : viewingSub.status === 'graded' ? 'Update Grade' : 'Save Grade'}
          </button>
        </div>
      </div>
    );
  }

  // -- Assignment detail with tabs ---
  if (selected) {
    const isGroupAssignment = (selected.group_ids?.length ?? 0) > 0;
    const subMap: Record<string, any> = Object.fromEntries(submissions.map((s: any) => [s.student_id, s]));
    const rows = assignedStudents.map((st: any) => ({ ...st, sub: subMap[st.id] ?? null }));
    const groupSubByGroup = Object.fromEntries(submissions.filter((s: any) => s.group_id).map((s: any) => [s.group_id, s]));
    const groupMap = new Map<string, { id: string; name: string; members: any[] }>();
    if (isGroupAssignment) {
      for (const st of assignedStudents as any[]) {
        if (!st.group_id) continue;
        if (!groupMap.has(st.group_id)) {
          groupMap.set(st.group_id, { id: st.group_id, name: st.group_name || 'Group', members: [] });
        }
        groupMap.get(st.group_id)!.members.push(st);
      }
    }
    const groupRows = Array.from(groupMap.values()).map(group => {
      const sub = groupSubByGroup[group.id] ?? null;
      const participantIds = new Set(Array.isArray(sub?.participants) ? sub.participants : []);
      const participants = sub ? group.members.filter(member => participantIds.has(member.id)) : [];
      const nonParticipants = sub ? group.members.filter(member => !participantIds.has(member.id)) : [];
      const leader = group.members.find(member => member.is_leader) ?? group.members[0] ?? null;
      return { ...group, sub, participants, nonParticipants, leader };
    });
    const responseRows = isGroupAssignment ? groupRows : rows;
    const responded = isGroupAssignment
      ? groupRows.filter((row: any) => row.sub != null).length
      : submissions.length;
    const gradedSubs = isGroupAssignment
      ? groupRows.filter((row: any) => row.sub?.status === 'graded')
      : submissions.filter(s => s.status === 'graded');
    const graded    = gradedSubs.length;
    const passed    = isGroupAssignment
      ? gradedSubs.filter((r: any) => (r.sub?.score ?? 0) >= 85).length
      : submissions.filter(s => s.status === 'graded' && s.score >= 85).length;
    const passRate  = graded > 0 ? Math.round((passed / graded) * 100) : 0;

    return (
      <div>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSelected(null)} className="flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 hover:opacity-70 transition-opacity" style={{ background: C.pill, border: 'none', cursor: 'pointer', color: C.muted }}>
              <ArrowLeft className="w-4 h-4"/>
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-base font-bold truncate" style={{ color: C.text }}>{selected.title}</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: selected.status === 'published' ? 'rgba(16,185,129,0.1)' : C.pill, color: selected.status === 'published' ? '#10b981' : C.faint }}>
                {selected.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href={`/create/assignment?edit=${selected.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-80"
              style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
              <Edit2 className="w-3.5 h-3.5"/> Edit
            </Link>
            <button onClick={() => deleteAssignment(selected.id)} disabled={deletingId === selected.id}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold"
              style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, cursor: deletingId === selected.id ? 'not-allowed' : 'pointer', opacity: deletingId === selected.id ? 0.6 : 1 }}>
              <Trash2 className="w-3.5 h-3.5"/> {deletingId === selected.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: C.pill }}>
          {(['details', 'responses'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: activeTab === tab ? C.card : 'transparent', color: activeTab === tab ? C.text : C.faint, boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {tab === 'responses' ? `Responses (${responded})` : 'Details'}
            </button>
          ))}
        </div>

        {/* -- Details tab -- */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {[
              { key: 'scenario',               label: 'Scenario' },
              { key: 'brief',                  label: 'Brief' },
              { key: 'tasks',                  label: 'Tasks' },
              { key: 'requirements',           label: 'Requirements' },
              { key: 'submission_instructions',label: 'Submission Instructions' },
            ].filter(f => selected[f.key]).map(f => (
              <div key={f.key} className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.green}50`, boxShadow: C.cardShadow }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.faint }}>{f.label}</p>
                <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(selected[f.key]) }}/>
              </div>
            ))}
            {!selected.scenario && !selected.brief && !selected.tasks && !selected.requirements && (
              <div className="text-center py-16 rounded-2xl" style={{ background: C.card }}>
                <p className="text-sm" style={{ color: C.faint }}>No details added yet. <Link href={`/create/assignment?edit=${selected.id}`} style={{ color: C.green }}>Edit assignment</Link></p>
              </div>
            )}
          </div>
        )}

        {/* -- Responses tab -- */}
        {activeTab === 'responses' && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: isGroupAssignment ? 'Groups' : 'Assigned', value: isGroupAssignment ? groupRows.length : assignedStudents.length, icon: Users, color: C.text, bg: C.card },
                { label: 'Responded',  value: responded,               icon: FileText,   color: '#2563eb', bg: '#eff6ff' },
                { label: 'Graded',     value: graded,                  icon: CheckCircle2,color:'#7c3aed', bg: '#f5f3ff' },
                { label: 'Pass Rate',  value: `${passRate}%`,          icon: TrendingUp, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4" style={{ background: C.card }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: C.faint }}>{s.label}</p>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                      <s.icon className="w-3.5 h-3.5" style={{ color: s.color }}/>
                    </div>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Export button */}
            {responseRows.length > 0 && (
              <div className="flex justify-end mb-3">
                <button onClick={() => isGroupAssignment ? exportGroupCSV(groupRows, selected.title) : exportCSV(rows, selected.title)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80 transition-opacity"
                  style={{ background: C.pill, color: C.muted, border: `1px solid ${C.divider}` }}>
                  <Download className="w-3.5 h-3.5"/> Export CSV
                </button>
              </div>
            )}

            {loadingSubs ? (
              <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: C.card }}/>)}</div>
            ) : responseRows.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: C.card }}>
                <p className="text-sm font-medium mb-1" style={{ color: C.text }}>{isGroupAssignment ? 'No groups assigned' : 'No students assigned'}</p>
                <p className="text-xs" style={{ color: C.faint }}>{(selected.group_ids?.length ?? 0) > 0 ? 'No group members found for this assignment.' : 'Assign a cohort to this assignment first.'}</p>
              </div>
            ) : isGroupAssignment ? (
              <div className="rounded-2xl overflow-hidden">
                <div className="grid px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ background: C.pill, color: C.faint, gridTemplateColumns: '1.35fr 1fr 90px 120px 110px 70px 80px 80px' }}>
                  <span>Group</span>
                  <span>Leader</span>
                  <span className="text-center">Members</span>
                  <span className="text-center">Participants</span>
                  <span>Status</span>
                  <span className="text-center">Score</span>
                  <span className="text-center">Result</span>
                  <span></span>
                </div>
                {groupRows.map((row: any, i: number) => {
                  const sub = row.sub;
                  const status = sub?.status ?? 'not_started';
                  const sc = sub?.score ?? null;
                  const isPassed = sc != null && sc >= 85;
                  const isExpanded = expandedGroups.has(row.id);
                  const statusCfg = status === 'graded'    ? { label: 'Graded',      bg: '#f0fdf4', color: '#16a34a' }
                                  : status === 'submitted' ? { label: 'Submitted',   bg: '#eff6ff', color: '#2563eb' }
                                  : status === 'draft'     ? { label: 'Draft',       bg: C.pill,    color: C.muted   }
                                  :                          { label: 'Not Started', bg: C.pill,    color: C.faint   };
                  return (
                    <div key={row.id} style={{ background: i % 2 === 0 ? C.card : C.page, borderTop: `1px solid ${C.divider}` }}>
                      <div className="grid px-5 py-3.5 items-center" style={{ gridTemplateColumns: '1.35fr 1fr 90px 120px 110px 70px 80px 80px' }}>
                        <button onClick={() => toggleExpandedGroup(row.id)} className="flex items-center gap-2 min-w-0 text-left hover:opacity-80"
                          style={{ color: C.text, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                          <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{row.name}</p>
                            <p className="text-xs truncate" style={{ color: C.faint }}>{sub ? `Submitted by ${sub.submitted_by_student?.full_name || sub.student?.full_name || 'group leader'}` : 'Awaiting submission'}</p>
                          </div>
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{row.leader?.full_name || row.leader?.email || '--'}</p>
                          <p className="text-xs truncate" style={{ color: C.faint }}>{row.leader?.email || ''}</p>
                        </div>
                        <span className="text-sm font-bold text-center" style={{ color: C.text }}>{row.members.length}</span>
                        <span className="text-sm font-bold text-center" style={{ color: sub ? C.text : C.faint }}>{sub ? `${row.participants.length}/${row.members.length}` : '--'}</span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-center w-fit" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                          {statusCfg.label}
                        </span>
                        <span className="text-sm font-bold text-center" style={{ color: sc != null ? (isPassed ? '#10b981' : '#ef4444') : C.faint }}>
                          {sc != null ? sc : '--'}
                        </span>
                        <span className="text-xs font-bold text-center px-2 py-1 rounded-full mx-auto"
                          style={sc != null ? { background: isPassed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isPassed ? '#10b981' : '#ef4444' } : { color: C.faint }}>
                          {sc != null ? (isPassed ? 'Passed' : 'Failed') : '--'}
                        </span>
                        <div className="flex justify-end">
                          {sub ? (
                            <button onClick={() => openSubmission(sub)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                              style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}>
                              {sub.status === 'graded' ? 'Regrade' : 'Grade'}
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: C.faint }}>--</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-5 pb-4">
                          <div className="rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4" style={{ background: C.input, border: `1px solid ${C.divider}` }}>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.faint }}>Group Members</p>
                              <div className="space-y-2">
                                {row.members.map((member: any) => {
                                  const participated = !!sub && row.participants.some((p: any) => p.id === member.id);
                                  return (
                                    <div key={member.id} className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <StudentAvatar name={member.full_name} email={member.email} size={28} C={C}/>
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{member.full_name || member.email}</p>
                                          <p className="text-xs truncate" style={{ color: C.faint }}>{member.email}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {member.is_leader && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#d97706' }}>Leader</span>}
                                        {sub && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: participated ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)', color: participated ? '#10b981' : '#ef4444' }}>{participated ? 'Participant' : 'Not marked'}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.faint }}>Submission</p>
                              {sub ? (
                                <div className="space-y-1.5 text-sm" style={{ color: C.text }}>
                                  <p><span className="font-semibold">Submitted by:</span> {sub.submitted_by_student?.full_name || sub.student?.full_name || 'Group leader'}</p>
                                  <p><span className="font-semibold">Submitted:</span> {sub.updated_at ? new Date(sub.updated_at).toLocaleString() : '--'}</p>
                                  <p style={{ color: C.faint }}>Only the marked participants receive this grade.</p>
                                </div>
                              ) : (
                                <p className="text-sm" style={{ color: C.faint }}>No submission yet.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden">
                {/* Table head */}
                <div className="grid px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ background: C.pill, color: C.faint, gridTemplateColumns: '1fr 110px 70px 80px 80px' }}>
                  <span>Student</span>
                  <span>Status</span>
                  <span className="text-center">Score</span>
                  <span className="text-center">Result</span>
                  <span></span>
                </div>
                {rows.map((row, i) => {
                  const sub     = row.sub;
                  const status  = sub?.status ?? 'not_started';
                  const sc      = sub?.score ?? null;
                  const isPassed = sc != null && sc >= 85;
                  const statusCfg = status === 'graded'    ? { label: 'Graded',      bg: '#f0fdf4', color: '#16a34a' }
                                  : status === 'submitted' ? { label: 'Submitted',   bg: '#eff6ff', color: '#2563eb' }
                                  : status === 'draft'     ? { label: 'Draft',       bg: C.pill,    color: C.muted   }
                                  :                          { label: 'Not Started', bg: C.pill,    color: C.faint   };
                  return (
                    <div key={row.id} className="grid px-5 py-3.5 items-center" style={{ gridTemplateColumns: '1fr 110px 70px 80px 80px', background: i % 2 === 0 ? C.card : C.page, borderTop: `1px solid ${C.divider}` }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <StudentAvatar name={row.full_name} email={row.email} size={34} C={C}/>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{row.full_name || row.email}</p>
                          <p className="text-xs truncate" style={{ color: C.faint }}>{row.email}</p>
                          {isGroupAssignment && row.group_name && (
                            <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: C.muted }}>Group: {row.group_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-center" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                          {statusCfg.label}
                        </span>
                        {isGroupAssignment && sub?.submitted_by_student?.full_name && (
                          <span className="text-xs" style={{ color: C.faint }}>by {(sub.submitted_by_student as any).full_name}</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-center" style={{ color: sc != null ? (isPassed ? '#10b981' : '#ef4444') : C.faint }}>
                        {sc != null ? sc : '--'}
                      </span>
                      <span className="text-xs font-bold text-center px-2 py-1 rounded-full mx-auto"
                        style={sc != null ? { background: isPassed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isPassed ? '#10b981' : '#ef4444' } : { color: C.faint }}>
                        {sc != null ? (isPassed ? 'Passed' : 'Failed') : '--'}
                      </span>
                      <div className="flex justify-end">
                        {sub ? (
                          <button onClick={() => openSubmission(sub)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                            style={{ background: C.cta, color: C.ctaText, border: 'none', cursor: 'pointer' }}>
                            {sub.status === 'graded' ? 'Regrade' : 'Grade'}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: C.faint }}>--</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -- Assignment list ---
  if (!assignments.length) return (
    <div className="text-center py-24 rounded-3xl" style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: C.lime }}>
        <ClipboardList className="w-7 h-7" style={{ color: C.green }}/>
      </div>
      <h2 className="text-base font-semibold mb-1" style={{ color: C.text }}>No Assignments yet</h2>
      <p className="text-sm mb-5" style={{ color: C.faint }}>Create your first assignment to get started.</p>
      <Link href="/create/assignment" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80" style={{ background: C.cta, color: C.ctaText }}>
        <Plus className="w-4 h-4"/> New Assignment
      </Link>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold" style={{ color: C.text }}>Assignments <span className="text-sm font-normal ml-1" style={{ color: C.faint }}>({assignments.length})</span></h2>
        <div className="flex items-center gap-2">
          {assignments.length > 0 && (
            <button onClick={() => exportAllAssignments(assignments, 'assignments_bulk')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: C.pill, color: C.muted }}>
              <Download className="w-3.5 h-3.5" /> Export All
            </button>
          )}
          {SYNC_ENABLED && assignments.length > 0 && (
            <PushAllButton
              items={assignments.map(a => ({ type: 'assignment', id: a.id }))}
              C={C}
            />
          )}
          <ImportButton
            types={['assignment']}
            C={C}
            onImported={r => { window.location.href = `/create/assignment?edit=${r.id}`; }}
            onBulkDone={() => window.location.reload()}
          />
          <Link href="/create/assignment" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80" style={{ background: C.cta, color: C.ctaText }}>
            <Plus className="w-4 h-4"/> New
          </Link>
        </div>
      </div>
      <div className="space-y-3">
        {assignments.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer group"
            style={{ background: C.card }}>
            {/* Cover / letter */}
            <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-xl font-black"
              style={{ background: C.thumbBg, color: C.green }}>
              {a.cover_image
                ? <img src={a.cover_image} alt="" className="w-full h-full object-cover"/>
                : <span style={{ opacity: 0.5 }}>{a.title?.[0]?.toUpperCase()}</span>}
            </div>
            {/* Info */}
            <button onClick={() => openAssignment(a)} className="flex-1 min-w-0 text-left" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{a.title}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: a.status === 'published' ? 'rgba(16,185,129,0.1)' : C.pill, color: a.status === 'published' ? '#10b981' : C.faint }}>
                  {a.status}
                </span>
              </div>
              <p className="text-xs" style={{ color: C.faint }}>{new Date(a.created_at).toLocaleDateString()}</p>
            </button>
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`/create/assignment?edit=${a.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80"
                style={{ background: C.pill, color: C.muted, textDecoration: 'none' }}>
                <Edit2 className="w-3 h-3"/> Edit
              </Link>
              <button onClick={e => { e.stopPropagation(); duplicateAssignment(a); }} disabled={duplicatingId === a.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80"
                style={{ background: C.pill, color: C.muted, cursor: duplicatingId === a.id ? 'not-allowed' : 'pointer', opacity: duplicatingId === a.id ? 0.5 : 1 }}>
                {duplicatingId === a.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Copy className="w-3 h-3"/>}
              </button>
              <button onClick={e => { e.stopPropagation(); exportAssignment(a); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-80"
                style={{ background: C.pill, color: C.muted }}>
                <Download className="w-3 h-3"/>
              </button>
              {SYNC_ENABLED && <PushButton type="assignment" id={a.id} C={C} />}
              <button onClick={e => { e.stopPropagation(); deleteAssignment(a.id); }} disabled={deletingId === a.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: C.deleteBg, color: C.deleteText, border: `1px solid ${C.deleteBorder}`, cursor: deletingId === a.id ? 'not-allowed' : 'pointer', opacity: deletingId === a.id ? 0.5 : 1 }}>
                <Trash2 className="w-3 h-3"/>
              </button>
            </div>
            <ChevronDown className="w-4 h-4 flex-shrink-0 -rotate-90 group-hover:translate-x-0.5 transition-transform" style={{ color: C.faint }}/>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
