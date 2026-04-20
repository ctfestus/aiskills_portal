'use client';

import React, { useState } from 'react';
import { Loader2, CheckCircle2, Zap, RotateCcw, Code2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

export interface LeanSubmission {
  submittedAt: string;
  overallScore: number;
  issueTitles: string[];
  topRecommendations: string[];
}

interface Props {
  reqId: string;
  isDark: boolean;
  accentColor: string;
  completed: boolean;
  submissions?: LeanSubmission[];
  rubric?: string[];
  schema?: string;
  minScore?: number;
  onComplete: (result: ReviewResult, lean: LeanSubmission, passed: boolean) => void;
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
  if (n >= 8) return '#22c55e';
  if (n >= 6) return '#f59e0b';
  return '#ef4444';
}

export default function CodeReviewPlayer({ reqId, isDark, accentColor, completed, submissions = [], rubric, schema, minScore, onComplete }: Props) {
  const [code, setCode]         = useState('');
  const [language, setLanguage] = useState('Python');
  const [dialect, setDialect]   = useState('PostgreSQL');
  const [result, setResult]     = useState<ReviewResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]       = useState('');

  const bg     = isDark ? '#0f0f0f' : '#f8fafc';
  const card   = isDark ? '#1a1a1a' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text   = isDark ? '#f0f0f0' : '#111';
  const muted  = isDark ? '#888' : '#666';
  const input  = isDark ? '#111' : '#f9fafb';
  const inner  = isDark ? '#222' : '#f3f4f6';

  async function handleSubmit() {
    if (!code.trim()) { setError('Please paste your code before submitting.'); return; }
    setError('');
    setAnalyzing(true);
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
      const lean: LeanSubmission = {
        submittedAt: new Date().toISOString(),
        overallScore: json.overallScore,
        issueTitles: (json.issues ?? []).map((i: LineIssue) => i.title),
        topRecommendations: json.topRecommendations ?? [],
      };
      const passed = !minScore || json.overallScore >= minScore;
      onComplete(json, lean, passed);
    } catch (err: any) {
      setError(err.message || 'Review failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() { setCode(''); setResult(null); setError(''); }

  // Input state
  if (!result) {
    const lastAttempt = submissions.length > 0 ? submissions[submissions.length - 1] : null;
    return (
      <div className="space-y-3">
        {lastAttempt && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg" style={{ background: inner, border: `1px solid ${border}` }}>
            <span style={{ fontSize: 12, color: muted }}>
              Attempt {submissions.length} · Last score: <span style={{ fontWeight: 700, color: scoreColor(lastAttempt.overallScore) }}>{lastAttempt.overallScore.toFixed(1)}/10</span>
            </span>
            <span style={{ fontSize: 11, color: muted }}>{new Date(lastAttempt.submittedAt).toLocaleDateString()}</span>
          </div>
        )}
        {/* Language selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {LANGUAGES.map(lang => (
            <button key={lang} onClick={() => setLanguage(lang)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: language === lang ? accentColor : inner, color: language === lang ? '#fff' : muted }}>
              {lang}
            </button>
          ))}
        </div>

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

        {/* Code textarea */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: inner, borderColor: border }}>
            <Code2 className="w-3.5 h-3.5" style={{ color: muted }} />
            <span className="text-xs font-semibold" style={{ color: muted }}>
              {language}{language === 'SQL' ? ` · ${dialect}` : ''}
            </span>
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={`Paste your ${language} code here…`}
            rows={14}
            spellCheck={false}
            className="w-full resize-none outline-none text-[13px] font-mono px-4 py-3"
            style={{ background: input, color: text, lineHeight: 1.7 }}
          />
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

  const JB = 'var(--font-mono)';
  const prev = submissions.length > 0 ? submissions[submissions.length - 1] : null;
  const currentTitles = result.issues.map(i => i.title);
  const resolvedIssues = prev ? prev.issueTitles.filter(t => !currentTitles.includes(t)) : [];
  const newIssues      = prev ? currentTitles.filter(t => !prev.issueTitles.includes(t)) : [];
  const scoreDelta     = prev ? +(result.overallScore - prev.overallScore).toFixed(1) : null;

  return (
    <div className="space-y-4" style={{ fontFamily: JB }}>

      {/* Diff panel */}
      {prev && (
        <div style={{ border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', background: card }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${border}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: muted }}>
              Attempt {submissions.length + 1} vs Attempt {submissions.length}
            </p>
            <span style={{ fontSize: 13, fontWeight: 800, color: scoreDelta! > 0 ? '#22c55e' : scoreDelta! < 0 ? '#ef4444' : muted, fontVariantNumeric: 'tabular-nums' }}>
              {scoreDelta! > 0 ? '+' : ''}{scoreDelta} pts
            </span>
          </div>
          <div className="flex">
            <div className="flex-1 px-5 py-4" style={{ borderRight: `1px solid ${border}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#22c55e', marginBottom: 8 }}>
                Fixed ({resolvedIssues.length})
              </p>
              {resolvedIssues.length === 0
                ? <p style={{ fontSize: 12, color: muted }}>None from last attempt</p>
                : resolvedIssues.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <div style={{ width: 2, height: 14, background: '#22c55e', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 12, color: text, lineHeight: 1.4 }}>{t}</p>
                  </div>
                ))}
            </div>
            <div className="flex-1 px-5 py-4">
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', marginBottom: 8 }}>
                New ({newIssues.length})
              </p>
              {newIssues.length === 0
                ? <p style={{ fontSize: 12, color: muted }}>No new issues</p>
                : newIssues.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <div style={{ width: 2, height: 14, background: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 12, color: text, lineHeight: 1.4 }}>{t}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
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
                <span style={{ fontSize: 18, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>/10</span>
              </div>
              <div style={{ width: 200, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 0, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ height: '100%', width: `${result.overallScore * 10}%`, background: '#ADEE66' }} />
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', maxWidth: 480 }}>{result.executiveSummary}</p>
            </div>
            <button onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
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
              <span style={{ fontSize: 9, color: muted }}>/10</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center justify-between mb-1.5">
                <p style={{ fontSize: 13, fontWeight: 700, color: text }}>{cat.name}</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(cat.score), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {cat.score >= 8 ? 'Excellent' : cat.score >= 6 ? 'Good' : cat.score >= 4 ? 'Needs Work' : 'Critical'}
                </span>
              </div>
              <div style={{ height: 2, background: border, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${cat.score * 10}%`, background: scoreColor(cat.score) }} />
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
              Score too low · {result.overallScore.toFixed(1)}/10 · Minimum required: {minScore}/10
            </p>
            <p style={{ fontSize: 12, color: '#ef4444', opacity: 0.8 }}>Review the feedback above, fix your code, and resubmit.</p>
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
