'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, ArrowLeft, Download, CheckCircle2, XCircle, Users, Trophy,
  TrendingUp, BarChart2, BarChart3, Settings, MoreHorizontal,
  Copy, Check, ExternalLink, Code2, GitFork, QrCode, Edit2,
  AlignLeft, HelpCircle, CalendarDays, Share2, Mail, Send, Bell,
  Award, Upload, Trash2, RefreshCw, Link as LinkIcon, Sun, Moon, Sparkles, X,
} from 'lucide-react';
import CertificateTemplate, { CertificateSettings, DEFAULT_CERT_SETTINGS } from '@/components/CertificateTemplate';
import NotificationBell from '@/components/NotificationBell';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import FormEditor from '@/components/FormEditor';
import { useTheme } from '@/components/ThemeProvider';

// ── Lazy charts ───────────────────────────────────────────────────────────────
const ResponsesOverTimeChart = dynamic(
  () => import('@/components/InsightCharts').then(m => ({ default: m.ResponsesOverTimeChart })),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-5 h-5 text-zinc-600 animate-spin" /></div> }
);

const PAGE_SIZE = 50;

type TabId = 'responses' | 'settings' | 'more' | 'email' | 'certificates' | 'leaderboard';

const TABS: { id: TabId; label: string; Icon: any; courseOnly?: boolean }[] = [
  { id: 'settings',     label: 'Settings',     Icon: Settings                       },
  { id: 'responses',    label: 'Responses',    Icon: BarChart3                      },
  { id: 'leaderboard',  label: 'Leaderboard',  Icon: Trophy,   courseOnly: true     },
  { id: 'certificates', label: 'Certificates', Icon: Award,    courseOnly: true     },
  { id: 'email',        label: 'Email',        Icon: Mail                           },
  { id: 'more',         label: 'More',         Icon: MoreHorizontal                 },
];

function getFormType(config: any): 'course' | 'event' | 'form' {
  if (config?.isCourse) return 'course';
  if (config?.eventDetails?.isEvent) return 'event';
  return 'form';
}

const TYPE_META = {
  course:  { label: 'Course',  Icon: HelpCircle,  color: '#f59e0b', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  event: { label: 'Event', Icon: CalendarDays, color: '#1f1bc3', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20'   },
  form:  { label: 'Form',  Icon: AlignLeft,   color: '#10b981', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function useCopy(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), timeout);
  }, [timeout]);
  return { copied, copy };
}

