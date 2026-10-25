// Runs the route planner on every board in a log: how long it takes, whether its first move is one the game
// allows, and, on each day the Clock Tower was found, how many turns the plan made at the day's start would have
// taken to reach it, next to how many explorations it actually took.
//   node test/check-route.js "<path to UE_game.log>"
'use strict';
const fs = require('fs');
const { createParser } = require('../parser');
const { plan } = require('../route');

const p = createParser();
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
let prev = null, n = 0, slow = 0, maxMs = 0, totalMs = 0, fallback = 0, badFirst = 0, maxStates = 0;
const days = new Map(); // run/day -> { first plan, explored at start, explored when found }
for (const line of lines) {
  p.feed(line + '\n');
  const b = p.state.board;
  if (!b || b === prev) continue;
  prev = b; n++;
  const t0 = process.hrtime.bigint();
  const r = plan(b, p.state.relics);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  totalMs += ms; maxMs = Math.max(maxMs, ms); if (ms > 50) slow++;
  if (!r) continue;
  if (r.searched === 'nearest-first') fallback++;
  maxStates = Math.max(maxStates, r.states || 0);
  const first = r.steps[0];
  if (first && first.action === 'explore') { const t = b[first.index]; if (!(t.reachable && !t.sealed && !t.explored)) badFirst++; }
  const key = `${p.state.run}/${p.state.day}`;
  const explored = b.filter((t) => t.explored).length;
  if (!days.has(key)) days.set(key, { plan: r, startExplored: explored, found: null });
  const d = days.get(key);
  const exit = b.find((t) => t.kind === 'exit' && t.explored);
  if (exit && d.found === null) d.found = { index: exit.index, explorations: explored - d.startExplored };
}
console.log(`boards: ${n}, plan time avg ${(totalMs / n).toFixed(1)} ms, max ${maxMs.toFixed(0)} ms, over 50 ms: ${slow}, fell back to nearest-first: ${fallback}, most states: ${maxStates}`);
console.log(`first move not allowed by the game: ${badFirst}`);
console.log('\nday   | candidates | plan: expected / worst turns | plan reaches the real exit at turn | you took');
let sumPlan = 0, sumYou = 0, k = 0;
for (const [key, d] of days) {
  if (!d.found || !d.plan || !d.plan.steps) continue;
  let turn = 0, at = null;
  for (const s of d.plan.steps) { turn += s.action === 'explore' ? 1 : s.sanity / d.plan.exploreCost; if (s.action === 'explore' && s.index === d.found.index) { at = turn; break; } }
  console.log(`${key.padEnd(5)} | ${String(d.plan.candidates.length).padStart(10)} | ${String(d.plan.expectedTurns).padStart(14)} / ${String(d.plan.worstTurns).padEnd(10)} | ${String(at === null ? 'not on route' : at.toFixed(1)).padStart(30)} | ${d.found.explorations}`);
  if (at !== null) { sumPlan += at; sumYou += d.found.explorations; k++; }
}
console.log(`\nover ${k} days: plan ${sumPlan.toFixed(1)} turns vs ${sumYou} explorations taken (the plan can't see steles before they're revealed, so real turns run higher)`);
