'use strict';
// Drives game.js's real init path in a DOM (jsdom) for every link shape.
// Guards the QA M1 regression: error messages for bad links were wiped by load().
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function boot(hash) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), {
    url: 'https://therealalexxx.github.io/loopmates/' + hash,
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(__dirname, 'levels.json'), 'utf8'))) });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  for (const f of ['sim.js', 'share.js', 'daily.js', 'game.js']) w.eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  return new Promise((resolve) => setTimeout(() => resolve(w), 50));
}

test('bad #c= link: error message survives load and level 1 is shown', async () => {
  const w = await boot('#c=%%%bad');
  const msg = w.document.getElementById('msg').textContent;
  assert.match(msg, /Bad level link/);
  assert.match(msg, /Showing level 1/);
});

test('out-of-range level number is named, not silently ignored', async () => {
  const w = await boot('#99');
  assert.match(w.document.getElementById('msg').textContent, /No level "99"/);
});

test('junk hash (stale share format) is named, not silently ignored', async () => {
  const w = await boot('#s=stalejunk');
  assert.match(w.document.getElementById('msg').textContent, /No level "s=stalejunk"/);
});

test('valid level link loads quietly', async () => {
  const w = await boot('#2');
  assert.strictEqual(w.document.getElementById('msg').textContent, '');
});

test('daily link selects the daily level', async () => {
  const w = await boot('#daily');
  assert.strictEqual(w.document.getElementById('msg').textContent, '');
});
