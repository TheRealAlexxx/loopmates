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
