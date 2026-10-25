// Feeds the advisor (engine.js) from the overlay's parser, and shapes its answers for the card. It builds the game
// state the advisor works on from the parser's: the bag, the board (the advisor names a Cell by its tile ID, the
// parser by the name the log gives it: same Cells), Sanity, the day's costs, today's interactions. Nothing here ranks
// or scores: engine.js does all of that.
'use strict';

const engine = require('./engine');
const { currentOffer } = require('../offers');
const { BUILDS, CLOSEST_OF } = require('../builds');

const loaded = engine.loadCatalog(__dirname);
if (!loaded.catalog) throw new Error('advisor catalog: ' + loaded.warnings.join('; '));
const catalog = loaded.catalog;
const synIdx = engine.buildSynergyIndexes(catalog.synergy);
const relicSyn = synIdx.relicsByName;
const foodSyn = synIdx.foodsByName;
// the Coin sources the card warns about having none of: the Economy engine's Old Stuff, on days 1-5
const COIN_SOURCES = catalog.synergy.builds.find((x) => x.id === 'economy').members;
const COIN_SOURCE_DAYS = 5;

// the advisor's tile IDs (its tile-names table) for the names the log gives revealed Cells
const TILE_IDS = [
  [/^Place of Awakening$/, 1000], [/^Bad Omen Stele - Blindness$/, 2002], [/^Bad Omen Stele - Anxiety$/, 2003],
  [/^Bad Omen Stele - Poverty$/, 2004], [/^Bad Omen Stele - Anorexia$/, 2005], [/^Unknown Old Stuff$/, 3000],
  [/^Unknown Food$/, 4000], [/^Mistville Trader$/, 5000], [/^Sanatorium$/, 6001], [/^Bank$/, 6002], [/^Ruins$/, 6004],
  [/^Watch Tower$/, 6005], [/^Folklores$/, 7001], [/^Alchemy Workshop$/, 8000], [/^Clearing$/, 98000], [/^Clock Tower$/, 99000],
];
const OFFER_MAX_ITEMS = 6; // the suggested order shows six

function tileIdOf(t) {
  if (!t.explored && !t.preview) return null; // the game names a Cell only once it's revealed or previewed
  if (t.kind === 'start') return 1000;
  if (t.kind === 'exit') return 99000;
  for (const [re, id] of TILE_IDS) if (re.test(t.name || '')) return id;
  return null;
}
// the worst case counts the Cells still unknown: here, the ones neither revealed nor previewed
function typeOf(t) {
  if (!t.explored && !t.preview) return null;
  return t.kind === 'exit' ? 'S6_EndPoint' : t.kind === 'start' ? 'S6_StartPoint' : 'S6_' + (t.kind || 'other');
}
const unknownTile = (index) => ({ index, tileId: null, type: null, previewed: false, explored: false, blocked: false, exploreCount: 0, cost: null, icon: null });

/**
 * The strategy settings: warning thresholds and value weights, as saved by the main window's Settings page. Thresholds
 * count only with both ratios. Weights are laid over the defaults one level deep, so a few changed numbers (the
 * odd-day reserve, say) are enough.
 */
function policy(saved) {
  const out = {};
  const t = saved && saved.thresholds;
  if (t && typeof t.yellowRatio === 'number' && typeof t.redRatio === 'number') out.thresholds = { version: 0, yellowRatio: t.yellowRatio, redRatio: t.redRatio };
  const w = saved && saved.weights;
  if (w && typeof w === 'object') {
    const d = engine.VALUE_WEIGHTS;
    out.weights = Object.assign({}, d, w);
    for (const k of Object.keys(d)) {
      if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && w[k] && typeof w[k] === 'object') out.weights[k] = Object.assign({}, d[k], w[k]);
    }
  }
  return out;
}
const defaults = () => ({ thresholds: { yellowRatio: engine.WARNING_THRESHOLDS.yellowRatio, redRatio: engine.WARNING_THRESHOLDS.redRatio }, weights: engine.VALUE_WEIGHTS });

/** The day's explore cost: as the log states it, else what the board shows on the Cells you can explore now. */
function exploreCost(s) {
  if (s.exploreCost != null) return s.exploreCost;
  if (s.baseExploreCost != null) return s.baseExploreCost;
  const costs = (s.board || []).filter((t) => t.reachable && !t.sealed && !t.explored && t.cost > 0).map((t) => t.cost).sort((a, b) => a - b);
  return costs.length ? costs[Math.floor(costs.length / 2)] : 0;
}

