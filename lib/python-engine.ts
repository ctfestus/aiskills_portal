// In-browser Python runner powered by Pyodide (loaded from CDN on first use).
// Singleton Pyodide instance is shared across all blocks on the page.
// Each block runs in the shared global namespace; setup code is executed once
// when the block mounts (initPythonRuntime), same pattern as sql-engine.

export interface PythonResult {
  stdout: string;
  returnValue: string | null;
  error: string | null;
  plots: string[];
}

export interface PythonRuntime {
  pyodide: any;
}

export interface PythonDatasetConfig {
  id?: string;
  variableName: string;
  fileName?: string;
  fileUrl?: string;
  csvUrl?: string;
}

export interface PythonDatasetPreview {
  columns: string[];
  rows: string[][];
  error?: string;
}

const PYTHON_RESERVED = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
  'raise', 'return', 'try', 'while', 'with', 'yield',
]);

const BLOCKED_PYTHON_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^\s*(from\s+js\s+import|import\s+js\b)/m, label: 'the browser JavaScript bridge' },
  { pattern: /__import__\s*\(\s*['"]js['"]\s*\)/, label: 'the browser JavaScript bridge' },
  { pattern: /\bpyodide\.http\b|\bopen_url\s*\(/, label: 'Pyodide network helpers' },
  { pattern: /\b(localStorage|sessionStorage|document|window)\b/, label: 'browser globals' },
];

function assertAllowedPythonCode(code: string) {
  for (const { pattern, label } of BLOCKED_PYTHON_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error(`This Python runner blocks ${label}. Use pandas/numpy-style data analysis code only.`);
    }
  }
}

export function isValidPythonIdentifier(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && !PYTHON_RESERVED.has(value);
}

function safeFsKey(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'dataset';
}

let _pyodide: any = null;
let _loadPromise: Promise<any> | null = null;

async function getPyodide(): Promise<any> {
  if (_pyodide) return _pyodide;
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise<any>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Python runtime is only available in the browser.'));
      return;
    }
    const existing = document.querySelector('script[data-pyodide-loader]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
      script.setAttribute('data-pyodide-loader', '');
      script.onerror = () => reject(new Error('Failed to load Pyodide from CDN.'));
      script.onload = () => {
        (window as any)
          .loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' })
          .then((py: any) => { _pyodide = py; resolve(py); })
          .catch(reject);
      };
      document.head.appendChild(script);
    } else {
      // Script tag exists but onload may have already fired; poll for loadPyodide
      const poll = () => {
        if ((window as any).loadPyodide) {
          (window as any)
            .loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' })
            .then((py: any) => { _pyodide = py; resolve(py); })
            .catch(reject);
        } else {
          setTimeout(poll, 50);
        }
      };
      poll();
    }
  });

  return _loadPromise;
}

let _packagesLoaded = false;

export async function initPythonRuntime(setupCode?: string): Promise<PythonRuntime> {
  const pyodide = await getPyodide();
  if (!_packagesLoaded) {
    // Load each data-science package individually so one failure doesn't block the rest
    for (const pkg of ['pandas', 'numpy', 'matplotlib', 'scipy', 'scikit-learn']) {
      try { await pyodide.loadPackage(pkg); } catch { /* skip unavailable packages */ }
    }
    try {
      await pyodide.runPythonAsync(`
import matplotlib as _cc_matplotlib
_cc_matplotlib.use('agg', force=True)
`);
    } catch { /* matplotlib is optional */ }
    _packagesLoaded = true;
  }
  if (setupCode?.trim()) {
    assertAllowedPythonCode(setupCode);
    await pyodide.runPythonAsync(setupCode);
  }
  return { pyodide };
}

/** Write a CSV string into Pyodide's virtual filesystem and return its temp path. */
export function writeCsvToFs(pyodide: any, fileKey: string, csvText: string): string {
  try { pyodide.FS.mkdir('/tmp'); } catch { /* already exists */ }
  const path = `/tmp/_cc_${safeFsKey(fileKey)}.csv`;
  pyodide.FS.writeFile(path, new TextEncoder().encode(csvText));
  return path;
}

