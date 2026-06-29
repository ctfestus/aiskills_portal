// Single source of truth for the course / form content contract.
//
// Every authoring, persistence, and runtime surface (create page, FormEditor, CourseTaker,
// the forms API, sync/import routes) must use THESE types and THESE transforms so the shape
// can never drift between where content is written and where it is read.
//
// Canonical fields: `courseTimer` and `pointsSystem`. Legacy aliases (`timer`, `pointsEnabled`,
// `pointsBase`, and snake_case DB columns) are accepted ONLY on ingest, via normalizeFormConfig,
// and collapsed into the canonical shape. Never read the aliases downstream.

import type { ThemeColor, ThemeMode } from '@/lib/theme-types';
import type { LessonDoc } from '@/lib/lesson-doc';

export type { ThemeColor, ThemeMode };
export type { LessonDoc };

// --- Types ---

export type FieldType =
  | 'text' | 'email' | 'textarea' | 'number' | 'select' | 'phone' | 'company' | 'social' | 'description';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  socialPlatforms?: string[];
  description?: string;
}

export type QuestionType =
  | 'multiple_choice' | 'fill_blank' | 'arrange' | 'image' | 'image_choice' | 'code'
  | 'code_review' | 'excel_review' | 'dashboard_critique' | 'sql_exercise' | 'document_review'
  | 'python_exercise';

export interface DownloadItem {
  id: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  linkUrl?: string;
  type: 'file' | 'link';
  pdfPages?: number;   // set when the uploaded file is a PDF, enables inline carousel
}

export interface CourseQuestion {
  id: string;
  type?: QuestionType;
  question: string;
  options: string[];          // MC: option text; arrange: items in correct order; fill_blank: []; image: ['0','1','2',...]
  correctAnswer: string;      // MC: option text; fill_blank: pipe-separated; arrange: options.join('|||'); image: index string
  explanation?: string;
  optionImages?: string[];    // image type only -- one base64 per option, same length as options
  imageUrl?: string;          // image_choice: a single prompt image shown above the text options
  hint?: string;
  codeSnippet?: string;
  codeLanguage?: string;
  lessonOnly?: boolean;
  lockUntilPrevious?: boolean;
  isSection?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  isDownloads?: boolean;
  downloadsTitle?: string;
  downloadsDescription?: string;
  downloadItems?: DownloadItem[];
  lesson?: {
    title?: string;
    body?: string;          // sanitized HTML; canonical for legacy lessons, lossy fallback when `doc` is present
    doc?: LessonDoc;        // canonical interactive-lesson content (TipTap/ProseMirror JSON); see lib/lesson-doc.ts
    imageUrl?: string;
    videoUrl?: string;
    pdfUrl?: string;
    pdfName?: string;
    pdfPages?: number;
  };
  // AI review fields (code_review | excel_review | dashboard_critique | document_review)
  rubric?: string[];
  schema?: string;
  context?: string;
  minScore?: number;
  reviewLanguage?: string;
  documentReviewMode?: 'ai_only' | 'manual' | 'hybrid';
  sqlTables?: { id?: string; tableName: string; fileName?: string; fileUrl?: string; csvUrl?: string; seedSql?: string }[];
  sqlStarterCode?: string;
  sqlSolution?: string;
  sqlExpectedResult?: { columns: string[]; rows: unknown[][] };
  sqlHints?: string[];
  sqlResultOrdered?: boolean;
  sqlNumericTolerance?: number;
  sqlRequiredPatterns?: string[];
  // python_exercise fields
  pythonDatasets?: { id: string; variableName: string; fileName?: string; fileUrl?: string; csvUrl?: string }[];
  pythonStarterCode?: string;
  pythonSolution?: string;
  pythonExpectedOutput?: string;
  pythonHasExpectedOutput?: boolean;
  pythonSetupCode?: string;
  pythonHints?: string[];
  // Optional NON-GRADED runnable playground attached to any question (a SQL/Python scratchpad the
  // student runs to work out the answer). Carries no answer key, so it is safe to send to the client.
  playground?: {
    language?: 'sql' | 'python';
    setupSql?: string;        // SQL: seed tables (CREATE/INSERT) the student can query
    setupPython?: string;     // Python: code run once before the student's code
    starterCode?: string;     // initial code in the editor
    // SQL: uploaded CSV tables loaded into DuckDB (same shape as sql_exercise sqlTables)
    sqlTables?: { id?: string; tableName: string; fileName?: string; fileUrl?: string; csvUrl?: string; seedSql?: string }[];
    // Python: uploaded CSVs loaded into pandas DataFrames named by variableName
    pythonDatasets?: { id?: string; variableName: string; fileName?: string; fileUrl?: string; csvUrl?: string }[];
  };
}

