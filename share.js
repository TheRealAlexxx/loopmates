'use strict';
// Encode and validate custom levels so they can live in a URL hash.
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Returns an error string, or null when the level is playable.
function validateLevel(lv) {
  if (!lv || typeof lv !== 'object') return 'not a level';
  if (!Number.isInteger(lv.T) || lv.T < 1 || lv.T > 24) return 'T must be 1 to 24';
  const g = lv.grid;
  if (!Array.isArray(g) || g.length < 3 || g.length > 12) return 'grid needs 3 to 12 rows';
  const w = typeof g[0] === 'string' ? g[0].length : 0;
  if (w < 3 || w > 12) return 'grid needs 3 to 12 columns';
  let s = 0, e = 0;
  const buttons = {};
  for (const row of g) {
    if (typeof row !== 'string' || row.length !== w) return 'rows must all be the same length';
    for (const c of row) {
      if (!'#.SEabcABC'.includes(c)) return 'unknown tile ' + c;
      if (c === 'S') s++;
      if (c === 'E') e++;
      if (c >= 'a' && c <= 'c') buttons[c] = (buttons[c] || 0) + 1;
    }
  }
  if (s !== 1) return 'need exactly one S';
  if (e !== 1) return 'need exactly one E';
  for (const c in buttons) if (buttons[c] > 1) return 'only one button ' + c + ' allowed';
  return null;
}

function encodeLevel(lv) {
  return b64urlEncode(JSON.stringify({ T: lv.T, grid: lv.grid }));
}

// Returns { level } or { error }.
function decodeLevel(code) {
  let lv;
  try { lv = JSON.parse(b64urlDecode(code)); } catch (e) { return { error: 'could not read the level code' }; }
  const err = validateLevel(lv);
  if (err) return { error: err };
  return { level: { name: 'Custom level', T: lv.T, grid: lv.grid } };
}

const shareApi = { encodeLevel, decodeLevel, validateLevel };
if (typeof module !== 'undefined') module.exports = shareApi;
else window.Share = shareApi;

// Classify the URL hash that selects what to load.
// Returns one of:
//   { kind: 'empty' }                    - no hash, use saved position
//   { kind: 'daily' }                    - #daily
//   { kind: 'level', index }             - #N, 1-based, in range
//   { kind: 'custom', code }             - #c=<code>
//   { kind: 'unknown', raw }             - anything else (bad level no., junk)
function parseLevelHash(hash, levelCount) {
  const h = (hash || '').replace(/^#/, '');
  if (h === '') return { kind: 'empty' };
  if (h === 'daily') return { kind: 'daily' };
  if (h.startsWith('c=')) return { kind: 'custom', code: h.slice(2) };
  const n = parseInt(h, 10);
  if (Number.isInteger(n) && String(n) === h && n >= 1 && n <= levelCount) return { kind: 'level', index: n - 1 };
  return { kind: 'unknown', raw: h };
}
shareApi.parseLevelHash = parseLevelHash;