export async function loadPythonDatasets(
  runtime: PythonRuntime,
  datasets: PythonDatasetConfig[] = [],
  previewRows = 10,
): Promise<Record<string, PythonDatasetPreview>> {
  const previews: Record<string, PythonDatasetPreview> = {};
  const usableDatasets = datasets.filter(d => d?.variableName?.trim() && (d.csvUrl || d.fileUrl));

  for (const ds of usableDatasets) {
    const variableName = ds.variableName.trim();
    if (!isValidPythonIdentifier(variableName)) {
      throw new Error(`Invalid Python dataset variable name "${variableName}". Use letters, numbers, and underscores, and do not start with a number.`);
    }

    const url = ds.csvUrl || ds.fileUrl;
    const resp = await fetch(url!);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${variableName}`);
    const csvText = await resp.text();

    const csvPath = writeCsvToFs(runtime.pyodide, ds.id || variableName, csvText);
    await runtime.pyodide.runPythonAsync(`import pandas as pd, os as _os_cc`);
    const df = await runtime.pyodide.runPythonAsync(`pd.read_csv(${JSON.stringify(csvPath)})`);
    runtime.pyodide.globals.set(variableName, df);
    try { df.destroy?.(); } catch {}
    await runtime.pyodide.runPythonAsync(`_os_cc.remove(${JSON.stringify(csvPath)})`);

    const colsProxy = await runtime.pyodide.runPythonAsync(`list(${variableName}.columns)`);
    const rowsProxy = await runtime.pyodide.runPythonAsync(`${variableName}.head(${Math.max(0, previewRows)}).astype(str).values.tolist()`);
    const columns: string[] = colsProxy.toJs ? colsProxy.toJs() : Array.from(colsProxy);
    const rowsRaw = rowsProxy.toJs ? rowsProxy.toJs() : Array.from(rowsProxy);
    const rows: string[][] = (rowsRaw as any[]).map((r: any) =>
      r && typeof r.toJs === 'function' ? r.toJs() : Array.from(r)
    );
    previews[variableName] = { columns, rows };
  }

  return previews;
}

export async function runPython(runtime: PythonRuntime, code: string): Promise<PythonResult> {
  const { pyodide } = runtime;
  assertAllowedPythonCode(code);

  // Redirect stdout + stderr into a StringIO buffer before running user code.
  await pyodide.runPythonAsync(`
import sys as _sys, io as _io
_cc_stdout_buf = _io.StringIO()
_sys.stdout = _cc_stdout_buf
_sys.stderr = _cc_stdout_buf
`);

  let returnValue: string | null = null;
  let error: string | null = null;
  let plots: string[] = [];

  try {
    const result = await pyodide.runPythonAsync(code);
    // runPythonAsync returns None->null for statements, or the last expression value.
    if (result !== undefined && result !== null) {
      returnValue = String(result);
    }
  } catch (e: any) {
    error = e?.message ?? String(e);
  }

  try {
    const plotProxy = await pyodide.runPythonAsync(`
import base64 as _cc_base64, io as _cc_io
_cc_plot_images = []
try:
    import matplotlib.pyplot as _cc_plt
    for _cc_num in _cc_plt.get_fignums()[:6]:
        _cc_fig = _cc_plt.figure(_cc_num)
        if _cc_fig.axes:
            _cc_plot_buf = _cc_io.BytesIO()
            _cc_fig.savefig(_cc_plot_buf, format='png', bbox_inches='tight', dpi=144)
            _cc_plot_images.append('data:image/png;base64,' + _cc_base64.b64encode(_cc_plot_buf.getvalue()).decode('ascii'))
            _cc_plot_buf.close()
    _cc_plt.close('all')
except Exception:
    pass
_cc_plot_images
`);
    const rawPlots = plotProxy?.toJs ? plotProxy.toJs() : plotProxy;
    plots = Array.from(rawPlots ?? []).map(String);
    try { plotProxy?.destroy?.(); } catch {}
  } catch {
    plots = [];
  }

  // Restore stdout/stderr and capture what was printed.
  const captured: string = await pyodide.runPythonAsync(`
_sys.stdout = _sys.__stdout__
_sys.stderr = _sys.__stderr__
_cc_stdout_buf.getvalue()
`);

  return {
    stdout: String(captured ?? ''),
    returnValue,
    error,
    plots,
  };
}
