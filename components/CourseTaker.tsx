'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { safeEmbedUrl as getVideoEmbedUrl } from '@/lib/safe-embed-url';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, XCircle, Loader2, ChevronRight, RotateCcw,
  Clock, EyeOff, AlertTriangle, ShieldAlert, GripVertical,
  ChevronLeft, BookOpen, X, ExternalLink, ArrowRight, MoreHorizontal, List, Zap,
  ArrowLeftToLine, ArrowRightFromLine, Download, ArrowDownToLine,
} from 'lucide-react';
import { AnimatedField } from '@/components/AnimatedField';
import { sanitizeRichText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { getFontById, loadGoogleFont } from '@/lib/fonts';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import DashboardCritiquePlayer from '@/components/DashboardCritiquePlayer';
import CodeReviewPlayer, { LeanSubmission } from '@/components/CodeReviewPlayer';
import ExcelReviewPlayer, { ExcelLeanSubmission } from '@/components/ExcelReviewPlayer';

type ShowAnswers = 'per_question' | 'after_quiz' | 'none';
type QuestionType = 'multiple_choice' | 'fill_blank' | 'arrange' | 'image' | 'code' | 'code_review' | 'excel_review' | 'dashboard_critique';

const REVIEW_TYPES: QuestionType[] = ['code_review', 'excel_review', 'dashboard_critique'];

interface DownloadItem {
  id: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  linkUrl?: string;
  type: 'file' | 'link';
}

interface CourseQuestion {
  id: string;
  type?: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  optionImages?: string[];
  hint?: string;
  codeSnippet?: string;
  codeLanguage?: string;
  lessonOnly?: boolean;
  isSection?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  isDownloads?: boolean;
  downloadsTitle?: string;
  downloadsDescription?: string;
  downloadItems?: DownloadItem[];
  lesson?: {
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
  };
  // AI review fields
  rubric?: string[];
  schema?: string;
  context?: string;
  minScore?: number;
  reviewLanguage?: string;
}



// -- Confetti burst --
function burstConfetti(canvas: HTMLCanvasElement, accent: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [accent, '#10b981', '#f59e0b', '#ec4899', '#60a5fa', '#a78bfa', '#fff'];
  const particles: {
    x: number; y: number; vx: number; vy: number;
    color: string; size: number; rot: number; rv: number; alpha: number;
  }[] = [];

  for (let i = 0; i < 120; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const speed = 4 + Math.random() * 10;
    particles.push({
      x: canvas.width / 2,
      y: canvas.height * 0.45,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    });
  }

  let frame = 0;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.99;
      p.rot += p.rv;
      p.alpha = Math.max(0, p.alpha - 0.018);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });
    frame++;
    if (frame < 90) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  animate();
}