export interface Speaker {
  id: string;
  name: string;
  title?: string;
  bio?: string;
  avatar_url?: string;
  linkedin_url?: string;
}

export interface EventDetails {
  isEvent: boolean;
  date?: string;
  time?: string;
  location?: string;
  timezone?: string;
  isPrivate?: boolean;
  capacity?: number;
  eventType?: 'in-person' | 'virtual';
  meetingLink?: string;
  speakers?: Speaker[];
  recurrence?: 'once' | 'daily' | 'weekly';
  recurrenceEndDate?: string;
  recurrenceDays?: number[];
}

export interface PostSubmission {
  type: 'default' | 'redirect' | 'button' | 'events' | 'notice';
  redirectUrl?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  relatedEventIds?: string[];
  noticeTitle?: string;
  noticeBody?: string;
}

export interface PointsMilestone {
  id: string;
  points: number;
  label: string;
  description: string;
  rewardUrl?: string;
}

export interface PointsSystem {
  enabled: boolean;
  basePoints: number;
  timeBonusEnabled: boolean;
  timeBonusSeconds: number;
  timeBonusMultiplier: number;
  streakEnabled: boolean;
  streakCount: number;
  streakBonus: number;
  hintPenalty: number;
  solutionPenalty: number;
  milestones: PointsMilestone[];
}

export interface FormConfig {
  title: string;
  description: string;
  coverImage: string;
  theme: ThemeColor;
  customAccent?: string;
  mode: ThemeMode;
  font: string;
  fields: FormField[];
  eventDetails?: EventDetails;
  isCourse?: boolean;
  questions?: CourseQuestion[];
  learnOutcomes?: string[];
  showAnswers?: 'per_question' | 'after_quiz' | 'none';
  lessonTiming?: 'before' | 'after';
  passmark?: number;
  courseTimer?: number;           // canonical (legacy alias: `timer`)
  maxAttempts?: number;
  postSubmission?: PostSubmission;
  pointsSystem?: PointsSystem;    // canonical (legacy aliases: `pointsEnabled` + `pointsBase`)
  deadline_days?: number | null;
  category?: string | null;
  badgeImageUrl?: string | null;
}

// --- Certifications ---
//
// Certifications are a separate first-class content type (their own table + player + overview),
// but they reuse the CourseQuestion shape so authoring and grading stay consistent with courses.
// Exam types only: multiple_choice | fill_blank | arrange | image | code | sql_exercise | python_exercise.
export interface CertificationConfig {
  title: string;
  description?: string;
  coverImage?: string;
  badgeImageUrl?: string | null;
  questions: CourseQuestion[];
  passmark: number;
  timeLimit?: number | null;   // minutes; null/0 = untimed
  maxAttempts: number;         // 0 = unlimited
  examProtection: boolean;
  deadline_days?: number | null;
  learnOutcomes?: string[];
  theme?: ThemeColor;
  mode?: ThemeMode;
  font?: string;
  customAccent?: string;
}

// --- Defaults ---

export const DEFAULT_POINTS_SYSTEM: PointsSystem = {
  enabled: true,
  basePoints: 50,
  timeBonusEnabled: false,
  timeBonusSeconds: 0,
  timeBonusMultiplier: 1,
  streakEnabled: false,
  streakCount: 0,
  streakBonus: 0,
  hintPenalty: 20,
  solutionPenalty: 30,
  milestones: [],
};

export const LEGACY_RUNTIME_POINTS_SYSTEM: PointsSystem = {
  enabled: false,
  basePoints: 100,
  timeBonusEnabled: true,
  timeBonusSeconds: 10,
  timeBonusMultiplier: 1.5,
  streakEnabled: true,
  streakCount: 3,
  streakBonus: 0,
  hintPenalty: 20,
  solutionPenalty: 30,
  milestones: [],
};

