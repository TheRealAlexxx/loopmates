'use strict';
// Generates levels.json. Pars come from the exhaustive solver in sim.js, so
// every shipped par is the true minimum number of loops.
// Usage: node gen-levels.js [seed] [count]
const fs = require('fs');
const Sim = require('./sim.js');

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomLevel(rand, w, h, nPairs, wallDensity) {
  const g = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      row.push(border || rand() < wallDensity ? '#' : '.');
    }
    g.push(row);
  }
  const free = () => {
    for (let i = 0; i < 200; i++) {
      const x = 1 + Math.floor(rand() * (w - 2)), y = 1 + Math.floor(rand() * (h - 2));
      if (g[y][x] === '.') return [x, y];
    }
    return null;
  };
  const put = (c) => { const p = free(); if (!p) return false; g[p[1]][p[0]] = c; return true; };
  if (!put('S') || !put('E')) return null;
  // Doors go on the shortest S->E path so that they actually block something.
  let S, E;
  g.forEach((row, y) => row.forEach((c, x) => { if (c === 'S') S = [x, y]; if (c === 'E') E = [x, y]; }));
  const prev = new Map([[S.join(), null]]);
  const q = [S];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (g[ny][nx] === '#' || prev.has(k)) continue;
      prev.set(k, [x, y]);
      q.push([nx, ny]);
    }
  }
  if (!prev.has(E.join())) return null;
  const path = [];
  for (let c = prev.get(E.join()); c && (c[0] !== S[0] || c[1] !== S[1]); c = prev.get(c.join())) path.push(c);
  if (path.length < 2) return null;
  for (let i = 0; i < nPairs; i++) {
    const open = path.filter(([x, y]) => g[y][x] === '.');
    if (!open.length) return null;
    const [dx, dy] = open[Math.floor(rand() * open.length)];
    g[dy][dx] = 'ABC'[i];
    if (!put('abc'[i])) return null;
  }
  return g.map(r => r.join(''));
}

function describe(grid) {
  // reject levels where S and E touch, or with unreachable clutter
  return grid.join('\n');
}

function main() {
  const seed = parseInt(process.argv[2] || '1', 10);
  const want = parseInt(process.argv[3] || '30', 10);
  const rand = rng(seed);
  const out = [];
  const seenGrid = new Set();
  let tried = 0;
  while (out.length < want && tried < 200000) {
    tried++; if (tried % 200 === 0) console.error('tried', tried, 'kept', out.length);
    const w = 6 + Math.floor(rand() * 3), h = 5 + Math.floor(rand() * 3);
    const nPairs = 1 + Math.floor(rand() * 2);
    const grid = randomLevel(rand, w, h, nPairs, 0.18 + rand() * 0.14);
    if (!grid) continue;
    const key = describe(grid);
    if (seenGrid.has(key)) continue;
    seenGrid.add(key);
    const T = 8 + Math.floor(rand() * 5);
    const L = Sim.parse({ name: 'x', T, grid });
    let res;
    try { res = Sim.solve(L, 3, { maxNodes: 300 }); } catch (e) { continue; }
    if (!res || res.loops < 2) continue;
    // Tightness: one tick less must change the answer or be unsolvable, so T is not slack.
    const L2 = Sim.parse({ name: 'x', T: T - 1, grid });
    let res2 = null;
    try { res2 = Sim.solve(L2, 3, { maxNodes: 300 }); } catch (e) { res2 = null; }
    if (res2 && res2.loops === res.loops) continue;
    // Every door must matter: removing any button-door pair must not leave par unchanged.
    out.push({ T, par: res.loops, grid, plan: res.plan });
  }
  out.sort((a, b) => a.par - b.par || a.T - b.T);
  out.forEach((l, i) => { l.name = 'Level ' + (i + 1); });
  fs.writeFileSync(process.env.OUT || 'levels.json', JSON.stringify(out, null, 1));
  const byPar = {};
  out.forEach(l => { byPar[l.par] = (byPar[l.par] || 0) + 1; });
  console.log('tried', tried, 'kept', out.length, 'by par', JSON.stringify(byPar));
}
main();
