import { describe, expect, it } from 'vitest';
import { stripPythonRunnerNoise } from '@/lib/python-engine';

describe('stripPythonRunnerNoise', () => {
  it('removes Matplotlib font cache startup noise while preserving real output', () => {
    const output = [
      'Matplotlib is building the font cache; this may take a moment.',
      '42',
      '',
    ].join('\n');

    expect(stripPythonRunnerNoise(output)).toBe('42\n');
  });

  it('removes the noise line even when stderr adds surrounding whitespace', () => {
    expect(stripPythonRunnerNoise('  Matplotlib is building the font cache; this may take a moment.  \n')).toBe('');
  });
});
