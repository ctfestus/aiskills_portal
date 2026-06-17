'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Code2,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { sanitizeRichText } from '@/lib/sanitize';
import { LessonRenderer } from '@/components/lesson/LessonRenderer';
import {
  initPythonRuntime,
  loadPythonDatasets,
  runPython,
  type PythonDatasetPreview,
  type PythonRuntime,
} from '@/lib/python-engine';
import type { LessonDoc } from '@/lib/lesson-doc';

function renderRichText(html: string): string {
  return sanitizeRichText(
    html.replace(/`([^`]+)`/g, (_, code: string) =>
      `<code>${code.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</code>`
    )
  );
}

function parseSaved(saved?: string) {
  if (!saved) return null;
  try { return JSON.parse(saved); } catch { return { code: saved }; }
}

interface CheckResult {
  passed: boolean;
  message: string;
  proof?: string;
}

interface Props {
  question: any;
  isDark: boolean;
  accentColor: string;
  savedAnswer?: string;
  completed: boolean;
  topOffset?: number;
  leftOffset?: number;
  sessionToken?: string;
  hintPenalty?: number;
  solutionPenalty?: number;
  onComplete: (payload: { code: string; output: string; passed: boolean; attempts?: number; solutionViewed?: boolean; skipped?: boolean; proof?: string }) => void;
  onHintUsed: () => void;
  onCheckAnswer?: (questionId: string, code: string, output: string) => Promise<CheckResult>;
  onRevealSolution?: (questionId: string, attempts: number) => Promise<string>;
  onNext?: () => void;
  isLastQuestion?: boolean;
  isFirstTaskForLesson?: boolean;
}

export default function PythonExercisePlayer({
  question,
  isDark,
  accentColor,
  savedAnswer,
  completed,
  topOffset = 0,
  leftOffset = 0,
  sessionToken,
  hintPenalty,
  solutionPenalty,
  onComplete,
  onHintUsed,
  onNext,
  isLastQuestion,
  isFirstTaskForLesson = true,
  onCheckAnswer,
  onRevealSolution,
}: Props) {
  const saved = parseSaved(savedAnswer);
  const starterCode = String(question.pythonStarterCode ?? '# Write your Python code here\n').trimEnd();

  const [code, setCode]               = useState<string>(saved?.code || starterCode);
  const [output, setOutput]           = useState<string>(saved?.output ?? '');
  const [error, setError]             = useState<string>('');
  const [running, setRunning]         = useState(false);
  const [checking, setChecking]       = useState(false);
  const [feedback, setFeedback]       = useState<CheckResult | null>(
    (saved?.skipped || saved?.solutionViewed) ? null : (saved?.feedback ?? null)
  );
  const [failedAttempts, setFailedAttempts] = useState<number>(Number(saved?.attempts ?? 0));
  const [solutionRevealed, setSolutionRevealed] = useState<boolean>(!!saved?.solutionViewed);
  const [revealedSolution, setRevealedSolution] = useState<string>('');
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [solutionError, setSolutionError] = useState('');
  const [leftOpen, setLeftOpen]       = useState(true);
  const [leftWidth, setLeftWidth]     = useState(420);
  const [editorPct, setEditorPct]     = useState(55);
  const [isMobile, setIsMobile]       = useState(false);
  const [mobileTab, setMobileTab]     = useState<'lesson' | 'code' | 'output'>('code');
  const [hintShown, setHintShown]     = useState(false);
  const [leftTab, setLeftTab]         = useState<'lesson' | 'hint'>('lesson');
  const [codeTab, setCodeTab]         = useState<'student' | 'solution'>('student');
  const [outputTab, setOutputTab]     = useState<string>('output');
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [preparing, setPreparing]     = useState(false);
  const [prepareError, setPrepareError] = useState('');
  const [datasetPreviews, setDatasetPreviews] = useState<Record<string, PythonDatasetPreview>>({});
  const [datasetsLoading, setDatasetsLoading] = useState(false);

  const pyRuntimeRef = useRef<PythonRuntime | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);
  const vResizingRef = useRef(false);
  const vResizeStartY = useRef(0);
  const vResizeStartPct = useRef(0);

  const lesson = question?.lesson;
  const hasHints = (question.pythonHints ?? []).filter(Boolean).length > 0;
  const hasChecker = !!question.pythonHasExpectedOutput || !!(question.pythonExpectedOutput?.trim());

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Init Pyodide then load datasets -- re-runs when question changes
  useEffect(() => {
    let cancelled = false;
    pyRuntimeRef.current = null;
    setPreparing(true);
    setPrepareError('');
    setDatasetPreviews({});
    setDatasetsLoading(false);

    (async () => {
      // 1. Init Pyodide (fast if already loaded -- singleton)
      let rt: PythonRuntime;
      try {
        rt = await initPythonRuntime(question.pythonSetupCode?.trim() || undefined);
        if (cancelled) return;
        pyRuntimeRef.current = rt;
      } catch (err: any) {
        if (!cancelled) {
          setPrepareError(err?.message || 'Could not load Python environment.');
          setPreparing(false);
        }
        return;
      }

      // 2. Load datasets sequentially into the shared Pyodide namespace
      // Keep preparing=true until datasets are ready so students can't run code before df exists
      const datasets = (question.pythonDatasets ?? [])
        .filter((d: any) => d.variableName?.trim() && (d.csvUrl || d.fileUrl));

      if (datasets.length) {
        try {
          const previews = await loadPythonDatasets(rt, datasets);
          if (!cancelled) setDatasetPreviews(previews);
        } catch (err: any) {
          if (!cancelled) {
            setPrepareError(err?.message || 'Failed to load dataset');
            setPreparing(false);
          }
          return;
        }
      }

      // All datasets injected -- now let the student interact
      if (!cancelled) {
        setDatasetsLoading(false);
        setPreparing(false);
      }
    })();

    return () => { cancelled = true; };
  // question.id gates re-init; pythonDatasets/setupCode are stable once question loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  function onResizeStart(e: React.MouseEvent) {
    resizingRef.current = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setLeftWidth(Math.max(200, Math.min(520, resizeStartW.current + ev.clientX - resizeStartX.current)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onVerticalResizeStart(e: React.MouseEvent) {
    vResizingRef.current = true;
    vResizeStartY.current = e.clientY;
    vResizeStartPct.current = editorPct;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!vResizingRef.current) return;
      const totalH = rightPanelRef.current?.offsetHeight ?? 1;
      const delta = ((ev.clientY - vResizeStartY.current) / totalH) * 100;
      setEditorPct(Math.max(25, Math.min(75, vResizeStartPct.current + delta)));
    };
    const onUp = () => {
      vResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const canvas    = isDark ? '#17181E' : '#F2F5FA';
  const leftBg    = isDark ? '#1E1F26' : '#ffffff';
  const editorBg  = isDark ? '#1E1F26' : '#ffffff';
  const outputBg  = isDark ? '#0d1117' : '#111827';
  const headerBg  = isDark ? '#17181E' : '#F2F5FA';
  const text      = isDark ? '#ACB8C5' : '#111111';
  const muted     = isDark ? '#A8B5C2' : '#555555';
  const subtle    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)';

  const handleTabKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newVal);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4; });
    }
  }, [code]);

  async function runCode() {
    if (!pyRuntimeRef.current) return;
    const codeToRun = codeTab === 'solution' && revealedSolution ? revealedSolution : code;
    setRunning(true);
    setError('');
    setOutput('');
    setFeedback(null);
    try {
      const res = await runPython(pyRuntimeRef.current, codeToRun);
      if (res.error) {
        setError(res.error);
      } else {
        const out = res.stdout + (res.returnValue !== null && !res.stdout.trim() ? `Out: ${res.returnValue}` : '');
        setOutput(out);
      }
    } catch (e: any) {
      setError(e?.message || 'Run failed.');
    } finally {
      setRunning(false);
      if (isMobile) setMobileTab('output');
    }
  }

  async function checkAnswer() {
    if (!pyRuntimeRef.current || !hasChecker) return;
    setChecking(true);
    setError('');
    setFeedbackDismissed(false);
    try {
      const res = await runPython(pyRuntimeRef.current, code);
      if (res.error) {
        setError(res.error);
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        onComplete({ code, output: '', passed: false, attempts, solutionViewed: solutionRevealed });
        return;
      }
      const actualOutput = res.stdout + (res.returnValue !== null && !res.stdout.trim() ? `Out: ${res.returnValue}` : '');
      setOutput(actualOutput);
      const check = onCheckAnswer
        ? await onCheckAnswer(question.id, code, actualOutput)
        : {
            passed: actualOutput.trim() === String(question.pythonExpectedOutput ?? '').trim(),
            message: actualOutput.trim() === String(question.pythonExpectedOutput ?? '').trim()
              ? 'Output matches.'
              : 'Output does not match the expected result.',
          };
      const attempts = check.passed ? failedAttempts : failedAttempts + 1;
      if (!check.passed) setFailedAttempts(attempts);
      setFeedback(check);
      onComplete({ code, output: actualOutput, passed: check.passed, attempts, solutionViewed: solutionRevealed, feedback: check, proof: check.proof } as any);
    } catch (e: any) {
      setError(e?.message || 'Run failed.');
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
    } finally {
      setChecking(false);
      if (isMobile) setMobileTab('output');
    }
  }

  function continueIncorrect() {
    if (!onNext) return;
    onComplete({ code, output, passed: false, skipped: true, attempts: failedAttempts, solutionViewed: solutionRevealed });
    onNext();
  }

  async function doRevealSolution() {
    setSolutionLoading(true);
    setSolutionError('');
    let sol = '';
    try {
      sol = onRevealSolution
        ? await onRevealSolution(question.id, failedAttempts)
        : String(question.pythonSolution ?? '');
      setRevealedSolution(sol);
      setSolutionRevealed(true);
      if (sol) setCodeTab('solution');
      onComplete({ code: sol || code, output, passed: false, attempts: failedAttempts, solutionViewed: true });
    } catch (err: any) {
      setSolutionError(err?.message || 'Could not load the solution.');
      setSolutionLoading(false);
      return;
    }
    setSolutionLoading(false);

    // Auto-run the solution immediately using `sol` directly (not state, avoids React flush timing)
    if (sol && pyRuntimeRef.current) {
      setRunning(true);
      setError('');
      setOutput('');
      setFeedback(null);
      try {
        const res = await runPython(pyRuntimeRef.current, sol);
        if (res.error) {
          setError(res.error);
        } else {
          const out = res.stdout + (res.returnValue !== null && !res.stdout.trim() ? `Out: ${res.returnValue}` : '');
          setOutput(out);
        }
      } catch (e: any) {
        setError(e?.message || 'Run failed.');
      } finally {
        setRunning(false);
        if (isMobile) setMobileTab('output');
      }
    }
  }

  if (preparing) {
    return (
      <div className="w-full flex items-center justify-center py-20" style={{ color: text }}>
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: accentColor, opacity: 0.15 }} />
            <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: accentColor }} />
            <Code2 className="absolute inset-0 m-auto w-5 h-5" style={{ color: accentColor }} />
          </div>
          <p className="font-semibold text-[14px] mb-1">Loading Python environment</p>
          <p className="text-[12px]" style={{ color: muted }}>This may take a moment on first load</p>
        </div>
      </div>
    );
  }

  if (prepareError) {
    return <div className="w-full p-5 text-[13px] text-red-400">{prepareError}</div>;
  }

  const feedbackVisible = feedback && !feedbackDismissed;
  const canReveal = hasChecker && !completed && !revealedSolution;
  const showContinueAfterSolution = solutionRevealed && !completed && !!onNext;
  const showingSolutionTab = codeTab === 'solution' && !!revealedSolution;

  return (
    <div
      className="fixed bottom-0 right-0 z-40 flex flex-col overflow-hidden"
      style={{ top: topOffset, left: leftOffset, transition: 'left 300ms ease', background: canvas, color: text }}
    >
      {/* MOBILE TAB BAR */}
      {isMobile && (
        <div className="flex-shrink-0 flex items-stretch gap-1.5 px-2 pt-2">
          {(lesson?.title || lesson?.doc || lesson?.body || question.question) && (
            <button type="button" onClick={() => setMobileTab('lesson')}
              className="flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors"
              style={{ background: mobileTab === 'lesson' ? leftBg : 'transparent', color: mobileTab === 'lesson' ? text : muted }}>
              Lesson
            </button>
          )}
          <button type="button" onClick={() => setMobileTab('code')}
            className="flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors"
            style={{ background: mobileTab === 'code' ? leftBg : 'transparent', color: mobileTab === 'code' ? text : muted }}>
            Code
          </button>
          <button type="button" onClick={() => setMobileTab('output')}
            className="flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors"
            style={{ background: mobileTab === 'output' ? leftBg : 'transparent', color: mobileTab === 'output' ? text : muted }}>
            Output
          </button>
        </div>
      )}

      {/* CONTENT ROW */}
      <div className="flex-1 min-h-0 flex overflow-hidden p-2 sm:p-3">

        {/* LEFT PANEL */}
        {(!isMobile ? leftOpen : mobileTab === 'lesson') && (
          <div className="flex flex-col rounded-2xl overflow-hidden"
            style={{ width: isMobile ? '100%' : leftWidth, flexShrink: 0, background: leftBg }}>
            <div className="flex-shrink-0 flex items-center gap-1 px-3 m-2 rounded-xl" style={{ height: 48, background: headerBg }}>
              <button type="button" onClick={() => setLeftTab('lesson')}
                className="flex-shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold transition-colors"
                style={{ background: leftTab === 'lesson' ? subtle : 'transparent', color: leftTab === 'lesson' ? text : muted }}>
                Lesson
              </button>
              {hasHints && (
                <button type="button"
                  onClick={() => { setLeftTab('hint'); if (!hintShown) { setHintShown(true); onHintUsed(); } }}
                  className="flex-shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold transition-colors"
                  style={{ background: leftTab === 'hint' ? subtle : 'transparent', color: leftTab === 'hint' ? text : muted }}>
                  Hint{hintPenalty && !hintShown ? <span className="ml-1 text-[10px] font-semibold" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>-{hintPenalty} pts</span> : null}
                </button>
              )}
            </div>

            {leftTab === 'lesson' && (
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
                {isFirstTaskForLesson && lesson?.title && (
                  <h2 className="text-[18px] font-bold leading-snug mb-3" style={{ color: text }}>{lesson.title}</h2>
                )}
                {lesson?.videoUrl && (
                  <div className="rounded-xl overflow-hidden mb-4" style={{ aspectRatio: '16/9', background: '#000' }}>
                    <iframe src={lesson.videoUrl} className="w-full h-full" allowFullScreen />
                  </div>
                )}
                {(lesson?.doc || lesson?.body) && (
                  <div className="lesson-content" style={{ color: text }}>
                    {lesson.doc
                      ? <LessonRenderer doc={lesson.doc as LessonDoc} isDark={isDark} />
                      : <div dangerouslySetInnerHTML={{ __html: renderRichText(lesson.body ?? '') }} />}
                  </div>
                )}
                {question.question && (
                  <div className="mt-4 rounded-xl p-4" style={{ background: subtle }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accentColor }}>Task</p>
                    <p className="text-[14px] leading-relaxed" style={{ color: text }}
                      dangerouslySetInnerHTML={{ __html: renderRichText(question.question) }} />
                  </div>
                )}
              </div>
            )}

            {leftTab === 'hint' && (
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: accentColor }}>Hints</p>
                {(question.pythonHints ?? []).filter(Boolean).map((hint: string, i: number) => (
                  <div key={i} className="mb-3 p-3 rounded-xl" style={{ background: subtle }}>
                    <p className="text-[13px] leading-relaxed" style={{ color: text }}
                      dangerouslySetInnerHTML={{ __html: renderRichText(hint) }} />
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* RESIZE HANDLE */}
        {!isMobile && leftOpen && (
          <div onMouseDown={onResizeStart}
            className="flex-shrink-0 w-2 cursor-col-resize hover:bg-white/10 transition-colors mx-1 rounded-full" />
        )}

        {/* RIGHT PANEL */}
        {(!isMobile || mobileTab === 'code' || mobileTab === 'output') && (
          <div ref={rightPanelRef} className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-0">

            {/* CODE EDITOR SECTION */}
            {(!isMobile || mobileTab === 'code') && (
              <div className="flex flex-col rounded-2xl overflow-hidden"
                style={{ flex: isMobile ? 1 : `0 0 ${editorPct}%`, minHeight: 0, background: editorBg }}>

                {/* Editor header */}
                <div className="flex-shrink-0 flex items-center gap-3 px-3 m-2 rounded-xl" style={{ height: 48, background: headerBg }}>
                  {!isMobile && (
                    <button type="button" onClick={() => setLeftOpen(v => !v)}
                      className="w-8 h-8 grid place-items-center rounded-lg transition-opacity hover:opacity-70 flex-shrink-0"
                      style={{ background: subtle, color: muted }}
                      title={leftOpen ? 'Collapse lesson' : 'Expand lesson'}>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${leftOpen ? '' : 'rotate-180'}`} />
                    </button>
                  )}
                  <div className="flex items-center gap-1 min-w-0">
                    <button type="button" onClick={() => setCodeTab('student')}
                      className="h-8 px-3 rounded-lg text-[12px] font-bold transition-colors"
                      style={{ background: codeTab === 'student' ? subtle : 'transparent', color: codeTab === 'student' ? text : muted }}>
                      Student Code
                    </button>
                    {revealedSolution && (
                      <button type="button" onClick={() => setCodeTab('solution')}
                        className="h-8 px-3 rounded-lg text-[12px] font-bold transition-colors"
                        style={{ background: codeTab === 'solution' ? 'rgba(52,211,153,0.13)' : 'transparent', color: codeTab === 'solution' ? '#34d399' : muted }}>
                        Solution
                      </button>
                    )}
                  </div>
                  <div className="flex-1" />
                  <button type="button"
                    disabled={showingSolutionTab}
                    onClick={() => { setCode(starterCode); setOutput(''); setError(''); setFeedback(null); }}
                    className="w-8 h-8 grid place-items-center rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
                    style={{ background: subtle, color: muted }} title="Reset">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Solution notice */}
                {revealedSolution && !completed && (
                  <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2"
                    style={{ background: 'rgba(52,211,153,0.10)' }}>
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#34d399' }}>Solution</span>
                    <span className="text-[12px]" style={{ color: isDark ? '#A8B5C2' : '#555555' }}>
                      The solution is open in its own tab. Your code was not changed.
                    </span>
                  </div>
                )}

                {/* Textarea */}
                <div className="flex-1 min-h-0 relative">
                  <textarea
                    value={showingSolutionTab ? revealedSolution : code}
                    onChange={e => { if (!showingSolutionTab) setCode(e.target.value); }}
                    onKeyDown={showingSolutionTab ? undefined : handleTabKey}
                    readOnly={showingSolutionTab}
                    spellCheck={false}
                    className="absolute inset-0 w-full h-full resize-none border-none outline-none p-4"
                    style={{
                      fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace',
                      fontSize: 13.5,
                      lineHeight: 1.75,
                      background: editorBg,
                      color: isDark ? '#d4d4d4' : '#1e1e1e',
                    }}
                  />
                </div>

                {/* ACTION BAR -- same position as SQL exercise */}
                <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 px-4 py-3">
                  {canReveal && (
                    <button type="button" onClick={doRevealSolution} disabled={solutionLoading}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold transition-opacity disabled:opacity-50 hover:opacity-80"
                      style={{ color: '#34d399', background: 'rgba(52,211,153,0.13)' }}>
                      {solutionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      View Solution
                      {solutionPenalty ? <span className="ml-1 text-[10px] font-semibold opacity-70">-{solutionPenalty} XP</span> : null}
                    </button>
                  )}
                  <button type="button" onClick={runCode} disabled={running || checking || !pyRuntimeRef.current}
                    className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg text-[13px] font-semibold transition-opacity disabled:opacity-40 hover:opacity-80"
                    style={{ background: subtle, color: text }}>
                    {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    Run Code
                  </button>
                  {hasChecker && !completed && !solutionRevealed && (
                    <button type="button" onClick={checkAnswer} disabled={running || checking || !pyRuntimeRef.current}
                      className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg text-[13px] font-semibold transition-opacity disabled:opacity-40"
                      style={{ background: accentColor, color: '#ffffff' }}>
                      {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Submit Answer
                    </button>
                  )}
                  {showContinueAfterSolution && (
                    <button type="button" onClick={continueIncorrect}
                      className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80"
                      style={{ background: accentColor, color: '#ffffff' }}>
                      <ChevronRight className="w-3.5 h-3.5" />
                      {isLastQuestion ? 'Finish Course' : 'Continue'}
                    </button>
                  )}
                  {completed && onNext && (
                    <button type="button" onClick={onNext}
                      className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg text-[13px] font-semibold"
                      style={{ background: accentColor, color: '#ffffff' }}>
                      {isLastQuestion ? 'Finish Course' : 'Next'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {solutionError && <p className="text-[11.5px] text-red-400">{solutionError}</p>}
                </div>
              </div>
            )}

            {/* VERTICAL RESIZE HANDLE */}
            {!isMobile && (
              <div onMouseDown={onVerticalResizeStart}
                className="flex-shrink-0 h-2 cursor-row-resize hover:bg-white/10 transition-colors rounded-full" />
            )}

            {/* OUTPUT PANEL */}
            {(!isMobile || mobileTab === 'output') && (
              <div className="flex flex-col rounded-2xl overflow-hidden"
                style={{ flex: isMobile ? 1 : `1 1 0%`, minHeight: 0, background: outputBg }}>

                {/* Tab bar: Output + one tab per dataset */}
                <div className="flex-shrink-0 flex items-center gap-1 px-3 overflow-x-auto no-scrollbar"
                  style={{ height: 40, background: isDark ? '#111318' : '#1a1f2e' }}>
                  <button type="button" onClick={() => setOutputTab('output')}
                    className="flex-shrink-0 h-7 px-3 rounded-md text-[11px] font-semibold transition-colors"
                    style={{ background: outputTab === 'output' ? 'rgba(255,255,255,0.08)' : 'transparent', color: outputTab === 'output' ? '#c9d1d9' : '#6b7a89' }}>
                    output
                  </button>
                  {(question.pythonDatasets ?? []).filter((d: any) => d.variableName?.trim() && d.csvUrl).map((ds: any) => (
                    <button key={ds.id} type="button" onClick={() => setOutputTab(`data:${ds.variableName}`)}
                      className="flex-shrink-0 h-7 px-3 rounded-md text-[11px] font-semibold transition-colors"
                      style={{ background: outputTab === `data:${ds.variableName}` ? 'rgba(255,255,255,0.08)' : 'transparent', color: outputTab === `data:${ds.variableName}` ? '#c9d1d9' : '#6b7a89' }}>
                      {ds.variableName}
                    </button>
                  ))}
                </div>

                {/* Output content */}
                {outputTab === 'output' && (
                  <div className="flex-1 min-h-0 overflow-auto p-4">
                    {error ? (
                      <pre className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: '#fda4af', fontFamily: '"JetBrains Mono",ui-monospace,monospace' }}>{error}</pre>
                    ) : output ? (
                      <pre className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: '#c9d1d9', fontFamily: '"JetBrains Mono",ui-monospace,monospace' }}>{output}</pre>
                    ) : (
                      <p className="text-[12px] italic" style={{ color: '#4a5568' }}>Run your code to see output here</p>
                    )}
                  </div>
                )}

                {/* Dataset preview content */}
                {outputTab.startsWith('data:') && (() => {
                  const varName = outputTab.slice(5);
                  const preview = datasetPreviews[varName];
                  const isLoading = datasetsLoading && !preview;
                  return (
                    <div className="flex-1 min-h-0 overflow-auto">
                      {isLoading && (
                        <div className="flex items-center gap-2 px-4 py-4">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#6b7a89' }} />
                          <span className="text-[12px]" style={{ color: '#6b7a89' }}>Loading {varName}...</span>
                        </div>
                      )}
                      {preview?.error && (
                        <p className="px-4 py-4 text-[12px]" style={{ color: '#fda4af' }}>Could not load {varName}: {preview.error}</p>
                      )}
                      {preview && !preview.error && preview.columns.length > 0 && (
                        <table className="text-[12px] border-collapse w-full">
                          <thead>
                            <tr>
                              {preview.columns.map(col => (
                                <th key={col} className="text-left px-4 py-2 whitespace-nowrap font-semibold"
                                  style={{ color: accentColor, background: isDark ? '#111318' : '#1a1f2e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row, ri) => (
                              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-4 py-1.5 whitespace-nowrap font-mono"
                                    style={{ color: '#c9d1d9', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11.5 }}>
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })()}

                {/* FEEDBACK BANNER */}
                {feedbackVisible && (
                  <div className="flex-shrink-0 px-4 py-3 flex items-start gap-3"
                    style={{ background: feedback.passed ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', borderTop: `1px solid ${feedback.passed ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}` }}>
                    {feedback.passed
                      ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                      : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f43f5e' }} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold" style={{ color: feedback.passed ? '#10b981' : '#f43f5e' }}>
                        {feedback.passed ? 'Correct!' : 'Not quite right'}
                      </p>
                      {!feedback.passed && (
                        <pre className="text-[11.5px] mt-1 whitespace-pre-wrap" style={{ color: isDark ? '#94a3b8' : '#64748b', fontFamily: '"JetBrains Mono",ui-monospace,monospace' }}>
                          {feedback.message}
                        </pre>
                      )}
                    </div>
                    <button type="button" onClick={() => setFeedbackDismissed(true)}><X className="w-3.5 h-3.5" style={{ color: muted }} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
