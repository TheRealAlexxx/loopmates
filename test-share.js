'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('./share.js');
const levels = require('./levels.json');

test('every shipped level survives an encode/decode round trip', () => {
  for (const lv of levels) {
    const r = S.decodeLevel(S.encodeLevel(lv));
    assert.deepStrictEqual(r.level.grid, lv.grid);
    assert.strictEqual(r.level.T, lv.T);
  }
});

test('codes are url safe', () => {
  for (const lv of levels) assert.match(S.encodeLevel(lv), /^[A-Za-z0-9_-]+$/);
});

test('rejects bad input', () => {
  assert.ok(S.decodeLevel('%%%').error);
  assert.ok(S.decodeLevel(S.encodeLevel({ T: 5, grid: ['###', '#S#', '###'] })).error); // no E
  assert.ok(S.validateLevel({ T: 5, grid: ['####', '#SE', '####'] }));                 // ragged
  assert.ok(S.validateLevel({ T: 99, grid: ['####', '#SE#', '####'] }));                // T too big
  assert.ok(S.validateLevel({ T: 5, grid: ['#####', '#SaaE', '#####'] }));              // two buttons
  assert.ok(S.validateLevel({ T: 5, grid: ['#####', '#S?E#', '#####'] }));              // unknown tile
  assert.strictEqual(S.validateLevel({ T: 5, grid: ['#####', '#SaE#', '#####'] }), null);
});

test('parseLevelHash classifies every link shape', () => {
  assert.deepStrictEqual(S.parseLevelHash('', 10), { kind: 'empty' });
  assert.deepStrictEqual(S.parseLevelHash('#daily', 10), { kind: 'daily' });
  assert.deepStrictEqual(S.parseLevelHash('#3', 10), { kind: 'level', index: 2 });
  assert.deepStrictEqual(S.parseLevelHash('#1', 10), { kind: 'level', index: 0 });
  assert.strictEqual(S.parseLevelHash('#99', 10).kind, 'unknown');   // out of range
  assert.strictEqual(S.parseLevelHash('#0', 10).kind, 'unknown');
  assert.strictEqual(S.parseLevelHash('#3x', 10).kind, 'unknown');   // not a plain number
  assert.deepStrictEqual(S.parseLevelHash('#c=abc', 10), { kind: 'custom', code: 'abc' });
  assert.strictEqual(S.parseLevelHash('#s=xyz', 10).kind, 'unknown'); // stale/junk links
});
