'use strict';
// Core rules for loopmates. Works in Node and in the browser.
//
// A level is a grid. You get T ticks per loop. Every earlier loop replays as a
// ghost at the same time as you. Lowercase letters are buttons, the matching
// uppercase letters are doors. A door is open on a tick when some ghost is
// standing on its button at that tick. Reach E before time runs out.

const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };

function parse(level) {
  const rows = level.grid;
  const h = rows.length, w = rows[0].length;
  let start = null, exit = null;
  const buttons = {}; // letter -> [x, y]
  const letters = [];
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error('ragged grid in ' + level.name);
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === 'S') start = [x, y];
      else if (c === 'E') exit = [x, y];
      else if (c >= 'a' && c <= 'c') { buttons[c] = [x, y]; letters.push(c); }
    }
  }
  if (!start || !exit) throw new Error('level needs S and E: ' + level.name);
  letters.sort();
  const bit = {};
  letters.forEach((c, i) => { bit[c] = 1 << i; });
  return { w, h, rows, start, exit, T: level.T, letters, bit, name: level.name };
}

function cellAt(L, x, y) {
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return '#';
  return L.rows[y][x];
}

// Which buttons are held at one position (bitmask).
function heldAt(L, x, y) {
  const c = cellAt(L, x, y);
  return c >= 'a' && c <= 'c' ? L.bit[c] : 0;
}

// Positions of a recorded loop over time. moves is a string of U D L R W,
// padded with waits up to T. Returns null if a move is illegal.
function replay(L, moves, open) {
  const pos = [L.start.slice()];
  let [x, y] = L.start;
  for (let t = 0; t < L.T; t++) {
    const m = t < moves.length ? moves[t] : 'W';
    const nx = x + DIRS[m][0], ny = y + DIRS[m][1];
    if (!canEnter(L, nx, ny, open[t + 1])) return null;
    x = nx; y = ny;
    pos.push([x, y]);
  }
  return pos;
}

function canEnter(L, x, y, openMask) {
  const c = cellAt(L, x, y);
  if (c === '#') return false;
  if (c >= 'A' && c <= 'C') return (openMask & L.bit[c.toLowerCase()]) !== 0;
  return true;
}

// Mask of held buttons per tick, from a list of ghost position tracks.
function openTimeline(L, tracks) {
  const open = new Array(L.T + 1).fill(0);
  for (const tr of tracks) {
    for (let t = 0; t <= L.T; t++) open[t] |= heldAt(L, tr[t][0], tr[t][1]);
  }
  return open;
}

// Can a player starting now reach E given these door states?
function canWin(L, open) {
  let cur = new Set([L.start[1] * L.w + L.start[0]]);
  const exitKey = L.exit[1] * L.w + L.exit[0];
  if (cur.has(exitKey)) return true;
  for (let t = 0; t < L.T; t++) {
    const next = new Set();
    for (const k of cur) {
      const x = k % L.w, y = (k / L.w) | 0;
      for (const m of 'UDLRW') {
        const nx = x + DIRS[m][0], ny = y + DIRS[m][1];
        if (!canEnter(L, nx, ny, open[t + 1])) continue;
        const nk = ny * L.w + nx;
        if (nk === exitKey) return true;
        next.add(nk);
      }
    }
    cur = next;
  }
  return false;
}

// Shortest winning move string given door states, or null.
function winningMoves(L, open) {
  const startKey = L.start[1] * L.w + L.start[0];
  const exitKey = L.exit[1] * L.w + L.exit[0];
  let cur = new Map([[startKey, '']]);
  for (let t = 0; t < L.T; t++) {
    const next = new Map();
    for (const [k, path] of cur) {
      const x = k % L.w, y = (k / L.w) | 0;
      for (const m of 'UDLRW') {
        const nx = x + DIRS[m][0], ny = y + DIRS[m][1];
        if (!canEnter(L, nx, ny, open[t + 1])) continue;
        const nk = ny * L.w + nx;
        if (nk === exitKey) return path + m;
        if (!next.has(nk)) next.set(nk, path + m);
      }
    }
    cur = next;
  }
  return startKey === exitKey ? '' : null;
}