/** The game state the advisor works on, from the parser's state. */
function gameState(s) {
  const running = s.run > 0 && s.day > 0;
  return {
    status: !running ? 'idle' : s.ended ? 'ended' : 'running',
    day: s.day,
    dayExploreCost: exploreCost(s),
    attrs: { sanity: s.sanity ?? 0, maxSanity: s.maxSanity ?? 0, gold: s.coins ?? 0, foodBarCap: 0, canUseFood: s.canUseFood !== false,
      shopFreeRefresh: s.freeRefresh ?? 0, shopRelicPriceMod: 0, furnaceUpgradeCount: 0 },
    relics: s.relics.map((r) => ({ id: r.id, name: r.name, level: r.level })),
    foods: s.items.map((f) => ({ id: f.id, name: f.name, uses: f.uses })),
    tiles: s.board ? s.board.map((t) => ({ index: t.index, tileId: tileIdOf(t), type: typeOf(t), previewed: !!t.preview, explored: !!t.explored,
      blocked: !!t.sealed, exploreCount: 0, cost: t.reachable && !t.explored && t.cost > 0 ? t.cost : null, icon: null })) : Array.from({ length: 25 }, (_, i) => unknownTile(i)),
    dailyInteractions: s.daily || { sanatorium: 0, bank: 0, stone: 0 },
    todayGuarantee: engine.guaranteeOf(s.day),
  };
}
// the offers the advisor ranks (none for Mistville Intel, before day 1)
const OFFER_KINDS = ['relic', 'shop', 'furnaceUpgrade', 'food'];

/**
 * The suggested order for the open offer (the parser's state.offer: an Old Stuff pick, the Trader, an upgrade or a Food
 * pick): the top six for that kind of offer, with the day-stage strategy and build summary. The order goes by the kind
 * of offer only; at an Old Stuff pick or the Trader, the ones actually on offer are marked (offered: { price, bought }),
 * and when none of the six is, best is the highest of the offer in the whole order (with its place, rank).
 */
function ranking(s, pol = {}) {
  const kind = s.offer && s.offer.kind;
  if (!OFFER_KINDS.includes(kind)) return null;
  const st = gameState(s);
  if (st.status === 'idle') return null;
  const r = engine.buildOfferRanking(st, catalog, kind, pol.weights ?? engine.VALUE_WEIGHTS);
  const contents = kind === 'relic' || kind === 'shop' ? currentOffer(s) : null;
  const offered = new Map(contents ? [...contents.relics, ...contents.foods].filter((o) => o.name).map((o) => [o.name, o]) : []);
  const shown = (x) => {
    const o = offered.get(x.name);
    return Object.assign({ name: x.name, kind: x.kind, priority: x.priority, note: x.familyNote ?? x.reason, owned: x.familyNote != null },
      o ? { offered: { price: o.price, bought: o.bought } } : null);
  };
  const items = r.items.slice(0, OFFER_MAX_ITEMS).map(shown);
  let best = null;
  if (offered.size && !items.some((x) => x.offered && !x.offered.bought)) {
    const at = r.items.findIndex((x) => offered.has(x.name) && !offered.get(x.name).bought);
    if (at >= OFFER_MAX_ITEMS) best = Object.assign(shown(r.items[at]), { rank: at + 1 });
  }
  return { kind, phaseStrategy: r.phaseStrategy, buildSummary: r.buildSummary, items, best };
}

/** The build progress panel: each group's members, with what's owned (Lv1 / Lv2) and the pair hints. */
function buildMembers(b, relics) {
  const state = (name) => {
    const r = relics.find((x) => x.name === name);
    if (!r) return { text: 'Not owned', cls: 'none' };
    return r.level >= 1 ? { text: 'Lv2', cls: 'ok' } : { text: 'Lv1 · needs upgrade', cls: 'warn' };
  };
  const anyOf = new Set(b.anyOf.flat());
  return b.members.map((m) => {
    let hint = null;
    if (b.kind === 'pair') {
      const pair = b.pairs.find((p) => p.partner === m);
      hint = pair ? `needs ${pair.base}` : b.wildcardPartners.includes(m) ? `wildcard · any ${b.wildcardBaseTag ?? ''}` : null;
    } else if (anyOf.has(m)) hint = 'either one';
    return Object.assign({ name: m, hint }, state(m));
  });
}

/**
 * What a build group still needs, for the card to draw: { mode: 'all' (every slot) | 'any' (any `left` of them) | 'pair'
 * (any `left` pairs), left, options: each slot or pair as { pieces: the ones still to get ({ name, upgrade: held at Lv1,
 * key, important }), have: the half you have of a pair } }, and bar: Lv2 pieces counted (lv2), slots an upgrade would
 * fill (lv1) and the target. Only Lv2 Old Stuff counts towards a group. needs is null once done.
 */
