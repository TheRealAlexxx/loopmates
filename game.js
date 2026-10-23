'use strict';
(function () {
  const KEYS = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R', ' ': 'W' };
  const $ = (id) => document.getElementById(id);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('loopmates') || '{}'); } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem('loopmates', JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  let levels = [], campaign = [], idx = 0, L = null;
  let ghosts = [];   // recorded move strings
  let tracks = [];   // their position tracks
  let moves = '';    // current loop
  let curPos = null, won = false, daily = false;

  let custom = false;
  let tutorial = false, tipStage = 0;
  const TUTORIAL = { name: 'First loop', T: 9, grid: ['#########', '#S...aAE#', '#########'] };
  const TUTORIAL_BTN = [5, 1];
  const TIPS = [
    'You get 9 ticks per loop. Every move or wait spends one. When the loop ends, it replays as a ghost. Walk to button a and wait there until the loop runs out.',
    'Meet your loopmate - it replays exactly what you recorded, so it stands on a for you. Now walk right, through door A, to E.',
    'See it? A is open only while your ghost stands on a. You cannot hold a door for yourself - that is the whole puzzle.',
  ];
  function showTip() { const t = $('tip'); t.hidden = false; t.textContent = TIPS[Math.min(tipStage, TIPS.length - 1)]; }
  function startTutorial() {
    tutorial = true; custom = true; daily = false; tipStage = 0;
    const lv = { name: TUTORIAL.name, T: TUTORIAL.T, grid: TUTORIAL.grid.slice() };
    try { lv.par = Sim.solve(Sim.parse(lv), 4, { maxNodes: 3000 }).loops; } catch (e) { /* keep unknown */ }
    levels = [lv];
    buildLevelList();
    load(0);
  }
  fetch('levels.json').then(r => r.json()).then(data => {
    levels = data;
    campaign = data;
    let linkMsg = null, forceIdx = null, landingLevel = null;
    const sel = Share.parseLevelHash(location.hash, levels.length);
    if (sel.kind === 'custom') {
      const r = Share.decodeLevel(sel.code);
      if (r.error) { linkMsg = 'Bad level link: ' + r.error + '. Showing level 1.'; location.hash = '#1'; forceIdx = 0; }
      else {
        custom = true;
        const lv = r.level;
        try { lv.par = Sim.solve(Sim.parse(lv), 4, { maxNodes: 3000 }).loops; } catch (e) { /* too big to solve here */ }
        levels = [lv];
        landingLevel = lv;
      }
    }
    const saved = store.get();
    daily = sel.kind === 'daily';
    if (sel.kind === 'daily') idx = Daily.dailyIndex(new Date(), levels.length);
    else if (sel.kind === 'level') idx = sel.index;
    else if (forceIdx !== null) idx = forceIdx;
    else {
      idx = Math.min(saved.cur || 0, levels.length - 1);
      if (sel.kind === 'unknown' && !linkMsg) linkMsg = 'No level "' + sel.raw + '". Showing level ' + (idx + 1) + '.';
    }
    buildLevelList();
    if (landingLevel) showLanding(landingLevel);
    else {
      load(idx);
      if (linkMsg) say(linkMsg, 'bad');
    }
  });

  function showLanding(lv) {
    const L = Sim.parse(lv);
    $('landing-meta').textContent = lv.name + (lv.par ? ' - par ' + lv.par + (lv.par === 1 ? ' loop' : ' loops') : '');
    const th = $('landing-thumb');
    th.innerHTML = '';
    th.style.gridTemplateColumns = 'repeat(' + L.w + ', 16px)';
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const s = document.createElement('span');
      const c = Sim.cellAt(L, x, y);
      s.className = c === '#' ? 'w' : c === 'S' ? 's' : c === 'E' ? 'e' : (c >= 'a' && c <= 'c') ? 'b' : (c >= 'A' && c <= 'C') ? 'd' : '';
      th.appendChild(s);
    }
    $('landing').hidden = false;
  }

  function load(i, save) {
    idx = i;
    L = Sim.parse(levels[i]);
    ghosts = []; tracks = []; moves = ''; won = false;
    curPos = L.start.slice();
    if (!custom) {
      if (save) { const s = store.get(); s.cur = i; store.set(s); }
      history.replaceState(null, '', daily ? '#daily' : '#' + (i + 1));
    }
    buildBoard();
    say('');
    if (tutorial) { tipStage = 0; showTip(); } else { $('tip').hidden = true; }
    $('share').hidden = true;
    $('resultcard').hidden = true;
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
    if (tutorial && tipStage === 1 && tracks.some(tr => tr[moves.length] && tr[moves.length][0] === TUTORIAL_BTN[0] && tr[moves.length][1] === TUTORIAL_BTN[1])) {
      tipStage = 2; showTip();
    }
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
    if (tutorial && tipStage === 0) { tipStage = 1; showTip(); }
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
    if (par) text += loops <= par ? 'Par. ' : (loops - par) + ' over par (' + par + '). ';
    if (tutorial) text += 'That is the whole game - your past loops are your teammates. The levels below are yours now.';
    else if (!custom && !daily && idx + 1 < levels.length) text += 'Next level: press enter.';
    if (tutorial) {
      tutorial = false; custom = false; $('tip').hidden = true;
      levels = campaign; buildLevelList();
      load(0);
    }
    say(text, 'win');
    $('share').hidden = !daily;
    const rc = $('resultcard');
    if (daily) { rc.textContent = Daily.shareGrid(ghosts.concat([moves]), L.T); rc.hidden = false; }
    else rc.hidden = true;
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
      b.addEventListener('click', () => {
        daily = false;
        if (tutorial) { load(i); return; }
        custom = false;
        if (levels !== campaign) { levels = campaign; buildLevelList(); }
        load(i, true);
      });
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
      if (won) { if (!custom && !daily && idx + 1 < levels.length) load(idx + 1, true); } else sendGhost(false);
    }
    else if (k === 'r') load(idx);
  });
  document.querySelectorAll('#pad button').forEach(b => b.addEventListener('click', () => step(b.dataset.k)));
  $('howto').addEventListener('click', startTutorial);
  $('landing-play').addEventListener('click', () => { $('landing').hidden = true; load(0); });
  $('undo').addEventListener('click', undo);
  $('send').addEventListener('click', () => sendGhost(false));
  $('daily').addEventListener('click', () => {
    tutorial = false; custom = false; daily = true;
    if (levels !== campaign) { levels = campaign; buildLevelList(); }
    load(Daily.dailyIndex(new Date(), levels.length));
  });
  $('share').addEventListener('click', () => {
    const text = Daily.shareText(new Date(), ghosts.length + 1, levels[idx].par, 'https://therealalexxx.github.io/loopmates/#daily')
      + '\n' + Daily.shareGrid(ghosts.concat([moves]), L.T);
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      () => say('Copied. ' + text.split('\n')[0], 'win'), () => say(text, 'win'));
  });
  $('reset').addEventListener('click', () => load(idx));
})();
