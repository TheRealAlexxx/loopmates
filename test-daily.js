'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('./daily.js');

test('every level appears once per cycle', () => {
  for (const count of [1, 2, 7, 28, 30, 49]) {
    const seen = new Set();
    for (let i = 0; i < count; i++) seen.add(D.dailyIndex(new Date(Date.UTC(2026, 9, 19 + i)), count));
    assert.strictEqual(seen.size, count, 'count ' + count);
  }
});

test('same date gives the same level whatever the time of day', () => {
  const a = D.dailyIndex(new Date('2026-10-19T00:00:01Z'), 28);
  const b = D.dailyIndex(new Date('2026-10-19T23:59:59Z'), 28);
  assert.strictEqual(a, b);
});

test('share text', () => {
  const d = new Date('2026-10-19T12:00:00Z');
  assert.strictEqual(D.shareText(d, 2, 2, 'u'), 'loopmates daily 2026-10-19: out in 2 loops (par)\nu');
  assert.strictEqual(D.shareText(d, 4, 2, 'u'), 'loopmates daily 2026-10-19: out in 4 loops (+2)\nu');
});

test('shareGrid renders one emoji row per loop', () => {
  const grid = D.shareGrid(['RRRRWWWWW', 'RRRRRR'], 9).split('\n');
  assert.strictEqual(grid.length, 2);
  assert.strictEqual([...grid[0]].length, 9);
  assert.strictEqual([...grid[0]].filter(c => c === '\u{1F7E8}').length, 4, 'loop 1: 4 move ticks');
  assert.strictEqual([...grid[1]][5], '\u{1F7E9}', 'final tick of the winning loop is green');
  assert.strictEqual([...grid[1]][8], '\u2B1C', 'unused winning-loop ticks are waits');
});
