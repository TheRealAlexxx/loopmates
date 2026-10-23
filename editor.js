'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const TOOLS = ['#', '.', 'S', 'E', 'a', 'A', 'b', 'B'];
  let tool = '#';
  let g = [];
  let painting = false;

  function blank(w, h, seed) {
    g = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) row.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.');
      g.push(row);
    }
    if (seed !== false) { g[1][1] = 'S'; g[h - 2][w - 2] = 'E'; }
  }

  function resize() {
    const w = clamp($('w').value, 3, 12), h = clamp($('h').value, 3, 12);
    const oldH = g.length, oldW = g[0].length;
    // Reject a resize that would cut off painted tiles: silently dropping
    // content (or silently moving S/E to keep the level valid) disguises a
    // changed puzzle. Say no, revert the inputs, and explain.
    let dropped = 0;
    for (let y = 1; y < oldH - 1; y++) for (let x = 1; x < oldW - 1; x++) {
      if (g[y][x] !== '.' && (x >= w - 1 || y >= h - 1)) dropped++;
    }
    if (dropped) {
      $('w').value = oldW; $('h').value = oldH;
      clearTimeout(timer); // a pending solver pass must not overwrite the rejection
      const el = $('status');
      el.className = 'err';
      el.textContent = 'That size would cut off ' + dropped + ' painted tile' + (dropped === 1 ? '' : 's') + ' - clear the edges first or choose a larger size.';
      return;
    }
    $('w').value = w; $('h').value = h; // keep the inputs in sync with the clamp
    const old = g;
    blank(w, h, false);
    // Copy old INTERIOR tiles only: the border is structural, not content.
    for (let y = 1; y < h - 1 && y < oldH - 1; y++) for (let x = 1; x < w - 1 && x < oldW - 1; x++) {
      g[y][x] = old[y][x];
    }
    ensureUnique();
    draw();
  }

  function clamp(v, lo, hi) { v = parseInt(v, 10); return isNaN(v) ? lo : Math.max(lo, Math.min(hi, v)); }

  // S, E and each button exist once at most: painting a new one moves it.
  function paint(x, y) {
    if (g[y][x] === tool) return;
    if (tool === 'S' || tool === 'E' || tool === 'a' || tool === 'b') {
      g.forEach((row) => row.forEach((c, i) => { if (c === tool) row[i] = '.'; }));
    }
    g[y][x] = tool;
    draw();
  }

  function ensureUnique() {
    for (const t of ['S', 'E']) {
      let seen = false;
      g.forEach((row) => row.forEach((c, i) => { if (c === t) { if (seen) row[i] = '.'; seen = true; } }));
    }
  }

  function level() { return { T: clamp($('T').value, 1, 24), grid: g.map((r) => r.join('')) }; }

  function draw() {
    const b = $('board');
    const w = g[0].length;
    b.innerHTML = '';
    b.style.gridTemplateColumns = 'repeat(' + w + ', 1fr)';
    b.style.maxWidth = Math.min(520, w * 60) + 'px';
    g.forEach((row, y) => row.forEach((ch, x) => {
      const d = document.createElement('div');
      let cls = 'c', txt = '';
      if (ch === '#') cls += ' wall';
      else if (ch === 'E') { cls += ' exit'; txt = 'E'; }
      else if (ch === 'S') { cls += ' start'; txt = ''; }
      else if (ch >= 'a' && ch <= 'c') { cls += ' button'; txt = ch; }
      else if (ch >= 'A' && ch <= 'C') { cls += ' door'; txt = ch; }
      d.className = cls; d.textContent = txt;
      d.dataset.x = x; d.dataset.y = y;
      b.appendChild(d);
    }));
    status();
  }

  let timer = null;
  function status() {
    clearTimeout(timer);
    const lv = level();
    const err = Share.validateLevel(lv);
    const el = $('status');
    $('play').href = err ? '#' : 'index.html#c=' + Share.encodeLevel(lv);
    if (err) { el.className = 'err'; el.textContent = err + '.'; return; }
    el.className = ''; el.textContent = 'Solving...';
    timer = setTimeout(() => {
      let msg, cls = 'ok';
      try {
        const r = Sim.solve(Sim.parse(Object.assign({ name: 'custom' }, lv)), 4, { maxNodes: 3000 });
        if (r) msg = 'Par ' + r.loops + (r.loops === 1 ? ' loop. No door stands in the way.' : ' loops.');
        else { msg = 'Not solvable in 4 loops or fewer with ' + lv.T + ' ticks.'; cls = 'err'; }
      } catch (e) { msg = 'Too big to solve here. You can still play it, but there is no par.'; cls = 'err'; }
      $('status').className = cls; $('status').textContent = msg;
    }, 200);
  }

  TOOLS.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t === '.' ? 'floor' : t === '#' ? 'wall' : t;
    b.addEventListener('click', () => { tool = t; [...$('palette').children].forEach((c) => c.classList.toggle('on', c === b)); });
    if (t === tool) b.classList.add('on');
    $('palette').appendChild(b);
  });

  const at = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    return t && t.dataset && t.dataset.x !== undefined ? [+t.dataset.x, +t.dataset.y] : null;
  };
  $('board').addEventListener('pointerdown', (e) => { painting = true; const p = at(e); if (p) paint(p[0], p[1]); e.preventDefault(); });
  $('board').addEventListener('pointermove', (e) => { if (painting) { const p = at(e); if (p) paint(p[0], p[1]); } });
  window.addEventListener('pointerup', () => { painting = false; });
  $('w').addEventListener('change', resize);
  $('h').addEventListener('change', resize);
  $('T').addEventListener('input', status);
  $('clear').addEventListener('click', () => { blank(g[0].length, g.length); draw(); });
  $('copy').addEventListener('click', () => {
    const url = new URL($('play').getAttribute('href'), location.href).href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => { $('status').textContent = 'Link copied.'; }, () => { $('status').textContent = url; });
  });

  blank(7, 5);
  draw();
})();
