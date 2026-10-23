'use strict';
// Picks the level of the day. Same level for everyone on a given UTC date.
function dayNumber(date) {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function dailyIndex(date, count) {
  // Step through the levels with a stride coprime to the count: neighbouring
  // days are not neighbouring levels, and every level shows up once per cycle.
  let stride = 7;
  while (gcd(stride, count) !== 1) stride++;
  return (dayNumber(date) * stride) % count;
}

function shareText(date, loops, par, url) {
  const d = date.toISOString().slice(0, 10);
  const tag = loops <= par ? 'par' : '+' + (loops - par);
  return 'loopmates daily ' + d + ': out in ' + loops + (loops === 1 ? ' loop' : ' loops') + ' (' + tag + ')\n' + url;
}

// One emoji row per loop, one square per tick: yellow = the live player moved
// or waited out that tick, green = reached E, white = waiting. Past loops are
// the recorded move strings; the final loop is the winning one.
function shareGrid(loopMoves, T) {
  return loopMoves.map((ms, i) => {
    const last = i === loopMoves.length - 1;
    let row = '';
    for (let t = 0; t < T; t++) {
      const m = ms[t] || 'W';
      row += last && m !== 'W' && t === ms.length - 1 ? '\u{1F7E9}' : m === 'W' ? '\u2B1C' : '\u{1F7E8}';
    }
    return row;
  }).join('\n');
}

const dailyApi = { dayNumber, dailyIndex, shareText, shareGrid };
if (typeof module !== 'undefined') module.exports = dailyApi;
else window.Daily = dailyApi;