// -- Sortable item for arrange questions --
function SortableItem({ id, label, idx, accent, isDark, isChecking }: {
  id: string; label: string; idx: number; accent: string; isDark: boolean; isChecking: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-150 ${
        isDark ? 'border-zinc-700 bg-zinc-800/60 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-900'
      } ${isChecking ? 'pointer-events-none' : ''}`}
    >
      <span
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
        style={{ background: accent }}
      >
        {idx + 1}
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {!isChecking && (
        <span
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>
      )}
    </div>
  );
}

export function CourseTaker({
  config,
  isSubmitting,
  onSubmit,
  isSuccess,
  onReset,
  onRetake,
  onClose,
  isSharedView,
  collectStudentInfo = false,
  formId,
  inlineMode = false,
  postSubmission,
  relatedForms = [],
  certificateId = null,
  initialStudentName = '',
  initialStudentEmail = '',
  relatedAssignment = null,
  logoUrl = '',
  logoDarkUrl = '',
}: any) {
  const [phase, setPhase] = useState<'info' | 'course' | 'complete'>(
    collectStudentInfo || !!initialStudentName ? 'info' : 'course'
  );
  const [reviewMode, setReviewMode] = useState(false); // true when student has already earned a cert -- no XP/saves
  const [studentName, setStudentName] = useState(initialStudentName);
  const [studentEmail, setStudentEmail] = useState(initialStudentEmail);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillBlankAnswer, setFillBlankAnswer] = useState('');
  const [arrangeOrder, setArrangeOrder] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Feature 1: direction tracking
  const [direction, setDirection] = useState(1);

  // Feature 2: skip & return
  const [skippedQuestions, setSkippedQuestions] = useState<Set<string>>(new Set());
  // AI review questions -- tracks which have been completed
  const [reviewCompleted, setReviewCompleted] = useState<Set<string>>(new Set());
  // Stores lean summaries/results for completed review questions (in-session only)
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, any>>({});
  // Submission history per review question (for 2-review limit)
  const [reviewSubmissions, setReviewSubmissions] = useState<Record<string, any[]>>({});
  const [reviewDashCounts, setReviewDashCounts] = useState<Record<string, number>>({});

  // Feature 3: hint system
  const [hintsUsed, setHintsUsed] = useState<Set<string>>(new Set());
  const [hintVisible, setHintVisible] = useState(false);

  // Feature 4: dark/light auto-match
  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });


  // Lesson sheet
  const [lessonOpen, setLessonOpen] = useState(false);
  const lessonOpenRef = useRef(false);
  useEffect(() => { lessonOpenRef.current = lessonOpen; }, [lessonOpen]);
  useEffect(() => { scoringLockRef.current = false; }, [currentQuestionIndex]);

  // Points system state
  const [totalPoints, setTotalPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [floatingPoints, setFloatingPoints] = useState<{ id: number; text: string; x: number; y: number } | null>(null);
  const [displayedPoints, setDisplayedPoints] = useState(0);

  // Chapters drawer
  const [showChapters, setShowChapters] = useState(false);

  // Sidebar (persistent panel, non-inline mode only) -- closed by default on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  // 3-dot menu + XP badge
  const [showMenu, setShowMenu] = useState(false);
  const [xpNotify, setXpNotify] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Anti-cheat state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [attemptError, setAttemptError] = useState('');
  const [checkingAttempts, setCheckingAttempts] = useState(!!initialStudentName);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confettiRef   = useRef<HTMLCanvasElement | null>(null);
  const touchStartX   = useRef(0);
  const touchStartY   = useRef(0);

  // Progress save/resume state
  const [savedProgress, setSavedProgress] = useState<any>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  const sessionTokenRef = useRef<string | null>(null);
  // Prevents double-scoring when Check/Next is clicked twice before React state settles
  const scoringLockRef = useRef(false);
  // Always-current snapshot of progress -- used by the visibilitychange flush
  const progressRef = useRef({ answers: {} as Record<string, string>, index: 0, score: 0, points: 0, streak: 0, hintsUsed: new Set<string>() });
  const maxIdxRef   = useRef(0);
  // Synchronously-updated mirror of answers -- avoids stale closure when user navigates rapidly
  const answersRef  = useRef<Record<string, string>>({});

  // Leaderboard rank context (shown on result screen)
  const [rankCtx, setRankCtx] = useState<{ above: any; me: any; below: any; rank: number; total: number } | null>(null);

  // Existing certificate (student already completed this course)
  const [existingCertId, setExistingCertId] = useState<string | null>(null);
  const [finishPending, setFinishPending] = useState<any[] | null>(null); // unanswered questions blocking finish
  const [streakToast, setStreakToast] = useState<string | null>(null);
  const questions = useMemo(() => config.questions || [], [config.questions]);
  const learningOutcomes: string[] = config.learnOutcomes || [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.filter((q: any) => !q.lessonOnly && !q.isSection && !q.isDownloads).length;
  const totalSlides = questions.length;
  // Current section: walk back from currentQuestionIndex to find the nearest section divider
  const currentSection = useMemo(() => {
    for (let i = currentQuestionIndex; i >= 0; i--) {
      if ((questions[i] as any)?.isSection) return questions[i] as any;
    }
    return null;
  }, [questions, currentQuestionIndex]);
  // Count how many section dividers appear up to and including currentQuestionIndex
  const currentSectionNumber = useMemo(() => {
    let n = 0;
    for (let i = 0; i <= currentQuestionIndex; i++) {
      if ((questions[i] as any)?.isSection) n++;
    }
    return n;
  }, [questions, currentQuestionIndex]);
  const totalSections = useMemo(() => questions.filter((q: any) => q.isSection).length, [questions]);

  // Group questions into sections for the chapters drawer
  const chapters = useMemo(() => {
    const groups: { sectionTitle: string; sectionIdx: number | null; slides: { q: CourseQuestion; idx: number }[] }[] = [];
    let cur: typeof groups[0] = { sectionTitle: 'Introduction', sectionIdx: null, slides: [] };
    questions.forEach((q: CourseQuestion, idx: number) => {
      if ((q as any).isSection) {
        if (cur.sectionIdx !== null || cur.slides.length) groups.push(cur);
        cur = { sectionTitle: (q as any).sectionTitle || 'New Section', sectionIdx: idx, slides: [] };
      } else {
        cur.slides.push({ q, idx });
      }
    });
    if (cur.sectionIdx !== null || cur.slides.length) groups.push(cur);
    return groups;
  }, [questions]);
  const showAnswers: ShowAnswers = config.showAnswers ?? 'per_question';
  const passmark = config.passmark ?? 50;
  const courseTimerMins: number = config.courseTimer ?? 0;
  const maxAttempts: number = config.maxAttempts ?? 0;
  const questionType: QuestionType = currentQuestion?.type ?? 'multiple_choice';

  const accentColors: Record<string, string> = {
    forest: '#006128', lime: '#ADEE66', emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b',
  };
  const accent = (config as any).customAccent ?? accentColors[config.theme] ?? '#006128';

  const fontOption = getFontById(config.font ?? 'sans');
  useEffect(() => { loadGoogleFont(fontOption); }, [fontOption]);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);
  const fontStyle = { fontFamily: fontOption.cssFamily };
  const isDark = (config.mode ?? 'dark') === 'auto' ? systemDark : (config.mode ?? 'dark') !== 'light';
  const cardBg = isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm';
  const textColor = isDark ? 'text-white' : 'text-zinc-900';
  const mutedColor = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const subtleBg = isDark ? 'bg-zinc-800/60' : 'bg-zinc-50';

  // Shuffle helper
  const shuffle = (arr: string[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Feature 4: listen to system dark mode changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Initialize arrange order when question changes
  useEffect(() => {
    if (!currentQuestion) return;
    const prevAnswer = answers[currentQuestion.id];
    const qType = currentQuestion.type ?? 'multiple_choice';
    if (REVIEW_TYPES.includes(qType)) {
      // Review questions don't use isChecking -- just track completion
      setIsChecking(false);
      setIsCorrect(null);
      setHintVisible(false);
      setSelectedOption(null);
      setFillBlankAnswer('');
      if (prevAnswer) {
        setReviewCompleted(prev => new Set(prev).add(currentQuestion.id));
      }
    } else if (prevAnswer) {
      // Normal question already answered -- restore locked state, no re-answering allowed
      const wasCorrect = isAnswerCorrect(currentQuestion, prevAnswer);
      setIsChecking(true);
      setIsCorrect(wasCorrect);
      setHintVisible(false);
      if (qType === 'fill_blank') {
        setFillBlankAnswer(prevAnswer);
        setSelectedOption(null);
      } else if (qType === 'arrange') {
        setArrangeOrder(prevAnswer.split('|||'));
        setSelectedOption(null);
      } else {
        setSelectedOption(prevAnswer);
        setFillBlankAnswer('');
      }
    } else {
      // Fresh question
      setFillBlankAnswer('');
      setSelectedOption(null);
      setIsChecking(false);
      setIsCorrect(null);
      setHintVisible(false);
      setQuestionStartTime(Date.now());
      if (qType === 'arrange') {
        setArrangeOrder(shuffle(currentQuestion.options));
      }
    }
    // Auto-open lesson before question if timing is set to 'before' (only for unanswered questions)
    if ((config as any).lessonTiming === 'before' && (currentQuestion.lesson?.body || currentQuestion.lesson?.videoUrl || currentQuestion.lesson?.imageUrl) && !prevAnswer) {
      setLessonOpen(true);
    } else {
      setLessonOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex]);

  // Initialize arrange order on first load
  useEffect(() => {
    if (currentQuestion && (currentQuestion.type ?? 'multiple_choice') === 'arrange') {
      setArrangeOrder(shuffle(currentQuestion.options));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setArrangeOrder(items => {
        const oldIdx = items.indexOf(active.id as string);
        const newIdx = items.indexOf(over.id as string);
        return arrayMove(items, oldIdx, newIdx);
      });
    }
  };

  // -- Timer --
  useEffect(() => {
    if (phase !== 'course' || !courseTimerMins) return;

    // Clear any existing interval before starting a new one (prevents double-ticking)
    if (timerRef.current) clearInterval(timerRef.current);

    // Only set the initial countdown once -- if timeLeft already has a value
    // it means the effect re-ran (StrictMode double-invoke etc.) and we must
    // not reset the clock.
    setTimeLeft(prev => (prev === null ? courseTimerMins * 60 : prev));

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          setPhase('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);




  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // -- Shared: run attempt/cert/progress checks after email is verified --
  // All queries go through /api/course (service role) -- anon client has no access to these tables.
  const runCourseChecks = useCallback(async (_email: string) => {
    setCheckingAttempts(true);

    if (!formId) { setCheckingAttempts(false); setPhase('course'); return; }

    try {
      const res = await fetch('/api/course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : {}),
        },
        body: JSON.stringify({ action: 'get-progress', course_id: formId }),
      });
      const d = await res.json();

      if (maxAttempts > 0 && d.attemptCount >= maxAttempts) {
        setAttemptError(
          `You have used all ${maxAttempts} attempt${maxAttempts > 1 ? 's' : ''} for this course.`
        );
        setCheckingAttempts(false);
        setPhase('info');
        return;
      }

      if (d.cert?.id) {
        // Already certified -- enter review mode: no saves, no XP, no new attempt
        setReviewMode(true);
        setCheckingAttempts(false);
        setPhase('course');
        return;
      }

      if (d.progress && d.progress.current_question_index > 0) {
        // In-progress -- auto-resume from where they left off
        maxIdxRef.current = d.progress.current_question_index;
        setCurrentQuestionIndex(d.progress.current_question_index);
        setAnswers(d.progress.answers ?? {});
        answersRef.current = d.progress.answers ?? {};
        setScore(d.progress.score ?? 0);
        setTotalPoints(d.progress.points ?? 0);
        setDisplayedPoints(d.progress.points ?? 0);
        setStreak(d.progress.streak ?? 0);
        setHintsUsed(new Set(d.progress.hints_used ?? []));
        setCheckingAttempts(false);
        setPhase('course');
        return;
      }
    } catch { /* allow on error */ }

    setCheckingAttempts(false);
    setPhase('course');
  }, [maxAttempts, formId]);

  // -- Start course -- get Supabase session token then run checks --
  const handleStartCourse = useCallback(async () => {
    if (!studentName.trim() || !studentEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail.trim())) {
      setAttemptError('Please enter a valid email address.');
      return;
    }

    setAttemptError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) sessionTokenRef.current = session.access_token;
    await runCourseChecks(studentEmail.trim().toLowerCase());
  }, [studentName, studentEmail, runCourseChecks]);

  // Keep sessionTokenRef in sync whenever Supabase refreshes the access token
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) sessionTokenRef.current = session.access_token;
    });
    return () => subscription.unsubscribe();
  }, []);

  // Keep progressRef in sync so the visibilitychange flush always has the latest values
  useEffect(() => {
    maxIdxRef.current = Math.max(maxIdxRef.current, currentQuestionIndex);
    answersRef.current = answers;
    progressRef.current = { answers, index: maxIdxRef.current, score, points: totalPoints, streak, hintsUsed };
  }, [answers, currentQuestionIndex, score, totalPoints, streak, hintsUsed]);

  // Flush progress when the student switches away from this tab (keepalive ensures delivery on unload)
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!formId || !studentEmail.trim() || reviewMode) return;
      const { answers, index, score, points, streak, hintsUsed } = progressRef.current;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionTokenRef.current) headers['Authorization'] = `Bearer ${sessionTokenRef.current}`;
      fetch('/api/course', {
        method: 'POST',
        headers,
        keepalive: true,
        body: JSON.stringify({
          action: 'save-progress',
          course_id: formId,
          current_question_index: index,
          answers,
          score,
          points,
          streak,
          hints_used: [...hintsUsed],
        }),
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [formId, studentEmail, reviewMode]);

  // Auto-start when pre-filled info arrives from the page (logged-in student)
  const autoStarted = useRef(false);
  useEffect(() => {
    if (initialStudentName && initialStudentEmail && !autoStarted.current) {
      autoStarted.current = true;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) sessionTokenRef.current = session.access_token;
        runCourseChecks(initialStudentEmail.trim().toLowerCase());
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save current progress via server API (fire-and-forget)
  const saveProgress = useCallback((
    newAnswers: Record<string, string>,
    newIndex: number,
    newScore: number,
    newPoints: number,
    newStreak: number,
    newHintsUsed: Set<string>,
  ) => {
    if (!formId || !studentEmail.trim()) return;
    if (reviewMode) return; // review mode -- never write new attempts
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionTokenRef.current) headers['Authorization'] = `Bearer ${sessionTokenRef.current}`;
    fetch('/api/course', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action:                 'save-progress',
        course_id:              formId,
        student_email:          studentEmail.trim(),
        student_name:           studentName.trim(),
        current_question_index: newIndex,
        answers:                newAnswers,
        score:                  newScore,
        points:                 newPoints,
        streak:                 newStreak,
        hints_used:             [...newHintsUsed],
      }),
    }).catch(() => {});
  }, [formId, studentEmail, studentName, reviewMode]);

  // Mark active attempt as completed via API -- returns a promise so callers can await it
  const clearProgress = useCallback(async (finalScore: number): Promise<void> => {
    if (!formId || !studentEmail.trim()) return;
    if (reviewMode) return; // review mode -- keep original completed attempt intact
    const scorePct = totalQuestions > 0 ? Math.round((Math.min(finalScore, totalQuestions) / totalQuestions) * 100) : 100;
    const passed   = totalQuestions === 0 ? true : scorePct >= passmark;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/course', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        action:                 'complete-attempt',
        course_id:              formId,
        score:                  scorePct,
        passed,
        points:                 totalPoints,
        current_question_index: totalQuestions,
      }),
    }).catch(err => console.error('[clearProgress] failed:', err));
  }, [formId, studentEmail, totalQuestions, passmark, totalPoints, reviewMode]);

  // Resume from saved progress
  const handleResume = useCallback(() => {
    if (!savedProgress) return;
    maxIdxRef.current = savedProgress.current_question_index ?? 0;
    setCurrentQuestionIndex(savedProgress.current_question_index);
    setAnswers(savedProgress.answers ?? {});
    answersRef.current = savedProgress.answers ?? {};
    setScore(savedProgress.score ?? 0);
    setTotalPoints(savedProgress.points ?? 0);
    setDisplayedPoints(savedProgress.points ?? 0);
    setStreak(savedProgress.streak ?? 0);
    setHintsUsed(new Set(savedProgress.hints_used ?? []));
    setSavedProgress(null);
    setShowResumePrompt(false);
    setPhase('course');
  }, [savedProgress]);

  // Discard saved progress and start fresh
  const handleStartFresh = useCallback(async () => {
    if (formId && studentEmail.trim()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/course', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ action: 'clear-progress', course_id: formId }),
        });
      } catch { /* ignore */ }
    }
    setSavedProgress(null);
    setShowResumePrompt(false);
    setPhase('course');
  }, [formId, studentEmail]);

  // -- Answer checking helpers --
  const checkFillBlank = (userAnswer: string, correctAnswer: string): boolean => {
    const accepted = correctAnswer.split('|').map(s => s.trim().toLowerCase());
    return accepted.includes(userAnswer.trim().toLowerCase());
  };

  const checkArrange = (order: string[], correctAnswer: string): boolean => {
    const correct = correctAnswer.split('|||');
    return order.join('|||') === correct.join('|||');
  };

  const getCurrentAnswer = () => {
    if (questionType === 'fill_blank') return fillBlankAnswer;
    if (questionType === 'arrange') return arrangeOrder.join('|||');
    return selectedOption ?? '';
  };

  const isAnswered = () => {
    if (REVIEW_TYPES.includes(questionType)) return reviewCompleted.has(currentQuestion.id);
    if (questionType === 'fill_blank') return fillBlankAnswer.trim().length > 0;
    if (questionType === 'arrange') return arrangeOrder.length > 0;
    return selectedOption !== null; // covers multiple_choice, image, code
  };

  // -- Format answer for review display --
  const formatAnswer = (q: any, answer: string) => {
    if (!answer) return null;
    const qType: QuestionType = q.type ?? 'multiple_choice';
    if (qType === 'arrange') return answer.split('|||').join(' -> ');
    if (qType === 'image') {
      const idx = q.options.indexOf(answer);
      return idx >= 0 ? `Option ${String.fromCharCode(65 + idx)}` : answer;
    }
    return answer;
  };

  const isAnswerCorrect = (q: any, answer: string) => {
    const qType: QuestionType = q.type ?? 'multiple_choice';
    if (REVIEW_TYPES.includes(qType)) return answer === 'completed';
    if (qType === 'fill_blank') return checkFillBlank(answer, q.correctAnswer);
    if (qType === 'arrange') return answer === q.correctAnswer;
    return answer === q.correctAnswer;
  };

  // -- Points system --
  const ps = (config as any).pointsSystem;
  const pointsEnabled = ps?.enabled !== false;

  // -- Animated points counter --
  useEffect(() => {
    if (displayedPoints === totalPoints) return;
    const step = Math.ceil(Math.abs(totalPoints - displayedPoints) / 20);
    const timer = setTimeout(() => {
      setDisplayedPoints(prev => Math.abs(totalPoints - prev) <= step ? totalPoints : prev + step);
    }, 16);
    return () => clearTimeout(timer);
  }, [totalPoints, displayedPoints]);

  // -- Fetch leaderboard rank when result appears --
  useEffect(() => {
    if (!isSuccess || !formId || !studentEmail) return;
    supabase
      .from('course_attempts')
      .select('student_id, score, points, passed, students(email, full_name)')
      .eq('course_id', formId)
      .not('completed_at', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        // Keep best attempt per student
        const byEmail = new Map<string, any>();
        for (const r of data) {
          const email = ((r.students as any)?.email || '').toLowerCase();
          const name  = (r.students as any)?.full_name || email;
          const entry = { email, name, percentage: r.score ?? 0, points: r.points ?? 0, passed: r.passed };
          const existing = byEmail.get(email);
          if (!existing || (entry.percentage > existing.percentage)) {
            byEmail.set(email, entry);
          }
        }
        const sorted = Array.from(byEmail.values()).sort((a, b) => {
          const d = b.percentage - a.percentage;
          return d !== 0 ? d : (b.points ?? 0) - (a.points ?? 0);
        });
        const myKey = studentEmail.trim().toLowerCase();
        const idx   = sorted.findIndex(d => d.email === myKey);
        if (idx === -1) return;
        setRankCtx({
          rank:  idx + 1,
          total: sorted.length,
          above: idx > 0                  ? sorted[idx - 1] : null,
          me:    sorted[idx],
          below: idx < sorted.length - 1  ? sorted[idx + 1] : null,
        });
      });
  }, [isSuccess, formId, studentEmail]);

  // -- Smart course recommendations (fetch when student passes) --
  const [recommendations, setRecommendations] = useState<any[]>([]);
  useEffect(() => {
    if (!isSuccess || !formId) return;
    // Only fetch if the student passed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch('/api/vector/recommend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ completedFormId: formId }),
      })
        .then(r => r.ok ? r.json() : { recommendations: [] })
        .then(({ recommendations: recs }) => { if (recs?.length) setRecommendations(recs); })
        .catch(() => {});
    });
  }, [isSuccess, formId]);

  // -- All questions answered but student never hit Submit (e.g. closed tab) --
  // Detect on mount/resume and auto-transition to the completion screen.
  useEffect(() => {
    if (phase === 'course' && !reviewMode && totalSlides > 0 && currentQuestionIndex >= totalSlides) {
      clearProgress(score).then(() => setPhase('complete'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestionIndex, totalSlides, reviewMode]);

  // -- Success screen (shown after submission) --
  if (isSuccess) {
    const submittedPct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 100;
    const submittedPassed = totalQuestions === 0 ? true : submittedPct >= passmark;
    const isLessonOnly = totalQuestions === 0;
    const scoreDisplay = Number.isInteger(score) ? String(score) : score.toFixed(1);
    const scoreMarker = Math.max(4, Math.min(96, submittedPct));
    const passMarker = Math.max(4, Math.min(96, passmark));

    const resultColor = submittedPassed ? '#10b981' : '#f43f5e';

    return (
      <div className={`max-w-2xl mx-auto space-y-3 pt-8 px-4 sm:px-6`} style={fontStyle}>

        {/* -- Hero card -- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl overflow-hidden ${cardBg}`}
        >
          {/* Accent top bar */}
          <div className="h-1 w-full" style={{ background: resultColor }} />

          <div className="p-7 sm:p-8 space-y-6">

            {/* Score row */}
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1 min-w-0 space-y-2">
                  {config.title && (
                    <p className={`text-xs font-semibold tracking-widest uppercase truncate ${mutedColor}`}>{config.title}</p>
                  )}
                  <div className="flex items-end gap-2 flex-wrap">
                    {isLessonOnly ? (
                      <span className={`text-4xl sm:text-5xl font-black leading-none ${textColor}`}>100%</span>
                    ) : (
                      <>
                        <span className={`text-4xl sm:text-5xl font-black leading-none ${textColor}`}>{submittedPct}%</span>
                        <span className={`text-sm sm:text-base pb-1 ${mutedColor}`}>{scoreDisplay} / {totalQuestions} correct</span>
                      </>
                    )}
                  </div>
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider text-white"
                    style={{ background: resultColor }}
                  >
                    {isLessonOnly ? 'COMPLETED' : (submittedPassed ? 'PASSED' : 'FAILED')}
                  </span>
                </div>
                {!isLessonOnly && (
                  <div className={`rounded-xl px-5 py-4 sm:min-w-[170px] ${subtleBg}`}>
                    <p className={`text-[11px] font-semibold tracking-widest uppercase ${mutedColor}`}>Pass Target</p>
                    <p className="mt-1 text-2xl font-black text-rose-500">{passmark}%</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl px-5 sm:px-6 py-5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }}>
                {isLessonOnly ? (
                  <div className="flex items-center gap-3 py-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm font-medium" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
                      You have completed all lessons in this course.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-[11px] font-semibold mb-3" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>Score progress</div>

                    <div className="relative pt-7 pb-8">
                      <div className="h-4 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${submittedPct}%`,
                            background: submittedPassed
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : 'linear-gradient(90deg, #f97316, #f43f5e)',
                            transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                          }}
                        />
                      </div>

                      <div
                        className="absolute top-4 bottom-5 w-0"
                        style={{ left: `${passMarker}%`, borderLeft: '2px dashed #ef4444' }}
                      />
                      <div
                        className="absolute top-0 -translate-x-1/2 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap"
                        style={{ left: `${scoreMarker}%`, background: resultColor, color: '#fff' }}
                      >
                        You: {submittedPct}%
                      </div>
                      <div
                        className={`absolute bottom-0 -translate-x-1/2 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}
                        style={{ left: `${passMarker}%` }}
                      >
                        Pass mark
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Certificate button */}
            {submittedPassed && certificateId && (
              <a
                href={`/certificate/${certificateId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: accent, color: '#ffffff' }}
              >
                View Your Certificate
              </a>
            )}

            {/* XP + milestones */}
            {pointsEnabled && (
              <div className={`rounded-xl ${isDark ? 'bg-zinc-800/40' : 'bg-zinc-50'}`}>

                {/* XP row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">⭐</span>
                    <div>
                      <p className={`text-[10px] font-semibold tracking-widest uppercase ${mutedColor}`}>XP Earned</p>
                      <p className="text-2xl font-black leading-none" style={{ color: isDark ? '#facc15' : '#10b981' }}>
                        {displayedPoints.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {streak >= (ps?.streakCount ?? 3) && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                      🔥 {streak} streak
                    </div>
                  )}
                </div>

                {/* Milestones */}
                {(ps?.milestones ?? []).length > 0 && (() => {
                  const sorted = [...(ps.milestones ?? [])].sort((a: any, b: any) => a.points - b.points);
                  const unlocked = sorted.filter((m: any) => totalPoints >= m.points);
                  const nextMilestone = sorted.find((m: any) => totalPoints < m.points);
                  return (
                    <div className="px-4 py-3 space-y-2">
                      {unlocked.map((m: any) => (
                        <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                          <span className="text-base flex-shrink-0">🏆</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${textColor}`}>{m.label}</p>
                            {m.description && <p className={`text-xs mt-0.5 ${mutedColor}`}>{m.description}</p>}
                            {m.rewardUrl && (
                              <a href={m.rewardUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 mt-1 hover:opacity-75">
                                Claim reward <ArrowRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <span className="text-emerald-500 text-xs font-bold flex-shrink-0">{m.points} XP</span>
                        </div>
                      ))}
                      {nextMilestone && (
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-zinc-900/60 border border-zinc-700/60' : 'bg-white border border-zinc-200'}`}>
                          <span className="text-base flex-shrink-0 opacity-40">🔒</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${mutedColor}`}>{nextMilestone.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: accent }}>
                              {nextMilestone.points - totalPoints} XP to unlock -- retake to beat your score
                            </p>
                          </div>
                          <span className={`text-xs font-bold flex-shrink-0 ${mutedColor}`}>{nextMilestone.points} XP</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className={`px-7 sm:px-8 py-4 flex items-center justify-end ${isDark ? 'bg-zinc-900/40' : 'bg-zinc-50/60'}`}>
            {!isSharedView && (
              <button onClick={onReset} className={`text-xs flex items-center gap-1.5 font-medium ${mutedColor} hover:opacity-70 transition-opacity`}>
                <RotateCcw className="w-3 h-3" /> Back to Editor
              </button>
            )}
            <p className={`text-xs ${mutedColor}`}>Results recorded</p>
          </div>
        </motion.div>

        {/* -- Leaderboard rank card -- */}
        {rankCtx && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-2xl overflow-hidden ${isDark ? 'bg-zinc-900/80' : 'bg-white'}`}
            style={{ boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${mutedColor}`}>Leaderboard</p>
                <p className={`text-sm font-bold mt-0.5 ${textColor}`}>
                  You ranked <span style={{ color: accent }}>#{rankCtx.rank}</span> out of {rankCtx.total}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                style={{ background: `${accent}18`, color: accent }}
              >
                {rankCtx.rank === 1 ? '🥇' : rankCtx.rank === 2 ? '🥈' : rankCtx.rank === 3 ? '🥉' : `#${rankCtx.rank}`}
              </div>
            </div>

            {/* Rows */}
            <div className={`mx-4 mb-4 rounded-xl overflow-hidden ${isDark ? 'bg-zinc-800/40' : 'bg-zinc-50'}`}>
              {/* One above */}
              {rankCtx.above && (
                <div className={`flex items-center gap-3 px-4 py-3 ${isDark ? 'border-b border-zinc-700/40' : 'border-b border-zinc-200/60'}`}>
                  <span className={`text-[11px] font-bold w-5 tabular-nums text-right ${mutedColor}`}>{rankCtx.rank - 1}</span>
                  <span className={`text-sm flex-1 truncate ${mutedColor}`}>{rankCtx.above.name || 'Anonymous'}</span>
                  <span className={`text-xs font-semibold tabular-nums ${mutedColor}`}>{rankCtx.above.percentage ?? 0}%</span>
                </div>
              )}

              {/* Me */}
              <div
                className={`flex items-center gap-3 px-4 py-3.5 ${rankCtx.above && (isDark ? 'border-b border-zinc-700/40' : 'border-b border-zinc-200/60')}`}
                style={{ background: `${accent}14` }}
              >
                <span className="text-[11px] font-black w-5 tabular-nums text-right" style={{ color: accent }}>{rankCtx.rank}</span>
                <span className={`text-sm font-semibold flex-1 truncate ${textColor}`}>
                  {rankCtx.me.name || 'You'}
                  <span className={`ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-md ${isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'}`}>you</span>
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>{rankCtx.me.percentage ?? 0}%</span>
              </div>

              {/* One below */}
              {rankCtx.below && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-[11px] font-bold w-5 tabular-nums text-right ${mutedColor}`}>{rankCtx.rank + 1}</span>
                  <span className={`text-sm flex-1 truncate ${mutedColor}`}>{rankCtx.below.name || 'Anonymous'}</span>
                  <span className={`text-xs font-semibold tabular-nums ${mutedColor}`}>{rankCtx.below.percentage ?? 0}%</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* -- Answer review -- */}
        {showAnswers === 'after_quiz' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`border rounded-2xl overflow-hidden ${cardBg}`}
          >
            <div className={`px-5 py-3.5 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <h3 className={`text-sm font-semibold ${textColor}`}>Answer Review</h3>
              <p className={`text-xs mt-0.5 ${mutedColor}`}>See where you went right and wrong.</p>
            </div>
            <div>
              {questions.map((q: any, idx: number) => {
                const userAnswer = answers[q.id] ?? '';
                const correct = isAnswerCorrect(q, userAnswer);
                const qType: QuestionType = q.type ?? 'multiple_choice';
                const correctDisplay = qType === 'arrange'
                  ? q.correctAnswer.split('|||').join(' -> ')
                  : qType === 'fill_blank'
                    ? q.correctAnswer.split('|').map((s: string) => s.trim()).join(' / ')
                    : qType === 'image'
                      ? (() => { const i = q.options.indexOf(q.correctAnswer); return i >= 0 ? `Option ${String.fromCharCode(65 + i)}` : q.correctAnswer; })()
                      : q.correctAnswer;
                return (
                  <div
                    key={q.id}
                    className={`px-5 py-4 flex gap-3 ${idx < questions.length - 1 ? (isDark ? 'border-b border-zinc-800/60' : 'border-b border-zinc-100') : ''}`}
                  >
                    {/* Status dot */}
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${correct ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                      {correct
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={`text-sm leading-snug ${textColor}`}>
                        <span className={`text-[11px] font-normal mr-1.5 ${mutedColor}`}>Q{idx + 1}</span>
                        {q.question}
                      </p>
                      {!correct && (
                        <div className="space-y-0.5 mt-1.5">
                          {userAnswer
                            ? <p className="text-xs text-rose-400">Your answer: <span className="font-medium">{formatAnswer(q, userAnswer)}</span></p>
                            : <p className={`text-xs italic ${mutedColor}`}>Not answered</p>}
                          <p className="text-xs text-emerald-400">Correct: <span className="font-medium">{correctDisplay}</span></p>
                        </div>
                      )}
                      {q.explanation && (
                        <p className={`text-xs leading-relaxed mt-2 ${mutedColor}`}>{q.explanation}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* -- Post-submission -- */}
        {postSubmission?.type && postSubmission.type !== 'default' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            {postSubmission.type === 'button' && postSubmission.buttonUrl && (
              <a
                href={postSubmission.buttonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: accent, color: 'white' }}
              >
                {postSubmission.buttonLabel || 'Continue'}
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {postSubmission.type === 'notice' && (
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'}`}>
                {postSubmission.noticeTitle && (
                  <h3 className={`font-semibold text-base mb-1.5 ${textColor}`}>{postSubmission.noticeTitle}</h3>
                )}
                {postSubmission.noticeBody && (
                  <p className={`text-sm leading-relaxed ${mutedColor}`}>{postSubmission.noticeBody}</p>
                )}
              </div>
            )}

            {postSubmission.type === 'redirect' && postSubmission.redirectUrl && (
              <div className={`flex items-center justify-center gap-2 p-4 rounded-2xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'}`}>
                <Loader2 className={`w-4 h-4 animate-spin ${mutedColor}`} />
                <span className={`text-sm ${mutedColor}`}>Redirecting you…</span>
              </div>
            )}

            {postSubmission.type === 'events' && relatedForms.length > 0 && (
              <div className="space-y-2.5">
                <p className={`text-xs font-semibold tracking-widest uppercase px-1 ${mutedColor}`}>You might also like</p>
                {relatedForms.map((rf: any) => {
                  const rfConfig = rf.config || {};
                  const href = rf.slug ? `/${rf.slug}` : `/${rf.id}`;
                  return (
                    <a key={rf.id} href={href}
                      className={`flex rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-100 shadow-sm'}`}>
                      {rfConfig.coverImage ? (
                        <div className="w-28 flex-shrink-0">
                          <img src={rfConfig.coverImage} alt="" className="w-full h-full object-cover" style={{ minHeight: '100px' }} />
                        </div>
                      ) : (
                        <div className={`w-28 flex-shrink-0 flex items-center justify-center text-2xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`} style={{ minHeight: '100px' }}>🗓</div>
                      )}
                      <div className="flex-1 min-w-0 p-4 flex flex-col justify-between gap-2">
                        <div>
                          <p className={`font-semibold text-sm leading-snug ${textColor}`}>{rfConfig.title || rf.title}</p>
                          {rfConfig.description && (
                            <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${mutedColor}`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(rfConfig.description) }} />
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
                          Register now <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* -- Assignment Capstone -- */}
        {relatedAssignment && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-zinc-900/80 border-zinc-800/60' : 'bg-white border-zinc-100'}`}
            style={{ boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div className="h-1 w-full" style={{ background: accent }} />
            <div className="px-5 py-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                <BookOpen className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${mutedColor}`}>Your Next Step</p>
                <p className={`text-sm font-bold leading-snug mb-1 ${textColor}`}>{relatedAssignment.title}</p>
                <p className={`text-xs leading-relaxed ${mutedColor}`}>
                  Apply what you just learned. Complete the assignment to reinforce your skills.
                </p>
              </div>
            </div>
            <div className={`px-5 pb-4`}>
              <a
                href={`/student?section=assignments`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: accent, color: '#fff' }}
              >
                Start Assignment <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}

        {/* -- AI-powered course recommendations -- */}
        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${mutedColor}`}>
              What to take next
            </p>
            <div className="space-y-2">
              {recommendations.map((rec: any, i: number) => (
                <a
                  key={rec.formId}
                  href={`/${rec.slug}?go=1`}
                  className={`flex items-center gap-3 rounded-xl p-3 no-underline transition-all hover:opacity-80 border ${
                    isDark ? 'bg-zinc-900/60 border-zinc-800/60' : 'bg-white border-zinc-100'
                  }`}
                  style={{ boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: `${accent}15` }}>
                    {rec.coverImage
                      ? <img src={rec.coverImage} alt="" className="w-full h-full object-cover" />
                      : <BookOpen className="w-4 h-4" style={{ color: accent }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${textColor}`}>{rec.title}</p>
                    <p className={`text-[10px] mt-0.5 ${mutedColor}`}>Recommended for you</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* -- Retake button (failed only) -- */}
        {!submittedPassed && !isLessonOnly && onRetake && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <button
              onClick={onRetake}
              className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm border transition-all hover:opacity-80 active:scale-[0.98]`}
              style={{ background: 'transparent', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)', color: isDark ? '#a1a1aa' : '#555' }}
            >
              <RotateCcw className="w-4 h-4" /> Retake Course
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  // -- Loading state while progress check runs silently --
  if (checkingAttempts && initialStudentName) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16, ...fontStyle }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent, opacity: 0.6 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340 }}>
          <div style={{ height: 12, borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', width: '70%' }} className="animate-pulse" />
          <div style={{ height: 12, borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', width: '50%' }} className="animate-pulse" />
        </div>
      </div>
    );
  }

  // -- Student info screen --
  if (phase === 'info') {
    // -- Auto-start mode (pre-filled from overview modal) -> render as portal popup --
    if (initialStudentName) {
      if (typeof document === 'undefined') return null;

      const overlayBg = isDark ? '#18181b' : '#ffffff';
      const overlayBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

      const popupContent = (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ background: overlayBg, border: `1px solid ${overlayBorder}`, borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', width: '100%', maxWidth: 420, overflow: 'hidden', ...fontStyle }}
          >
            {/* Accent top bar */}
            <div style={{ height: 4, background: accent }} />

            <div style={{ padding: '24px 28px 28px' }}>
              {/* Attempt error */}
              {!checkingAttempts && attemptError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${textColor}`}>Attempts exhausted</p>
                      <p className={`text-xs mt-0.5 ${mutedColor}`}>{attemptError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing certificate */}
              {!checkingAttempts && existingCertId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${accent}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>
                      🎓
                    </div>
                    <div>
                      <p className={`text-base font-bold ${textColor}`}>Course completed!</p>
                      <p className={`text-xs mt-0.5 ${mutedColor}`}>Hi {studentName}. Your certificate is ready.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <a
                      href={`/certificate/${existingCertId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 14, fontWeight: 700, fontSize: 14, color: 'white', background: accent, textDecoration: 'none' }}
                    >
                      View & Download Certificate <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => { setExistingCertId(null); setPhase('course'); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 14, fontWeight: 500, fontSize: 13, background: 'transparent', border: `1px solid ${overlayBorder}`, cursor: 'pointer', color: isDark ? '#a1a1aa' : '#71717a' }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retake course anyway
                    </button>
                  </div>
                </div>
              )}

              {/* Resume in-progress */}
              {!checkingAttempts && !existingCertId && showResumePrompt && savedProgress && (() => {
                const savedPct = totalSlides > 0 ? Math.round((savedProgress.current_question_index / totalSlides) * 100) : 0;
                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${accent}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>
                      📖
                    </div>
                    <div>
                      <p className={`text-base font-bold ${textColor}`}>Welcome back, {studentName.split(' ')[0]}!</p>
                      <p className={`text-xs mt-0.5 ${mutedColor}`}>
                        Slide {savedProgress.current_question_index + 1} of {totalSlides}
                        {savedProgress.points > 0 && <> · <span style={{ color: accent }}>{savedProgress.points} XP earned</span></>}
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, borderRadius: 99, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: accent, width: `${savedPct}%`, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={handleResume}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 14, fontWeight: 700, fontSize: 14, color: 'white', background: accent, border: 'none', cursor: 'pointer' }}
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleStartFresh}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 14, fontWeight: 500, fontSize: 13, background: 'transparent', border: `1px solid ${overlayBorder}`, cursor: 'pointer', color: isDark ? '#a1a1aa' : '#71717a' }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Start over
                    </button>
                  </div>
                </div>
                );
              })()}
            </div>
          </motion.div>
        </div>
      );

      // Only show the popup while something needs user attention; otherwise render nothing
      // (handleStartCourse will transition to 'course' phase when all clear)
      if (existingCertId || showResumePrompt || attemptError) {
        return createPortal(popupContent, document.body);
      }
      return null;
    }

    // -- Normal info form (no pre-filled info) --
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-xl mx-auto border rounded-2xl overflow-hidden ${cardBg}`}
        style={fontStyle}
      >
        <div className="p-8 space-y-6">
          <div>
            <h2 className={`text-xl font-semibold mb-1 ${textColor}`}>Before you begin</h2>
            <p className={`text-sm ${mutedColor}`}>Enter your details to record your attempt.</p>
          </div>

          {(courseTimerMins > 0 || maxAttempts > 0) && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${isDark ? 'border-zinc-700 bg-zinc-800/40 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-0.5">
                {courseTimerMins > 0 && <p>Time limit: <span className="font-semibold text-amber-400">{courseTimerMins} minute{courseTimerMins > 1 ? 's' : ''}</span></p>}
                {maxAttempts > 0 && <p>Max attempts: <span className="font-semibold">{maxAttempts}</span> per email address</p>}
                <p className="mt-1">Do not switch tabs or windows during the course.</p>
              </div>
            </div>
          )}

          {learningOutcomes.length > 0 && (
            <div className={`p-4 rounded-xl border ${isDark ? 'border-zinc-700 bg-zinc-800/40' : 'border-zinc-200 bg-zinc-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.14em] mb-2 ${mutedColor}`}>What you will learn</p>
              <div className="space-y-2">
                {learningOutcomes.map((outcome, idx) => (
                  <div key={`${idx}-${outcome}`} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                    <p className={`text-sm leading-relaxed ${textColor}`}>{outcome}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${mutedColor}`}>Full Name</label>
              <AnimatedField theme={config.theme || 'forest'} mode={config.mode || 'dark'}>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="Enter your full name..."
                  className={`w-full bg-transparent border-none outline-none px-4 py-3 text-sm ${isDark ? 'text-white placeholder:text-zinc-600' : 'text-zinc-900 placeholder:text-zinc-400'}`}
                />
              </AnimatedField>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${mutedColor}`}>Email Address</label>
              <AnimatedField theme={config.theme || 'forest'} mode={config.mode || 'dark'}>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={e => { setStudentEmail(e.target.value); setAttemptError(''); }}
                  placeholder="you@example.com"
                  className={`w-full bg-transparent border-none outline-none px-4 py-3 text-sm ${isDark ? 'text-white placeholder:text-zinc-600' : 'text-zinc-900 placeholder:text-zinc-400'}`}
                />
              </AnimatedField>
            </div>
          </div>

          {attemptError && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {attemptError}
            </div>
          )}

          {existingCertId ? (
            <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'bg-zinc-50 border border-zinc-200/80'}`}>
              <div className="h-0.5 w-full" style={{ background: accent }} />
              <div className="p-4 space-y-3">
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>You&apos;ve already completed this course</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Your certificate is ready to view and share.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/certificate/${existingCertId}`} target="_blank" rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] hover:opacity-90 whitespace-nowrap"
                    style={{ background: accent, color: 'white' }}>
                    🎓 View Certificate
                  </a>
                  <button onClick={() => { setExistingCertId(null); setPhase('course'); }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/60'}`}>
                    <RotateCcw className="w-3.5 h-3.5" /> Retake anyway
                  </button>
                </div>
              </div>
            </div>
          ) : showResumePrompt && savedProgress ? (
            <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'bg-zinc-50 border border-zinc-200/80'}`}>
              {(() => {
                const savedPct = totalSlides > 0 ? Math.round((savedProgress.current_question_index / totalSlides) * 100) : 0;
                return (<>
              <div className={`h-0.5 w-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`}>
                <div className="h-full transition-all duration-700" style={{ width: `${savedPct}%`, background: accent }} />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Continue where you left off</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Slide {savedProgress.current_question_index + 1} of {totalSlides}
                      {savedProgress.points > 0 && <> &middot; <span style={{ color: accent }}>{savedProgress.points} XP earned</span></>}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums px-2 py-1 rounded-lg ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
                    {savedPct}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleResume} className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] hover:opacity-90" style={{ background: accent, color: 'white' }}>
                    Continue <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleStartFresh} className={`py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/60'}`}>
                    <RotateCcw className="w-3.5 h-3.5" /> Start over
                  </button>
                </div>
              </div>
              </>);
              })()}
            </div>
          ) : (
            <button
              onClick={handleStartCourse}
              disabled={!studentName.trim() || !studentEmail.trim() || checkingAttempts || !!attemptError}
              className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              style={{ background: accent }}
            >
              {checkingAttempts ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ChevronRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // -- Complete screen --
  if (phase === 'complete') {
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 100;
    const passed = totalQuestions === 0 ? true : percentage >= passmark;
    const unansweredCount = questions.filter((q: any) => !q.lessonOnly && !q.isSection && !q.isDownloads && !answers[q.id]).length;

    const handleGoBack = (idx: number) => {
      setCurrentQuestionIndex(idx);
      setSelectedOption(null);
      setFillBlankAnswer('');
      setIsChecking(false);
      setIsCorrect(null);
      setDirection(1);
      setPhase('course');
    };

    const completeCard = (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`w-full max-w-lg border rounded-2xl overflow-hidden ${cardBg}`}
        style={fontStyle}
      >
        <div className="p-8 text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto bg-zinc-500/10">
            <CheckCircle2 className="w-8 h-8 text-zinc-400" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${textColor}`}>All Done!</h2>
            <p className={`text-sm mt-1 ${mutedColor}`}>
              {timeLeft === 0 ? "Time's up! " : ''}Submit your results to see your score.
            </p>
          </div>

          {/* Unanswered warning */}
          {unansweredCount > 0 && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 text-left space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400">
                    {unansweredCount} question{unansweredCount > 1 ? 's' : ''} unanswered
                  </p>
                  <p className="text-xs text-red-400/70 mt-0.5">
                    Go back to answer them or submit anyway.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                {questions
                  .filter((q: any) => !q.lessonOnly && !q.isSection && !q.isDownloads && !answers[q.id])
                  .map((q: any) => {
                    const idx = questions.findIndex((qq: any) => qq.id === q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => handleGoBack(idx)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                      >
                        Q{idx + 1}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {totalQuestions > 0 && (
            <p className={`text-xs ${mutedColor}`}>
              You answered {Object.keys(answers).filter(id => !questions.find((q: any) => q.id === id)?.lessonOnly).length} of {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}.
            </p>
          )}
          <button
            onClick={(e) => onSubmit(e, { name: studentName, email: studentEmail, score, total: totalQuestions, percentage, passed, answers, points: totalPoints, streak, studentToken: sessionTokenRef.current })}
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
            style={{ background: accent }}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : totalQuestions === 0 ? 'Complete Course' : 'Submit & See Results'}
          </button>
        </div>
      </motion.div>
    );

    if (inlineMode) return completeCard;
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
        {completeCard}
      </div>,
      document.body
    );
  }


  const calcPoints = (hintUsed: boolean): { earned: number; label: string; isTimeBonus: boolean; isStreak: boolean } => {
    if (!pointsEnabled) return { earned: 0, label: '', isTimeBonus: false, isStreak: false };
    const base = ps?.basePoints ?? 50;
    const elapsed = (Date.now() - questionStartTime) / 1000;
    const timeBonusEnabled = ps?.timeBonusEnabled ?? true;
    const withinTimeBonus = timeBonusEnabled && elapsed <= (ps?.timeBonusSeconds ?? 10);
    const timeMultiplier = withinTimeBonus ? (ps?.timeBonusMultiplier ?? 1.5) : 1;
    const newStreak = streak + 1;
    const streakEnabled = ps?.streakEnabled ?? true;
    const isStreak = streakEnabled && newStreak >= (ps?.streakCount ?? 3);
    const streakMultiplier = isStreak ? 1.2 : 1;
    let earned = Math.round(base * timeMultiplier * streakMultiplier);
    if (hintUsed) earned = Math.max(0, earned - (ps?.hintPenalty ?? 20));
    let label = `+${earned} XP`;
    if (withinTimeBonus && isStreak) label = `🔥⚡ +${earned} XP`;
    else if (isStreak) label = `🔥 +${earned} XP`;
    else if (withinTimeBonus) label = `⚡ +${earned} XP`;
    return { earned, label, isTimeBonus: withinTimeBonus, isStreak };
  };

  // -- Swipe navigation --
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Ignore if vertical scroll is dominant or swipe too short
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;

    // Never swipe on arrange (drag-and-drop) questions
    if ((currentQuestion?.type ?? 'multiple_choice') === 'arrange') return;

    if (deltaX < 0) {
      // Swipe left -> next
      if (isChecking) {
        // Feedback already shown -- advance
        handleNext();
      } else if (!isChecking && isAnswered() && showAnswers === 'none') {
        // Direct mode -- submit and advance
        handleNextDirect();
      }
    } else {
      // Swipe right -> previous (only when not locked in feedback)
      if (!isChecking && currentQuestionIndex > 0) {
        setDirection(-1);
        setCurrentQuestionIndex(prev => prev - 1);
      }
    }
  };

  // -- Quiz questions --
  if (!currentQuestion) return null;

  const handleCheck = (overrideAnswer?: string) => {
    if (overrideAnswer == null && !isAnswered()) return;
    if (answers[currentQuestion.id]) return; // already answered -- no re-awarding
    if (scoringLockRef.current) return; // prevent double-fire before state settles
    scoringLockRef.current = true;
    const userAnswer = overrideAnswer ?? getCurrentAnswer();
    let correct = false;
    if (questionType === 'fill_blank') {
      correct = checkFillBlank(userAnswer, currentQuestion.correctAnswer);
    } else if (questionType === 'arrange') {
      correct = checkArrange(arrangeOrder, currentQuestion.correctAnswer);
    } else {
      correct = userAnswer === currentQuestion.correctAnswer;
    }
    setIsCorrect(correct);
    setIsChecking(true);
    if (correct && !reviewMode) {
      // Feature 3: if hint was used for this question, award 0.9 instead of 1
      const hintWasUsed = hintsUsed.has(currentQuestion.id);
      setScore(s => s + (hintWasUsed ? 0.9 : 1));
      if (confettiRef.current) burstConfetti(confettiRef.current, accent);
      // Points system
      if (pointsEnabled && !reviewMode) {
        const { earned, label, isStreak } = calcPoints(hintVisible);
        setTotalPoints(prev => prev + earned);
        const newStreak = streak + 1;
        setStreak(newStreak);
        setFloatingPoints({ id: Date.now(), text: label, x: 50, y: 60 });
        setTimeout(() => setFloatingPoints(null), 1200);
        setXpNotify(true);
        setTimeout(() => setXpNotify(false), 2500);
        if (isStreak) {
          setStreakToast(`${newStreak} in a row! 1.2× XP`);
          setTimeout(() => setStreakToast(null), 2200);
        }
      }
    } else {
      if (pointsEnabled && !reviewMode) {
        setStreak(0);
      }
    }
    const newAnswers = { ...answersRef.current, [currentQuestion.id]: userAnswer };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);
    // Compute updated score/points for saving (state updates are async)
    const hintWasUsed = hintsUsed.has(currentQuestion.id);
    const newScore  = score + (correct ? (hintWasUsed ? 0.9 : 1) : 0);
    const newPoints = correct && pointsEnabled ? totalPoints + calcPoints(hintVisible).earned : totalPoints;
    const newStreak = correct && pointsEnabled ? streak + 1 : (pointsEnabled ? 0 : streak);
    saveProgress(newAnswers, currentQuestionIndex + 1, newScore, newPoints, newStreak, hintsUsed);
  };

  const doFinish = (finalScore: number) => {
    const pending = questions.filter((q: any) => !q.lessonOnly && !q.isSection && !q.isDownloads && !answers[q.id]);
    if (!reviewMode && pending.length > 0) {
      setFinishPending(pending);
    } else {
      clearProgress(finalScore).then(() => setPhase('complete'));
    }
  };

  const handleNext = () => {
    setLessonOpen(false);
    setDirection(1);
    setSelectedOption(null);
    setFillBlankAnswer('');
    setIsChecking(false);
    setIsCorrect(null);

    if (currentQuestionIndex < totalSlides - 1) {
      const nextIndex = currentQuestionIndex + 1;
      if (currentQuestion?.lessonOnly || (currentQuestion as any)?.isDownloads) {
        const newAnswers = { ...answersRef.current, [currentQuestion.id]: 'viewed' };
        answersRef.current = newAnswers;
        setAnswers(newAnswers);
        saveProgress(newAnswers, nextIndex, score, totalPoints, streak, hintsUsed);
      }
      setCurrentQuestionIndex(nextIndex);
      setSelectedOption(null);
      setFillBlankAnswer('');
      setIsChecking(false);
      setIsCorrect(null);
    } else {
      if (reviewMode) {
        setCurrentQuestionIndex(0);
        answersRef.current = {};
        setAnswers({});
        setSelectedOption(null);
        setFillBlankAnswer('');
        setIsChecking(false);
        setIsCorrect(null);
      } else {
        doFinish(score);
      }
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setDirection(-1);
      setCurrentQuestionIndex(i => i - 1);
    }
  };

  const handleSkip = () => {
    // Mark current question as skipped
    setSkippedQuestions(prev => new Set(prev).add(currentQuestion.id));
    // Find next unanswered or skipped question (wrapping)
    let next = -1;
    for (let i = 1; i <= totalSlides; i++) {
      const idx = (currentQuestionIndex + i) % totalSlides;
      const q = questions[idx];
      if (!answers[q.id]) { next = idx; break; }
    }
    if (next >= 0 && next !== currentQuestionIndex) {
      setDirection(1);
      setCurrentQuestionIndex(next);
      setSelectedOption(null);
      setFillBlankAnswer('');
      setIsChecking(false);
      setIsCorrect(null);
    } else {
      if (reviewMode) {
        // Review complete -- reset to start, same as handleNext/handleNextDirect
        setCurrentQuestionIndex(0);
        answersRef.current = {};
        setAnswers({});
        setSelectedOption(null);
        setFillBlankAnswer('');
        setIsChecking(false);
        setIsCorrect(null);
      } else {
        clearProgress(score).then(() => setPhase('complete'));
      }
    }
  };

  const handleNextDirect = () => {
    setLessonOpen(false);
    let newAnswers = answersRef.current;
    let newScore   = score;
    if (!reviewMode && isAnswered() && !answersRef.current[currentQuestion.id]) {
      if (scoringLockRef.current) return; // prevent double-fire before state settles
      scoringLockRef.current = true;
      const userAnswer = getCurrentAnswer();
      let correct = false;
      if (questionType === 'fill_blank') {
        correct = checkFillBlank(userAnswer, currentQuestion.correctAnswer);
      } else if (questionType === 'arrange') {
        correct = checkArrange(arrangeOrder, currentQuestion.correctAnswer);
      } else {
        correct = userAnswer === currentQuestion.correctAnswer;
      }
      if (correct) {
        const hintWasUsed = hintsUsed.has(currentQuestion.id);
        newScore = score + (hintWasUsed ? 0.9 : 1);
        setScore(newScore);
      }
      newAnswers = { ...answersRef.current, [currentQuestion.id]: userAnswer };
      answersRef.current = newAnswers;
      setAnswers(newAnswers);
    }
    setDirection(1);
    if (currentQuestionIndex < totalSlides - 1) {
      const nextIndex = currentQuestionIndex + 1;
      saveProgress(newAnswers, nextIndex, newScore, totalPoints, streak, hintsUsed);
      setCurrentQuestionIndex(nextIndex);
      setSelectedOption(null);
      setFillBlankAnswer('');
    } else {
      if (reviewMode) {
        // Review complete -- loop back to start, same as handleNext does
        setCurrentQuestionIndex(0);
        answersRef.current = {};
        setAnswers({});
        setSelectedOption(null);
        setFillBlankAnswer('');
        setIsChecking(false);
        setIsCorrect(null);
      } else {
        doFinish(newScore);
      }
    }
  };

  const countableSlides = questions.filter((q: any) => !q.isSection);
  const completedSlides = countableSlides.filter((q: any) => !!answers[q.id]).length;
  const progressPct = countableSlides.length > 0 ? (completedSlides / countableSlides.length) * 100 : 0;
  const timerWarning = timeLeft !== null && timeLeft <= 60;

  // -- Correct answer display for after-check feedback --
  const correctAnswerDisplay = () => {
    if (questionType === 'fill_blank') {
      return currentQuestion.correctAnswer.split('|').map((s: string) => s.trim()).join(' / ');
    }
    if (questionType === 'arrange') {
      return currentQuestion.options.join(' -> ');
    }
    if (questionType === 'image') {
      const idx = currentQuestion.options.indexOf(currentQuestion.correctAnswer);
      return idx >= 0 ? `Option ${String.fromCharCode(65 + idx)}` : currentQuestion.correctAnswer;
    }
    return currentQuestion.correctAnswer;
  };


  // -- Section divider slide --
  if (currentQuestion.isSection) {
    const isLast = currentQuestionIndex >= totalSlides - 1;
    const coverImage = (config as any).coverImage as string | undefined;
    // How many non-section, non-lessonOnly slides follow this section before the next section
    const slidesInSection = (() => {
      let count = 0;
      for (let i = currentQuestionIndex + 1; i < questions.length; i++) {
        const q = questions[i] as any;
        if (q.isSection) break;
        if (!q.lessonOnly) count++;
      }
      return count;
    })();

    return (
      <>
      <div className="relative flex flex-col min-h-screen overflow-hidden" style={{ fontFamily: fontStyle.fontFamily }}>

        {/* Full-bleed background -- cover image with overlay, or gradient fallback */}
        {coverImage ? (
          <>
            <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'brightness(0.35) saturate(1.2)' }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}55 0%, transparent 60%, rgba(0,0,0,0.6) 100%)` }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: isDark
            ? `linear-gradient(135deg, #0a0a0f 0%, ${accent}22 50%, #0a0a0f 100%)`
            : `linear-gradient(135deg, #0f0f1a 0%, ${accent}33 50%, #1a1a2e 100%)` }} />
        )}

        {/* Noise texture overlay for depth */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

        {/* Glowing accent orb top-right */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-30 pointer-events-none" style={{ background: accent }} />
        {/* Subtle orb bottom-left */}
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-[100px] opacity-20 pointer-events-none" style={{ background: accent }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col min-h-screen items-center justify-center px-6 py-16">
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {currentQuestionIndex > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)' }}
                title="Previous"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
          </div>
          <motion.div
            key={`section-${currentQuestionIndex}`}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-lg text-center"
          >
            {/* Section pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="flex items-center justify-center mb-6"
            >
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.18em] uppercase border"
                style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: accent }} />
                Section {currentSectionNumber}{totalSections > 1 ? ` of ${totalSections}` : ''}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4 }}
              className="text-4xl sm:text-5xl font-black leading-[1.1] tracking-tight mb-4"
              style={{ color: '#ffffff' }}
            >
              {currentQuestion.sectionTitle || 'New Section'}
            </motion.h2>

            {/* Description */}
            {currentQuestion.sectionDescription && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.4 }}
                className="text-sm sm:text-base leading-relaxed mb-6"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {currentQuestion.sectionDescription}
              </motion.p>
            )}

            {/* Meta row */}
            {slidesInSection > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.35 }}
                className="flex items-center justify-center gap-2 mb-8"
              >
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <BookOpen className="w-3 h-3" /> {slidesInSection} question{slidesInSection !== 1 ? 's' : ''}
                </span>
              </motion.div>
            )}

            {/* CTA button */}
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.35 }}
              onClick={handleNext}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97] hover:brightness-110 shadow-2xl"
              style={{ background: accent, color: '#ffffff', boxShadow: `0 8px 40px ${accent}55` }}
            >
              {isLast ? 'Finish Course' : 'Begin Section'}
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>

        {/* Bottom progress strip */}
        <div className="relative z-10 px-6 pb-8 flex items-center gap-2 justify-center">
          {questions.map((q: any, i: number) => {
            if (q.isSection) {
              return (
                <div key={q.id} className="h-1 rounded-full transition-all duration-300"
                  style={{ width: i === currentQuestionIndex ? 24 : 8, background: i <= currentQuestionIndex ? accent : 'rgba(255,255,255,0.2)' }} />
              );
            }
            return (
              <div key={q.id} className="h-1 w-1.5 rounded-full"
                style={{ background: answers[q.id] ? accent : 'rgba(255,255,255,0.15)' }} />
            );
          })}
        </div>
      </div>

      </>
    );
  }


  // -- Unanswered questions confirmation modal --
  if (finishPending) {
    const goToQuestion = (idx: number) => {
      setFinishPending(null);
      setCurrentQuestionIndex(idx);
      setSelectedOption(null);
      setFillBlankAnswer('');
      setIsChecking(false);
      setIsCorrect(null);
      setDirection(-1);
    };
    const modal = (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
        <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {finishPending.length} question{finishPending.length > 1 ? 's' : ''} unanswered
              </p>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Go back to answer them or submit anyway.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {finishPending.map((q: any) => {
              const idx = questions.findIndex((qq: any) => qq.id === q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(idx)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={{ borderColor: accent, color: accent, background: `${accent}15` }}
                >
                  Q{idx + 1}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setFinishPending(null); clearProgress(score).then(() => setPhase('complete')); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            >
              Submit anyway
            </button>
            <button
              onClick={() => setFinishPending(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: accent }}
            >
              Keep answering
            </button>
          </div>
        </div>
      </div>
    );
    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
  }

  const quizUI = (
    <>
      {/* -- Confetti canvas -- */}
      <canvas
        ref={confettiRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* -- Streak toast -- */}
      <AnimatePresence>
        {streakToast && (
          <motion.div
            key="streak-toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
          >
            <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-semibold text-white shadow-lg"
              style={{ background: '#10b981' }}>
              🔥 {streakToast.replace(/^🔥\s*/, '')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>


      {/* -- Main container (split layout for full-screen, single column for inline) -- */}
      <div
        className={inlineMode
          ? `relative flex flex-col rounded-xl overflow-hidden min-h-[500px] ${isDark ? 'bg-black' : 'bg-white'}`
          : 'fixed inset-0 z-[200] overflow-hidden flex flex-col'
        }
        style={{ color: isDark ? '#ffffff' : '#18181b', ...fontStyle }}
      >

        {/* Nav bar -- full width */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-2"
          style={{
            background: isDark ? '#111113' : '#ffffff',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            minHeight: 44,
          }}
        >
          {/* Left: logo */}
          <div className="flex items-center flex-shrink-0">
            {(isDark ? (logoDarkUrl || logoUrl) : logoUrl) && (
              <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center' }}>
                <img src={(isDark ? (logoDarkUrl || logoUrl) : logoUrl) || undefined} alt="" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
              </Link>
            )}
          </div>
          {/* Right: controls */}
          <div className="flex items-center gap-1">
          {timeLeft !== null && (
            <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums mr-2 ${timerWarning ? 'text-rose-400' : mutedColor}`}>
              <Clock className="w-3 h-3" />
              {formatTime(timeLeft)}
            </span>
          )}
          {reviewMode && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mr-2"
              style={{ background: isDark ? 'rgba(99,102,241,0.2)' : '#ede9fe', color: isDark ? '#a5b4fc' : '#6d28d9' }}>
              Review Mode
            </span>
          )}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className={`relative p-1.5 rounded-lg transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
              title="Course info"
            >
              <MoreHorizontal className="w-4 h-4" />
              {xpNotify && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className={`absolute right-0 top-9 z-50 w-52 rounded-xl shadow-xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'}`}
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-widest ${mutedColor}`}>Course Progress</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={`text-xs ${mutedColor}`}>Current</span>
                      <span className="text-xs font-semibold" style={{ color: accent }}>{currentQuestionIndex + 1} of {totalSlides}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs ${mutedColor}`}>Total slides</span>
                      <span className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#18181b' }}>{totalSlides}</span>
                    </div>
                    {pointsEnabled && (
                      <div className="flex justify-between items-center">
                        <span className={`text-xs ${mutedColor}`}>XP earned</span>
                        <span className="text-xs font-bold tabular-nums flex items-center gap-1" style={{ color: isDark ? '#facc15' : '#10b981' }}>
                          ⭐ {displayedPoints.toLocaleString()}
                          {streak >= 2 && <span className="text-orange-400">🔥{streak}</span>}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </div>
        </div>

        {/* Body row: sidebar + content */}
        <div className="relative flex flex-1 overflow-hidden">

        {/* -- SIDEBAR (non-inline only) -- */}
        {!inlineMode && (
          <>
            {/* Mobile backdrop */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-30 sm:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Mobile open button -- tab anchored to left edge of content when sidebar is closed */}
            {!sidebarOpen && (
              <div className="absolute top-4 left-0 z-50 sm:hidden group">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`px-2.5 py-2 rounded-r-lg transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-700 bg-white shadow-sm border-t border-r border-b border-zinc-200'}`}
                >
                  <ArrowRightFromLine className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <span className={`pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-white'}`}>
                  Open course outline
                </span>
              </div>
            )}

            <aside
              className={`absolute inset-y-0 left-0 z-40 sm:relative sm:inset-auto flex-shrink-0 flex flex-col border-r transition-all duration-300 ${!sidebarOpen ? '-translate-x-full sm:translate-x-0' : 'translate-x-0'}`}
              style={{
                width: sidebarOpen ? 'min(100vw, 288px)' : 44,
                minWidth: sidebarOpen ? 'min(100vw, 288px)' : 44,
                background: isDark ? '#141416' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
                overflow: sidebarOpen ? 'hidden' : 'visible',
              }}
            >
              {/* Close/expand toggle -- right-aligned when open, centered when collapsed (desktop only) */}
              <div className={`flex justify-end ${sidebarOpen ? 'px-3' : 'hidden sm:flex justify-center'} pt-3 pb-1 flex-shrink-0`}>
                <div className="relative group">
                  <button
                    onClick={() => setSidebarOpen(v => !v)}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'}`}
                  >
                    {sidebarOpen
                      ? <ArrowLeftToLine className="w-4 h-4" strokeWidth={2.5} />
                      : <ArrowRightFromLine className="w-4 h-4" strokeWidth={2.5} />}
                  </button>
                  {/* Tooltip below when open (aside has overflow:hidden, left side is clipped). Tooltip to the right when collapsed (44px rail, no space on left). */}
                  <span className={`pointer-events-none absolute px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 ${isDark ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-white'} ${sidebarOpen ? 'top-full mt-1 right-0' : 'left-full ml-2 top-1/2 -translate-y-1/2'}`}>
                    {sidebarOpen ? 'Collapse outline' : 'Expand outline'}
                  </span>
                </div>
              </div>

              {sidebarOpen && (<>
              {/* Course title */}
              {config.title && (
                <div
                  className="px-3 pt-2 pb-1 flex-shrink-0"
                >
                  <p className="text-base font-bold leading-snug" style={{ color: isDark ? '#e4e4e7' : '#111' }}>
                    {config.title}
                  </p>
                </div>
              )}

              {/* Overall progress */}
              <div
                className="px-4 py-3 border-b flex-shrink-0"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)' }}
              >
                <div className="flex justify-between text-[12px] mb-1.5" style={{ color: isDark ? '#555' : '#999' }}>
                  <span>Progress</span>
                  <span style={{ color: accent }}>{Math.round(progressPct)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, background: accent }}
                  />
                </div>
                {pointsEnabled && totalPoints > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[12px]" style={{ color: isDark ? '#555' : '#999' }}>XP</span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: isDark ? '#facc15' : accent }}>
                      {displayedPoints.toLocaleString()}
                    </span>
                    {streak >= 2 && <span className="text-[12px] text-orange-400">🔥 {streak}</span>}
                  </div>
                )}
              </div>

              {/* Questions / chapters list */}
              <nav className="flex-1 py-3 overflow-y-auto">
                <div className="px-3">
                  {chapters.map((group, gi) => {
                    const totalGroupSlides = group.slides.length;
                    const isCollapsed = collapsedSections.has(gi);
                    const toggleCollapse = () => setCollapsedSections(prev => {
                      const next = new Set(prev);
                      next.has(gi) ? next.delete(gi) : next.add(gi);
                      return next;
                    });
                    return (
                      <div key={gi} className="mb-1">
                        {/* Section label */}
                        <button
                          onClick={toggleCollapse}
                          className="w-full flex items-start justify-between gap-1 px-2 pt-4 pb-3 hover:opacity-70 transition-opacity text-left"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-semibold mb-0.5"
                              style={{ color: isDark ? '#666' : '#aaa' }}>
                              Module {gi + 1}
                            </span>
                            <span className="text-[13px] font-bold leading-tight"
                              style={{ color: group.sectionIdx !== null ? (isDark ? '#e4e4e7' : '#111') : isDark ? '#666' : '#777' }}>
                              {group.sectionTitle}
                            </span>
                          </div>
                          <ChevronRight
                            className="w-3.5 h-3.5 flex-shrink-0 mt-1 transition-transform duration-200"
                            style={{
                              color: isDark ? '#555' : '#aaa',
                              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                            }}
                          />
                        </button>

                        {/* Slides */}
                        {!isCollapsed && group.slides.map(({ q, idx }, si) => {
                          const isAnsweredQ = !!answers[q.id];
                          const isCurrent = idx === currentQuestionIndex;
                          const isLastItem = si === totalGroupSlides - 1 && gi === chapters.length - 1;

                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setDirection(idx > currentQuestionIndex ? 1 : -1);
                                setCurrentQuestionIndex(idx);
                                if (typeof window !== 'undefined' && window.innerWidth < 640) setSidebarOpen(false);
                              }}
                              className="w-full flex items-start gap-2.5 text-left transition-all hover:opacity-80"
                            >
                              {/* Circle + connector line */}
                              <div className="flex flex-col items-center flex-shrink-0">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                                  style={{
                                    background: isCurrent
                                      ? accent
                                      : isAnsweredQ
                                        ? `${accent}22`
                                        : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                    border: `2px solid ${isCurrent ? accent : isAnsweredQ ? `${accent}50` : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                  }}
                                >
                                  {isCurrent ? (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  ) : isAnsweredQ ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: accent }} />
                                  ) : (q as any).isDownloads ? (
                                    <Download className="w-3 h-3" style={{ color: isDark ? '#777' : '#888' }} />
                                  ) : (q as any).lessonOnly ? (
                                    <BookOpen className="w-3 h-3" style={{ color: isDark ? '#777' : '#888' }} />
                                  ) : (
                                    <span className="text-[11px] font-medium" style={{ color: isDark ? '#777' : '#888' }}>
                                      {idx + 1}
                                    </span>
                                  )}
                                </div>
                                {!isLastItem && (
                                  <div style={{
                                    width: 0,
                                    minHeight: 18,
                                    flex: 1,
                                    borderLeft: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
                                    marginTop: 3,
                                    marginBottom: 3,
                                  }} />
                                )}
                              </div>

                              {/* Text */}
                              <div className="flex-1 min-w-0 pt-0.5" style={{ paddingBottom: isLastItem ? 8 : 20 }}>
                                {(q as any).isDownloads ? (
                                  <p className="text-[12.5px] font-semibold leading-snug line-clamp-2"
                                    style={{ color: isCurrent ? (isDark ? '#f0f0f0' : '#111') : isDark ? '#777' : '#888' }}>
                                    {(q as any).downloadsTitle || 'Downloads'}
                                  </p>
                                ) : (q as any).lessonOnly ? (
                                  <p className="text-[12.5px] font-semibold leading-snug line-clamp-2"
                                    style={{ color: isCurrent ? (isDark ? '#f0f0f0' : '#111') : isDark ? '#777' : '#888' }}>
                                    {(q as any).lesson?.title || 'Lesson Content'}
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-[12.5px] font-semibold leading-snug"
                                      style={{ color: isCurrent ? (isDark ? '#f0f0f0' : '#111') : isDark ? '#777' : '#888' }}>
                                      {REVIEW_TYPES.includes(q.type as QuestionType) ? 'Project' : 'Test Your Knowledge'}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="text-[11px] font-medium" style={{ color: isDark ? '#555' : '#777' }}>
                                        {q.type === 'fill_blank' ? 'Fill in the blank'
                                          : q.type === 'arrange' ? 'Arrange in order'
                                          : q.type === 'code' ? 'Code snippet'
                                          : q.type === 'image' ? 'Image choice'
                                          : q.type === 'code_review' ? 'AI Code Review'
                                          : q.type === 'excel_review' ? 'AI Excel Review'
                                          : q.type === 'dashboard_critique' ? 'AI Dashboard Review'
                                                          : 'Multiple choice'}
                                      </span>
                                      <span style={{ color: isDark ? '#444' : '#bbb' }}>·</span>
                                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
                                        style={{ color: isCurrent ? accent : isDark ? '#555' : '#888' }}>
                                        <Zap className="w-3 h-3" />
                                        XP
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </nav>
              </>)}
            </aside>
          </>
        )}

        {/* -- MAIN CONTENT COLUMN -- */}
        <div
          className={inlineMode ? 'flex-1 flex flex-col' : 'flex-1 overflow-hidden flex flex-col'}
          style={{ background: isDark ? '#0f0f10' : '#F2F5FA' }}
        >

          {/* Question content - scrollable */}
          <div
            className={`flex-1 overflow-y-auto px-2 sm:px-4 pt-4 sm:pt-8 pb-4 sm:pb-6 w-full ${isDark ? 'course-scroll' : 'course-scroll course-scroll-light'}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="max-w-4xl mx-auto w-full">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentQuestionIndex}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, x: d * 40 }),
                    center: { opacity: 1, x: 0 },
                    exit: (d: number) => ({ opacity: 0, x: d * -40 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                >
                  {/* -- Downloads slide -- */}
                  {(currentQuestion as any).isDownloads ? (() => {
                    const dlItems: DownloadItem[] = (currentQuestion as any).downloadItems || [];
                    const isLast = currentQuestionIndex >= totalSlides - 1;
                    return (
                      <div className="rounded-xl overflow-hidden" style={{ background: isDark ? '#1e1e1e' : '#ffffff' }}>
                        <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-4 sm:pb-5" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#F2F5FA'}` }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Downloads</p>
                          <h1 className="text-xl font-bold leading-snug" style={{ color: isDark ? '#f0f0f0' : '#111' }}>
                            {(currentQuestion as any).downloadsTitle || 'Downloads'}
                          </h1>
                        </div>
                        {(currentQuestion as any).downloadsDescription && (
                          <div className="px-4 sm:px-8 pt-4 pb-2">
                            <div
                              className={`prose prose-sm max-w-none ${isDark ? '[&_*]:!text-[#a1a1aa] [&_strong]:!text-white [&_b]:!text-white' : '[&_*]:!text-[#555]'}`}
                              style={{ color: isDark ? '#a1a1aa' : '#555' }}
                              dangerouslySetInnerHTML={{ __html: sanitizeRichText((currentQuestion as any).downloadsDescription) }}
                            />
                          </div>
                        )}
                        {dlItems.length > 0 && (
                          <div className="px-4 sm:px-8 pt-4 pb-2 space-y-3">
                            {dlItems.map((item) => {
                              const href = item.type === 'file' ? item.fileUrl : item.linkUrl;
                              return (
                                <div key={item.id} className="rounded-xl overflow-hidden" style={{ background: isDark ? '#2a2a2e' : '#F2F5FA', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                  <div className="flex items-center gap-4 p-4">
                                    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${accent}15`, border: `1.5px solid ${accent}25` }}>
                                      <ArrowDownToLine className="w-4.5 h-4.5" style={{ color: accent }} strokeWidth={2} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm leading-snug" style={{ color: isDark ? '#ffffff' : '#111' }}>
                                        {item.title || 'Untitled'}
                                      </p>
                                      {item.description && (
                                        <div
                                          className={`text-sm mt-1 leading-relaxed prose max-w-none ${isDark ? '[&_*]:!text-[#a1a1aa] [&_strong]:!text-white [&_b]:!text-white' : '[&_*]:!text-[#555]'}`}
                                          style={{ color: isDark ? '#a1a1aa' : '#555' }}
                                          dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.description) }}
                                        />
                                      )}
                                    </div>
                                    {href && (
                                      <a href={href} target="_blank" rel="noopener noreferrer"
                                        download={item.type === 'file' ? (item.fileName || true) : undefined}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-85 active:scale-[0.97]"
                                        style={{ background: accent, color: '#fff' }}>
                                        {item.type === 'file'
                                          ? <><ArrowDownToLine className="w-3.5 h-3.5" strokeWidth={2} /> Download</>
                                          : <><ExternalLink className="w-3.5 h-3.5" /> Open</>}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="px-4 sm:px-8 pb-5 sm:pb-7 pt-4">
                          <button onClick={handleNext}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 sm:py-3 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                            style={{ background: accent, color: 'white' }}>
                            {isLast ? 'Finish Course' : 'Continue'}
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })() : /* -- Lesson-only slide: render as unified card like VirtualExperienceTaker -- */
                  currentQuestion.lessonOnly ? (() => {
                    const lesson = currentQuestion.lesson || {} as any;
                    const embedUrl = lesson.videoUrl ? getVideoEmbedUrl(lesson.videoUrl) : null;
                    const isLast = currentQuestionIndex >= totalSlides - 1;
                    return (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          background: isDark ? '#1e1e1e' : '#ffffff',
                        }}
                      >
                        {/* Lesson header */}
                        <div
                          className="px-4 sm:px-8 pt-5 sm:pt-8 pb-4 sm:pb-5"
                          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#F2F5FA'}` }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Lesson</p>
                          <h1 className="text-xl font-bold leading-snug" style={{ color: isDark ? '#f0f0f0' : '#111' }}>
                            {lesson.title || 'Lesson Content'}
                          </h1>
                        </div>

                        {/* Video */}
                        {embedUrl && (
                          <div className="px-3 sm:px-8 pt-4 sm:pt-7 pb-2">
                            <div className="rounded-lg overflow-hidden" style={embedUrl.includes('canva.com') ? { height: '80vh' } : { aspectRatio: '16/9' }}>
                              <iframe
                                src={embedUrl}
                                className="w-full h-full border-0"
                                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        )}

                        {/* Image */}
                        {lesson.imageUrl && (
                          <div className="px-3 sm:px-8 pt-4 pb-2">
                            <div className="rounded-lg overflow-hidden">
                              <img src={lesson.imageUrl} alt="Lesson illustration" className="w-full object-cover" />
                            </div>
                          </div>
                        )}

                        {/* Body */}
                        {lesson.body && (
                          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-5 sm:pb-6">
                            <div
                              className={`prose prose-sm max-w-none [font-size:15.5px] ve-lesson-body ${isDark ? 'dark' : ''} ${isDark
                                ? 'prose-invert prose-p:text-zinc-300 prose-p:leading-[1.6] prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-blue-400 prose-li:text-zinc-300 prose-li:leading-[1.6] prose-hr:border-zinc-800 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:text-zinc-400 prose-blockquote:not-italic prose-code:text-emerald-400 prose-pre:bg-zinc-900'
                                : 'prose-p:text-[#111] prose-p:leading-[1.6] prose-headings:text-[#111] prose-headings:font-semibold prose-strong:text-[#111] prose-li:text-[#111] prose-li:leading-[1.6] prose-a:text-blue-600 prose-hr:border-zinc-200 prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:text-zinc-600 prose-blockquote:not-italic prose-code:text-emerald-700 prose-pre:bg-zinc-50'
                              }`}
                              style={{ color: isDark ? '#d4d4d8' : '#3f3f46', ...fontStyle }}
                              dangerouslySetInnerHTML={{ __html: sanitizeRichText(lesson.body) }}
                            />
                          </div>
                        )}

                        {/* Continue button inside card */}
                        <div className="px-4 sm:px-8 pb-5 sm:pb-7 pt-2">
                          <button
                            onClick={handleNext}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 sm:py-3 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                            style={{ background: accent, color: 'white' }}
                          >
                            {isLast ? 'Finish Course' : 'Continue'}
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })() : <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: isDark ? '#1e1e1e' : '#ffffff',
                    }}
                  >
                  <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-5 sm:pb-8">
                  <div className="flex items-center gap-2 mb-5">
                    {/* Hint button -- hidden for review types */}
                    {currentQuestion.hint && !hintsUsed.has(currentQuestion.id) && !isChecking && !REVIEW_TYPES.includes(questionType) && (
                      <button
                        onClick={() => {
                          setHintVisible(true);
                          setHintsUsed(prev => new Set(prev).add(currentQuestion.id));
                        }}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${isDark ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' : 'border-amber-400/50 text-amber-600 hover:bg-amber-50'}`}
                      >
                        💡 Hint
                      </button>
                    )}
                  </div>

                  {/* Hint display */}
                  {hintVisible && currentQuestion.hint && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mb-4 px-4 py-3 rounded-xl border text-sm ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}
                    >
                      💡 {currentQuestion.hint}
                      <span className={`ml-2 text-[10px] opacity-60`}>(score ×0.9 if correct)</span>
                    </motion.div>
                  )}

                  <h2 className={`text-lg sm:text-2xl font-semibold leading-snug mb-5 sm:mb-8 ${textColor}`}>
                    {currentQuestion.question}
                  </h2>

                  {/* -- Fill in the blank -- */}
                  {questionType === 'fill_blank' && (
                    <div>
                      <AnimatedField theme={config.theme || 'forest'} mode={config.mode || 'dark'}>
                        <input
                          type="text"
                          value={fillBlankAnswer}
                          onChange={e => { if (!isChecking) setFillBlankAnswer(e.target.value); }}
                          onKeyDown={e => { if (e.key === 'Enter' && !isChecking && fillBlankAnswer.trim()) handleCheck(); }}
                          placeholder="Type your answer here..."
                          disabled={isChecking}
                          className={`w-full bg-transparent border-none outline-none px-4 py-3 text-sm ${isDark ? 'text-white placeholder:text-zinc-600' : 'text-zinc-900 placeholder:text-zinc-400'} disabled:opacity-60`}
                        />
                      </AnimatedField>
                      {isChecking && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-3 px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
                        >
                          {isCorrect ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                          <span>
                            {isCorrect ? 'Correct!' : (
                              <>Incorrect. Accepted: <span className="font-semibold">{currentQuestion.correctAnswer.split('|').map((s: string) => s.trim()).join(' / ')}</span></>
                            )}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* -- Arrange in order -- */}
                  {questionType === 'arrange' && (
                    <div>
                      <p className={`text-xs mb-3 ${mutedColor}`}>Drag to reorder. Put items in the correct sequence.</p>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={arrangeOrder} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {arrangeOrder.map((item, idx) => (
                              <SortableItem
                                key={item}
                                id={item}
                                label={item}
                                idx={idx}
                                accent={accent}
                                isDark={isDark}
                                isChecking={isChecking}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                      {isChecking && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-3 px-4 py-3 rounded-xl border text-sm ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
                        >
                          {isCorrect ? (
                            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Correct order!</span>
                          ) : (
                            <div className="space-y-1">
                              <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Incorrect order.</span>
                              <p className="text-xs opacity-80">Correct: {currentQuestion.options.join(' -> ')}</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* -- Image options -- */}
                  {questionType === 'image' && (
                    <div className="grid grid-cols-2 gap-4">
                      {currentQuestion.options.map((option: string, idx: number) => {
                        const imgSrc = (currentQuestion.optionImages || [])[idx] || '';
                        const isSelected = selectedOption === option;
                        const showCorrect = isChecking && option === currentQuestion.correctAnswer;
                        const showWrong = isChecking && isSelected && !isCorrect;
                        const borderColor = showCorrect ? '#10b981' : showWrong ? '#f43f5e' : isSelected ? accent : (isDark ? '#3f3f46' : '#e4e4e7');
                        const borderWidth = (showCorrect || showWrong || isSelected) ? 3 : 2;
                        return (
                          <button
                            key={idx}
                            disabled={isChecking}
                            onClick={() => { setSelectedOption(option); if (showAnswers === 'per_question' && !isChecking && !answers[currentQuestion.id]) handleCheck(option); }}
                            className="relative rounded-2xl overflow-hidden transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed group"
                            style={{ border: `${borderWidth}px solid ${borderColor}` }}
                          >
                            {imgSrc ? (
                              <img src={imgSrc} alt={`Option ${idx + 1}`} className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className={`w-full h-52 flex items-center justify-center text-sm ${isDark ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-100 text-zinc-400'}`}>No image</div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                            <div className="absolute bottom-0 inset-x-0 px-3 py-2.5 flex items-center justify-between">
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 shadow"
                                style={{ background: showCorrect ? '#10b981' : showWrong ? '#f43f5e' : isSelected ? accent : 'rgba(0,0,0,0.5)' }}
                              >
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span className="flex-shrink-0">
                                {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                {showWrong && <XCircle className="w-4 h-4 text-rose-400" />}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* -- Lesson content for review questions -- */}
                  {REVIEW_TYPES.includes(questionType) && currentQuestion.lesson && (currentQuestion.lesson.body || currentQuestion.lesson.videoUrl || currentQuestion.lesson.imageUrl) && (
                    <>
                      {currentQuestion.lesson.videoUrl && getVideoEmbedUrl(currentQuestion.lesson.videoUrl) && (
                        <div className="mb-4 rounded-lg overflow-hidden" style={getVideoEmbedUrl(currentQuestion.lesson.videoUrl)!.includes('canva.com') ? { height: '80vh' } : { aspectRatio: '16/9' }}>
                          <iframe
                            src={getVideoEmbedUrl(currentQuestion.lesson.videoUrl)!}
                            className="w-full h-full border-0"
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {currentQuestion.lesson.imageUrl && (
                        <div className="mb-4 rounded-lg overflow-hidden">
                          <img src={currentQuestion.lesson.imageUrl} alt="Lesson illustration" className="w-full object-cover" />
                        </div>
                      )}
                      {currentQuestion.lesson.body && (
                        <div
                          className={`mb-6 prose prose-sm max-w-none [font-size:15.5px] ve-lesson-body ${isDark ? 'dark' : ''} ${isDark
                            ? 'prose-invert prose-p:text-zinc-300 prose-p:leading-[1.6] prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-blue-400 prose-li:text-zinc-300 prose-li:leading-[1.6] prose-hr:border-zinc-800 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:text-zinc-400 prose-blockquote:not-italic prose-code:text-emerald-400 prose-pre:bg-zinc-900'
                            : 'prose-p:text-[#111] prose-p:leading-[1.6] prose-headings:text-[#111] prose-headings:font-semibold prose-strong:text-[#111] prose-li:text-[#111] prose-li:leading-[1.6] prose-a:text-blue-600 prose-hr:border-zinc-200 prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:text-zinc-600 prose-blockquote:not-italic prose-code:text-emerald-700 prose-pre:bg-zinc-50'
                          }`}
                          style={{ color: isDark ? '#d4d4d8' : '#3f3f46', ...fontStyle }}
                          dangerouslySetInnerHTML={{ __html: sanitizeRichText(currentQuestion.lesson.body) }}
                        />
                      )}
                    </>
                  )}

                  {/* -- AI Review players -- */}
                  {questionType === 'code_review' && (
                    <CodeReviewPlayer
                      reqId={currentQuestion.id}
                      isDark={isDark}
                      accentColor={accent}
                      completed={reviewCompleted.has(currentQuestion.id)}
                      submissions={reviewSubmissions[currentQuestion.id] ?? []}
                      savedSummary={reviewSummaries[currentQuestion.id]}
                      rubric={currentQuestion.rubric}
                      schema={currentQuestion.schema}
                      minScore={currentQuestion.minScore}
                      reviewLanguage={currentQuestion.reviewLanguage}
                      maxReviews={2}
                      onComplete={(_, lean, passed) => {
                        const alreadyDone = reviewCompleted.has(currentQuestion.id);
                        setReviewCompleted(prev => new Set(prev).add(currentQuestion.id));
                        setReviewSummaries(prev => ({ ...prev, [currentQuestion.id]: lean }));
                        setReviewSubmissions(prev => ({ ...prev, [currentQuestion.id]: [...(prev[currentQuestion.id] ?? []), lean] }));
                        const answer = passed ? 'completed' : 'failed';
                        const newAnswers = { ...answersRef.current, [currentQuestion.id]: answer };
                        answersRef.current = newAnswers;
                        if (!alreadyDone && passed && !reviewMode) setScore(s => s + 1);
                        setAnswers(newAnswers);
                        saveProgress(newAnswers, currentQuestionIndex + 1, score + (!alreadyDone && passed ? 1 : 0), totalPoints, streak, hintsUsed);
                      }}
                    />
                  )}
                  {questionType === 'excel_review' && (
                    <ExcelReviewPlayer
                      reqId={currentQuestion.id}
                      isDark={isDark}
                      accentColor={accent}
                      completed={reviewCompleted.has(currentQuestion.id)}
                      submissions={reviewSubmissions[currentQuestion.id] ?? []}
                      savedSummary={reviewSummaries[currentQuestion.id]}
                      context={currentQuestion.context}
                      rubric={currentQuestion.rubric}
                      minScore={currentQuestion.minScore}
                      maxReviews={2}
                      onComplete={(_, lean, passed) => {
                        const alreadyDone = reviewCompleted.has(currentQuestion.id);
                        setReviewCompleted(prev => new Set(prev).add(currentQuestion.id));
                        setReviewSummaries(prev => ({ ...prev, [currentQuestion.id]: lean }));
                        setReviewSubmissions(prev => ({ ...prev, [currentQuestion.id]: [...(prev[currentQuestion.id] ?? []), lean] }));
                        const answer = passed ? 'completed' : 'failed';
                        const newAnswers = { ...answersRef.current, [currentQuestion.id]: answer };
                        answersRef.current = newAnswers;
                        if (!alreadyDone && passed && !reviewMode) setScore(s => s + 1);
                        setAnswers(newAnswers);
                        saveProgress(newAnswers, currentQuestionIndex + 1, score + (!alreadyDone && passed ? 1 : 0), totalPoints, streak, hintsUsed);
                      }}
                    />
                  )}
                  {questionType === 'dashboard_critique' && (
                    <DashboardCritiquePlayer
                      reqId={currentQuestion.id}
                      isDark={isDark}
                      accentColor={accent}
                      completed={reviewCompleted.has(currentQuestion.id)}
                      savedResult={reviewSummaries[currentQuestion.id]?.result}
                      savedImageUrl={reviewSummaries[currentQuestion.id]?.imageUrl}
                      rubric={currentQuestion.rubric}
                      minScore={currentQuestion.minScore}
                      reviewsUsed={reviewDashCounts[currentQuestion.id] ?? 0}
                      maxReviews={2}
                      onComplete={(result, imageDataUrl, passed) => {
                        const alreadyDone = reviewCompleted.has(currentQuestion.id);
                        setReviewCompleted(prev => new Set(prev).add(currentQuestion.id));
                        setReviewSummaries(prev => ({ ...prev, [currentQuestion.id]: { result, imageUrl: imageDataUrl } }));
                        setReviewDashCounts(prev => ({ ...prev, [currentQuestion.id]: (prev[currentQuestion.id] ?? 0) + 1 }));
                        const answer = passed ? 'completed' : 'failed';
                        const newAnswers = { ...answersRef.current, [currentQuestion.id]: answer };
                        answersRef.current = newAnswers;
                        if (!alreadyDone && passed && !reviewMode) setScore(s => s + 1);
                        setAnswers(newAnswers);
                        saveProgress(newAnswers, currentQuestionIndex + 1, score + (!alreadyDone && passed ? 1 : 0), totalPoints, streak, hintsUsed);
                      }}
                    />
                  )}

                  {/* -- Code snippet -- */}
                  {questionType === 'code' && currentQuestion.codeSnippet && (
                    <div className="mb-8 rounded-2xl overflow-hidden border border-zinc-700/60 shadow-lg">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700/60" style={{ background: '#111827' }}>
                        <span className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                          {currentQuestion.codeLanguage || 'javascript'}
                        </span>
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                        </div>
                      </div>
                      <SyntaxHighlighter
                        language={currentQuestion.codeLanguage || 'javascript'}
                        style={atomOneDark}
                        customStyle={{ margin: 0, borderRadius: 0, fontSize: '14px', lineHeight: '1.7', padding: '20px 24px', background: '#0d1117' }}
                        showLineNumbers
                      >
                        {currentQuestion.codeSnippet}
                      </SyntaxHighlighter>
                    </div>
                  )}

                  {/* -- Multiple choice (also renders for code type) -- */}
                  {(questionType === 'multiple_choice' || questionType === 'code') && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((option: string, idx: number) => {
                        const isSelected = selectedOption === option;
                        const showCorrect = isChecking && option === currentQuestion.correctAnswer;
                        const showWrong = isChecking && isSelected && !isCorrect;
                        let borderStyle = '';
                        let bgStyle = '';
                        let buttonInlineStyle: React.CSSProperties = {};
                        const numColor: React.CSSProperties = showCorrect
                          ? { color: '#10b981' }
                          : showWrong
                            ? { color: '#f43f5e' }
                            : isSelected
                              ? { color: accent }
                              : { color: isDark ? '#52525b' : '#a1a1aa' };
                        const borderWidth = (showCorrect || showWrong || isSelected) ? 'border-2' : 'border-[1.5px]';
                        const optionTextColor = (isSelected || showCorrect || showWrong)
                          ? (isDark ? 'text-white' : 'text-zinc-900')
                          : (isDark ? 'text-zinc-400' : 'text-zinc-500');
                        if (showCorrect) {
                          borderStyle = 'border-emerald-500';
                          bgStyle = 'bg-emerald-500/10';
                        } else if (showWrong) {
                          borderStyle = 'border-rose-500';
                          bgStyle = '';
                          buttonInlineStyle = { backgroundColor: isDark ? '#662525' : '#fff1f1' };
                        } else if (isSelected) {
                          borderStyle = 'border-transparent';
                          buttonInlineStyle = { borderColor: accent, backgroundColor: `${accent}18` };
                        } else {
                          borderStyle = isDark ? 'border-zinc-700/60 hover:border-zinc-600' : 'border-zinc-200 hover:border-zinc-300';
                          bgStyle = isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50';
                        }
                        return (
                          <button
                            key={idx}
                            disabled={isChecking}
                            onClick={() => { setSelectedOption(option); if (showAnswers === 'per_question' && !isChecking && !answers[currentQuestion.id]) handleCheck(option); }}
                            style={buttonInlineStyle}
                            className={`w-full text-left px-5 py-4 rounded-2xl ${borderWidth} transition-all duration-150 flex items-center gap-3 ${borderStyle} ${bgStyle} ${optionTextColor}`}
                          >
                            <span className="flex-1 text-base font-medium leading-snug">{option}</span>
                            <span className="flex-shrink-0 flex items-center gap-2">
                              {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                              {showWrong && <XCircle className="w-4 h-4 text-rose-500" />}
                              <span className="text-sm font-semibold tabular-nums" style={numColor}>{idx + 1}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  </div>{/* end inner padding */}

                  {/* -- Card footer: action bar -- */}
                  {(() => {
                    // Review type footer: just a Continue button enabled once the review is submitted
                    if (REVIEW_TYPES.includes(questionType)) {
                      const done = reviewCompleted.has(currentQuestion.id);
                      return (
                        <div className="px-4 sm:px-8 py-3 sm:py-4 flex justify-end" style={{ background: isDark ? '#1e1e1e' : '#ffffff' }}>
                          <button
                            onClick={handleNext}
                            disabled={!done}
                            className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ background: done ? accent : (isDark ? '#3f3f46' : '#d4d4d8'), color: 'white' }}
                          >
                            {currentQuestionIndex < totalSlides - 1 ? 'Continue' : 'Finish Course'}
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }

                    const hasLesson = (currentQuestion?.lesson?.body || currentQuestion?.lesson?.videoUrl || currentQuestion?.lesson?.imageUrl) && (config as any).lessonTiming !== 'before';
                    const footerBg = isChecking
                      ? (isCorrect ? (isDark ? '#0a2e1a' : '#f0fdf4') : (isDark ? '#662525' : '#fff1f1'))
                      : (isDark ? '#1e1e1e' : '#ffffff');
                    return (
                      <div className="px-4 sm:px-8 py-3 sm:py-4" style={{ background: footerBg }}>
                        {isChecking && currentQuestion?.explanation && (
                          <div className={`mb-3 text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                            <span className="font-semibold text-[11px] uppercase tracking-wider opacity-50 mr-2">Explanation</span>
                            {currentQuestion.explanation}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 sm:gap-4">
                          {isChecking ? (
                            <div
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm flex-shrink-0 border-2 ${isCorrect ? 'border-emerald-500' : 'border-rose-500'}`}
                              style={{
                                background: isCorrect
                                  ? '#ffffff'
                                  : (isDark ? '#1e1e1e' : '#fff1f1'),
                                color: isCorrect
                                  ? (isDark ? '#34d399' : '#059669')
                                  : (isDark ? '#fca5a5' : '#dc2626'),
                              }}>
                              {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              {isCorrect ? 'Correct!' : 'Incorrect!'}
                            </div>
                          ) : (
                            <button onClick={handleSkip}
                              className={`text-sm font-medium transition-colors flex-shrink-0 ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                              Skip
                            </button>
                          )}
                          <div className="flex items-center gap-2 sm:gap-3">
                            {showAnswers === 'per_question' ? (
                              isChecking ? (
                                <>
                                  {hasLesson && (
                                    <button onClick={() => setLessonOpen(true)}
                                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${isCorrect ? (isDark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25' : 'bg-rose-50 text-rose-600')}`}>
                                      <BookOpen className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                                      {isCorrect ? 'Review Lesson' : 'Why?'}
                                    </button>
                                  )}
                                  <button onClick={handleNext}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                                    style={{ background: isCorrect ? '#10b981' : '#DB585A', color: 'white' }}>
                                    {currentQuestionIndex < totalSlides - 1 ? 'Continue' : 'Finish'}
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                (questionType === 'fill_blank' || questionType === 'arrange') && (
                                  <button onClick={() => handleCheck()} disabled={!isAnswered()}
                                    className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                    style={{ background: isAnswered() ? accent : (isDark ? '#27272a' : '#e4e4e7'), color: isAnswered() ? 'white' : (isDark ? '#52525b' : '#a1a1aa') }}>
                                    Check Answer
                                  </button>
                                )
                              )
                            ) : (
                              <>
                                {relatedAssignment && currentQuestionIndex === totalQuestions - 1 && (
                                  <p className="text-xs hidden sm:block" style={{ color: isDark ? '#a1a1aa' : '#52525b' }}>
                                    Complete to unlock <span className="font-semibold" style={{ color: accent }}>{relatedAssignment.title}</span>
                                  </p>
                                )}
                                <button onClick={handleNextDirect} disabled={!isAnswered() && questionType !== 'arrange'}
                                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                  style={{ background: (isAnswered() || questionType === 'arrange') ? accent : (isDark ? '#3f3f46' : '#d4d4d8'), color: 'white' }}>
                                  {currentQuestionIndex < totalSlides - 1 ? 'Continue' : 'Finish Course'}
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  </div>}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>{/* end main column */}
        </div>{/* end body row */}
      </div>{/* end main container */}

      {/* Chapters drawer - inline mode only (full-screen mode uses persistent sidebar) */}
      {inlineMode && (
        <AnimatePresence>
          {showChapters && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[300] bg-black/50"
                onClick={() => setShowChapters(false)}
              />
              <motion.div
                initial={{ x: -310 }}
                animate={{ x: 0 }}
                exit={{ x: -310 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="fixed left-0 top-0 bottom-0 z-[301] flex flex-col"
                style={{
                  width: 300,
                  background: isDark ? '#111' : '#fff',
                  borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  boxShadow: '4px 0 32px rgba(0,0,0,0.35)',
                }}
              >
                <div className={`flex items-center justify-between px-4 py-3.5 border-b flex-shrink-0 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                  <p className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#111' }}>Course Contents</p>
                  <button onClick={() => setShowChapters(false)} className={`p-1 rounded-lg transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                  {chapters.map((group, gi) => (
                    <div key={gi}>
                      <div className="px-4 pt-4 pb-1.5">
                        <button
                          onClick={() => { if (group.sectionIdx !== null) { setDirection(group.sectionIdx > currentQuestionIndex ? 1 : -1); setCurrentQuestionIndex(group.sectionIdx); setShowChapters(false); } }}
                          disabled={group.sectionIdx === null}
                          className="text-left w-full"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wide leading-tight" style={{ color: accent }}>{group.sectionTitle}</span>
                        </button>
                      </div>
                      {group.slides.map(({ q, idx }) => {
                        const answered = !!answers[q.id];
                        const isCurrent = idx === currentQuestionIndex;
                        return (
                          <button key={q.id}
                            onClick={() => { setDirection(idx > currentQuestionIndex ? 1 : -1); setCurrentQuestionIndex(idx); setShowChapters(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-80"
                            style={{ background: isCurrent ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)') : 'transparent' }}
                          >
                            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                              style={{ background: isCurrent ? accent : answered ? `${accent}25` : isDark ? '#2a2a2a' : '#f0f0f0', color: isCurrent ? '#fff' : answered ? accent : isDark ? '#555' : '#aaa' }}>
                              {answered ? '✓' : (q as any).lessonOnly ? '◉' : idx + 1}
                            </span>
                            <span className="flex-1 text-[13px] leading-snug line-clamp-2" style={{ color: isCurrent ? (isDark ? '#fff' : '#111') : isDark ? '#999' : '#555' }}>
                              {(q as any).lessonOnly ? ((q as any).lesson?.title || 'Lesson') : q.question}
                            </span>
                            {isCurrent && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accent }} />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Lesson sheet */}
      <AnimatePresence>
        {lessonOpen && currentQuestion?.lesson && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLessonOpen(false)}
              className="fixed inset-0 z-[9990]"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[9991] rounded-t-3xl flex flex-col overflow-hidden"
              style={{
                background: isDark ? '#18181b' : '#ffffff',
                color: isDark ? '#ffffff' : '#18181b',
                maxHeight: '88vh',
              }}
            >
              {/* drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
              </div>

              {/* header row */}
              <div className="flex items-start justify-between px-5 sm:px-8 pt-4 sm:pt-5 pb-3 sm:pb-4 flex-shrink-0">
                <div>
                  <p className={`text-[11px] font-semibold tracking-widest uppercase mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Lesson</p>
                  <h3 className={`text-lg sm:text-xl font-bold leading-snug ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {currentQuestion.lesson.title || 'Theory'}
                  </h3>
                </div>
                <button
                  onClick={() => setLessonOpen(false)}
                  className={`mt-1 p-2 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'text-zinc-500 hover:text-white hover:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* scrollable content */}
              <div className="overflow-y-auto flex-1 overscroll-contain">
                <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-2 pb-5 sm:pt-3 sm:pb-7 space-y-5 sm:space-y-6">
                  {currentQuestion.lesson.videoUrl && getVideoEmbedUrl(currentQuestion.lesson.videoUrl) && (
                    <div className="rounded-xl overflow-hidden shadow-md" style={{ aspectRatio: '16/9' }}>
                      <iframe
                        src={getVideoEmbedUrl(currentQuestion.lesson.videoUrl)!}
                        className="w-full h-full border-0"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  )}
                  {currentQuestion.lesson.imageUrl && (
                    <div className="rounded-xl overflow-hidden shadow-sm">
                      <img src={currentQuestion.lesson.imageUrl} alt="Lesson illustration" className="w-full object-cover" />
                    </div>
                  )}
                  {currentQuestion.lesson.body && (
                    <div
                      className={`prose prose-base sm:prose-lg max-w-none ve-lesson-body ${isDark ? 'dark' : ''} ${isDark
                        ? 'prose-invert prose-p:text-zinc-300 prose-p:leading-[1.65] prose-headings:text-white prose-strong:text-white prose-a:text-blue-400 prose-li:text-zinc-300 prose-li:leading-[1.65] prose-hr:border-zinc-800 prose-blockquote:border-l-emerald-500 prose-blockquote:text-zinc-300 prose-blockquote:not-italic'
                        : 'prose-p:text-zinc-700 prose-p:leading-[1.65] prose-headings:text-zinc-900 prose-strong:text-zinc-900 prose-li:text-zinc-700 prose-li:leading-[1.65] prose-a:text-blue-600 prose-hr:border-zinc-200 prose-blockquote:border-l-emerald-500 prose-blockquote:text-zinc-700 prose-blockquote:not-italic'
                      }`}
                      style={{ color: isDark ? '#d4d4d8' : '#3f3f46', ...fontStyle }}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(currentQuestion.lesson.body) }}
                    />
                  )}
                  {(config as any).lessonTiming === 'before' && !isChecking ? (
                    <button
                      onClick={() => setLessonOpen(false)}
                      className="w-full py-4 rounded-xl text-[15px] font-semibold transition-all active:scale-[0.98]"
                      style={{ background: accent, color: 'white' }}
                    >
                      Start Question
                    </button>
                  ) : isChecking ? (
                    <button
                      onClick={() => { setLessonOpen(false); handleNext(); }}
                      className="w-full py-4 rounded-xl text-[15px] font-semibold transition-all active:scale-[0.98]"
                      style={{ background: isCorrect ? '#10b981' : '#DB585A', color: 'white' }}
                    >
                      Continue
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating XP */}
      <AnimatePresence>
        {floatingPoints && (
          <motion.div
            key={floatingPoints.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            className="fixed z-[9999] pointer-events-none font-black text-2xl"
            style={{ left: `${floatingPoints.x}%`, top: `${floatingPoints.y}%`, transform: 'translateX(-50%)', textShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.15)', color: isDark ? '#facc15' : '#10b981' }}
          >
            {floatingPoints.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print protection */}
      <style>{`@media print { body { display: none !important; } }`}</style>
    </>
  );

  if (inlineMode) return quizUI;
  if (typeof document === 'undefined') return null;
  return createPortal(quizUI, document.body);
}
