import { describe, it, expect } from 'vitest';

import { sanitizeExamQuestions } from '@/lib/grade-question';

// Guards the exam answer-key leak fix: the questions delivered to a student taking a certification
// must never carry correctAnswer or any solution/expected-output/rubric field.

describe('sanitizeExamQuestions', () => {
  it('strips every answer-key field but keeps render-safe data', () => {
    const [mc, py] = sanitizeExamQuestions([
      { id: 'q1', type: 'multiple_choice', question: 'Q', options: ['a', 'b'], correctAnswer: 'a', explanation: 'because' },
      {
        id: 'q2', type: 'python_exercise', question: 'P',
        pythonStarterCode: 'x = 1', pythonSolution: 'print(42)', pythonExpectedOutput: '42',
        sqlSolution: 'SELECT 1', sqlExpectedResult: { columns: ['n'], rows: [[1]] }, rubric: ['clean code'],
      },
    ]);

    expect(mc.correctAnswer).toBeUndefined();
    expect(mc.explanation).toBeUndefined();
    expect(mc.options).toEqual(['a', 'b']); // render data preserved

    expect(py.pythonSolution).toBeUndefined();
    expect(py.pythonExpectedOutput).toBeUndefined();
    expect(py.sqlSolution).toBeUndefined();
    expect(py.sqlExpectedResult).toBeUndefined();
    expect(py.rubric).toBeUndefined();
    expect(py.pythonStarterCode).toBe('x = 1');       // starter is shown to the student
    expect(py.pythonHasExpectedOutput).toBe(true);    // flag retained so the player offers a check
  });

  it('sets pythonHasExpectedOutput false when there is no expected output', () => {
    const [q] = sanitizeExamQuestions([{ id: 'q', type: 'python_exercise', pythonExpectedOutput: '' }]);
    expect(q.pythonHasExpectedOutput).toBe(false);
  });

  it('tolerates non-array / non-object input', () => {
    expect(sanitizeExamQuestions(undefined)).toEqual([]);
    expect(sanitizeExamQuestions([null])).toEqual([null]);
  });
});
