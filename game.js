'use strict';
(function () {
  const KEYS = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R', ' ': 'W' };
  const $ = (id) => document.getElementById(id);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('loopmates') || '{}'); } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem('loopmates', JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  let levels = [], idx = 0, L = null;
  let ghosts = [];   // recorded move strings
  let tracks = [];   // their position tracks
  let moves = '';    // current loop
  let curPos = null, won = false, daily = false;

  let custom = false;
  fetch('levels.json').then(r => r.json()).then(data => {
    levels = data;
    if (location.hash.startsWith('#c=')) {
      const r = Share.decodeLevel(location.hash.slice(3));
      if (r.error) { levels = data; $('msg').textContent = 'Bad level link: ' + r.error + '. Showing level 1.'; location.hash = '#1'; }
      else {
        custom = true;
        const lv = r.level;
        try { lv.par = Sim.solve(Sim.parse(lv), 4, { maxNodes: 3000 }).loops; } catch (e) { /* too big to solve here */ }
        levels = [lv];
      }
    }
    const saved = store.get();
    const h = location.hash === '#daily' ? Daily.dailyIndex(new Date(), levels.length) + 1 : parseInt(location.hash.slice(1), 10);
    daily = location.hash === '#daily';
    idx = h > 0 && h <= levels.length ? h - 1 : Math.min(saved.cur || 0, levels.length - 1);
    buildLevelList();
    load(idx);
  });

  function load(i) {
    idx = i;
    L = Sim.parse(levels[i]);
    ghosts = []; tracks = []; moves = ''; won = false;
    curPos = L.start.slice();
    if (!custom) {
      const s = store.get(); s.cur = i; store.set(s);
      history.replaceState(null, '', daily ? '#daily' : '#' + (i + 1));
    }
    buildBoard();
    say('');
    $('share').hidden = true;
    render();
    refreshLevelList();
  }

  function open() { return Sim.openTimeline(L, tracks); }

  function buildBoard() {
    const b = $('board');
    b.innerHTML = '';
    b.style.gridTemplateColumns = 'repeat(' + L.w + ', 1fr)';
    b.style.maxWidth = Math.min(520, L.w * 74) + 'px';
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const d = document.createElement('div');
      d.id = 'c' + x + '_' + y;
      b.appendChild(d);
    }
  }

  function render() {
    const t = moves.length;
    const op = open();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const ch = L.rows[y][x];
      const d = $('c' + x + '_' + y);
      let cls = 'c', txt = '';
      if (ch === '#') cls += ' wall';
      else if (ch === 'E') { cls += ' exit'; txt = 'E'; }
      else if (ch === 'S') cls += ' start';
      else if (ch >= 'a' && ch <= 'c') { cls += ' button'; txt = ch; }
      else if (ch >= 'A' && ch <= 'C') {
        cls += ' door';
        if (op[t] & L.bit[ch.toLowerCase()]) cls += ' open';
        txt = ch;
      }
      d.className = cls;
      d.textContent = txt;
      tracks.forEach((tr, gi) => {
        if (tr[t][0] === x && tr[t][1] === y) {
          const g = document.createElement('div');
          g.className = 'actor ghost g' + (gi % 4);
          d.appendChild(g);
        }
      });
      if (curPos[0] === x && curPos[1] === y) {
        const m = document.createElement('div');
        m.className = 'actor me';
        d.appendChild(m);
      }
    }
    $('lvl-name').textContent = L.name + (levels[idx].par ? '  (par ' + levels[idx].par + ')' : '');
    $('loop-info').textContent = 'loop ' + (ghosts.length + 1);
    $('tick-info').textContent = 'tick ' + t + '/' + L.T;
    $('timefill').style.width = (t / L.T * 100) + '%';
    $('undo').disabled = moves.length === 0 || won;
    $('send').disabled = moves.length === 0 || won;
  }

  function say(text, cls) { const m = $('msg'); m.textContent = text; m.className = cls || ''; }

  function posAfter(ms) {
    const op = open();
    const p = Sim.replay(Object.assign({}, L, { T: ms.length }), ms, op);
    return p ? p[p.length - 1] : null;
  }

  function step(m) {
    if (won) return;
    const t = moves.length;
    if (t >= L.T) return;
    const op = open();
    const nx = curPos[0] + Sim.DIRS[m][0], ny = curPos[1] + Sim.DIRS[m][1];
    if (!Sim.canEnter(L, nx, ny, op[t + 1])) {
      const cell = $('c' + curPos[0] + '_' + curPos[1]);
      cell.classList.remove('shake'); void cell.offsetWidth; cell.classList.add('shake');
      const c = Sim.cellAt(L, nx, ny);
      say(c >= 'A' && c <= 'C' ? 'That door is closed on that tick.' : 'Wall.', 'bad');
      return;
    }
    moves += m;
    curPos = [nx, ny];
    say('');
    if (nx === L.exit[0] && ny === L.exit[1]) return win();
    if (moves.length >= L.T) { sendGhost(true); return; }
    render();
  }

  function sendGhost(auto) {
    if (won || moves.length === 0) return;
    const full = moves.padEnd(L.T, 'W');
    const tr = Sim.replay(L, full, open());
    ghosts.push(full);
    tracks.push(tr);
    moves = '';
    curPos = L.start.slice();
    say(auto ? 'Time is up. That loop is now a ghost.' : 'Ghost sent. Loop ' + (ghosts.length + 1) + ' starts.');
    render();
  }

  function win() {
    won = true;
    const loops = ghosts.length + 1;
    const par = levels[idx].par;
    if (!custom) {
      const s = store.get();
      s.best = s.best || {};
      if (!s.best[idx] || loops < s.best[idx]) s.best[idx] = loops;
      store.set(s);
    }
    let text = 'Out in ' + loops + (loops === 1 ? ' loop. ' : ' loops. ');
    if (par) text += loops <= par ? 'Par.' : (loops - par) + ' over par (' + par + ').';
    if (!custom && !daily && idx + 1 < levels.length) text += ' Next level: press enter.';
    say(text, 'win');
    $('share').hidden = !daily;
    render();
    refreshLevelList();
  }

  function undo() {
    if (won || !moves.length) return;
    moves = moves.slice(0, -1);
    curPos = posAfter(moves) || L.start.slice();
    say('');
    render();
  }

  function buildLevelList() {
    const box = $('levels');
    box.innerHTML = '';
    levels.forEach((lv, i) => {
      const b = document.createElement('button');
      b.textContent = i + 1;
      b.addEventListener('click', () => { daily = false; load(i); });
      box.appendChild(b);
    });
  }

  function refreshLevelList() {
    const best = store.get().best || {};
    [...$('levels').children].forEach((b, i) => {
      b.className = (i === idx ? 'cur ' : '') + (best[i] ? (best[i] <= levels[i].par ? 'par' : 'done') : '');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); step(KEYS[k]); }
    else if (k === 'Backspace') { e.preventDefault(); undo(); }
    else if (k === 'Enter') {
      e.preventDefault();
      if (won) { if (!custom && !daily && idx + 1 < levels.length) load(idx + 1); } else sendGhost(false);
    }
    else if (k === 'r') load(idx);
  });
  document.querySelectorAll('#pad button').forEach(b => b.addEventListener('click', () => step(b.dataset.k)));
  $('undo').addEventListener('click', undo);
  $('send').addEventListener('click', () => sendGhost(false));
  $('daily').addEventListener('click', () => { daily = true; load(Daily.dailyIndex(new Date(), levels.length)); });
  $('share').addEventListener('click', () => {
    const text = Daily.shareText(new Date(), ghosts.length + 1, levels[idx].par, 'https://therealalexxx.github.io/loopmates/#daily');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      () => say('Copied. ' + text.split('\n')[0], 'win'), () => say(text, 'win'));
  });
  $('reset').addEventListener('click', () => load(idx));
})();
