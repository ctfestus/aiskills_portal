import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  requireRole: vi.fn(),
  isAuthError: (value: any) => !!value?.error,
}));

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  generateJSON: vi.fn(),
}));

import { requireRole } from '@/lib/api-auth';
import { getRedis } from '@/lib/redis';
import { generateJSON } from '@/lib/ai';
import { POST } from '@/app/api/ai-course/route';

const mockRequireRole = vi.mocked(requireRole);
const mockGetRedis = vi.mocked(getRedis);
const mockGenerateJSON = vi.mocked(generateJSON);

async function post(body: Record<string, unknown>): Promise<Response> {
  const res = await POST(new Request('http://localhost/api/ai-course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  }) as any);
  return res as unknown as Response;
}

function outline(modules = ['Module 1']) {
  return {
    courseTitle: 'Python for Analysts',
    courseDescription: 'Learn Python analysis.',
    businessScenario: 'A finance team analyses weekly sales.',
    learningOutcomes: ['Analyze data with pandas'],
    datasetPlan: {
      description: 'Synthetic sales data',
      datasets: [{ variableName: 'df', description: 'Sales data', columns: ['region', 'sales'] }],
    },
    modules: modules.map((title, idx) => ({
      id: `m${idx + 1}`,
      title,
      description: `${title} description`,
      lessons: [{
        id: `l${idx + 1}`,
        title: `${title} lesson`,
        skillFocus: 'Filtering',
        questionType: 'python_exercise',
        questionSummary: 'Print a deterministic result.',
      }],
    })),
  };
}

function generatedModule(overrides: Record<string, unknown> = {}) {
  return {
    moduleIntroTitle: 'Intro',
    moduleIntroBody: '<p>Intro body</p>',
    lessons: [{
      lessonId: 'l1',
      lessonTitle: 'Filtering Rows',
      lessonBody: '<p>Lesson body</p>',
      lessonType: 'python_exercise',
      questionText: '1. Print the row count.',
      setupCode: 'import pandas as pd\nimport numpy as np\nnp.random.seed(42)\ndf = pd.DataFrame({"sales": np.random.randint(10, 20, 50)})',
      starterCode: 'print(len(df))',
      solution: 'print(len(df))',
      expectedOutput: '50',
      hints: ['Use len.', 'Pass df to len.', 'print(len(df))'],
      ...overrides,
    }],
  };
}

beforeEach(() => {
  mockRequireRole.mockReset();
  mockGetRedis.mockReset();
  mockGenerateJSON.mockReset();
  mockRequireRole.mockResolvedValue({
    user: { id: 'instructor1', email: 'teacher@example.com' },
    role: 'instructor',
  } as any);
  mockGetRedis.mockReturnValue({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  } as any);
});

describe('POST /api/ai-course Python course generation', () => {
  it('regenerates a single Python outline module with the shape the UI expects', async () => {
    mockGenerateJSON.mockResolvedValue({
      module: {
        id: 'm1',
        title: 'Fresh module',
        description: 'Fresh description',
        lessons: [{
          id: 'l1',
          title: 'Fresh lesson',
          skillFocus: 'Filtering',
          questionType: 'python_exercise',
          questionSummary: 'Filter rows.',
        }],
      },
    });

    const res = await post({
      action: 'generate_python_course_outline',
      title: 'Python for Analysts',
      industry: 'Finance',
      role: 'Analyst',
      level: 'Beginner',
      focus: 'Data Analysis',
      moduleIndex: 0,
      existingOutline: outline(),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.module.title).toBe('Fresh module');
    expect(mockGenerateJSON).toHaveBeenCalledTimes(1);
    expect(String(mockGenerateJSON.mock.calls[0][0])).toContain('regenerating one module');
  });

  it('fails the full course request instead of silently omitting failed modules', async () => {
    mockGenerateJSON
      .mockResolvedValueOnce(generatedModule())
      .mockRejectedValueOnce(new Error('model timeout'));

    const res = await post({
      action: 'generate_python_course_full',
      title: 'Python for Analysts',
      industry: 'Finance',
      role: 'Analyst',
      level: 'Beginner',
      outline: outline(['Module 1', 'Module 2']),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('Module 2');
  });

  it('allows generated Python exercises without expected output so save preflight can compute it', async () => {
    mockGenerateJSON.mockResolvedValue(generatedModule({ expectedOutput: '' }));

    const res = await post({
      action: 'generate_python_course_full',
      title: 'Python for Analysts',
      industry: 'Finance',
      role: 'Analyst',
      level: 'Beginner',
      outline: outline(),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const pythonExercise = body.questions.find((q: any) => q.type === 'python_exercise');
    expect(pythonExercise).toBeTruthy();
    expect(pythonExercise.pythonExpectedOutput).toBe('');
  });
});
