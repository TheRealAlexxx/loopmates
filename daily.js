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

const dailyApi = { dayNumber, dailyIndex, shareText };
if (typeof module !== 'undefined') module.exports = dailyApi;
else window.Daily = dailyApi;
