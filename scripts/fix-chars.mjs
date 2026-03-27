/**
 * fix-chars.mjs
 * Replaces all non-ASCII / corrupted Unicode characters in source files
 * with clean ASCII equivalents. Safe to re-run at any time.
 *
 * Usage:  node scripts/fix-chars.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// ---------------------------------------------------------------------------
// Ordered replacement table — applied to every .ts / .tsx file
// ---------------------------------------------------------------------------
const REPLACEMENTS = [
  // -- Corrupted box-drawing sequences (Latin-1 mis-read of UTF-8 bytes) ---
  // U+2500 "─"  UTF-8: E2 94 80  mis-read as: â (E2) + " (94 in Win-1252) + € (80 in Win-1252)
  [/\u00e2\u201c\u20ac/g,  '-'],   // â"€  (box horizontal ─)
  [/\u00e2\u0094\u0080/g,  '-'],   // alternative byte-level variant
  // U+2192 "→"  UTF-8: E2 86 92
  [/\u00e2\u2020\u2019/g,  '->'],  // â†'  (right arrow →)
  [/\u00e2\u0086\u0092/g,  '->'],
  // U+2190 "←"  UTF-8: E2 86 90
  [/\u00e2\u0086\u0090/g,  '<-'],
  // Generic corrupted "â" prefix sequences that are leftover junk
  [/â"[^\s]/g, '-'],
  [/â€[^\s"']/g, '-'],

  // -- Actual Unicode symbols -----------------------------------------------
  [/\u2500/g,  '-'],   // ─  box drawing horizontal
  [/\u2502/g,  '|'],   // │  box drawing vertical
  [/\u251c/g,  '+'],   // ├
  [/\u2514/g,  '+'],   // └
  [/\u250c/g,  '+'],   // ┌
  [/\u2192/g,  ''],   // →  right arrow - removed
  [/\u2190/g,  ''],   // ←  left arrow - removed
  [/\u2191/g,  ''],   // ↑
  [/\u2193/g,  ''],   // ↓
  [/\u2013/g,  '-'],   // –  en dash
  [/\u2014/g,  '--'],  // —  em dash
  [/\u2019/g,  "'"],   // '  right single quote (smart apostrophe)
  [/\u2018/g,  "'"],   // '  left single quote
  [/\u201c/g,  '"'],   // "  left double quote
  [/\u201d/g,  '"'],   // "  right double quote
  [/\ufffd/g,  ''],    // replacement char (corrupted byte)
  // Accented chars that appear only from copy-paste corruption
  [/Bras\u00edlia/g, 'Brasilia'],
  [/Bras\u00efia/g,  'Brasilia'],
];

// Characters to strip from comment-only lines (emoji ranges)
// We remove emoji from // comments and /* */ comment lines
const EMOJI_RANGE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}]/gu;

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------
function walk(dir, exts, results = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.claude' || name === 'scripts') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, results);
    else if (exts.includes(extname(name))) results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Per-file processing
// ---------------------------------------------------------------------------
function processFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  let text = original;

  // 1. Apply symbol replacements everywhere
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // 2. Strip emoji from line comments (// ...)
  text = text.replace(/\/\/[^\n]*/g, line =>
    line.replace(EMOJI_RANGE, '').replace(/\s{2,}/g, ' ').trimEnd()
  );

  // 3. Strip emoji from JSX comments ({/* ... */}) — single-line only
  text = text.replace(/\{\/\*[^*]*\*\/\}/g, block =>
    block.replace(EMOJI_RANGE, '').replace(/\s{2,}/g, ' ')
  );

  // 4. Clean up runs of dashes left from box-drawing removal (e.g. ------ → ---)
  text = text.replace(/(-)\1{4,}/g, '---');

  if (text !== original) {
    writeFileSync(filePath, text, 'utf8');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const files = walk(ROOT, ['.ts', '.tsx']);

let fixed = 0;
for (const f of files) {
  try {
    if (processFile(f)) {
      console.log('Fixed:', f.replace(ROOT, ''));
      fixed++;
    }
  } catch (e) {
    console.error('Error:', f, e.message);
  }
}

console.log(`\nDone. ${fixed} file(s) updated, ${files.length - fixed} already clean.`);
