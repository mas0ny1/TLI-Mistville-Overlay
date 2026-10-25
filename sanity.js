// Sanity for the card's Sanity bar: how full you'd start the next floor if you headed for the Clock Tower now, and
// where to stop exploring so it starts full.
//
// Rules (from the run history):
//   - a day change gives back 10 (entering the Clock Tower) + 30% of Max Sanity, plus Fluffy Old Blanket (8% of Max
//     Sanity, 16% upgraded) and Sleeping Spice (20; upgraded it gives Max Sanity instead), each rounded down, and never
//     above Max Sanity (38 of 45 day changes to within 1 Sanity; the misses are Old Stuff raising Max Sanity at the
//     day change). At Max Sanity 120 that's 46: end a day on 74 or more (the full-heal line) and the next one starts
//     full.
//   - a Sanatorium restores 20, 27 with Sanatorium Contract, 10 (upgraded 20) more with Special Protection Pass.
// Heading out now, the next floor starts on: your Sanity, plus the Sanatoriums you've revealed and not used, less what
// finding today's Clock Tower should still cost (the route's expected turns, for this board), plus what a new day gives
// back; at most Max Sanity.
'use strict';

const engine = require('./advisor/engine');
const { catalog } = require('./advisor/adapt');

const SANATORIUM = 20;
const NEARLY_FULL = 0.9; // the next floor starting on at least this share of Max Sanity: amber; below it, red
const LAST_DAY = 15;

const level = (relics, re) => { const r = relics.find((x) => re.test(x.name)); return r ? r.level + 1 : 0; }; // the bag's level 0 is "Level 1"

/** What a day change gives back at this Max Sanity with this Old Stuff, before the cap. */
function newDayGain(maxSanity, relics) {
  const blanket = level(relics, /^Fluffy Old Blanket$/), spice = level(relics, /^Sleeping Spice$/);
  return 10 + Math.floor(maxSanity * 0.3) + (blanket ? Math.floor(maxSanity * (blanket >= 2 ? 0.16 : 0.08)) : 0) + (spice === 1 ? 20 : 0);
}

/** What one Sanatorium restores with this Old Stuff. */
function sanatoriumGain(relics) {
  const contract = level(relics, /^Sanatorium Contract$/), pass = level(relics, /^Special Protection Pass$/);
  return SANATORIUM + (contract ? 7 : 0) + (pass >= 2 ? 20 : pass ? 10 : 0);
}

/**
 * The Sanity bar, from the parser's state, today's route (route.js) and points of interest (view.js), or null outside
 * a run:
 * { sanity: now, or what today starts on while the log hasn't said (expected: true); max; gain: what a new day gives
 *   back; fullHeal: end today on this or more and the next floor starts full; sanatoriums: revealed and not used yet,
 *   worth `waiting` Sanity (sanatorium: what one restores); findToday: about what finding today's Clock Tower still
 *   costs (0 once found, or with no board yet); reserve: the advisor's odd-day reserve before the Clock Tower (odd days
 *   only); keep: what to end today on (the full-heal line; on day 15, the reserve or a Cell); stopAt: keep +
 *   findToday; spare: sanity + waiting − stopAt; spareCells; cost: today's per Cell; nextStart: what the next floor
 *   starts on heading out now (null on day 15); lastDay;
 *   level: 'ok' (the next floor starts full; on day 15, enough to finish), 'low' (it starts on 90% of Max Sanity or
 *   more) or 'out' (less; on day 15, not enough) }
 */
function sanityPlan(state, route, policy = {}, pois = null) {
  if (!(state.run > 0 && state.day > 0) || state.ended || state.maxSanity == null || state.sanity == null) return null;
  const max = state.maxSanity, day = state.day, gain = newDayGain(max, state.relics), lastDay = day >= LAST_DAY;
  // the game writes a new day's Sanity only when you first act: until then it's yesterday's end plus what a day gives back
  const expected = state.sanityRead === false;
  const sanity = expected ? Math.min(max, state.sanity + gain) : state.sanity;
  const cost = state.exploreCost ?? state.baseExploreCost ?? catalog.dailyExploreCost[day - 1] ?? 0;
  const fullHeal = Math.max(0, max - gain);
  const reserve = day % 2 === 1 ? ((policy.weights || engine.VALUE_WEIGHTS).buffer || {}).reserveSanity || 0 : 0;
  // never below one Cell's cost: Sanity 0 ends the run
  const keep = Math.max(reserve, Math.max(1, cost), lastDay ? 0 : fullHeal);
  // Sanatoriums you've revealed and not used yet: Sanity you can still collect today
  const sana = pois && pois.list.find((p) => p.label === 'Sanatorium');
  const sanatoriums = sana ? sana.unused.length : 0;
  const waiting = sanatoriums * sanatoriumGain(state.relics);
  // finding today's Clock Tower: the route's expected turns at its cost per Cell (a removal counts as its Sanity)
  const findToday = !route || route.found != null || !route.expectedTurns ? 0 : Math.round(route.expectedTurns * (route.exploreCost || cost));
  const stopAt = keep + findToday;
  const spare = sanity + waiting - stopAt;
  const nextStart = lastDay ? null : Math.max(0, Math.min(max, sanity + waiting - findToday + gain));
  const level = lastDay ? (spare >= 0 ? 'ok' : 'out') : nextStart >= max ? 'ok' : nextStart >= NEARLY_FULL * max ? 'low' : 'out';
  return {
    sanity, expected, max, gain, fullHeal, sanatoriums, waiting, sanatorium: sanatoriumGain(state.relics), findToday, reserve, keep, stopAt, spare, cost,
    nextStart, lastDay, level, spareCells: cost > 0 ? Math.floor(Math.max(0, spare) / cost) : null,
  };
}

module.exports = { sanityPlan, newDayGain, sanatoriumGain };
