'use strict';
// Drives the level editor in a DOM: painting, uniqueness, validation truth,
// live par solving, and the #c= link round-trip. (QA round-2 coverage gap.)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const Share = require('./share.js');

function boot() {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'editor.html'), 'utf8'), {
    url: 'https://therealalexxx.github.io/loopmates/editor.html',
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  for (const f of ['sim.js', 'share.js', 'editor.js']) w.eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  return w;
}

const cells = (w) => [...w.document.querySelectorAll('#board .c')];
const cellAt = (w, x, y) => cells(w).find((c) => +c.dataset.x === x && +c.dataset.y === y);
const settle = () => new Promise((r) => setTimeout(r, 300)); // solver debounce is 200ms

function paint(w, x, y) {
  const target = cellAt(w, x, y);
  w.document.elementFromPoint = () => target;
  const ev = new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 1, clientY: 1 });
  target.dispatchEvent(ev);
  const up = new w.MouseEvent('pointerup', { bubbles: true });
  w.dispatchEvent(up);
}

function pickTool(w, label) {
  const b = [...w.document.querySelectorAll('#palette button')].find((x) => x.textContent === label);
  b.click();
}

test('boot renders the default level and solves it live', async () => {
  const w = boot();
  assert.strictEqual(cells(w).length, 35, '7x5 grid');
  assert.strictEqual(cells(w).filter((c) => c.classList.contains('start')).length, 1);
  assert.strictEqual(cells(w).filter((c) => c.classList.contains('exit')).length, 1);
  await settle();
  assert.match(w.document.getElementById('status').textContent, /Par 1 loop/);
});

test('painting over the only S tells the truth and disables the play link', async () => {
  const w = boot();
  await settle();
  pickTool(w, 'wall');
  paint(w, 1, 1); // the S cell
  assert.match(w.document.getElementById('status').textContent, /need exactly one S/);
  assert.strictEqual(w.document.getElementById('play').getAttribute('href'), '#');
});

test('painting a new S moves it (never two)', async () => {
  const w = boot();
  pickTool(w, 'S');
  paint(w, 3, 2);
  assert.strictEqual(cells(w).filter((c) => c.classList.contains('start')).length, 1);
  assert.ok(cellAt(w, 3, 2).classList.contains('start'));
});

test('the play link round-trips the painted level exactly', async () => {
  const w = boot();
  pickTool(w, 'wall');
  paint(w, 4, 1); // wall the side route so E is only reachable through A
  pickTool(w, 'E');
  paint(w, 5, 1); // move E behind the door
  pickTool(w, 'a');
  paint(w, 4, 2);
  pickTool(w, 'A');
  paint(w, 5, 2);
  w.document.getElementById('T').value = '12';
  w.document.getElementById('T').dispatchEvent(new w.Event('input', { bubbles: true }));
  const href = w.document.getElementById('play').getAttribute('href');
  assert.ok(href.startsWith('index.html#c='), 'href carries the encoded level');
  const r = Share.decodeLevel(href.slice('index.html#c='.length));
  assert.ok(!r.error, 'decodes cleanly: ' + r.error);
  assert.strictEqual(r.level.T, 12);
  assert.strictEqual(r.level.grid[2][4], 'a');
  assert.strictEqual(r.level.grid[2][5], 'A');
  assert.strictEqual(r.level.grid[1][5], 'E');
  assert.strictEqual(r.level.grid.length, 5);
  assert.strictEqual(r.level.grid[0].length, 7);
  await settle();
  assert.match(w.document.getElementById('status').textContent, /Par 2 loops/, 'solver finds the true par for a one-door level');
});

