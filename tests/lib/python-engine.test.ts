import { describe, expect, it } from 'vitest';
import { normalizePythonCodeInput, stripPythonRunnerNoise } from '@/lib/python-engine';

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

describe('normalizePythonCodeInput', () => {
  it('converts AI-escaped multiline Python into executable code', () => {
    const escaped = 'import pandas as pd\\nimport numpy as np\\nnp.random.seed(42)\\ndf = pd.DataFrame({"x": [1, 2]})';

    expect(normalizePythonCodeInput(escaped)).toBe(
      'import pandas as pd\nimport numpy as np\nnp.random.seed(42)\ndf = pd.DataFrame({"x": [1, 2]})',
    );
  });

  it('does not rewrite ordinary escaped newline string literals', () => {
    const code = 'print("hello\\nworld")';

    expect(normalizePythonCodeInput(code)).toBe(code);
  });
});
