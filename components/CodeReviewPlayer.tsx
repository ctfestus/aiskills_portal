'use client';

import React, { useState, useRef } from 'react';
import { Loader2, CheckCircle2, Zap, RotateCcw, Code2, Download, Upload, FileCode, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { downloadReviewPdf } from '@/lib/downloadReviewPdf';
import AiReviewDisclaimer from '@/components/AiReviewDisclaimer';

const LANGUAGES = ['Python', 'SQL', 'JavaScript', 'TypeScript', 'R', 'Java', 'C#', 'Other'];
const SQL_DIALECTS = ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server'];

interface RubricGrade { criterion: string; passed: boolean; comment: string; }
interface LineIssue {
  lines: string;
  severity: 'error' | 'warning' | 'suggestion';
  title: string;
  detail: string;
  fix: string;
}
interface CategoryScore {
  name: string;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}
interface ReviewResult {
  overallScore: number;
  executiveSummary: string;
  issues: LineIssue[];
  categories: CategoryScore[];
  topRecommendations: string[];
  rubricGrades?: RubricGrade[];
}

interface Props {
  reqId: string;
  isDark: boolean;
  accentColor: string;
  completed: boolean;
  savedResult?: ReviewResult;
  reviewsUsed?: number;
  rubric?: string[];
  schema?: string;
  minScore?: number;
  reviewLanguage?: string;
  maxReviews?: number;
  showAttemptCount?: boolean;
  onReviewStart?: () => void;
  onComplete: (result: ReviewResult, passed: boolean) => void;
}

function severityColor(s: LineIssue['severity']) {
  if (s === 'error')      return '#ef4444';
  if (s === 'warning')    return '#f59e0b';
  return '#3b82f6';
}
function severityLabel(s: LineIssue['severity']) {
  if (s === 'error')   return 'Error';
  if (s === 'warning') return 'Warning';
  return 'Suggestion';
}
function scoreColor(n: number) {
  if (n >= 80) return '#22c55e';
  if (n >= 60) return '#f59e0b';
  return '#ef4444';
}

export default function CodeReviewPlayer({ reqId, isDark, accentColor, completed, savedResult, reviewsUsed = 0, rubric, schema, minScore, reviewLanguage, maxReviews, showAttemptCount, onReviewStart, onComplete }: Props) {
  const atLimit = maxReviews !== undefined && reviewsUsed >= maxReviews;
  // Lock the "already completed" views only when: no per-question limit (VE/assignment), at limit,
  // or state was lost on page reload (no saved report and no further attempts).
  const shouldLock = maxReviews === undefined || atLimit || reviewsUsed === 0;
  // Offer Reset (try again) only while attempts remain. Once a submission is terminal -- completed
  // with no per-question retry budget (direct/VE assignments) -- hide it so the student can't clear
  // the saved report into an empty locked state.
  const showReset = !atLimit && !(completed && maxReviews === undefined);
  // Normalize authored language to match the LANGUAGES display array
  const lockedLanguage = reviewLanguage
    ? (LANGUAGES.find(l => l.toLowerCase() === reviewLanguage.toLowerCase()) ?? null)
    : null;

  const [code, setCode]         = useState('');
  const [language, setLanguage] = useState(lockedLanguage ?? 'Python');
  const [dialect, setDialect]   = useState('PostgreSQL');
  // Show the saved report on mount whenever one exists. When retries remain, the result view's
  // Reset button (rendered while !atLimit) lets the student start another attempt.
  const [result, setResult]     = useState<ReviewResult | null>(savedResult ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]       = useState('');
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bg     = isDark ? '#0f0f0f' : '#f8fafc';
  const card   = isDark ? '#1a1a1a' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text   = isDark ? '#f0f0f0' : '#111';
  const muted  = isDark ? '#888' : '#666';
  const input  = isDark ? '#111' : '#f9fafb';
  const inner  = isDark ? '#222' : '#f3f4f6';

  async function handleSubmit() {
    if (!code.trim()) { setError(inputMode === 'upload' ? 'Please upload a file before submitting.' : 'Please paste your code before submitting.'); return; }
    setError('');
    setAnalyzing(true);
    onReviewStart?.();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/code-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          code: code.trim(),
          language,
          ...(language === 'SQL' ? { dialect } : {}),
          ...(schema?.trim() ? { schema: schema.trim() } : {}),
          ...(rubric?.length ? { rubric } : {}),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
      const passed = !minScore || json.overallScore >= minScore;
      onComplete(json, passed);
    } catch (err: any) {
      setError(err.message || 'The AI review service is busy right now. Please wait a moment and try again. Your work has not been lost.');
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() { setCode(''); setResult(null); setError(''); setUploadedFileName(''); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setCode(text ?? '');
      setUploadedFileName(file.name);
      setError('');
    };
    reader.onerror = () => setError('Could not read file. Please try again.');
    reader.readAsText(file);
    e.target.value = '';
  }

  async function downloadPdf() {
    if (!resultsRef.current) return;
    try {
      await downloadReviewPdf(resultsRef.current, `code-review-${Date.now()}.pdf`);
    } catch (err: any) {
      setError(err?.message ?? 'PDF export failed. Please try again.');
    }
  }

  // Already completed but the saved report isn't available (e.g. older data) -- show locked state
  if (!result && completed && shouldLock) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}25` }}>
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
        <p className="text-sm font-medium" style={{ color: accentColor }}>
          Code review already submitted for this question.
        </p>
      </div>
    );
  }

  // Input state
  if (!result) {
    if (atLimit) {
      return (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', border: `1px solid ${border}` }}>
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: muted }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: text }}>Review limit reached</p>
            <p className="text-xs mt-0.5" style={{ color: muted }}>You have used all {maxReviews} allowed review attempts for this question.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <AiReviewDisclaimer isDark={isDark} />
        {/* Language selector -- locked when instructor specified a language */}
        {lockedLanguage ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: accentColor, color: '#fff' }}>
              {lockedLanguage}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: muted }}>
              <Lock className="w-3 h-3" /> Language set by instructor
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {LANGUAGES.map(lang => (
              <button key={lang} onClick={() => setLanguage(lang)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: language === lang ? accentColor : inner, color: language === lang ? '#fff' : muted }}>
                {lang}
              </button>
            ))}
          </div>
        )}

        {/* SQL dialect selector */}
        {language === 'SQL' && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dialect</p>
            <div className="flex items-center gap-2 flex-wrap">
              {SQL_DIALECTS.map(d => (
                <button key={d} onClick={() => setDialect(d)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ background: dialect === d ? `${accentColor}18` : inner,
                    color: dialect === d ? accentColor : muted,
                    border: `1px solid ${dialect === d ? `${accentColor}40` : border}`,
                    borderRadius: 6 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Code input -- paste or upload */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: inner, borderColor: border }}>
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5" style={{ color: muted }} />
              <span className="text-xs font-semibold" style={{ color: muted }}>
                {language}{language === 'SQL' ? ` · ${dialect}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1" style={{ background: isDark ? '#0a0a0a' : '#e5e7eb', borderRadius: 6, padding: 3 }}>
              {(['paste', 'upload'] as const).map(mode => (
                <button key={mode} onClick={() => setInputMode(mode)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    borderRadius: 4,
                    background: inputMode === mode ? (isDark ? '#1e1e1e' : '#fff') : 'transparent',
                    color: inputMode === mode ? text : muted,
                    boxShadow: inputMode === mode ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
                  }}>
                  {mode === 'paste' ? <><Code2 className="w-3 h-3" />Paste</> : <><Upload className="w-3 h-3" />Upload</>}
                </button>
              ))}
            </div>
          </div>

          {inputMode === 'paste' ? (
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={`Paste your ${language} code here…`}
              rows={14}
              spellCheck={false}
              className="w-full resize-none outline-none text-[13px] font-mono px-4 py-3"
              style={{ background: input, color: text, lineHeight: 1.7 }}
            />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
              style={{ minHeight: 200, background: input, padding: '32px 24px' }}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange}
                accept=".py,.js,.ts,.jsx,.tsx,.sql,.r,.R,.java,.cs,.c,.cpp,.go,.rs,.rb,.php,.swift,.kt,.scala,.txt" />
              {uploadedFileName ? (
                <>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${accentColor}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileCode className="w-5 h-5" style={{ color: accentColor }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: text }}>{uploadedFileName}</p>
                    <p className="text-xs mt-1" style={{ color: muted }}>
                      {code.split('\n').length} lines loaded -- click to replace
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: isDark ? '#1e1e1e' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${border}` }}>
                    <Upload className="w-5 h-5" style={{ color: muted }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: text }}>Click to upload your file</p>
                    <p className="text-xs mt-1" style={{ color: muted }}>
                      .py .js .ts .sql .r .java .cs and more
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

        <button onClick={handleSubmit} disabled={analyzing}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
          style={{ background: accentColor, color: '#fff', borderRadius: 8 }}>
          {analyzing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Reviewing…</>
            : <><Zap className="w-4 h-4" /> Submit for AI Review</>}
        </button>
      </div>
    );
  }

  // Result state
  const errors      = result.issues.filter(i => i.severity === 'error');
  const warnings    = result.issues.filter(i => i.severity === 'warning');
  const suggestions = result.issues.filter(i => i.severity === 'suggestion');

  return (
    <div ref={resultsRef} className="space-y-4" style={{ fontFamily: 'var(--font-sans)' }}>
      <AiReviewDisclaimer isDark={isDark} />
      {showAttemptCount && maxReviews !== undefined && reviewsUsed > 0 && (
        <p style={{ fontSize: 11, fontWeight: 600, color: muted }}>Attempt {reviewsUsed} of {maxReviews}</p>
      )}

      {/* Header */}
      <div style={{ background: isDark ? '#111827' : '#0f172a', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: '#ADEE66' }}>
                AI Code Review · {language}
              </p>
              <div className="flex items-baseline gap-2 mb-3">
                <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: '#fff', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                  {result.overallScore.toFixed(1)}
                </span>
                <span style={{ fontSize: 18, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>/100</span>
              </div>
              <div style={{ width: 200, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 0, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ height: '100%', width: `${result.overallScore}%`, background: '#ADEE66' }} />
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', maxWidth: 480 }}>{result.executiveSummary}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={downloadPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(173,238,102,0.12)', color: '#ADEE66', borderRadius: 6, border: '1px solid rgba(173,238,102,0.2)' }}>
                <Download className="w-3 h-3" /> PDF
              </button>
              {showReset && (
                <button onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Issue counts row */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { list: errors,      color: '#ef4444', label: 'Errors' },
            { list: warnings,    color: '#f59e0b', label: 'Warnings' },
            { list: suggestions, color: '#3b82f6', label: 'Suggestions' },
          ].map(({ list, color, label }, idx) => (
            <div key={label} className="flex-1 flex items-center gap-2.5 px-7 py-4"
              style={{ borderRight: idx < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: list.length > 0 ? color : 'rgba(255,255,255,0.15)', fontVariantNumeric: 'tabular-nums' }}>
                {list.length}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: list.length > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      {result.issues.length > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: muted }}>Issues</p>
          </div>
          {result.issues.map((issue, i) => {
            const color = severityColor(issue.severity);
            return (
              <div key={i} style={{
                display: 'flex', gap: 0,
                borderBottom: i < result.issues.length - 1 ? `1px solid ${border}` : 'none',
              }}>
                {/* Sharp accent bar */}
                <div style={{ width: 3, flexShrink: 0, background: color }} />
                <div style={{ flex: 1, padding: '16px 20px' }}>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
                      padding: '3px 8px', background: `${color}15`, color, borderRadius: 3 }}>
                      {severityLabel(issue.severity)}
                    </span>
                    <p style={{ fontSize: 13, fontWeight: 700, color: text }}>{issue.title}</p>
                    {issue.lines && (
                      <span style={{ fontSize: 11, padding: '2px 8px',
                        background: inner, color: muted, borderRadius: 4, marginLeft: 'auto' }}>
                        Line {issue.lines}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12.5, lineHeight: 1.6, color: muted, marginBottom: issue.fix ? 12 : 0 }}>{issue.detail}</p>
                  {issue.fix && (
                    <div style={{ background: isDark ? 'rgba(37,99,235,0.08)' : '#eff6ff',
                      borderLeft: '2px solid #3b82f6', padding: '10px 14px' }}>
                      <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3b82f6', marginBottom: 5 }}>Fix</p>
                      <p style={{ fontSize: 12.5, color: isDark ? '#93c5fd' : '#1e40af', lineHeight: 1.6 }}>{issue.fix}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rubric */}
      {result.rubricGrades && result.rubricGrades.length > 0 && (() => {
        const passed = result.rubricGrades!.filter(g => g.passed).length;
        const total  = result.rubricGrades!.length;
        const pct    = Math.round((passed / total) * 100);
        const trackColor = pct === 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
        return (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div className="flex items-center justify-between" style={{ padding: '12px 20px', borderBottom: `1px solid ${border}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: muted }}>Assignment Rubric</p>
              <div className="flex items-center gap-3">
                <div style={{ width: 80, height: 2, background: border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: trackColor }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: text, fontVariantNumeric: 'tabular-nums' }}>
                  {passed}<span style={{ fontWeight: 400, color: muted }}>/{total}</span>
                </span>
              </div>
            </div>
            {result.rubricGrades!.map((grade, i) => (
              <div key={i} className="flex items-start gap-4"
                style={{ padding: '14px 20px', borderBottom: i < result.rubricGrades!.length - 1 ? `1px solid ${border}` : 'none' }}>
                <div style={{ width: 2, alignSelf: 'stretch', flexShrink: 0, background: grade.passed ? '#22c55e' : border, marginTop: 2, marginBottom: 2 }} />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 4 }}>{grade.criterion}</p>
                  <p style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>{grade.comment}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', flexShrink: 0, marginTop: 2,
                  color: grade.passed ? '#22c55e' : muted }}>
                  {grade.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Category scores */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: muted }}>Score Breakdown</p>
        </div>
        {result.categories.map((cat, i) => (
          <div key={cat.name} className="flex items-center gap-5"
            style={{ padding: '16px 20px', borderBottom: i < result.categories.length - 1 ? `1px solid ${border}` : 'none' }}>
            <div style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: scoreColor(cat.score), lineHeight: 1, display: 'block', fontVariantNumeric: 'tabular-nums' }}>{cat.score}</span>
              <span style={{ fontSize: 9, color: muted }}>/100</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center justify-between mb-1.5">
                <p style={{ fontSize: 13, fontWeight: 700, color: text }}>{cat.name}</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(cat.score), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {cat.score >= 80 ? 'Excellent' : cat.score >= 60 ? 'Good' : cat.score >= 40 ? 'Needs Work' : 'Critical'}
                </span>
              </div>
              <div style={{ height: 2, background: border, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${cat.score}%`, background: scoreColor(cat.score) }} />
              </div>
              <p style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>{cat.summary}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Top recommendations */}
      {result.topRecommendations.length > 0 && (
        <div style={{ background: isDark ? '#111827' : '#0f172a', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#ADEE66' }}>Priority Actions</p>
          </div>
          {result.topRecommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-4"
              style={{ padding: '16px 20px', borderBottom: i < result.topRecommendations.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span style={{ flexShrink: 0, width: 20, height: 20, background: '#ADEE66', color: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, borderRadius: 4 }}>
                {i + 1}
              </span>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.65)' }}>{r}</p>
            </div>
          ))}
        </div>
      )}

      {/* Completion / gate */}
      {minScore && result.overallScore < minScore ? (
        <div className="flex items-start gap-3 px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '2px solid #ef4444' }}>
          <div style={{ flexShrink: 0, marginTop: 1 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, background: '#ef4444', borderRadius: '50%' }} />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>
              Score too low · {result.overallScore.toFixed(1)}/100 · Minimum required: {minScore}/100
            </p>
            <p style={{ fontSize: 12, color: '#ef4444', opacity: 0.8 }}>You can continue or try again with improved code -- no point awarded until the minimum is reached.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3"
          style={{ background: `${accentColor}10`, borderLeft: `2px solid ${accentColor}` }}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: accentColor }}>
            Review complete · {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''} identified
          </p>
        </div>
      )}
    </div>
  );
}
