// Everything the card shows, from the parser's state: the board (points of interest, the route, where the Clock
// Tower can be), the Sanity bar (sanity.js) and the advisor (advisor/): what to pick at each screen, the advice line,
// the day's budget, today's tip, build progress and gain cards.

'use strict';

const { plan, EXIT_MIN_DISTANCE } = require('./route');
const advisor = require('./advisor/adapt');
const { sanityPlan } = require('./sanity');
const { formatAlert } = require('./parser');

// Points of interest on a day's board. How many there are, from every board explored in full (cells as first revealed,
// runs in dungeons 1-8): always 3 Banks and 3 Sanatoriums; day 1 has 2 Old Stuff and 1 Food and no Trader or Alchemy
// Workshop; later days vary, so they're counted without a total. (More can turn up during a day, e.g. under a stele.)
const POIS = [
  { name: 'Bank', label: 'Bank', total: () => 3 },
  { name: 'Sanatorium', label: 'Sanatorium', total: () => 3 },
  { name: 'Unknown Old Stuff', label: 'Old Stuff', total: (day) => (day === 1 ? 2 : null) },
  { name: 'Unknown Food', label: 'Food', total: (day) => (day === 1 ? 1 : null) },
  // shops stay as they are after a visit, so they're never "not used yet"
  { name: 'Mistville Trader', label: 'Trader', total: (day) => (day === 1 ? 0 : null), shop: true },
  { name: 'Alchemy Workshop', label: 'Alchemy', total: (day) => (day === 1 ? 0 : null), shop: true },
  { name: 'Watch Tower', label: 'Watch Tower', total: () => null },
  { name: 'Folklores', label: 'Folklores', total: () => null },
];

/** What's been found today, what's been revealed but not used yet, and what the board should still hold. */
function pointsOfInterest(state) {
  const board = state.board;
  if (!board) return null;
  const counted = state.dungeon > 0 && state.dungeon < 1000; // totals are from the mode played since run 2
  const hidden = board.filter((t) => !t.explored).length;
  const list = POIS.map((p) => {
    const found = Object.values(state.seen || {}).filter((names) => names.includes(p.name)).length;
    const unused = p.shop ? [] : board.filter((t) => t.explored && t.name === p.name).map((t) => t.index);
    const total = counted ? p.total(state.day) : null;
    return { label: p.label, found, total, unused, missing: total != null ? Math.max(0, total - found) : 0 };
  }).filter((p) => p.found || p.total);
  const exitFound = board.some((t) => t.kind === 'exit' && t.explored);
  const missing = list.filter((p) => p.missing > 0), unused = list.filter((p) => p.unused.length);
  return { list, hidden, exitFound, missing: missing.map((p) => ({ label: p.label, n: p.missing })), unused: unused.map((p) => ({ label: p.label, cells: p.unused })), counted };
}

/** The card's view. gainCard: the latest gain card (main.js keeps its tracker); policy: advisor.policy(). */
function buildView(state, gainCard = null, policy = {}) {
  const route = state.board ? plan(state.board, state.relics) : null;
  const pois = pointsOfInterest(state);
  return {
    // the board closes for the fights (Advent of Folklores) and the walk to the Clock Tower, and opens again with the next day
    // (Mistville Intel also comes before the board opens: an open screen is never a fight)
    inMistville: state.inMistville, mazeOpen: state.mazeOpen, combat: state.inMistville && !state.mazeOpen && !state.screen, day: state.day,
    sanity: state.sanity, sanityPeak: state.sanityPeak, maxSanity: state.maxSanity, coins: state.coins, ended: state.ended,
    run: state.run, foodSlots: state.foodSlots, freeRefresh: state.freeRefresh, canUseFood: state.canUseFood, daily: state.daily,
    relics: state.relics.map((r) => Object.assign({ name: r.name, level: r.level, intel: r.name === state.intelItem }, advisor.tagsOf(r.name))),
    items: state.items.map((f) => Object.assign({ name: f.name, uses: f.uses }, advisor.tagsOf(f.name))),
    board: state.board, route, pois, sanityPlan: sanityPlan(state, route, policy, pois),
    exit: { known: route ? (route.found ?? route.known) : null, found: !!(route && route.found !== null), cells: route ? route.candidates : [] },
    screen: state.screen, offer: state.offer, ranking: advisor.ranking(state, policy), explore: advisor.exploring(state, policy), gainCard,
    intel: state.intel, intelItem: state.intelItem,
    message: state.lastMessage, messageAt: state.lastMessageAt,
    // "the log format may have changed", and the Mistville lines not recognised (the main window lists them)
    logCheck: { alert: formatAlert(state), lines: state.logCheck.lines, unknown: state.logCheck.unknown, recent: state.logCheck.recent.slice() },
  };
}

module.exports = { EXIT_MIN_DISTANCE, buildView, pointsOfInterest };
