'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Sim = require('./sim.js');
const levels = require('./levels.json');

const tiny = (grid, T) => Sim.parse({ name: 'tiny', T, grid });

test('door stays shut without a ghost', () => {
  const L = tiny(['#####', '#SaAE', '#####'], 6);
  const open = new Array(7).fill(0);
  assert.strictEqual(Sim.canWin(L, open), false);
});

test('a ghost on the button opens the door on the same tick', () => {
  const L = tiny(['#####', '#SaAE', '#####'], 6);
  const r = Sim.solve(L, 3);
  assert.strictEqual(r.loops, 2);
  assert.deepStrictEqual(Sim.check(L, r.plan), { ok: true, loops: 2 });
});

test('closed door blocks a recorded move', () => {
  const L = tiny(['#####', '#SaAE', '#####'], 6);
  const open = new Array(7).fill(0);
  assert.strictEqual(Sim.replay(L, 'RRR', open), null);
});

test('no button, no door: par is one loop', () => {
  const L = tiny(['#####', '#S.E#', '#####'], 4);
  assert.strictEqual(Sim.solve(L, 3).loops, 1);
});

test('too little time is unsolvable', () => {
  const L = tiny(['#######', '#S...E#', '#######'], 3);
  assert.strictEqual(Sim.solve(L, 3), null);
});

// Independent check of the solver: enumerate every move string for tiny levels.
function brute(L, maxLoops) {
  const all = [''];
  const strs = [];
  (function gen(prefix) {
    if (prefix.length === L.T) { strs.push(prefix); return; }
    for (const m of 'UDLRW') gen(prefix + m);
  })('');
  function go(tracks, left) {
    const open = Sim.openTimeline(L, tracks);
    for (const s of strs) {
      const pos = Sim.replay(L, s, open);
      if (!pos) continue;
      if (pos.some(p => p[0] === L.exit[0] && p[1] === L.exit[1])) return true;
    }
    if (left === 0) return false;
    for (const s of strs) {
      const pos = Sim.replay(L, s, open);
      if (pos && go(tracks.concat([pos]), left - 1)) return true;
    }
    return false;
  }
  for (let loops = 1; loops <= maxLoops; loops++) if (go([], loops - 1)) return loops;
  return null;
}

test('solver agrees with brute force on tiny levels', () => {
  const cases = [
    [['#####', '#SaAE', '#####'], 4],
    [['#####', '#S.aE', '#.#A#', '#####'], 5],
    [['######', '#Sa.E#', '#.##A#', '######'], 5],
    [['#####', '#S#E#', '#aAA#', '#####'], 5],
    [['#####', '#SaE#', '#.#A#', '#####'], 4],
  ];
  for (const [grid, T] of cases) {
    const L = tiny(grid, T);
    const s = Sim.solve(L, 2);
    assert.strictEqual(s ? s.loops : null, brute(L, 2), grid.join('/'));
  }
});

test('every shipped level is solved by its stored plan at par', () => {
  assert.ok(levels.length >= 20);
  for (const lv of levels) {
    const L = Sim.parse(lv);
    const c = Sim.check(L, lv.plan);
    assert.ok(c.ok, lv.name + ': ' + c.reason);
    assert.strictEqual(lv.plan.length, lv.par, lv.name);
  }
});

test('par is the true minimum for every shipped level', () => {
  for (const lv of levels) {
    const L = Sim.parse(lv);
    const s = Sim.solve(L, lv.par, { maxNodes: 1e6 });
    assert.strictEqual(s.loops, lv.par, lv.name);
  }
});