// ── Responses Tab ─────────────────────────────────────────────────────────────
function ResponsesTab({
  form, responses, totalCount, page, pageLoading,
  onExport, onPageChange, courseProgress,
}: {
  form: any; responses: any[]; totalCount: number; page: number; pageLoading: boolean;
  onExport: () => void; onPageChange: (p: number) => void; courseProgress: any[];
}) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const card = isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-white border-[rgba(0,0,0,0.07)]';
  const cardHeader = isDark ? 'border-zinc-800' : 'border-[rgba(0,0,0,0.07)]';
  const dividerCls = isDark ? 'divide-zinc-800/50' : 'divide-[rgba(0,0,0,0.05)]';
  const textPrim = isDark ? 'text-white' : 'text-[#111]';
  const textMut = isDark ? 'text-zinc-500' : 'text-[#888]';
  const textSub = isDark ? 'text-zinc-300' : 'text-[#555]';
  const tableHead = isDark ? 'bg-zinc-950 text-zinc-400 border-zinc-800' : 'bg-[#f5f6f7] text-[#888] border-[rgba(0,0,0,0.06)]';
  const tableRow = isDark ? 'hover:bg-zinc-800/20' : 'hover:bg-[#f5f6f7]';
  const isCourse = form.config?.isCourse;
  const isEvent = form.config?.eventDetails?.isEvent;
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);
  const configuredFields = form.config?.fields ?? [];
  const resolveResponseValue = (response: any, matcher: (key: string, field: any) => boolean) => {
    const data = response?.data || {};
    for (const [key, value] of Object.entries(data)) {
      const field = configuredFields.find((f: any) => f?.name === key || f?.id === key);
      if (matcher(String(key), field) && value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  };
  const getResponseName = (response: any) => {
    const fullName =
      resolveResponseValue(response, (key, field) => {
        const normalizedKey = key.toLowerCase();
        const label = String(field?.label || '').toLowerCase();
        return (
          normalizedKey === 'name' ||
          normalizedKey === 'full_name' ||
          normalizedKey === 'fullname' ||
          label === 'name' ||
          label === 'full name'
        );
      }) ||
      resolveResponseValue(response, (key, field) => {
        const normalizedKey = key.toLowerCase();
        const label = String(field?.label || '').toLowerCase();
        return (
          (normalizedKey.includes('full') && normalizedKey.includes('name')) ||
          (label.includes('full') && label.includes('name'))
        );
      });

    if (fullName) return fullName;

    return (
      resolveResponseValue(response, (key, field) => {
        const normalizedKey = key.toLowerCase();
        const label = String(field?.label || '').toLowerCase();
        return (
          normalizedKey === 'first_name' ||
          normalizedKey === 'firstname' ||
          label === 'first name' ||
          (label.includes('first') && label.includes('name'))
        );
      }) ||
      'Anonymous'
    );
  };
  const getResponseEmail = (response: any) =>
    resolveResponseValue(response, (key, field) => {
      const normalizedKey = key.toLowerCase();
      const label = String(field?.label || '').toLowerCase();
      return normalizedKey === 'email' || normalizedKey.includes('email') || label === 'email' || label.includes('email');
    }) || '—';

  const formatFieldLabel = (key: string) =>
    key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase());

  if (isCourse) {
    const questions = form.config?.questions || [];
    const attempts = totalCount;
    const scores = responses.map((r: any) => r.data?.score ?? 0);
    const totals = responses.map((r: any) => r.data?.total ?? questions.length);
    const passmark = form.config?.passmark ?? 50;
    const passed = responses.filter((r: any) => (r.data?.percentage ?? 0) >= passmark).length;
    const passRate = attempts ? Math.round((passed / attempts) * 100) : 0;
    const avgScore = attempts ? (scores.reduce((a: number, b: number) => a + b, 0) / attempts).toFixed(1) : '—';
    const topScore = attempts ? Math.max(...scores.map((s: number, i: number) => Math.round((s / (totals[i] || 1)) * 100))) : 0;

    const questionStats = questions.map((q: any) => {
      const answered = responses.filter((r: any) => r.data?.answers?.[q.id]);
      const correct = answered.filter((r: any) => r.data.answers[q.id] === q.correctAnswer).length;
      return {
        question: q.question.length > 30 ? q.question.slice(0, 30) + '…' : q.question,
        fullQuestion: q.question,
        correct, incorrect: answered.length - correct, total: answered.length,
        pct: answered.length ? Math.round((correct / answered.length) * 100) : 0,
      };
    });

    // Build enrolled student list: combine in-progress (courseProgress) + completed (responses)
    const completedByEmail = new Map<string, any>();
    for (const r of responses) {
      const key = (r.data?.email || '').trim().toLowerCase();
      if (!key) continue;
      const existing = completedByEmail.get(key);
      if (!existing || new Date(r.created_at) > new Date(existing.created_at)) completedByEmail.set(key, r);
    }
    const inProgressStudents = courseProgress.filter(p => {
      const key = (p.student_email || '').trim().toLowerCase();
      return key && !completedByEmail.has(key);
    });
    const totalEnrolled = completedByEmail.size + inProgressStudents.length;

    return (
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Started',    value: totalEnrolled || '—',                                Icon: Users,      color: '#8b5cf6' },
            { label: 'Avg Score',  value: attempts ? `${avgScore} / ${questions.length}` : '—', Icon: BarChart2,   color: '#00a4ef' },
            { label: 'Pass Rate',  value: attempts ? `${passRate}%` : '—',                    Icon: TrendingUp,  color: '#10b981' },
            { label: 'Top Score',  value: attempts ? `${topScore}%` : '—',                    Icon: Trophy,      color: '#f59e0b' },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className={`border rounded-2xl p-5 ${card}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className={`text-xs font-medium uppercase tracking-wide ${textMut}`}>{label}</span>
              </div>
              <p className={`text-3xl font-bold ${textPrim}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Per-question breakdown */}
        {attempts > 0 && (
          <div className={`border rounded-3xl overflow-hidden ${card}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${cardHeader}`}>
              <h3 className={`text-base font-semibold ${textPrim}`}>Question Breakdown</h3>
              <button onClick={onExport} className={`flex items-center gap-1.5 text-xs transition-colors hover:opacity-60 ${textMut}`}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            <div className={`divide-y ${dividerCls}`}>
              {questionStats.map((q: any, i: number) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <span className={`text-xs font-mono w-5 flex-shrink-0 ${textMut}`}>Q{i + 1}</span>
                  <p className={`flex-1 text-sm ${textSub}`}>{q.fullQuestion}</p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> {q.correct}</span>
                    <span className="flex items-center gap-1 text-xs text-rose-400"><XCircle className="w-3.5 h-3.5" /> {q.incorrect}</span>
                    <span className="text-xs font-semibold w-10 text-right" style={{ color: q.pct >= 50 ? '#10b981' : '#f43f5e' }}>{q.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submissions table */}
        <div className={`rounded-3xl border overflow-hidden ${card}`}>
          <div className={`px-6 py-4 border-b ${cardHeader}`}>
            <h3 className={`text-base font-semibold ${textPrim}`}>Student Submissions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={`border-b ${tableHead}`}>
                <tr>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Score</th>
                  <th className="px-6 py-3 font-medium">Result</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dividerCls}`}>
                {(() => {
                  // Keep only the most recent attempt per student email
                  const byEmail = new Map<string, any>();
                  for (const r of responses) {
                    const key = (r.data?.email || '').trim().toLowerCase() || `anon_${r.data?.name || r.id}`;
                    const existing = byEmail.get(key);
                    if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
                      byEmail.set(key, r);
                    }
                  }
                  return [...byEmail.values()].map((r: any) => {
                    const pct = r.data?.percentage ?? (r.data?.total ? Math.round((r.data.score / r.data.total) * 100) : 0);
                    const pass = pct >= passmark;
                    return (
                      <tr key={r.id} className={`transition-colors ${tableRow}`}>
                        <td className={`px-6 py-3 font-medium ${textPrim}`}>{r.data?.name || <span className={`italic ${textMut}`}>Anonymous</span>}</td>
                        <td className={`px-6 py-3 ${textMut}`}>{r.data?.email || '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`font-semibold ${textPrim}`}>{r.data?.score ?? '—'}</span>
                          <span className={textMut}> / {r.data?.total ?? questions.length}</span>
                          <span className={`ml-2 text-xs ${textMut}`}>({pct}%)</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${pass ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {pass ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className={`px-6 py-3 whitespace-nowrap text-xs ${textMut}`}>{new Date(r.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  });
                })()}
                {responses.length === 0 && (
                  <tr><td colSpan={5} className={`px-6 py-12 text-center ${textMut}`}>No submissions yet. Share the course link to get started!</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination totalCount={totalCount} page={page} pageLoading={pageLoading} onPageChange={onPageChange} isDark={isDark} />
        </div>

        {/* Enrolled Students */}
        {(totalEnrolled > 0 || courseProgress.length > 0) && (
          <div className={`rounded-3xl border overflow-hidden ${card}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${cardHeader}`}>
              <div>
                <h3 className={`text-base font-semibold ${textPrim}`}>Students</h3>
                <p className={`text-xs mt-0.5 ${textMut}`}>{inProgressStudents.length} in progress · {completedByEmail.size} completed</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#f1f2f3] text-[#555]'}`}>
                {totalEnrolled} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={`border-b ${tableHead}`}>
                  <tr>
                    <th className="px-6 py-3 font-medium">Student</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Progress</th>
                    <th className="px-6 py-3 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${dividerCls}`}>
                  {/* In-progress students */}
                  {inProgressStudents.map((p: any) => {
                    const qTotal = questions.length || 1;
                    const progressPct = Math.min(100, Math.round(((p.current_question_index ?? 0) / qTotal) * 100));
                    return (
                      <tr key={`ip_${p.student_email}`} className={`transition-colors ${tableRow}`}>
                        <td className={`px-6 py-3 font-medium ${textPrim}`}>{p.student_name || <span className={`italic ${textMut}`}>Unknown</span>}</td>
                        <td className={`px-6 py-3 ${textMut}`}>{p.student_email || '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            In Progress
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-20 rounded-full overflow-hidden ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`}>
                              <div className="h-full rounded-full bg-amber-400" style={{ width: `${progressPct}%` }} />
                            </div>
                            <span className={`text-xs ${textMut}`}>{p.current_question_index ?? 0}/{qTotal}</span>
                          </div>
                        </td>
                        <td className={`px-6 py-3 whitespace-nowrap text-xs ${textMut}`}>
                          {p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Completed students */}
                  {[...completedByEmail.values()].map((r: any) => {
                    const pct = r.data?.percentage ?? (r.data?.total ? Math.round((r.data.score / r.data.total) * 100) : 0);
                    const pass = pct >= passmark;
                    return (
                      <tr key={`cp_${r.id}`} className={`transition-colors ${tableRow}`}>
                        <td className={`px-6 py-3 font-medium ${textPrim}`}>{r.data?.name || <span className={`italic ${textMut}`}>Anonymous</span>}</td>
                        <td className={`px-6 py-3 ${textMut}`}>{r.data?.email || '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${pass ? (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700')}`}>
                            {pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {pass ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-20 rounded-full overflow-hidden ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pass ? '#10b981' : '#f43f5e' }} />
                            </div>
                            <span className={`text-xs ${textMut}`}>{pct}%</span>
                          </div>
                        </td>
                        <td className={`px-6 py-3 whitespace-nowrap text-xs ${textMut}`}>
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                  {totalEnrolled === 0 && (
                    <tr><td colSpan={5} className={`px-6 py-12 text-center ${textMut}`}>No students enrolled yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Event responses
  if (isEvent) {
    const capacity = Number(form.config?.eventDetails?.capacity) || 0;
    const fillPercent = capacity > 0 ? Math.min(100, Math.round((totalCount / capacity) * 100)) : 100;
    const progressWidth = totalCount > 0 ? Math.max(fillPercent, 8) : 0;
    const participantRows = responses.map((r: any) => ({
      ...r,
      participantName: getResponseName(r),
      participantEmail: getResponseEmail(r),
      submittedDate: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      submittedDateFull: new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    }));
    const responseEntries = selectedResponse
      ? Object.entries(selectedResponse.data || {}).filter(([key, value]) => key !== 'email' && value !== null && value !== undefined && value !== '')
      : [];
    const spotsLeft = capacity > 0 ? Math.max(capacity - totalCount, 0) : null;

    return (
      <>
        <div className="space-y-6">
          <div className={`overflow-hidden rounded-[28px] border ${card}`}>
            <div className={isDark ? 'bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_40%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(24,24,27,0.9))] p-6 sm:p-7' : 'bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_40%),linear-gradient(180deg,#ffffff,#f8fafc)] p-6 sm:p-7'}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? 'bg-emerald-500/12 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                      Event responses
                    </span>
                    <div>
                      <p className={`text-4xl font-semibold tracking-tight ${textPrim}`}>{totalCount}</p>
                      <p className={`mt-1 text-sm ${textMut}`}>
                        {capacity > 0 ? `${fillPercent}% of capacity claimed` : 'Registered participants'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
                    <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-white/5' : 'bg-white/85 shadow-sm'}`}>
                      <p className={`text-[11px] font-medium uppercase tracking-[0.18em] ${textMut}`}>Capacity</p>
                      <p className={`mt-2 text-xl font-semibold ${textPrim}`}>{capacity > 0 ? capacity : 'Open'}</p>
                    </div>
                    <div className={`rounded-2xl px-4 py-3 ${isDark ? 'bg-white/5' : 'bg-white/85 shadow-sm'}`}>
                      <p className={`text-[11px] font-medium uppercase tracking-[0.18em] ${textMut}`}>Remaining</p>
                      <p className={`mt-2 text-xl font-semibold ${textPrim}`}>{spotsLeft !== null ? spotsLeft : '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="max-w-2xl">
                  <div className={`relative h-2.5 overflow-hidden rounded-full ${isDark ? 'bg-white/8' : 'bg-[#ebe7de]'}`}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${progressWidth}%`,
                        background: 'linear-gradient(90deg, #10b981 0%, #34d399 45%, #6ee7b7 100%)',
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className={`text-sm ${textMut}`}>Participant occupancy</p>
                    <p className={`text-sm font-medium ${textPrim}`}>
                      {capacity > 0 ? `${totalCount} / ${capacity}` : `${totalCount} registered`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={onExport}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${isDark ? 'bg-white/6 text-white hover:bg-white/10' : 'bg-white text-[#111] shadow-sm hover:bg-[#f5f6f7] border border-[rgba(0,0,0,0.07)]'}`}
                  >
                    <Download className="w-4 h-4" /> Export participants
                  </button>
                  <p className={`text-sm ${textMut}`}>Select a participant to see the full registration response.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-[28px] border ${card}`}>
            <div className={`flex items-center justify-between gap-3 border-b px-6 py-5 ${cardHeader}`}>
              <div>
                <h3 className={`text-base font-semibold ${textPrim}`}>Participants</h3>
                <p className={`mt-1 text-sm ${textMut}`}>A focused view of who registered and when they joined.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#f1f2f3] text-[#555]'}`}>
                {totalCount} total
              </span>
            </div>
            <div className={`transition-opacity ${pageLoading ? 'opacity-40' : ''}`}>
              {participantRows.length > 0 ? (
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  {participantRows.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedResponse(r)}
                      className={`grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_90px] items-center gap-4 px-6 py-4 text-left transition-colors ${tableRow}`}
                    >
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${textPrim}`}>{r.participantName}</p>
                        <p className={`mt-1 text-xs ${textMut}`}>Open response details</p>
                      </div>
                      <p className={`truncate text-sm ${textSub}`}>{r.participantEmail}</p>
                      <p className={`text-right text-xs font-medium ${textMut}`}>{r.submittedDate}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`px-6 py-16 text-center ${textMut}`}>No participants yet. Share your event to start collecting registrations.</div>
              )}
            </div>
            <Pagination totalCount={totalCount} page={page} pageLoading={pageLoading} onPageChange={onPageChange} isDark={isDark} />
          </div>
        </div>

        <AnimatePresence>
          {selectedResponse && (() => {
            const pName = getResponseName(selectedResponse);
            const pEmail = getResponseEmail(selectedResponse);
            const initials = (() => {
              const parts = pName.trim().split(/\s+/).filter(Boolean);
              if (parts.length === 0) return '?';
              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            })();
            const AVATAR_GRADIENTS = [
              'linear-gradient(135deg,#6366f1,#8b5cf6)',
              'linear-gradient(135deg,#ec4899,#f43f5e)',
              'linear-gradient(135deg,#f59e0b,#ef4444)',
              'linear-gradient(135deg,#10b981,#059669)',
              'linear-gradient(135deg,#3b82f6,#6366f1)',
              'linear-gradient(135deg,#14b8a6,#3b82f6)',
              'linear-gradient(135deg,#f97316,#f59e0b)',
              'linear-gradient(135deg,#8b5cf6,#ec4899)',
            ];
            const avatarGradient = AVATAR_GRADIENTS[(pName.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4"
              >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedResponse(null)} />
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-[91] w-full max-w-md overflow-hidden rounded-t-[32px] sm:rounded-[28px] shadow-2xl"
                  style={{ background: isDark ? '#111113' : '#ffffff' }}
                >
                  {/* Header */}
                  <div
                    className="relative overflow-hidden px-6 pt-6 pb-5"
                    style={{ background: isDark ? 'linear-gradient(160deg,#1c1c1f 0%,#111113 100%)' : 'linear-gradient(160deg,#f5f5f7 0%,#ffffff 100%)' }}
                  >
                    {/* Glow blob behind avatar */}
                    <div
                      className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-full opacity-20 blur-3xl"
                      style={{ background: avatarGradient }}
                    />

                    {/* Close button */}
                    <button
                      onClick={() => setSelectedResponse(null)}
                      className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    >
                      <X className="h-4 w-4" style={{ color: isDark ? '#a1a1aa' : '#71717a' }} />
                    </button>

                    {/* Avatar + identity */}
                    <div className="flex items-center gap-4">
                      <div
                        className="relative flex h-11 w-11 flex-shrink-0 items-end justify-center overflow-hidden rounded-full shadow-lg"
                        style={{ background: avatarGradient }}
                      >
                        <img
                          src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(pName)}&backgroundColor=transparent`}
                          alt={pName}
                          className="h-[90%] w-[90%] object-contain object-bottom"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.previousSibling as HTMLElement | null)?.removeAttribute('style');
                          }}
                        />
                        <span
                          className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white"
                          style={{ display: 'none' }}
                        >
                          {initials}
                        </span>
                      </div>
                      <div className="min-w-0 pr-8">
                        <h3 className={`truncate text-xl font-bold leading-tight ${textPrim}`}>{pName}</h3>
                        <p className={`mt-0.5 truncate text-sm ${textMut}`}>{pEmail === '—' ? 'No email provided' : pEmail}</p>
                        <span
                          className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Registered
                        </span>
                      </div>
                    </div>

                    {/* Stat pills */}
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Registered', value: selectedResponse.submittedDateFull },
                        { label: 'Response ID', value: selectedResponse.id.slice(0, 8).toUpperCase() },
                        { label: 'Fields', value: String(responseEntries.length) },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="rounded-2xl px-3 py-2.5 text-center"
                          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                        >
                          <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMut}`}>{label}</p>
                          <p className={`mt-1 text-xs font-bold leading-tight ${textPrim}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

                  {/* Fields */}
                  <div className="max-h-[52vh] overflow-y-auto p-5 space-y-2">
                    {responseEntries.length > 0 ? responseEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-2xl px-4 py-3.5"
                        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
                      >
                        <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMut}`}>{formatFieldLabel(String(key))}</p>
                        <p className={`mt-1.5 text-sm font-medium leading-relaxed break-words ${textPrim}`}>
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                      </div>
                    )) : (
                      <p className={`py-6 text-center text-sm ${textMut}`}>No additional fields for this participant.</p>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </>
    );
  }

  // Regular form responses
  const dailyData = responses.reduce((acc: any, r: any) => {
    const date = new Date(r.created_at).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.keys(dailyData).map(date => ({ date, count: dailyData[date] })).reverse();
  const fields = (form.config?.fields ?? []).filter((f: any) => f.type !== 'description');

  return (
    <div className="space-y-6">
      {/* Stat */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className={`border rounded-2xl p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-emerald-500" /><span className={`text-xs uppercase tracking-wide font-medium ${textMut}`}>Total Responses</span></div>
          <p className={`text-3xl font-bold ${textPrim}`}>{totalCount}</p>
        </div>
        <div className={`border rounded-2xl p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-3"><AlignLeft className="w-4 h-4 text-blue-500" /><span className={`text-xs uppercase tracking-wide font-medium ${textMut}`}>Fields</span></div>
          <p className={`text-3xl font-bold ${textPrim}`}>{fields.length}</p>
        </div>
        <div className={`border rounded-2xl p-5 col-span-2 md:col-span-1 ${card}`}>
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-amber-500" /><span className={`text-xs uppercase tracking-wide font-medium ${textMut}`}>Latest</span></div>
          <p className={`text-sm font-medium ${textPrim}`}>
            {responses[0] ? new Date(responses[0].created_at).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {responses.length > 0 && (
        <div className={`p-6 rounded-3xl border h-[280px] ${card}`}>
          <h3 className={`text-base font-semibold mb-4 ${textPrim}`}>Responses Over Time</h3>
          <ResponsesOverTimeChart data={chartData} />
        </div>
      )}

      <div className={`rounded-3xl border overflow-hidden ${card}`}>
        <div className={`px-6 py-4 border-b flex items-center justify-between ${cardHeader}`}>
          <h3 className={`text-base font-semibold ${textPrim}`}>All Submissions</h3>
          <button onClick={onExport} className={`flex items-center gap-1.5 text-xs transition-colors hover:opacity-60 ${textMut}`}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`border-b ${tableHead}`}>
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                {fields.map((f: any) => <th key={f.id} className="px-6 py-4 font-medium">{f.label}</th>)}
              </tr>
            </thead>
            <tbody className={`transition-opacity ${pageLoading ? 'opacity-40' : ''} divide-y ${dividerCls}`}>
              {responses.map((r: any) => (
                <tr key={r.id} className={`transition-colors ${tableRow}`}>
                  <td className={`px-6 py-4 whitespace-nowrap text-xs ${textMut}`}>{new Date(r.created_at).toLocaleString()}</td>
                  {fields.map((f: any) => <td key={f.id} className={`px-6 py-4 max-w-[200px] truncate ${textSub}`}>{r.data?.[f.name] || '—'}</td>)}
                </tr>
              ))}
              {responses.length === 0 && (
                <tr><td colSpan={fields.length + 1} className={`px-6 py-12 text-center ${textMut}`}>No responses yet. Share your form to get started!</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalCount={totalCount} page={page} pageLoading={pageLoading} onPageChange={onPageChange} isDark={isDark} />
      </div>
    </div>
  );
}

function Pagination({ totalCount, page, pageLoading, onPageChange, isDark = true }: { totalCount: number; page: number; pageLoading: boolean; onPageChange: (p: number) => void; isDark?: boolean }) {
  if (totalCount <= PAGE_SIZE) return null;
  const btnStyle = isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-[#f5f6f7] hover:bg-[#eaecef] text-[#555] border border-[rgba(0,0,0,0.07)]';
  const textStyle = isDark ? 'text-zinc-500' : 'text-[#888]';
  const borderStyle = isDark ? 'border-zinc-800' : 'border-[rgba(0,0,0,0.07)]';
  return (
    <div className={`flex items-center justify-between px-6 py-4 border-t ${borderStyle}`}>
      <span className={`text-xs ${textStyle}`}>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(page - 1)} disabled={page === 0 || pageLoading} className={`px-3 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-colors ${btnStyle}`}>Previous</button>
        <button onClick={() => onPageChange(page + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount || pageLoading} className={`px-3 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-colors ${btnStyle}`}>Next</button>
      </div>
    </div>
  );
}

// Social share icon SVGs (inline to avoid extra packages)
function TwitterXIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Email Tab ─────────────────────────────────────────────────────────────────
function EmailTab({ form, formUrl, isFreePlan }: { form: any; formUrl: string; isFreePlan?: boolean }) {
  const cfg = form.config ?? {};
  const isEvent = cfg.eventDetails?.isEvent === true;
  const isCourse  = cfg.isCourse === true;
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Quick send state
  const [quickTo, setQuickTo]           = useState('');
  const [quickType, setQuickType]       = useState<'confirmation' | 'reminder' | 'course-result'>('confirmation');
  const [quickSending, setQuickSending] = useState(false);
  const [quickResult, setQuickResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // Blast state
  const [blastSubject, setBlastSubject] = useState('');
  const [blastBody, setBlastBody]       = useState('');
  const [blasting, setBlasting]         = useState(false);
  const [blastResult, setBlastResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [blastTone, setBlastTone]       = useState<'friendly' | 'professional' | 'casual'>('friendly');
  const [blastPurpose, setBlastPurpose] = useState('event update');
  const [blastPrompt, setBlastPrompt]   = useState('');
  const [blastAiLoading, setBlastAiLoading] = useState(false);
  const [blastAiResult, setBlastAiResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Reminder state (events only)
  const [reminderType, setReminderType] = useState<'24hr' | '1hr'>('24hr');
  const [reminding, setReminding]       = useState(false);
  const [reminderResult, setReminderResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Fetch all participant emails

  const handleQuickSend = async () => {
    if (!isValidEmail(quickTo)) { setQuickResult({ ok: false, msg: 'Enter a valid email address.' }); return; }
    setQuickSending(true);
    setQuickResult(null);
    try {
      const eventBannerUrl = cfg.coverImage
        ? (/^https?:\/\//i.test(cfg.coverImage)
            ? cfg.coverImage
            : `${window.location.origin}/api/og/${form.id}`)
        : undefined;
      let payload: any = { type: quickType, to: quickTo, data: { formUrl } };
      if (isCourse) {
        // Course: send a test of the broadcast email to this single address
        if (!blastSubject.trim() || !blastBody.trim()) {
          setQuickResult({ ok: false, msg: 'Fill in the Broadcast Email subject and body first, then test here.' });
          setQuickSending(false);
          return;
        }
        payload = {
          type: 'blast',
          to: quickTo,
          data: {
            formId: form.id,
            subject: blastSubject,
            body: blastBody,
            formTitle: cfg.title || form.title,
            eventTitle: cfg.title || form.title,
            formUrl,
          },
        };
      } else if (quickType === 'confirmation') {
        payload.data = {
          eventTitle: cfg.title,
          eventDate: cfg.eventDetails?.date,
          eventTime: cfg.eventDetails?.time,
          eventLocation: cfg.eventDetails?.location,
          eventTimezone: cfg.eventDetails?.timezone,
          customTitle: cfg.postSubmission?.noticeTitle,
          customBody: cfg.postSubmission?.noticeBody,
          meetingLink: cfg.eventDetails?.eventType === 'virtual' ? cfg.eventDetails?.meetingLink : undefined,
          bannerUrl: eventBannerUrl,
          formUrl,
        };
      } else if (quickType === 'reminder') {
        payload.data = {
          formId: form.id,
          eventTitle: cfg.title,
          eventDate: cfg.eventDetails?.date,
          eventTime: cfg.eventDetails?.time,
          eventLocation: cfg.eventDetails?.location,
          eventTimezone: cfg.eventDetails?.timezone,
          meetingLink: cfg.eventDetails?.eventType === 'virtual' ? cfg.eventDetails?.meetingLink : undefined,
          bannerUrl: eventBannerUrl,
          formUrl,
          isOneHour: reminderType === '1hr',
        };
      }
      const { data: { session: quickSession } } = await supabase.auth.getSession();
      const quickHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (quickSession?.access_token) quickHeaders['Authorization'] = `Bearer ${quickSession.access_token}`;
      const res = await fetch('/api/email', { method: 'POST', headers: quickHeaders, body: JSON.stringify(payload) });
      if (res.ok) setQuickResult({ ok: true, msg: `Email sent to ${quickTo}.` });
      else { const err = await res.json().catch(() => ({})); setQuickResult({ ok: false, msg: err.error || 'Send failed.' }); }
    } catch { setQuickResult({ ok: false, msg: 'Network error.' }); }
    setQuickSending(false);
  };

  const handleBlast = async () => {
    if (!blastSubject.trim() || !blastBody.trim()) {
      setBlastResult({ ok: false, msg: 'Subject and body are required.' });
      return;
    }
    setBlasting(true);
    setBlastResult(null);
    try {
      const eventBannerUrl = cfg.coverImage
        ? (/^https?:\/\//i.test(cfg.coverImage)
            ? cfg.coverImage
            : `${window.location.origin}/api/og/${form.id}`)
        : undefined;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          type: 'blast',
          data: {
            formId: form.id,
            subject: blastSubject,
            body: blastBody,
            formTitle: cfg.title || form.title,
            eventTitle: cfg.title || form.title,
            eventDate: cfg.eventDetails?.date,
            eventTime: cfg.eventDetails?.time,
            eventTimezone: cfg.eventDetails?.timezone,
            eventLocation: cfg.eventDetails?.location,
            meetingLink: cfg.eventDetails?.meetingLink,
            bannerUrl: eventBannerUrl,
            formUrl,
          },
        }),
      });
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        const count = result.count ?? 0;
        setBlastResult({ ok: true, msg: `Sent to ${count} recipient${count !== 1 ? 's' : ''}.` });
        setBlastSubject('');
        setBlastBody('');
      } else {
        const err = await res.json().catch(() => ({}));
        setBlastResult({ ok: false, msg: err.error || 'Send failed.' });
      }
    } catch { setBlastResult({ ok: false, msg: 'Network error. Please try again.' }); }
    setBlasting(false);
  };

  const handleGenerateBroadcastEmail = async () => {
    setBlastAiLoading(true);
    setBlastAiResult(null);
    try {
      const { data: { session: aiSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiSession?.access_token ?? ''}` },
        body: JSON.stringify({
          action: 'generate_broadcast_email',
          formTitle: cfg.title || form.title,
          description: cfg.description,
          audience: isEvent ? 'registrants' : isCourse ? 'participants' : 'respondents',
          tone: blastTone,
          purpose: blastPurpose.trim() || 'event update',
          prompt: blastPrompt.trim(),
          eventDetails: cfg.eventDetails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'AI request failed');
      setBlastSubject(data.subject || '');
      setBlastBody(data.body || '');
      setBlastAiResult({ ok: true, msg: 'Broadcast email draft generated.' });
      setBlastResult(null);
    } catch (e: any) {
      setBlastAiResult({ ok: false, msg: e?.message || 'Failed to generate broadcast email.' });
    }
    setBlastAiLoading(false);
  };

  const handleReminder = async () => {
    setReminding(true);
    setReminderResult(null);
    try {
      const eventBannerUrl = cfg.coverImage
        ? (/^https?:\/\//i.test(cfg.coverImage)
            ? cfg.coverImage
            : `${window.location.origin}/api/og/${form.id}`)
        : undefined;
      const { data: { session: reminderSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(reminderSession?.access_token ? { 'Authorization': `Bearer ${reminderSession.access_token}` } : {}) },
        body: JSON.stringify({
          type: 'reminder',
          data: {
            formId: form.id,
            eventTitle: cfg.title,
            eventDate: cfg.eventDetails?.date,
            eventTime: cfg.eventDetails?.time,
            eventLocation: cfg.eventDetails?.location,
            eventTimezone: cfg.eventDetails?.timezone,
            meetingLink: cfg.eventDetails?.eventType === 'virtual' ? cfg.eventDetails?.meetingLink : undefined,
            bannerUrl: eventBannerUrl,
            formUrl,
            isOneHour: reminderType === '1hr'
          },
        }),
      });
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        const count = result.count ?? 0;
        setReminderResult({ ok: true, msg: `Reminder sent to ${count} registrant${count !== 1 ? 's' : ''}.` });
      } else { const err = await res.json().catch(() => ({})); setReminderResult({ ok: false, msg: err.error || 'Send failed.' }); }
    } catch { setReminderResult({ ok: false, msg: 'Network error. Please try again.' }); }
    setReminding(false);
  };

  const quickTypes = [
    ...(isEvent  ? [{ value: 'confirmation', label: 'Registration Confirmation' }, { value: 'reminder', label: 'Event Reminder' }] : []),
    ...(isCourse   ? [{ value: 'course-result',  label: 'Course Result (sample)'      }] : []),
    ...(!isEvent && !isCourse ? [{ value: 'confirmation', label: 'Confirmation' }] : []),
  ] as { value: typeof quickType; label: string }[];

  // ── Shared style tokens ──
  const card = isDark
    ? 'bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden'
    : 'bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl overflow-hidden shadow-sm';

  const cardHeader = isDark
    ? 'px-6 py-4 border-b border-zinc-800 flex items-center gap-3'
    : 'px-6 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-3';

  const cardTitle = isDark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-gray-900';
  const cardSub   = isDark ? 'text-xs text-zinc-500 mt-0.5' : 'text-xs text-gray-400 mt-0.5';

  const label = isDark
    ? 'block text-xs font-medium text-zinc-400 mb-1.5'
    : 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  const input = isDark
    ? 'w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all'
    : 'w-full bg-[#f5f6f7] border border-[rgba(0,0,0,0.07)] rounded-xl px-4 py-3 text-sm text-[#111] placeholder:text-[#aaa] focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all';

  const textarea = `${input} resize-none leading-relaxed`;

  const primaryBtn = 'w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';

  const feedback = (ok: boolean) => ok
    ? (isDark
        ? 'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        : 'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-700')
    : (isDark
        ? 'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm bg-rose-500/10 border border-rose-500/20 text-rose-400'
        : 'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-600');

  const iconColor = isDark ? 'text-emerald-400' : 'text-emerald-600';
  const sectionIconBg = isDark ? 'p-2 rounded-lg bg-emerald-500/10' : 'p-2 rounded-lg bg-emerald-50';

  return (
    <div className="max-w-2xl mx-auto space-y-4 py-2">

      {/* ── Blast Email ── */}
      <div className={card}>
        <div className={cardHeader}>
          <div className={sectionIconBg}>
            <Mail className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div>
            <p className={cardTitle}>Broadcast Email</p>
            <p className={cardSub}>
              Send a message to all {isEvent ? 'registrants' : isCourse ? 'participants' : 'respondents'} with an email address
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className={isDark ? 'rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3' : 'rounded-xl border border-[rgba(0,0,0,0.07)] bg-[#f5f6f7] p-4 space-y-3'}>
            <div className="flex items-start gap-3">
              <div className={sectionIconBg}>
                <Sparkles className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className={cardTitle}>AI Draft</p>
                <p className={cardSub}>Generate the subject and message for your broadcast email.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Tone</label>
                <select
                  value={blastTone}
                  onChange={e => setBlastTone(e.target.value as 'friendly' | 'professional' | 'casual')}
                  className={input}
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div>
                <label className={label}>Purpose</label>
                <input
                  type="text"
                  value={blastPurpose}
                  onChange={e => setBlastPurpose(e.target.value)}
                  placeholder="e.g. reminder, venue change, last call"
                  className={input}
                />
              </div>
            </div>
            <div>
              <label className={label}>Extra instructions</label>
              <textarea
                value={blastPrompt}
                onChange={e => setBlastPrompt(e.target.value)}
                placeholder="Optional: mention urgency, promo angle, what attendees should do next, or any details to emphasize."
                rows={3}
                className={textarea}
              />
            </div>
            {blastAiResult && (
              <div className={feedback(blastAiResult.ok)}>
                {blastAiResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{blastAiResult.msg}</span>
              </div>
            )}
            <button
              onClick={handleGenerateBroadcastEmail}
              disabled={blastAiLoading}
              className={primaryBtn}
              style={{ background: '#059669' }}
            >
              {blastAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Generate Broadcast Email</>}
            </button>
          </div>

          <div>
            <label className={label}>Subject</label>
            <input
              type="text"
              value={blastSubject}
              onChange={e => { setBlastSubject(e.target.value); setBlastResult(null); }}
              placeholder="e.g. Important update about your registration"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Message</label>
            <textarea
              value={blastBody}
              onChange={e => { setBlastBody(e.target.value); setBlastResult(null); }}
              placeholder="Write your message here..."
              rows={5}
              className={textarea}
            />
          </div>
          <div className={isDark ? 'rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-500' : 'rounded-xl border border-[rgba(0,0,0,0.07)] bg-[#f5f6f7] px-4 py-3 text-xs text-[#888]'}>
            Available tags: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{form_title}}'}</code>, <code>{'{{event_title}}'}</code>, <code>{'{{event_date}}'}</code>, <code>{'{{event_time}}'}</code>, <code>{'{{event_timezone}}'}</code>, <code>{'{{event_location}}'}</code>, <code>{'{{meeting_link}}'}</code>, <code>{'{{form_url}}'}</code>
          </div>
          {blastResult && (
            <div className={feedback(blastResult.ok)}>
              {blastResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{blastResult.msg}</span>
            </div>
          )}
          {isFreePlan && (
            <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
              <span className="text-base">✦</span>
              Email broadcasts are not available on the free plan. Upgrade to Pro.
            </div>
          )}
          <button
            onClick={handleBlast}
            disabled={blasting || !blastSubject.trim() || !blastBody.trim() || isFreePlan}
            title={isFreePlan ? 'Upgrade to Pro to send broadcast emails' : undefined}
            className={primaryBtn}
            style={{ background: isFreePlan ? undefined : '#059669', opacity: isFreePlan ? 0.5 : undefined, cursor: isFreePlan ? 'not-allowed' : undefined }}
          >
            {blasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Broadcast</>}
          </button>
          <p className={isDark ? 'text-xs text-zinc-600 text-center' : 'text-xs text-gray-400 text-center'}>
            Only recipients who provided an email address will receive this.
          </p>
        </div>
      </div>

      {/* ── Event Reminder (bulk) ── */}
      {isEvent && (
        <div className={card}>
          <div className={cardHeader}>
            <div className={sectionIconBg}>
              <Bell className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div>
              <p className={cardTitle}>Event Reminder</p>
              <p className={cardSub}>Notify all registrants about the upcoming event</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['24hr', '1hr'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setReminderType(t)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    reminderType === t
                      ? isDark
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : isDark
                        ? 'border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                        : 'border-[rgba(0,0,0,0.07)] text-[#888] hover:border-[rgba(0,0,0,0.14)] hover:text-[#555] bg-white'
                  }`}
                >
                  {t === '24hr' ? '24 Hours Before' : '1 Hour Before'}
                </button>
              ))}
            </div>
            {reminderResult && (
              <div className={feedback(reminderResult.ok)}>
                {reminderResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{reminderResult.msg}</span>
              </div>
            )}
            {isFreePlan && (
              <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                <span className="text-base">✦</span>
                Email reminders are not available on the free plan. Upgrade to Pro.
              </div>
            )}
            <button
              onClick={handleReminder}
              disabled={reminding || !!isFreePlan}
              title={isFreePlan ? 'Upgrade to Pro to send email reminders' : undefined}
              className={primaryBtn}
              style={{ background: isFreePlan ? undefined : '#059669', opacity: isFreePlan ? 0.5 : undefined, cursor: isFreePlan ? 'not-allowed' : undefined }}
            >
              {reminding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send {reminderType === '1hr' ? '1-Hour' : '24-Hour'} Reminder</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Send Now (Quick Send) ── */}
      <div className={card}>
        <div className={cardHeader}>
          <div className={sectionIconBg}>
            <Send className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div>
            <p className={cardTitle}>Send to Individual</p>
            <p className={cardSub}>Send an email instantly to a single address — useful for testing or follow-ups</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={label}>Recipient Email</label>
            <input
              type="email"
              value={quickTo}
              onChange={e => { setQuickTo(e.target.value); setQuickResult(null); }}
              placeholder="recipient@example.com"
              className={input}
            />
          </div>
          {quickTypes.length > 1 && (
            <div>
              <label className={label}>Email Type</label>
              <div className="grid grid-cols-2 gap-2">
                {quickTypes.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setQuickType(t.value); setQuickResult(null); }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all text-left ${
                      quickType === t.value
                        ? isDark
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : isDark
                          ? 'border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                          : 'border-[rgba(0,0,0,0.07)] text-[#888] hover:border-[rgba(0,0,0,0.14)] hover:text-[#555] bg-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isFreePlan && (
            <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
              <span className="text-base">✦</span>
              Email features are not available on the free plan. Upgrade to Pro.
            </div>
          )}
          {quickResult && (
            <div className={feedback(quickResult.ok)}>
              {quickResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{quickResult.msg}</span>
            </div>
          )}
          <button
            onClick={handleQuickSend}
            disabled={quickSending || !quickTo.trim() || !!isFreePlan}
            title={isFreePlan ? 'Upgrade to Pro to send emails' : undefined}
            className={primaryBtn}
            style={{ background: isFreePlan ? undefined : '#059669', opacity: isFreePlan ? 0.5 : undefined, cursor: isFreePlan ? 'not-allowed' : undefined }}
          >
            {quickSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Email</>}
          </button>
          {isCourse && (
            <p className={isDark ? 'text-xs text-zinc-600 text-center' : 'text-xs text-gray-400 text-center'}>
              Sends a test using your Broadcast Email subject &amp; body
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard Tab ───────────────────────────────────────────────────────────
function LeaderboardTab({ form }: { form: any }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('responses')
      .select('data, created_at')
      .eq('form_id', form.id)
      .then(({ data }) => {
        if (!data) { setLoading(false); return; }
        const byEmail = new Map<string, any>();
        for (const r of data) {
          const key = (r.data?.email || '').toLowerCase() || `anon_${r.data?.name}`;
          const existing = byEmail.get(key);
          const pct = r.data?.percentage ?? 0;
          if (!existing || pct > (existing.data?.percentage ?? 0)) byEmail.set(key, r);
        }
        const sorted = Array.from(byEmail.values()).sort((a, b) => {
          const d = (b.data?.percentage ?? 0) - (a.data?.percentage ?? 0);
          return d !== 0 ? d : (b.data?.points ?? 0) - (a.data?.points ?? 0);
        });
        setRows(sorted);
        setLoading(false);
      });
  }, [form.id]);

  const passmark   = form.config?.passmark ?? 50;
  const totalQ     = form.config?.questions?.length ?? 0;
  const passCount  = rows.filter(r => (r.data?.percentage ?? 0) >= passmark).length;
  const avgPct     = rows.length ? Math.round(rows.reduce((s, r) => s + (r.data?.percentage ?? 0), 0) / rows.length) : 0;

  const rankStyle = (rank: number) => {
    if (rank === 1) return { color: '#f59e0b', glow: '0 0 12px rgba(245,158,11,0.4)' };
    if (rank === 2) return { color: '#cbd5e1', glow: '0 0 8px rgba(203,213,225,0.3)' };
    if (rank === 3) return { color: '#cd7c3b', glow: '0 0 8px rgba(205,124,59,0.3)' };
    return { color: isDark ? '#52525b' : '#a1a1aa', glow: 'none' };
  };

  const bg   = isDark ? 'bg-[#0a0a0a]'     : 'bg-white';
  const bdr  = isDark ? 'border-zinc-800/60' : 'border-zinc-200';
  const txt  = isDark ? 'text-white'         : 'text-zinc-900';
  const muted = isDark ? 'text-zinc-500'     : 'text-zinc-400';

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
    </div>
  );

  if (rows.length === 0) return (
    <div className={`rounded-2xl border p-16 text-center ${bg} ${bdr}`}>
      <Trophy className="w-9 h-9 mx-auto mb-3 opacity-20 text-amber-400" />
      <p className={`font-semibold ${txt}`}>No completions yet</p>
      <p className={`text-sm mt-1 ${muted}`}>The leaderboard will populate once students complete the course.</p>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completions', value: rows.length, color: '#6366f1' },
          { label: 'Avg Score', value: `${avgPct}%`, color: '#10b981' },
          { label: 'Pass Rate', value: rows.length ? `${Math.round((passCount / rows.length) * 100)}%` : '—', color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl border px-5 py-4 ${bg} ${bdr}`}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color }}>{label}</p>
            <p className={`text-2xl font-black mt-1 ${txt}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className={`rounded-2xl border overflow-hidden ${bg} ${bdr}`}>

        {/* Header */}
        <div className={`grid items-center px-5 py-3 border-b ${bdr}`} style={{ gridTemplateColumns: '44px 1fr 120px 88px' }}>
          {['Rank', 'Student', 'Score', 'XP'].map(h => (
            <span key={h} className={`text-[11px] font-semibold uppercase tracking-widest ${muted}`}>{h}</span>
          ))}
        </div>

        {rows.map((r, i) => {
          const rank   = i + 1;
          const name   = r.data?.name  || 'Anonymous';
          const score  = r.data?.score ?? 0;
          const total  = r.data?.total ?? totalQ;
          const pct    = r.data?.percentage ?? 0;
          const pts    = r.data?.points ?? 0;
          const passed = pct >= passmark;
          const rs     = rankStyle(rank);
          const isTop  = rank <= 3;

          return (
            <div
              key={i}
              className={`grid items-center px-5 py-4 border-b last:border-0 transition-all duration-150 group ${isDark ? 'border-zinc-800/40 hover:bg-zinc-900/80' : 'border-zinc-100 hover:bg-zinc-50'} ${rank === 1 ? (isDark ? 'bg-amber-500/[0.04]' : 'bg-amber-50/60') : ''}`}
              style={{ gridTemplateColumns: '44px 1fr 120px 88px' }}
            >
              {/* Rank */}
              <div className="flex items-center justify-start">
                <span
                  className="text-sm font-black tabular-nums"
                  style={{ color: rs.color, textShadow: rs.glow }}
                >
                  {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                </span>
              </div>

              {/* Student */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black"
                  style={{
                    background: isTop ? `${rs.color}22` : isDark ? '#27272a' : '#f4f4f5',
                    color: isTop ? rs.color : isDark ? '#71717a' : '#a1a1aa',
                    boxShadow: isTop ? `0 0 0 1.5px ${rs.color}44` : 'none',
                  }}
                >
                  {name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${txt}`}>{name}</p>
                </div>
              </div>

              {/* Score + bar */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-bold tabular-nums ${passed ? 'text-emerald-400' : muted}`}>{pct}%</span>
                  <span className={`text-[11px] tabular-nums ${muted}`}>{score}/{total}</span>
                </div>
                <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: passed ? '#10b981' : '#f43f5e' }}
                  />
                </div>
              </div>

              {/* XP */}
              <div>
                {pts > 0 ? (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600'}`}>
                    ⭐ {pts.toLocaleString()}
                  </span>
                ) : (
                  <span className={`text-xs ${muted}`}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Certificate Tab ───────────────────────────────────────────────────────────
const SCALE = 0.28;
const PREV_W = Math.round(1860 * SCALE);
const PREV_H = Math.round(1200 * SCALE);

function CertificateTab({ form }: { form: any }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const cfg = form.config ?? {};
  const passmark = cfg.passmark ?? 50;

  // Design settings state
  const [settings, setSettings] = useState<CertificateSettings>(DEFAULT_CERT_SETTINGS);
  const [, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Certificates list state
  const [certs, setCerts] = useState<any[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Unissued passed students
  const [unissued, setUnissued] = useState<any[]>([]);

  const bgRef  = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef  = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CertificateSettings>(key: K, val: CertificateSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  // Load existing settings and certificates
  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const [{ data: settingsRow }, { data: defaultsRow }, { data: certRows }, { data: responses }] = await Promise.all([
        supabase.from('certificate_settings').select('*').eq('form_id', form.id).single(),
        supabase.from('certificate_defaults').select('*').eq('user_id', authUser?.id ?? '').single(),
        supabase.from('certificates').select('*').eq('form_id', form.id).order('issued_at', { ascending: false }),
        supabase.from('responses').select('*').eq('form_id', form.id),
      ]);
      // Use course-specific settings if they exist, otherwise fall back to creator's default
      const row = settingsRow ?? defaultsRow;
      if (row) {
        setSettings({
          institutionName:    row.institution_name    ?? DEFAULT_CERT_SETTINGS.institutionName,
          primaryColor:       row.primary_color       ?? DEFAULT_CERT_SETTINGS.primaryColor,
          accentColor:        row.accent_color        ?? DEFAULT_CERT_SETTINGS.accentColor,
          backgroundImageUrl: row.background_image_url ?? null,
          logoUrl:            row.logo_url            ?? null,
          signatureUrl:       row.signature_url       ?? null,
          signatoryName:      row.signatory_name      ?? DEFAULT_CERT_SETTINGS.signatoryName,
          signatoryTitle:     row.signatory_title     ?? DEFAULT_CERT_SETTINGS.signatoryTitle,
          certifyText:        row.certify_text        ?? DEFAULT_CERT_SETTINGS.certifyText,
          completionText:     row.completion_text     ?? DEFAULT_CERT_SETTINGS.completionText,
          fontFamily:         (row.font_family        ?? DEFAULT_CERT_SETTINGS.fontFamily)  as CertificateSettings['fontFamily'],
          headingSize:        (row.heading_size       ?? DEFAULT_CERT_SETTINGS.headingSize) as CertificateSettings['headingSize'],
          paddingTop:         row.padding_top         ?? DEFAULT_CERT_SETTINGS.paddingTop,
          paddingLeft:        row.padding_left        ?? DEFAULT_CERT_SETTINGS.paddingLeft,
          lineSpacing:        (row.line_spacing       ?? DEFAULT_CERT_SETTINGS.lineSpacing) as CertificateSettings['lineSpacing'],
        });
      }
      setSettingsLoaded(true);
      if (certRows) setCerts(certRows);

      // Find passed students without a certificate
      if (responses) {
        const issuedResponseIds = new Set((certRows ?? []).map((c: any) => c.response_id));
        const passed = responses.filter((r: any) =>
          r.data?.passed === true &&
          r.data?.name &&
          !issuedResponseIds.has(r.id)
        );
        setUnissued(passed);
      }
      setCertsLoading(false);
    };
    load();
  }, [form.id]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMsg(null);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const shared = {
      institution_name:     settings.institutionName,
      primary_color:        settings.primaryColor,
      accent_color:         settings.accentColor,
      background_image_url: settings.backgroundImageUrl ?? null,
      logo_url:             settings.logoUrl ?? null,
      signature_url:        settings.signatureUrl ?? null,
      signatory_name:       settings.signatoryName,
      signatory_title:      settings.signatoryTitle,
      certify_text:         settings.certifyText,
      completion_text:      settings.completionText,
      font_family:          settings.fontFamily,
      heading_size:         settings.headingSize,
      padding_top:          settings.paddingTop ?? 280,
      padding_left:         settings.paddingLeft ?? 182,
      line_spacing:         settings.lineSpacing ?? 'normal',
      updated_at:           new Date().toISOString(),
    };
    // Save course-specific settings AND update creator's global default
    const [{ error }] = await Promise.all([
      supabase.from('certificate_settings').upsert({ form_id: form.id, ...shared }, { onConflict: 'form_id' }),
      authUser ? supabase.from('certificate_defaults').upsert({ user_id: authUser.id, ...shared }, { onConflict: 'user_id' }) : Promise.resolve({ error: null }),
    ]);
    setSaveMsg(error ? { ok: false, msg: 'Save failed. Please try again.' } : { ok: true, msg: 'Design saved and set as your new default.' });
    setSaving(false);
  };

  const handleImageUpload = async (slot: 'background' | 'logo' | 'signature', file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    setUploading(slot);
    const ext  = file.name.split('.').pop() ?? 'png';
    const path = `${form.id}/${slot}.${ext}`;
    const { error } = await supabase.storage.from('cert-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('cert-assets').getPublicUrl(path);
      // eslint-disable-next-line react-hooks/purity -- Safe: impure call inside an async event handler, not render
      const url = `${publicUrl}?v=${Date.now()}`;
      if (slot === 'background') set('backgroundImageUrl', url);
      if (slot === 'logo')       set('logoUrl', url);
      if (slot === 'signature')  set('signatureUrl', url);
    }
    setUploading(null);
  };

  const handleIssue = async (responseId: string, studentName: string, studentEmail: string) => {
    setActionLoading(responseId);
    const { data, error } = await supabase.from('certificates').insert({
      form_id:       form.id,
      response_id:   responseId,
      student_name:  studentName,
      student_email: studentEmail || null,
    }).select('*').single();
    if (!error && data) {
      setCerts(prev => [data, ...prev]);
      setUnissued(prev => prev.filter(r => r.id !== responseId));
    }
    setActionLoading(null);
  };

  const handleRevoke = async (certId: string) => {
    setActionLoading(certId);
    await supabase.from('certificates').update({ revoked: true, revoked_at: new Date().toISOString() }).eq('id', certId);
    setCerts(prev => prev.map(c => c.id === certId ? { ...c, revoked: true } : c));
    setActionLoading(null);
  };

  const handleReissue = async (certId: string) => {
    setActionLoading(certId);
    await supabase.from('certificates').update({ revoked: false, revoked_at: null, issued_at: new Date().toISOString() }).eq('id', certId);
    setCerts(prev => prev.map(c => c.id === certId ? { ...c, revoked: false } : c));
    setActionLoading(null);
  };

  // Shared styles
  const card   = isDark ? 'bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden' : 'bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl shadow-sm overflow-hidden';
  const hdr    = isDark ? 'px-6 py-4 border-b border-zinc-800 flex items-center gap-3' : 'px-6 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-3';
  const inp    = isDark ? 'w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors' : 'w-full bg-[#f5f6f7] border border-[rgba(0,0,0,0.07)] rounded-xl px-3 py-2.5 text-sm text-[#111] placeholder:text-[#aaa] focus:outline-none focus:border-emerald-400 transition-colors';
  const lbl    = isDark ? 'block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider' : 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider';
  const btn    = isDark ? 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50' : 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50';
  const outBtn = isDark ? 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors disabled:opacity-50' : 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-[rgba(0,0,0,0.07)] text-[#888] hover:border-[rgba(0,0,0,0.14)] hover:text-[#111] transition-colors bg-white disabled:opacity-50';

  return (
    <div className="space-y-6">
      {/* ── Design Editor ── */}
      <div className={card}>
        <div className={hdr}>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className={isDark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-gray-900'}>Certificate Design</p>
            <p className={isDark ? 'text-xs text-zinc-500' : 'text-xs text-gray-400'}>Customise the look of certificates issued for this course</p>
          </div>
        </div>
        <div className="p-6 grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: settings form */}
          <div className="space-y-5">
            {/* Institution */}
            <div>
              <label className={lbl}>Institution Name</label>
              <input value={settings.institutionName} onChange={e => set('institutionName', e.target.value)} placeholder="FestMan" className={inp} />
            </div>
            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Primary Color</label>
                <div className="flex gap-2">
                  <input type="color" value={settings.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                    className="h-10 w-12 rounded-lg border border-zinc-700 cursor-pointer p-0.5 bg-zinc-800" />
                  <input value={settings.primaryColor} onChange={e => set('primaryColor', e.target.value)} maxLength={7} className={`${inp} font-mono text-xs`} />
                </div>
              </div>
              <div>
                <label className={lbl}>Accent Color</label>
                <div className="flex gap-2">
                  <input type="color" value={settings.accentColor} onChange={e => set('accentColor', e.target.value)}
                    className="h-10 w-12 rounded-lg border border-zinc-700 cursor-pointer p-0.5 bg-zinc-800" />
                  <input value={settings.accentColor} onChange={e => set('accentColor', e.target.value)} maxLength={7} className={`${inp} font-mono text-xs`} />
                </div>
              </div>
            </div>
            {/* Certify / Completion text */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Certify Text</label>
                <input value={settings.certifyText} onChange={e => set('certifyText', e.target.value)} placeholder="This is to certify that" className={inp} />
              </div>
              <div>
                <label className={lbl}>Completion Text</label>
                <input value={settings.completionText} onChange={e => set('completionText', e.target.value)} placeholder="has successfully completed" className={inp} />
              </div>
            </div>
            {/* Signatory */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Signatory Name</label>
                <input value={settings.signatoryName} onChange={e => set('signatoryName', e.target.value)} placeholder="Dr. Jane Smith" className={inp} />
              </div>
              <div>
                <label className={lbl}>Signatory Title</label>
                <input value={settings.signatoryTitle} onChange={e => set('signatoryTitle', e.target.value)} placeholder="Program Director" className={inp} />
              </div>
            </div>
            {/* Font / Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Font Family</label>
                <select value={settings.fontFamily} onChange={e => set('fontFamily', e.target.value as any)} className={inp}>
                  <option value="serif">Serif (Georgia)</option>
                  <option value="sans-serif">Sans-serif (Inter)</option>
                  <option value="lato">Lato</option>
                  <option value="source-sans-pro">Source Sans Pro</option>
                  <option value="script">Script</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Name Size</label>
                <select value={settings.headingSize} onChange={e => set('headingSize', e.target.value as any)} className={inp}>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
            </div>
            {/* Images */}
            <div className="space-y-3">
              <label className={lbl}>Images</label>
              {(['background', 'logo', 'signature'] as const).map(slot => {
                const labels = { background: 'Background', logo: 'Logo / Seal', signature: 'Signature' };
                const urlKey: Record<string, keyof CertificateSettings> = { background: 'backgroundImageUrl', logo: 'logoUrl', signature: 'signatureUrl' };
                const ref = slot === 'background' ? bgRef : slot === 'logo' ? logoRef : sigRef;
                const url = settings[urlKey[slot]] as string | null | undefined;
                return (
                  <div key={slot} className="flex items-center gap-3">
                    <input ref={ref} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(slot, f); e.target.value = ''; }} />
                    <button onClick={() => ref.current?.click()} disabled={!!uploading} className={outBtn}>
                      {uploading === slot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {url ? `Replace ${labels[slot]}` : `Upload ${labels[slot]}`}
                    </button>
                    {url && (
                      <button onClick={() => set(urlKey[slot] as any, null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Save */}
            {saveMsg && (
              <div className={`flex items-center gap-2 text-sm ${saveMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                {saveMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {saveMsg.msg}
              </div>
            )}
            <button onClick={handleSaveSettings} disabled={saving} className={btn}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Design'}
            </button>
          </div>

          {/* Right: live preview */}
          <div className="lg:sticky lg:top-20">
            <p className={isDark ? 'text-xs font-medium text-zinc-400 mb-3' : 'text-xs font-medium text-gray-500 mb-3'}>
              Live Preview <span className="opacity-50">(28% scale)</span>
            </p>
            <div style={{ width: `${PREV_W}px`, height: `${PREV_H}px`, position: 'relative', overflow: 'hidden', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: '1860px', height: '1200px' }}>
                <CertificateTemplate
                  certId="PREVIEW0"
                  studentName="Thomas Festus Cudjoe"
                  courseName={cfg.title || form.title || 'Course Title'}
                  issueDate={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  settings={settings}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Issued Certificates ── */}
      <div className={card}>
        <div className={hdr}>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className={isDark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-gray-900'}>
              Issued Certificates
              {certs.length > 0 && <span className="ml-2 text-xs font-normal text-zinc-500">{certs.filter(c => !c.revoked).length} active</span>}
            </p>
            <p className={isDark ? 'text-xs text-zinc-500' : 'text-xs text-gray-400'}>
              Certificates are auto-issued when students pass (≥{passmark}%)
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Unissued passed students */}
          {unissued.length > 0 && (
            <div className={isDark ? 'rounded-xl border border-amber-500/20 bg-amber-500/5 p-4' : 'rounded-xl border border-amber-200 bg-amber-50 p-4'}>
              <p className={isDark ? 'text-xs font-semibold text-amber-400 mb-3' : 'text-xs font-semibold text-amber-700 mb-3'}>
                {unissued.length} student{unissued.length !== 1 ? 's' : ''} passed but haven&apos;t received a certificate yet
              </p>
              <div className="space-y-2">
                {unissued.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3">
                    <div>
                      <span className={isDark ? 'text-sm text-white font-medium' : 'text-sm text-gray-800 font-medium'}>{r.data?.name || 'Student'}</span>
                      {r.data?.email && <span className={isDark ? 'text-xs text-zinc-500 ml-2' : 'text-xs text-gray-400 ml-2'}>{r.data.email}</span>}
                      <span className={isDark ? 'text-xs text-zinc-600 ml-2' : 'text-xs text-gray-400 ml-2'}>{r.data?.percentage}%</span>
                    </div>
                    <button onClick={() => handleIssue(r.id, r.data?.name || 'Student', r.data?.email || '')}
                      disabled={actionLoading === r.id} className={`${outBtn} border-emerald-600/40 text-emerald-400 hover:border-emerald-500`}>
                      {actionLoading === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                      Issue
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {certsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
          ) : certs.length === 0 ? (
            <div className="text-center py-10">
              <Award className={isDark ? 'w-8 h-8 text-zinc-700 mx-auto mb-2' : 'w-8 h-8 text-gray-300 mx-auto mb-2'} />
              <p className={isDark ? 'text-sm text-zinc-500' : 'text-sm text-gray-400'}>No certificates issued yet</p>
              <p className={isDark ? 'text-xs text-zinc-600 mt-1' : 'text-xs text-gray-300 mt-1'}>Students who pass the course will automatically receive one</p>
            </div>
          ) : (
            <div className="space-y-2">
              {certs.map(c => (
                <div key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl ${isDark ? 'bg-zinc-800/40' : 'bg-[#f5f6f7]'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={isDark ? 'text-sm font-medium text-white truncate' : 'text-sm font-medium text-gray-900 truncate'}>{c.student_name}</span>
                      {c.revoked
                        ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Revoked</span>
                        : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                      }
                    </div>
                    {c.student_email && <p className={isDark ? 'text-xs text-zinc-500 mt-0.5' : 'text-xs text-gray-400 mt-0.5'}>{c.student_email}</p>}
                    <p className={isDark ? 'text-xs text-zinc-600 mt-0.5' : 'text-xs text-gray-300 mt-0.5'}>
                      {new Date(c.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · ID: {c.id.slice(0,8).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={`/certificate/${c.id}`} target="_blank" rel="noreferrer" className={outBtn}>
                      <LinkIcon className="w-3.5 h-3.5" /> View
                    </a>
                    {c.revoked ? (
                      <button onClick={() => handleReissue(c.id)} disabled={actionLoading === c.id} className={outBtn}>
                        {actionLoading === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Re-issue
                      </button>
                    ) : (
                      <button onClick={() => handleRevoke(c.id)} disabled={actionLoading === c.id}
                        className={`${outBtn} hover:border-rose-500/40 hover:text-rose-400`}>
                        {actionLoading === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── More Tab ──────────────────────────────────────────────────────────────────
function MoreTab({ form, formUrl, onClone }: { form: any; formUrl: string; onClone: () => Promise<void> }) {
  const { copied: linkCopied, copy: copyLink } = useCopy();
  const { copied: embedCopied, copy: copyEmbed } = useCopy();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const textPrim  = isLight ? '#111'              : '#fff';
  const textMut   = isLight ? '#555'              : '#71717a';
  const divider   = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(63,63,70,0.6)';
  const inputBg   = isLight ? '#f0fdf4'           : '#18181b';
  const inputBord = isLight ? '#d1d5db'           : '#3f3f46';
  const btnBg     = isLight ? '#f3f4f6'           : '#27272a';
  const btnBord   = isLight ? 'rgba(0,0,0,0.10)'  : '#3f3f46';
  const codeBg    = isLight ? '#f3f4f6'           : '#18181b';

  const embedCode = `<iframe
  src="${formUrl}"
  width="600"
  height="700"
  frameborder="0"
  style="border: 1px solid #bfcbda88; border-radius: 4px;"
  allow="fullscreen; payment"
  aria-hidden="false"
  tabindex="0"
></iframe>`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(formUrl)}&margin=12&color=ffffff&bgcolor=18181b&qzone=1`;

  const shareText = encodeURIComponent(`Check out this form: ${form.title}`);
  const shareUrl = encodeURIComponent(formUrl);

  const socialLinks = [
    {
      label: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
      Icon: TwitterXIcon,
      color: '#1DA1F2',
      bg: 'rgba(29,161,242,0.1)',
      border: 'rgba(29,161,242,0.25)',
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      Icon: LinkedInIcon,
      color: '#0A66C2',
      bg: 'rgba(10,102,194,0.1)',
      border: 'rgba(10,102,194,0.25)',
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      Icon: FacebookIcon,
      color: '#1877F2',
      bg: 'rgba(24,119,242,0.1)',
      border: 'rgba(24,119,242,0.25)',
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${shareText}%20${shareUrl}`,
      Icon: WhatsAppIcon,
      color: '#25D366',
      bg: 'rgba(37,211,102,0.1)',
      border: 'rgba(37,211,102,0.25)',
    },
  ];

  const handleClone = async () => {
    setCloning(true);
    await onClone();
    setCloning(false);
    setCloned(true);
    setTimeout(() => setCloned(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto" style={{ color: textPrim }}>
      {/* Clone */}
      <div className="py-6 flex items-center justify-between gap-4" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center gap-3">
          <GitFork className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <div>
            <p className="text-base font-semibold" style={{ color: textPrim }}>Clone Form</p>
            <p className="text-sm mt-0.5" style={{ color: textMut }}>Duplicate this form as a new draft</p>
          </div>
        </div>
        <button
          onClick={handleClone}
          disabled={cloning || cloned}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border disabled:opacity-60 flex-shrink-0"
          style={cloned ? { borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' } : { borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}
        >
          {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : cloned ? <><Check className="w-4 h-4" /> Cloned!</> : <><GitFork className="w-4 h-4" /> Clone</>}
        </button>
      </div>

      {/* Share link */}
      <div className="py-6 space-y-3" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center gap-3 mb-3">
          <Share2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-base font-semibold" style={{ color: textPrim }}>Share Link</p>
            <p className="text-sm mt-0.5" style={{ color: textMut }}>Copy the direct URL</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl overflow-hidden" style={{ background: inputBg, border: `1px solid ${inputBord}` }}>
          <span className="flex-1 text-sm px-3 py-2.5 truncate font-mono" style={{ color: textMut }}>{formUrl}</span>
          <button
            onClick={() => copyLink(formUrl)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors flex-shrink-0 hover:opacity-80"
            style={{ background: btnBg, color: textPrim, borderLeft: `1px solid ${inputBord}` }}
          >
            {linkCopied ? <><Check className="w-4 h-4 text-emerald-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>
      </div>

      {/* Social share */}
      <div className="py-6 space-y-3" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center gap-3">
          <Share2 className="w-5 h-5 text-pink-400 flex-shrink-0" />
          <div>
            <p className="text-base font-semibold" style={{ color: textPrim }}>Share on Social</p>
            <p className="text-sm mt-0.5" style={{ color: textMut }}>Spread the word on your favourite platforms</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {socialLinks.map(({ label, href, Icon, color, bg, border }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold border transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ background: bg, borderColor: border, color }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* HTML Embed */}
      <div className="py-6 space-y-3" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Code2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-base font-semibold" style={{ color: textPrim }}>HTML Embed</p>
              <p className="text-sm mt-0.5" style={{ color: textMut }}>Drop this snippet into any webpage</p>
            </div>
          </div>
          <button
            onClick={() => copyEmbed(embedCode)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 hover:opacity-80"
            style={{ border: `1px solid ${btnBord}`, background: btnBg, color: textMut }}
          >
            {embedCopied ? <><Check className="w-4 h-4 text-emerald-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>
        <pre className="rounded-xl px-4 py-3.5 text-sm font-mono overflow-x-auto whitespace-pre leading-relaxed"
          style={{ background: codeBg, border: `1px solid ${inputBord}`, color: textMut }}>
          {embedCode}
        </pre>
      </div>

      {/* QR Code */}
      <div className="py-6 space-y-3" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center gap-3">
          <QrCode className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-base font-semibold" style={{ color: textPrim }}>QR Code</p>
            <p className="text-sm mt-0.5" style={{ color: textMut }}>Scan to open the form</p>
          </div>
        </div>
        <div className="flex items-start gap-5">
          <img src={qrUrl} alt="QR Code" className="w-32 h-32 rounded-xl flex-shrink-0" style={{ border: `1px solid ${inputBord}` }} />
          <div className="space-y-2 pt-1">
            <p className="text-sm leading-relaxed" style={{ color: textMut }}>Print or display at your event — attendees scan to open instantly.</p>
            <a href={qrUrl} download={`qr-${form.slug || form.id}.png`} className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-70" style={{ color: textMut }}>
              <Download className="w-4 h-4" /> Download QR
            </a>
          </div>
        </div>
      </div>

      {/* Open live */}
      <div className="py-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ExternalLink className="w-5 h-5 flex-shrink-0" style={{ color: textMut }} />
          <div>
            <p className="text-base font-semibold" style={{ color: textPrim }}>Open Live Page</p>
            <p className="text-sm mt-0.5" style={{ color: textMut }}>View as respondents see it</p>
          </div>
        </div>
        <a
          href={formUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 hover:opacity-80"
          style={{ border: `1px solid ${btnBord}`, background: btnBg, color: textPrim }}
        >
          <ExternalLink className="w-4 h-4" /> Open
        </a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FormDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [courseProgress, setCourseProgress] = useState<any[]>([]);
  const initialTab = (searchParams.get('tab') as TabId) || 'settings';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = '/auth'; return; }

      const [{ data: { user } }, { data: formData }, { data: responseData, count }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('forms').select('*').eq('id', id as string).single(),
        supabase.from('responses').select('*', { count: 'exact' }).eq('form_id', id as string)
          .order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      ]);
      if (!user) { window.location.href = '/auth'; return; }
      if (formData) setForm(formData);
      if (responseData) setResponses(responseData);
      setTotalCount(count ?? 0);

      // Fetch plan + live email limit from plan_config (DB-driven, not hardcoded)
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
      const plan = profile?.plan || 'free';
      const { data: planCfg } = await supabase.from('plan_config').select('emails').eq('plan', plan).single();
      // emails === 0 means blocked; -1 or any positive means allowed
      const emailsBlocked = planCfg ? planCfg.emails === 0 : plan === 'free';
      setIsFreePlan(emailsBlocked);

      // For courses: fetch in-progress students via authenticated API
      if (formData?.config?.isCourse) {
        const progressRes = await fetch(`/api/course-progress?formId=${encodeURIComponent(id as string)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (progressRes.ok) {
          const progressJson = await progressRes.json();
          setCourseProgress(progressJson.progress ?? []);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [id]);

  const fetchPage = async (newPage: number) => {
    setPageLoading(true);
    const from = newPage * PAGE_SIZE;
    const { data } = await supabase.from('responses').select('*')
      .eq('form_id', id as string)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (data) setResponses(data);
    setPage(newPage);
    setPageLoading(false);
  };

  const handleExport = () => {
    if (!responses.length || !form) return;
    const allKeys = Array.from(responses.reduce((keys: Set<string>, r: any) => {
      Object.keys(r.data ?? {}).forEach((k: string) => keys.add(k));
      return keys;
    }, new Set<string>()));
    const escape = (val: unknown) => {
      const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csv = [allKeys.map(escape).join(','), ...responses.map((r: any) => allKeys.map((k: string) => escape((r.data ?? {})[k])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${form.title || 'responses'}.csv`;
    a.click();
  };

  const handleClone = async () => {
    if (!form) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: cloned, error } = await supabase.from('forms').insert({
      user_id: session.user.id,
      title: `${form.title} (Copy)`,
      description: form.description,
      config: { ...form.config, title: `${form.config?.title || form.title} (Copy)` },
      slug: null,
    }).select('id').single();
    if (!error && cloned?.id) {
      router.push(`/dashboard/${cloned.id}`);
    } else {
      alert('Clone failed. Please try again.');
    }
  };

  const { theme, toggle: toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const formUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${form?.slug || id}`
    : `/${form?.slug || id}`;

  const bg       = isLight ? '#ffffff' : '#111111';
  const navBg    = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.80)';
  const navBord  = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(39,39,42,0.6)';
  const textPrim = isLight ? '#111' : '#fff';
  const textMut  = isLight ? '#555' : '#71717a';
  const btnBg    = isLight ? '#f5f6f7' : '#27272a';
  const btnBord  = isLight ? 'rgba(0,0,0,0.09)' : '#3f3f46';
  const green    = '#006128';
  const lime     = '#ADEE66';

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: green }} /></div>;
  }
  if (!form) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: bg, color: textPrim }}><p>Form not found or you don&apos;t have access.</p></div>;
  }

  const type = getFormType(form.config);
  const meta = TYPE_META[type];

  const lightBadge: Record<string, string> = {
    course: 'bg-amber-50 text-amber-700 border-amber-200',
    event:  'bg-blue-50 text-blue-700 border-blue-200',
    form:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <main className="min-h-screen font-sans" style={{ background: bg, color: textPrim }}>
      {/* Decorative blob */}
      {isLight && <div className="fixed top-0 right-0 pointer-events-none" style={{ width:180, height:180, borderRadius:'50%', background:lime, transform:'translate(35%,-25%)', opacity:0.45, zIndex:0 }} />}

      {/* ── Top header ── */}
      <header className="sticky top-0 z-20 backdrop-blur-md" style={{ borderBottom: `1px solid ${navBord}`, background: navBg }}>
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-4">
          <Link href="/dashboard" className="transition-colors flex-shrink-0 hover:opacity-60" style={{ color: textMut }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Logo + Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            {isLight && (
              <Link href="/dashboard" className="flex items-center gap-1.5 hover:opacity-70 transition-opacity flex-shrink-0">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#1a1a1a' }}>
                  <svg viewBox="0 0 24 24" fill={lime} width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
              </Link>
            )}
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${isLight ? lightBadge[type] : meta.badge}`}>
              <meta.Icon className="w-3 h-3" />
              {meta.label}
            </div>
            <span className="font-semibold truncate" style={{ color: textPrim }}>{form.title}</span>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setActiveTab('settings')} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-70" style={{ background: btnBg, border: `1px solid ${btnBord}`, color: textMut }}>
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <a href={formUrl} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-70" style={{ background: btnBg, border: `1px solid ${btnBord}`, color: textMut }}>
              <ExternalLink className="w-3.5 h-3.5" /> View
            </a>
            <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors ff-hover" title="Toggle theme" style={{ color: textMut }}>
              {isLight ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>}
            </button>
            <NotificationBell />
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="px-2 sm:px-6 flex items-center gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.filter(tab => !tab.courseOnly || type === 'course').map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); }}
                className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
                style={{ color: isActive ? textPrim : textMut }}
              >
                <tab.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === 'responses' && totalCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold transition-colors" style={{ background: isActive ? (isLight ? lime : 'rgba(255,255,255,0.15)') : (isLight ? '#e8eaed' : '#27272a'), color: isActive ? (isLight ? green : 'white') : textMut }}>
                    {totalCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="detail-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ background: isLight ? green : 'white' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {activeTab === 'settings' ? (
            <FormEditor formId={id as string} />
          ) : (
            <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-6xl w-full">
              {activeTab === 'responses' && (
                <ResponsesTab
                  form={form}
                  responses={responses}
                  totalCount={totalCount}
                  page={page}
                  pageLoading={pageLoading}
                  onExport={handleExport}
                  onPageChange={fetchPage}
                  courseProgress={courseProgress}
                />
              )}
              {activeTab === 'leaderboard' && (
                <LeaderboardTab form={form} />
              )}
              {activeTab === 'certificates' && (
                <CertificateTab form={form} />
              )}
              {activeTab === 'email' && (
                <EmailTab form={form} formUrl={formUrl} isFreePlan={isFreePlan} />
              )}
              {activeTab === 'more' && (
                <MoreTab form={form} formUrl={formUrl} onClone={handleClone} />
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
