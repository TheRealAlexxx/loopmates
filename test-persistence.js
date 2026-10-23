'use strict';
// Campaign progress (localStorage cur) moves only on explicit campaign
// navigation (level-list pick, Enter-next). Daily, custom links, error
// fallbacks and plain link visits must not clobber it. (QA round-2.)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const Share = require('./share.js');
const levels = require('./levels.json');

function boot(hash, seedCur) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), {
    url: 'https://therealalexxx.github.io/loopmates/' + hash,
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  if (seedCur !== undefined) w.localStorage.setItem('loopmates', JSON.stringify({ cur: seedCur }));
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(__dirname, 'levels.json'), 'utf8'))) });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  for (const f of ['sim.js', 'share.js', 'daily.js', 'game.js']) w.eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  return new Promise((resolve) => setTimeout(() => resolve(w), 50));
}

const cur = (w) => JSON.parse(w.localStorage.getItem('loopmates') || '{}').cur;

test('picking a level from the list saves the position', async () => {
  const w = await boot('', 0);
  w.document.querySelectorAll('#levels button')[4].click(); // level 5
  assert.strictEqual(cur(w), 4);
});

test('daily button does not move the campaign position', async () => {
  const w = await boot('', 4);
  w.document.getElementById('daily').click();
  assert.strictEqual(cur(w), 4, 'daily play must not clobber campaign progress');
});

test('bad #c= link fallback does not move the campaign position', async () => {
  const w = await boot('#c=%%%bad', 9);
  assert.match(w.document.getElementById('msg').textContent, /Bad level link/);
  assert.strictEqual(cur(w), 9);
});

test('unknown hash fallback does not move the campaign position', async () => {
  const w = await boot('#99', 9);
  assert.match(w.document.getElementById('msg').textContent, /No level "99"/);
  assert.strictEqual(cur(w), 9);
});

test('visiting a #N link does not move the saved position by itself', async () => {
  const w = await boot('#5', 9);
  assert.strictEqual(cur(w), 9);
});

test('playing a custom share link does not move the campaign position', async () => {
  const w = await boot('#c=' + Share.encodeLevel(levels[0]), 9);
  w.document.getElementById('landing-play').click();
  assert.strictEqual(cur(w), 9);
});
