'use strict';
// End-to-end: the "learn the ropes" tutorial is playable to a win through
// the real UI events, and the teaching tips fire in order.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function boot(hash) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), {
    url: 'https://therealalexxx.github.io/loopmates/' + (hash || ''),
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(__dirname, 'levels.json'), 'utf8'))) });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  for (const f of ['sim.js', 'share.js', 'daily.js', 'game.js']) w.eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  return new Promise((resolve) => setTimeout(() => resolve(w), 50));
}

function keys(w, seq) {
  for (const k of seq) {
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  }
}

test('tutorial plays to a win with tips firing in order', async () => {
  const w = await boot('');
  w.document.getElementById('howto').click();
  const tip = w.document.getElementById('tip');
  const msg = w.document.getElementById('msg');
  assert.strictEqual(tip.hidden, false);
  assert.match(tip.textContent, /9 ticks per loop/, 'stage 0 tip');

  // loop 1: walk to the button, wait out the clock
  keys(w, ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', ' ', ' ', ' ', ' ', ' ']);
  assert.match(msg.textContent, /ghost/i, 'loop 1 became a ghost');
  assert.match(tip.textContent, /loopmate/, 'stage 1 tip after first ghost');
  assert.match(w.document.getElementById('loop-info').textContent, /loop 2/);

  // loop 2: ghost holds a, walk through A to E
  keys(w, ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']);
  assert.match(tip.textContent, /open only while your ghost/, 'stage 2 tip when door held open');
  keys(w, ['ArrowRight', 'ArrowRight']);
  assert.match(msg.textContent, /Out in 2 loops/, 'won in 2 loops');
  assert.match(msg.textContent, /That is the whole game/, 'tutorial win copy');
  const n = require('./levels.json').length;
  assert.strictEqual(w.document.querySelectorAll('#levels button').length, n, 'campaign levels restored after tutorial win');
  assert.strictEqual(w.document.getElementById('tip').hidden, true, 'tip hidden after tutorial ends');
  assert.strictEqual(w.document.getElementById('lvl-name').textContent, require('./levels.json')[0].name + '  (par ' + (require('./levels.json')[0].par || '?') + ')', 'board/title show campaign level 1, not the tutorial');
  assert.strictEqual(new URL(w.location.href).hash, '#1', 'hash consistent with the shown level');
});

test('closed door in loop 1 tells the truth', async () => {
  const w = await boot('');
  w.document.getElementById('howto').click();
  keys(w, ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']); // straight at door A
  assert.match(w.document.getElementById('msg').textContent, /door is closed/i);
});

test('leaving the tutorial via the daily button restores the campaign and hides the tip', async () => {
  const w = await boot('');
  w.document.getElementById('howto').click();
  assert.strictEqual(w.document.getElementById('tip').hidden, false);
  assert.strictEqual(w.document.querySelectorAll('#levels button').length, 1, 'tutorial list is just the teaching level');
  w.document.getElementById('daily').click();
  assert.strictEqual(w.document.getElementById('tip').hidden, true);
  const n = require('./levels.json').length;
  assert.strictEqual(w.document.querySelectorAll('#levels button').length, n, 'campaign levels restored');
  assert.match(w.document.getElementById('lvl-name').textContent, /par/, 'a real daily level loaded, not the tutorial');
});

test('clicking the tutorial entry in the level list restarts the tutorial', async () => {
  const w = await boot('');
  w.document.getElementById('howto').click();
  keys(w, ['ArrowRight']);
  w.document.querySelector('#levels button').click();
  assert.strictEqual(w.document.getElementById('tip').hidden, false, 'still in tutorial');
  assert.match(w.document.getElementById('lvl-name').textContent, /First loop/);
  assert.match(w.document.getElementById('tick-info').textContent, /tick 0\/9/, 'restarted at tick 0');
});
