import { describe, expect, it } from 'vitest';
import { validateVirtualExperienceForPublish } from '@/lib/virtual-experience-validation';

const validConfig = () => ({
  company: 'AFC',
  role: 'Financial Analyst',
  tagline: 'Build a decision-ready model.',
  modules: [{
    id: 'm1',
    title: 'Analysis',
    lessons: [{
      id: 'l1',
      title: 'Review the data',
      body: '<p>Read the brief.</p>',
      requirements: [{ id: 'r1', type: 'task', label: 'Complete the analysis', description: '' }],
    }],
  }],
});

describe('validateVirtualExperienceForPublish', () => {
  it('accepts a complete experience', () => {
    expect(validateVirtualExperienceForPublish(validConfig())).toEqual([]);
  });

  it('rejects empty experiences', () => {
    const issues = validateVirtualExperienceForPublish({ modules: [] });
    expect(issues.map(issue => issue.message)).toEqual(expect.arrayContaining([
      'Add the company or organization name.',
      'Add the learner role.',
      'Add a short experience tagline.',
      'Add at least one module.',
    ]));
  });

  it('rejects incomplete multiple-choice and decision tasks', () => {
    const config: any = validConfig();
    config.modules[0].lessons[0].requirements = [
      { id: 'mcq', type: 'mcq', label: 'Choose', description: '', options: ['Only'], correctAnswer: '' },
      { id: 'decision', type: 'decision', label: 'Decide', description: '', options: ['A', 'B'], correctAnswer: 'C' },
    ];
    const messages = validateVirtualExperienceForPublish(config).map(issue => issue.message);
    expect(messages.some(message => message.includes('at least two answer options'))).toBe(true);
    expect(messages.some(message => message.includes('valid correct answer'))).toBe(true);
    expect(messages.some(message => message.includes('recommended path'))).toBe(true);
  });
});