export function normalizePointsSystem(
  value: Partial<PointsSystem> | null | undefined,
  fallback: PointsSystem = DEFAULT_POINTS_SYSTEM,
): PointsSystem {
  const raw = value && typeof value === 'object' ? value : {};
  const num = (v: unknown, fb: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  return {
    enabled:             typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    basePoints:          num(raw.basePoints, fallback.basePoints),
    timeBonusEnabled:    typeof raw.timeBonusEnabled === 'boolean' ? raw.timeBonusEnabled : fallback.timeBonusEnabled,
    timeBonusSeconds:    num(raw.timeBonusSeconds, fallback.timeBonusSeconds),
    timeBonusMultiplier: num(raw.timeBonusMultiplier, fallback.timeBonusMultiplier),
    streakEnabled:       typeof raw.streakEnabled === 'boolean' ? raw.streakEnabled : fallback.streakEnabled,
    streakCount:         num(raw.streakCount, fallback.streakCount),
    streakBonus:         num(raw.streakBonus, fallback.streakBonus),
    hintPenalty:         num(raw.hintPenalty, fallback.hintPenalty),
    solutionPenalty:     num(raw.solutionPenalty, fallback.solutionPenalty),
    milestones:          Array.isArray(raw.milestones) ? raw.milestones : fallback.milestones,
  };
}

export function pointsSystemFromCourseRow(row: any): PointsSystem {
  const legacy = normalizePointsSystem({
    ...LEGACY_RUNTIME_POINTS_SYSTEM,
    enabled:    row?.points_enabled ?? LEGACY_RUNTIME_POINTS_SYSTEM.enabled,
    basePoints: row?.points_base ?? LEGACY_RUNTIME_POINTS_SYSTEM.basePoints,
  }, LEGACY_RUNTIME_POINTS_SYSTEM);
  return normalizePointsSystem(row?.points_system, legacy);
}

// --- Normalize (ingest) ---

function newId(): string {
  // Universal across Node 19+ and browsers; ids are opaque (only uniqueness matters).
  const c = (globalThis as any).crypto;
  return c?.randomUUID ? c.randomUUID() : `q-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/**
 * Ensure every question has a stable id and a string `correctAnswer`.
 * Some producers (MCP / AI generation) send `correct` as a 0-based option index;
 * CourseTaker reads `correctAnswer` as the option string, so we reconcile here.
 */
export function normalizeQuestions(questions: any[] | undefined): CourseQuestion[] {
  return (questions ?? []).map((q: any) => {
    const normalized: any = { ...q, id: q?.id || newId() };
    if (!normalized.correctAnswer && typeof normalized.correct === 'number' && Array.isArray(normalized.options)) {
      normalized.correctAnswer = normalized.options[normalized.correct] ?? '';
    }
    return normalized as CourseQuestion;
  });
}

/**
 * Collapse any inbound config (client POST, AI generation, or a DB row) into the canonical
 * FormConfig shape. Legacy aliases are read here and ONLY here:
 *   - courseTimer  <- courseTimer | timer | course_timer
 *   - pointsSystem <- pointsSystem | { pointsEnabled|points_enabled, pointsBase|points_base }
 * After this, downstream code reads only `courseTimer` and `pointsSystem`.
 */
export function normalizeFormConfig(raw: any): FormConfig {
  const {
    // strip legacy aliases out of the spread so the canonical shape stays clean
    timer, course_timer,
    pointsEnabled, points_enabled, pointsBase, points_base, points_system,
    ...rest
  } = raw ?? {};

  const courseTimer = rest.courseTimer ?? timer ?? course_timer ?? undefined;

  let pointsSystem: PointsSystem | undefined = rest.pointsSystem ?? points_system;
  if (pointsSystem) {
    pointsSystem = normalizePointsSystem(pointsSystem, LEGACY_RUNTIME_POINTS_SYSTEM);
  } else {
    const enabled = pointsEnabled ?? points_enabled;
    const basePoints = pointsBase ?? points_base;
    if (enabled != null || basePoints != null) {
      pointsSystem = normalizePointsSystem({
        ...LEGACY_RUNTIME_POINTS_SYSTEM,
        enabled: enabled ?? LEGACY_RUNTIME_POINTS_SYSTEM.enabled,
        basePoints: basePoints ?? LEGACY_RUNTIME_POINTS_SYSTEM.basePoints,
      }, LEGACY_RUNTIME_POINTS_SYSTEM);
    }
  }

  return {
    ...rest,
    courseTimer,
    pointsSystem,
    questions: rest.questions !== undefined ? normalizeQuestions(rest.questions) : rest.questions,
  } as FormConfig;
}

// --- Validate ---

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Shape-level validation enforced at the persistence boundary. */
export function validateFormConfig(config: FormConfig | null | undefined): ValidationResult {
  if (!config) return { ok: false, error: 'config is required' };
  const isCourse = Boolean(config.isCourse);
  const isEvent = Boolean(config.eventDetails?.isEvent);
  if (!isCourse && !isEvent) {
    return { ok: false, error: 'config must set isCourse or eventDetails.isEvent' };
  }
  return { ok: true };
}