function needsOf(b, relics, key = [], important = []) {
  const level = (n) => { const r = relics.find((x) => x.name === n); return r ? r.level : null; };
  const counted = (n) => level(n) !== null && level(n) >= 1;
  const piece = (n) => ({ name: n, upgrade: level(n) !== null && level(n) < 1, key: key.includes(n), important: important.includes(n) });
  if (b.kind === 'pair') {
    const tagged = relics.some((r) => r.level >= 1 && relicSyn.get(r.name)?.tier1 === b.wildcardBaseTag);
    const anyTagged = relics.some((r) => relicSyn.get(r.name)?.tier1 === b.wildcardBaseTag);
    const any = { name: `any ${b.wildcardBaseTag} Old Stuff`, upgrade: !tagged && anyTagged, key: false, important: false };
    const pairs = [
      ...b.pairs.map((p) => ({ pieces: [p.base, p.partner].filter((n) => !counted(n)).map(piece), have: [p.base, p.partner].find(counted) || null })),
      ...b.wildcardPartners.map((w) => ({ pieces: [counted(w) ? null : piece(w), tagged ? null : any].filter(Boolean), have: tagged ? `${b.wildcardBaseTag} Old Stuff` : counted(w) ? w : null })),
    ];
    const done = pairs.filter((p) => !p.pieces.length).length;
    const left = Math.max(0, b.target - done);
    const lv1 = Math.min(left, pairs.filter((p) => p.pieces.length && p.pieces.every((x) => x.upgrade)).length);
    return { needs: left ? { mode: 'pair', left, options: pairs.filter((p) => p.pieces.length).map((p) => ({ pieces: p.pieces, have: p.pieces.length === 1 ? p.have : null })) } : null,
      bar: { lv2: Math.min(done, b.target), lv1, target: b.target } };
  }
  const anyOf = new Set(b.anyOf.flat());
  const slots = [...b.members.filter((m) => !anyOf.has(m)).map((m) => [m]), ...b.anyOf];
  const open = slots.filter((slot) => !slot.some(counted));
  const filled = slots.length - open.length;
  const left = Math.max(0, b.target - filled);
  const lv1 = Math.min(left, open.filter((slot) => slot.some((n) => level(n) !== null)).length);
  return { needs: left ? { mode: left < open.length ? 'any' : 'all', left, options: open.map((slot) => ({ pieces: slot.map(piece), have: null })) } : null,
    bar: { lv2: Math.min(filled, b.target), lv1, target: b.target } };
}
/** needs as one line of text ("needs: A, B or C", "any one of: …", "one pair of: … (with your …)", "upgrade X"). */
function needsText(needs) {
  if (!needs) return null;
  const name = (x) => (x.upgrade ? 'upgrade ' : '') + x.name + (x.key ? ' (key)' : x.important ? ' (important)' : '');
  const list = needs.options.map((o) => o.pieces.map(name).join(needs.mode === 'pair' ? ' + ' : ' or ') + (o.have ? ` (with your ${o.have})` : ''));
  if (needs.mode === 'pair') return 'one pair of: ' + list.join('; ');
  return (needs.mode === 'any' ? `any ${needs.left === 1 ? 'one' : needs.left} of: ` : 'needs: ') + list.join(', ');
}
/** A group's needs, bar and missing line together. */
function missingOf(b, relics, key, important) {
  const { needs, bar } = needsOf(b, relics, key, important);
  return { needs, bar, missing: needsText(needs) };
}

/** The overlay's own builds (builds.js), counted the way the advisor counts its groups: Lv2 Old Stuff only. */
function ownBuilds(relics) {
  return BUILDS.map((b) => {
    const core = [...b.key, ...b.important, ...b.core.filter((n) => !b.key.includes(n) && !b.important.includes(n))];
    const def = { kind: 'collect', members: core, anyOf: [], pairs: [], wildcardPartners: [], target: core.length };
    const owned = core.filter((n) => relics.some((r) => r.name === n && r.level >= 1)).length;
    const hint = (n) => (b.key.includes(n) ? 'key' : b.important.includes(n) ? 'important' : null);
    return Object.assign({ id: b.id, label: b.label, note: b.note, owned, target: core.length, own: true,
      status: owned >= core.length ? 'done' : owned === core.length - 1 ? 'near' : 'open',
      members: buildMembers(def, relics).map((m) => (hint(m.name) ? Object.assign(m, { hint: hint(m.name) }) : m)) }, missingOf(def, relics, b.key, b.important));
  });
}

/**
 * Marks the build closest to complete among CLOSEST_OF (builds.js), by the share of its pieces counted (Lv2), then
 * the share an upgrade away. Builds already done don't take part; nothing is marked while none has a piece, and every
 * build tied at the top is.
 */
function markClosest(groups) {
  const score = (g) => [g.bar.lv2 / g.bar.target, g.bar.lv1 / g.bar.target];
  const open = groups.filter((g) => CLOSEST_OF.includes(g.id) && g.status !== 'done' && g.bar && g.bar.target && g.bar.lv2 + g.bar.lv1 > 0);
  if (!open.length) return groups;
  const top = open.map(score).reduce((a, b) => (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) ? b : a));
  for (const g of open) { const s = score(g); if (s[0] === top[0] && s[1] === top[1]) g.closest = true; }
  return groups;
}

