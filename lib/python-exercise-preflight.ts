import type { CourseQuestion } from '@/lib/course-schema';
import { initPythonRuntime, loadPythonDatasets, normalizePythonCodeInput, runPython } from '@/lib/python-engine';

export interface PythonPreflightIssue {
  questionId: string;
  label: string;
  message: string;
}

export interface PythonPreflightResult {
  questions: CourseQuestion[];
  issues: PythonPreflightIssue[];
  computedCount: number;
}

const outputFromResult = (res: Awaited<ReturnType<typeof runPython>>) =>
  res.stdout + (res.returnValue !== null && !res.stdout.trim() ? `Out: ${res.returnValue}` : '');

function questionLabel(q: CourseQuestion, index: number): string {
  return q.lesson?.title || q.question || `Python exercise ${index + 1}`;
}

export function formatPythonPreflightIssue(issue: PythonPreflightIssue): string {
  return `${issue.label}: ${issue.message}`;
}

export async function preflightPythonExercises(
  questions: CourseQuestion[],
  { requireComplete = false }: { requireComplete?: boolean } = {},
): Promise<PythonPreflightResult> {
  const nextQuestions = [...questions];
  const issues: PythonPreflightIssue[] = [];
  let computedCount = 0;

  for (let i = 0; i < nextQuestions.length; i++) {
    const q = nextQuestions[i];
    if (q.type !== 'python_exercise') continue;

    const label = questionLabel(q, i);
    if (!q.pythonSolution?.trim()) {
      if (requireComplete) {
        issues.push({ questionId: q.id, label, message: 'Add a reference solution before publishing.' });
      }
      continue;
    }

    try {
      const normalizedSetupCode = normalizePythonCodeInput(q.pythonSetupCode ?? '');
      const normalizedSolution = normalizePythonCodeInput(q.pythonSolution);
      const runtime = await initPythonRuntime(normalizedSetupCode.trim() || undefined);
      await loadPythonDatasets(runtime, q.pythonDatasets ?? [], 0);
      const res = await runPython(runtime, normalizedSolution);
      if (res.error) throw new Error(res.error);

      const output = outputFromResult(res);
      if (requireComplete && !output.trim()) {
        issues.push({ questionId: q.id, label, message: 'The reference solution must print deterministic output.' });
      }

      if (
        output !== (q.pythonExpectedOutput ?? '') ||
        normalizedSetupCode !== (q.pythonSetupCode ?? '') ||
        normalizedSolution !== q.pythonSolution
      ) {
        nextQuestions[i] = {
          ...q,
          pythonSetupCode: normalizedSetupCode,
          pythonSolution: normalizedSolution,
          pythonExpectedOutput: output,
        };
        computedCount++;
      }
    } catch (err: any) {
      issues.push({
        questionId: q.id,
        label,
        message: err?.message || 'Could not run the reference solution.',
      });
    }
  }

  return { questions: nextQuestions, issues, computedCount };
}
