'use strict';
// A #c= share link lands on a recipient page first (thumbnail, par,
// truthful "nothing stored" framing), and Play starts the actual level.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const Share = require('./share.js');
const levels = require('./levels.json');

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

test('valid #c= link shows the landing card, then plays', async () => {
  const code = Share.encodeLevel(levels[0]);
  const w = await boot('#c=' + code);
  const landing = w.document.getElementById('landing');
  assert.strictEqual(landing.hidden, false, 'landing shown before play');
  assert.match(w.document.getElementById('landing-meta').textContent, /par \d+ loop/);
  assert.ok(w.document.querySelectorAll('#landing-thumb span').length > 0, 'thumbnail rendered');
  assert.match(landing.textContent, /never uploaded/, 'bounded truthful storage note');
  assert.ok(!/nothing is stored anywhere/.test(landing.textContent), 'no overbroad claim while progress uses localStorage');
  w.document.getElementById('landing-play').click();
  assert.strictEqual(landing.hidden, true, 'play hides the landing');
  assert.ok(w.document.querySelectorAll('#board .c').length > 0, 'board rendered');
  assert.strictEqual(w.document.getElementById('msg').textContent, '', 'no error on a good link');
});

test('landing overlay is actually hidden by the hidden attribute (CSS regression guard)', async () => {
  const w = await boot('');
  const landing = w.document.getElementById('landing');
  assert.strictEqual(w.getComputedStyle(landing).display, 'none', 'hidden overlay must not paint');
});

test('bad #c= link skips the landing and names the problem', async () => {
  const w = await boot('#c=%%%bad');
  assert.strictEqual(w.document.getElementById('landing').hidden, true, 'no landing for a bad link');
  assert.match(w.document.getElementById('msg').textContent, /Bad level link/);
});