// Every distinct way a ghost can affect doors, given the doors already open.
// Returns a list of { sig, moves } where sig is the held-button mask per tick.
// Ghosts that never hold a button are useless and are left out.
function ghostOptions(L, open) {
  let layer = new Map(); // key -> moves, key = pos + '|' + sig
  const sig0 = [heldAt(L, L.start[0], L.start[1])];
  layer.set(L.start.join(',') + '|' + sig0.join(','), { x: L.start[0], y: L.start[1], sig: sig0, moves: '' });
  for (let t = 0; t < L.T; t++) {
    const next = new Map();
    for (const s of layer.values()) {
      for (const m of 'UDLRW') {
        const nx = s.x + DIRS[m][0], ny = s.y + DIRS[m][1];
        if (!canEnter(L, nx, ny, open[t + 1])) continue;
        const sig = s.sig.concat(heldAt(L, nx, ny));
        const key = nx + ',' + ny + '|' + sig.join(',');
        if (!next.has(key)) next.set(key, { x: nx, y: ny, sig, moves: s.moves + m });
      }
    }
    layer = next;
    if (layer.size > 150000) throw new Error('search budget exceeded');
  }
  const seen = new Map();
  for (const s of layer.values()) {
    if (!s.sig.some(v => v)) continue;
    const k = s.sig.join(',');
    if (!seen.has(k) || seen.get(k).moves.length > s.moves.length) seen.set(k, { sig: s.sig, moves: s.moves });
  }
  // Drop dominated options: more open doors is never worse.
  const all = [...seen.values()].sort((a, b) => b.sig.filter(v => v).length - a.sig.filter(v => v).length);
  const kept = [];
  for (const o of all) {
    if (!kept.some(k => covers(k.sig, o.sig))) kept.push(o);
  }
  return kept;
}

function covers(open, sig) {
  // true when sig adds nothing new on top of open
  for (let t = 0; t < sig.length; t++) if (sig[t] & ~open[t]) return false;
  return true;
}

// Minimum number of loops (ghosts + the final run) needed to reach E.
// Exhaustive within maxLoops. Returns { loops, plan } or null.
function solve(L, maxLoops, opts) {
  const budget = (opts && opts.maxNodes) || 2e6;
  let nodes = 0;
  const failed = new Set();
  function go(open, ghostsLeft, plan) {
    if (canWin(L, open)) return plan.concat(winningMoves(L, open));
    if (ghostsLeft === 0) return null;
    const key = open.join(',') + '#' + ghostsLeft;
    if (failed.has(key)) return null;
    for (const g of ghostOptions(L, open)) {
      if (++nodes > budget) throw new Error('search budget exceeded');
      if (covers(open, g.sig)) continue;
      const open2 = open.map((v, t) => v | g.sig[t]);
      const r = go(open2, ghostsLeft - 1, plan.concat(g.moves));
      if (r) return r;
    }
    failed.add(key);
    return null;
  }
  for (let loops = 1; loops <= maxLoops; loops++) {
    const plan = go(new Array(L.T + 1).fill(0), loops - 1, []);
    if (plan) return { loops, plan };
  }
  return null;
}

// Check a complete answer: a list of move strings, the last one must win.
function check(L, plan) {
  const tracks = [];
  for (let i = 0; i < plan.length; i++) {
    const open = openTimeline(L, tracks);
    const pos = replay(L, plan[i], open);
    if (!pos) return { ok: false, reason: 'loop ' + (i + 1) + ' hits a wall or closed door' };
    if (i === plan.length - 1) {
      const won = pos.some(p => p[0] === L.exit[0] && p[1] === L.exit[1]);
      return won ? { ok: true, loops: plan.length } : { ok: false, reason: 'last loop does not reach E' };
    }
    tracks.push(pos);
  }
  return { ok: false, reason: 'empty plan' };
}

const api = { DIRS, parse, cellAt, heldAt, replay, canEnter, openTimeline, canWin, winningMoves, ghostOptions, solve, check };
if (typeof module !== 'undefined') module.exports = api;
else window.Sim = api;