/** Everything shown while you explore: the advice line, the day's budget, today's tip and build progress. */
function exploring(s, pol = {}) {
  const st = gameState(s);
  if (st.status === 'idle') return null;
  const b = engine.computeBudget(st, pol, catalog);
  // the game writes the new day's Sanity only when you first act: until then, nothing that goes by Sanity (yesterday's
  // last Sanity against a board not yet explored would warn every morning)
  const sanityPending = s.sanityRead === false;
  if (sanityPending) { b.warning = null; b.bufferHint = null; }
  const reach = b.reachability && !b.reachability.reachable ? b.reachability : null;
  const d = st.dailyInteractions;
  const defs = new Map(catalog.synergy.builds.map((x) => [x.id, x]));
  // in the early days, none of the Economy engine's Coin gain Old Stuff held at any level: the card says so
  const noCoinSource = st.status === 'running' && st.day <= COIN_SOURCE_DAYS && !COIN_SOURCES.some((n) => st.relics.some((r) => r.name === n)) ? COIN_SOURCES : null;
  return {
    advice: (b.warning && b.warning.advice) ?? (reach && reach.advice) ?? b.bufferHint ?? (b.detour && b.detour.advice) ?? null,
    adviceLevel: b.warning ? b.warning.level : reach ? (reach.clearPlan ? 'yellow' : 'red') : 'none',
    tilesLeft: b.tilesLeft, exploreCost: b.dayExploreCost, clearCost: b.dayClearCost, clearHint: b.clearHint, warning: b.warning, sanityPending,
    dailyTip: st.status === 'running' ? [st.todayGuarantee !== null ? `Today: ${st.todayGuarantee}` : null, `San. ${d.sanatorium} · Bank ${d.bank} · Stele ${d.stone}`].filter(Boolean).join(' │ ') : null,
    todayGuarantee: st.todayGuarantee,
    canUseFood: st.attrs.canUseFood,
    noCoinSource,
    builds: b.builds && { advice: b.builds.advice, summary: b.builds.summary,
      groups: markClosest(b.builds.groups.map((g) => Object.assign({}, g, defs.has(g.id) ? Object.assign({ members: buildMembers(defs.get(g.id), st.relics) }, missingOf(defs.get(g.id), st.relics)) : { members: [] }))
        .concat(ownBuilds(st.relics))) },
  };
}

/** A new GainCardTracker (the gain cards) on this catalog. */
const gainTracker = () => new engine.GainCardTracker(catalog);

/** Archetype and tags of an Old Stuff or Food (the synergy data), for colouring the bag. */
function tagsOf(name) {
  const r = relicSyn.get(name) || foodSyn.get(name);
  return r ? { archetype: r.archetype, tier1: r.tier1 ?? null, tier2: r.tier2 ?? null } : { archetype: null, tier1: null, tier2: null };
}

/** The Catalog tab: the advisor's catalog and synergy data, with the IDs the overlay has seen in your bag. */
function catalogView(seen) {
  const seenRelic = new Map(Object.entries((seen && seen.relicIds) || {}).map(([id, n]) => [n, +id]));
  const seenFood = new Map(Object.entries((seen && seen.foodIds) || {}).map(([id, n]) => [n, +id]));
  const pairs = (e) => (e ? e.pairs.map((p) => ({ with: p.with, note: p.note })) : []);
  return {
    relics: catalog.relics.map((r) => {
      const syn = relicSyn.get(r.name);
      return { name: r.name, id: r.id, seenId: seenRelic.get(r.name) ?? null, effect: r.effect, upgradeEffect: r.upgradeEffect, upgradeCost: r.upgradeCost,
        note: (syn && syn.note) ?? r.note ?? null, archetype: syn ? syn.archetype : null, tier1: syn ? syn.tier1 : null, tier2: syn ? syn.tier2 : null,
        pairs: pairs(syn), requires: syn ? syn.requires : [], requiresAny: !!(syn && syn.requiresAny), priority: syn ? syn.priority : null, encounter: !!(syn && syn.source === 'encounter') };
    }),
    foods: catalog.foods.map((f) => {
      const syn = foodSyn.get(f.name);
      return { name: f.name, id: f.id, seenId: seenFood.get(f.name) ?? null, effect: f.effect, initialUses: f.initialUses, note: (syn && syn.note) ?? f.note ?? null,
        archetype: syn ? syn.archetype : null, pairs: pairs(syn) };
    }),
    dailyExploreCost: catalog.dailyExploreCost, dailyClearCost: catalog.dailyClearCost,
  };
}

module.exports = { catalog, gameState, ranking, exploring, gainTracker, tagsOf, catalogView, tileIdOf, policy, defaults };
