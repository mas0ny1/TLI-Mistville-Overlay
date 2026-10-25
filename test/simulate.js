// Plays random Mistville boards with the route planner, re-planning after every reveal as you would, and counts the
// real turns and Sanity until the Clock Tower is found. Omens and Ruins are hidden until revealed, so this measures
// what the planner can't see: how well a route copes with a stele appearing in its way.
//   node test/simulate.js [games]
// Board mix from the log (cells as first revealed, 23 days): ~4 steles (Blindness 29%, Anxiety 26%, Anorexia 22%,
// Poverty 20%, Blank 3%) and ~2 Ruins per board; the rest is harmless. The Clock Tower is anywhere 4+ steps from the
// start, all equally likely.
'use strict';
const { plan } = require('../route');

const GAMES = +process.argv[2] || 400;
let seed = 12345;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const STELES = [['Bad Omen Stele - Blindness', 29], ['Bad Omen Stele - Anxiety', 26], ['Bad Omen Stele - Anorexia', 22], ['Bad Omen Stele - Poverty', 20], ['Blank Stele', 3]];
const steleName = () => { let r = rand() * 100; for (const [n, w] of STELES) { if ((r -= w) < 0) return n; } return 'Blank Stele'; };
const N4 = (i) => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([a, b]) => [Math.floor(i / 5) + a, (i % 5) + b]).filter(([r, c]) => r >= 0 && r < 5 && c >= 0 && c < 5).map(([r, c]) => r * 5 + c);
const N8 = (i) => { const o = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const r = Math.floor(i / 5) + a, c = (i % 5) + b; if ((a || b) && r >= 0 && r < 5 && c >= 0 && c < 5) o.push(r * 5 + c); } return o; };

function makeBoard() {
  const start = Math.floor(rand() * 25);
  const d = (i) => Math.abs(Math.floor(i / 5) - Math.floor(start / 5)) + Math.abs((i % 5) - (start % 5));
  const exit = pick([...Array(25).keys()].filter((i) => d(i) >= 4));
  const free = [...Array(25).keys()].filter((i) => i !== start && i !== exit);
  const truth = Array(25).fill('Clearing'); truth[start] = 'Place of Awakening'; truth[exit] = 'Clock Tower';
  for (let k = 0; k < 4; k++) truth[free.splice(Math.floor(rand() * free.length), 1)[0]] = steleName();
  for (let k = 0; k < 2; k++) truth[free.splice(Math.floor(rand() * free.length), 1)[0]] = 'Ruins';
  // the game wouldn't wall in the start or the Clock Tower with Ruins: such a board can't be finished
  if ([start, exit].some((i) => N4(i).every((n) => truth[n] === 'Ruins'))) return makeBoard();
  return { truth, start, exit };
}

/** The board as the game would log it, from what's been revealed. hazards: also preview every stele and Ruins
 *  (an "oracle", to measure how much knowing them in advance would save). */
function observe(truth, explored, hazards) {
  const tiles = truth.map((name, i) => ({ index: i, row: Math.floor(i / 5), col: i % 5, kind: 'hidden', name: '', content: '', explored: false, preview: false, sealed: false, reachable: false, done: false, cost: 0 }));
  for (let i = 0; i < 25; i++) if (explored[i]) {
    const n = truth[i];
    Object.assign(tiles[i], { explored: true, name: n, kind: n === 'Place of Awakening' ? 'start' : n === 'Clock Tower' ? 'exit' : /Stele/.test(n) ? 'stele' : n === 'Ruins' ? 'building' : 'clearing' });
    if (/Stele/.test(n)) tiles[i].cost = /Anxiety/.test(n) ? 20 : 10;
  }
  for (let i = 0; i < 25; i++) if (explored[i] && /Stele/.test(truth[i])) for (const n of /Blindness/.test(truth[i]) ? N8(i) : N4(i)) if (!explored[n]) tiles[n].sealed = true;
  for (let i = 0; i < 25; i++) if (!explored[i]) {
    const open = N4(i).some((n) => explored[n] && truth[n] !== 'Ruins');
    tiles[i].reachable = open; if (open && !tiles[i].sealed) tiles[i].cost = 3;
    if (hazards && (/Stele/.test(truth[i]) || truth[i] === 'Ruins')) Object.assign(tiles[i], { preview: true, name: truth[i] });
  }
  return tiles;
}

function play(board, opts) {
  const truth = board.truth.slice(), explored = Array(25).fill(false);
  explored[board.start] = true;
  let turns = 0, sanity = 0, removals = 0, explores = 0;
  for (let guard = 0; guard < 60; guard++) {
    const tiles = observe(truth, explored, opts.oracle);
    const r = plan(tiles, [], opts);
    if (!r || !r.steps.length) return { fail: true };
    const s = r.steps[0];
    if (s.action === 'explore') {
      if (!tiles[s.index].reachable || tiles[s.index].sealed || explored[s.index]) return { fail: true, why: 'illegal move' };
      explored[s.index] = true; turns++; explores++; sanity += 3;
      if (s.index === board.exit) return { turns, sanity, removals, explores };
    } else {
      const cost = tiles[s.index].cost; truth[s.index] = 'Clearing'; turns++; removals++; sanity += cost;
    }
  }
  return { fail: true, why: 'too long' };
}

module.exports = { makeBoard, observe, play };
if (require.main === module) {
  const policies = [
    ['ties: first found', { keepOpen: 0, center: false }],
    ['current default', {}],
    ['oracle: sees every stele and Ruins', { oracle: true }],
    ...(process.argv[3] ? JSON.parse(process.argv[3]).map((o, i) => ['variant ' + (i + 1) + ' ' + JSON.stringify(o), o]) : []),
  ];
  const boards = Array.from({ length: GAMES }, makeBoard);
  console.log(`${GAMES} random boards, each played by every planner\n`);
  for (const [name, opts] of policies) {
    let n = 0, t = 0, s = 0, rm = 0, worst = 0; const fails = {}; const t0 = Date.now();
    for (const b of boards) { const r = play(b, opts); if (r.fail) { fails[r.why || 'no plan'] = (fails[r.why || 'no plan'] || 0) + 1; continue; } n++; t += r.turns; s += r.sanity; rm += r.removals; worst = Math.max(worst, r.turns); }
    console.log(`${name.padEnd(40)} turns ${(t / n).toFixed(2)}  Sanity ${(s / n).toFixed(1)}  stele removals ${(rm / n).toFixed(2)}  worst ${worst}  failed ${JSON.stringify(fails)}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