test('resize keeps the interior and reclamps; clear resets', async () => {
  const w = boot();
  pickTool(w, 'a');
  paint(w, 3, 2);
  w.document.getElementById('w').value = '9';
  w.document.getElementById('w').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.strictEqual(cells(w).length, 45, '9x5 grid');
  assert.ok(cellAt(w, 3, 2).classList.contains('button'), 'painted button survived resize');
  w.document.getElementById('clear').click();
  assert.ok(!cells(w).some((c) => c.classList.contains('button')), 'clear wipes paint');
  assert.strictEqual(cells(w).filter((c) => c.classList.contains('start')).length, 1);
});

function setSize(w, id, value) {
  const el = w.document.getElementById(id);
  el.value = String(value);
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}

test('a shrink that would cut off painted tiles is rejected, board untouched', async () => {
  const w = boot();
  await settle();
  setSize(w, 'h', 3); // default E at (3,5) falls outside a 3-row grid
  assert.strictEqual(cells(w).length, 35, 'board unchanged after rejection');
  assert.match(w.document.getElementById('status').textContent, /would cut off \d+ painted tile/, 'truthful rejection message');
  assert.strictEqual(w.document.getElementById('h').value, '5', 'input reverted to the real size');
});

test('a shrink where every painted tile fits is allowed and preserves content', async () => {
  const w = boot();
  pickTool(w, 'E');
  paint(w, 2, 2); // move E inside the future bounds
  pickTool(w, 'a');
  paint(w, 3, 1);
  setSize(w, 'w', 5);
  setSize(w, 'h', 4);
  assert.strictEqual(cells(w).length, 20, '5x4 grid');
  assert.strictEqual(cells(w).filter((c) => c.classList.contains('exit')).length, 1);
  assert.ok(cellAt(w, 2, 2).classList.contains('exit'), 'E kept its painted cell');
  assert.ok(cellAt(w, 3, 1).classList.contains('button'), 'button kept its painted cell');
  assert.strictEqual(cells(w).filter((c) => c.classList.contains('start')).length, 1);
});

test('degenerate 3x3 resize is rejected rather than destroying the puzzle', async () => {
  const w = boot();
  setSize(w, 'w', 1); // clamps to 3
  assert.strictEqual(w.document.getElementById('w').value, '5'.replace('5', '7'), 'rejected input reverts to 7');
  assert.strictEqual(cells(w).length, 35, 'board unchanged');
  assert.match(w.document.getElementById('status').textContent, /would cut off/);
});

test('widening 7 to 12 does not copy the old border as an interior wall column', async () => {
  const w = boot();
  setSize(w, 'w', 12);
  assert.strictEqual(cells(w).length, 60, '12x5 grid');
  for (let y = 1; y <= 3; y++) {
    assert.ok(!cellAt(w, 6, y).classList.contains('wall'), 'old border column 6 row ' + y + ' is interior floor, not a copied wall');
    assert.ok(!cellAt(w, 10, y).classList.contains('wall'), 'new interior column 10 row ' + y + ' is floor');
  }
  assert.ok(cellAt(w, 11, 2).classList.contains('wall'), 'new border is wall');
});

test('a moved S survives resize at its painted position', async () => {
  const w = boot();
  pickTool(w, 'S');
  paint(w, 3, 2);
  setSize(w, 'w', 9);
  assert.strictEqual(cells(w).filter((c) => c.classList.contains('start')).length, 1);
  assert.ok(cellAt(w, 3, 2).classList.contains('start'), 'S kept its painted cell');
});

test('out-of-range size inputs sync back to the clamped value', async () => {
  const w = boot();
  setSize(w, 'w', 99);
  assert.strictEqual(w.document.getElementById('w').value, '12');
  assert.strictEqual(cells(w)[0].parentElement.children.length, 60, 'board clamped to 12 wide');
});

test('a pending solver pass cannot overwrite the rejection message (race)', async () => {
  const w = boot();
  pickTool(w, 'wall');
  paint(w, 3, 2); // schedules the 200ms solver
  setSize(w, 'h', 3); // destructive: rejected immediately, well within 200ms
  await settle();
  assert.match(w.document.getElementById('status').textContent, /would cut off/, 'rejection reason survives the pending solver timer');
});
