// The cheapest way to find the Clock Tower on a Mistville board, re-planned every time the board changes.
//
// Rules (from the game's own tile texts, checked against every board in the log):
//   - an unexplored Cell can be explored when a revealed Cell beside it (up/down/left/right; all 8 with Explorer's
//     Glasses, every Cell with Glasses level 2) opens it. Every revealed Cell opens its neighbours except Ruins
//     ("the four Cells around it will not be explorable"), unless you have Scavenger's Boots.
//   - a revealed stele seals the 4 unrevealed Cells around it (Blindness: all 8, unless Amulet: Blindness);
//     clicking it removes it for the Sanity shown on it.
//   - the Clock Tower shows only when its own Cell is explored, and is at least 4 steps from the start.
// The plan picks the order of explorations (and stele removals) with the fewest expected turns until the Clock
// Tower is found, with every Cell it could be in equally likely. A removal counts as its Sanity cost in
// explorations. Previewed good Cells on the way are worth a little; previewed steles, Tentacles and Ruins cost extra.
// Unrevealed Cells could hold anything, so the plan only knows what the board shows; it's redone live.

'use strict';

// turns a known (previewed) Cell is worth when the route passes through it, or costs extra
const BONUS = [[/Unknown Old Stuff/i, 1.5], [/Sanatorium/i, 1.2], [/Unknown Food/i, 1], [/Bank/i, 1], [/Watch Tower/i, 1], [/Mistville Trader/i, 0.5], [/Alchemy Workshop/i, 0.5]];
const PENALTY = [[/Stele/i, 4], [/Tentacle/i, 2], [/^Ruins$/i, 1.5]];
const EXIT_MIN_DISTANCE = 4;
const MAX_STATES = 150000; // beyond this the plan falls back to "nearest possible Cell first"
const STELE_BITS = 33554432; // 2^25: stele removals sit above the 25 board bits in a state's key

const rc = (i) => [Math.floor(i / 5), i % 5];
const inside = (r, c) => r >= 0 && r < 5 && c >= 0 && c < 5;
function around(i, ring8) {
  const [r, c] = rc(i), out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    if (!ring8 && dr && dc) continue;
    if (inside(r + dr, c + dc)) out.push((r + dr) * 5 + c + dc);
  }
  return out;
}
const level = (relics, re) => { const r = relics.find((x) => re.test(x.name)); return r ? r.level + 1 : 0; }; // the bag's level 0 is "Level 1"
const valueOf = (list, name) => { for (const [re, v] of list) if (re.test(name || '')) return v; return 0; };
const on = (mask, i) => (mask >> i) & 1;

/** board: the parser's 25 tiles; relics: the Old Stuff bag.
 *  opts.keepOpen: between moves within this many turns of each other, take the one that leaves more Cells open to
 *  explore, so one new omen can't wall the route off; opts.center: then the one nearer the middle. In 1,000 simulated
 *  boards (test/simulate.js) that found the Clock Tower in 10.5 turns instead of 10.7, with 13% fewer stele removals. */
function plan(board, relics = [], opts = {}) {
  const keepOpen = opts.keepOpen ?? 0.25, center = opts.center ?? true;
  const centreDistance = (c) => Math.abs(Math.floor(c / 5) - 2) + Math.abs((c % 5) - 2);
  if (!board) return null;
  const start = board.find((t) => t.kind === 'start');
  if (!start) return null;
  const glasses = level(relics, /Explorer.s Glasses/i), boots = level(relics, /Scavenger.s Boots/i) > 0, blindAmulet = level(relics, /Amulet: Blindness/i);
  const exitTile = board.find((t) => t.kind === 'exit');
  if (exitTile && exitTile.explored) return { found: exitTile.index, steps: [], candidates: [] };

  const steles = board.filter((t) => t.explored && t.kind === 'stele');
  const sealShape = (s) => around(s.index, /Blindness/i.test(s.name) && !blindAmulet);
  // which revealed steles keep each sealed Cell sealed (as a bitmask over `steles`); one nobody explains stays shut
  const sealMask = board.map((t) => (t.sealed && !t.explored ? steles.reduce((m, s, k) => (sealShape(s).includes(t.index) ? m | (1 << k) : m), 0) : 0));
  const stuck = board.map((t, i) => t.sealed && !t.explored && !sealMask[i]);

  // Sanity: the board shows what exploring and removing cost now (Beak Mask, Ms. Grumpy, Amulet: Anxiety are already
  // in it); Old Stuff that gives Sanity back is taken off here
  const exploreCosts = board.filter((t) => t.reachable && !t.sealed && !t.explored && t.cost > 0).map((t) => t.cost).sort((a, b) => a - b);
  const exploreCost = exploreCosts.length ? exploreCosts[Math.floor(exploreCosts.length / 2)] : 3;
  const bear = level(relics, /^Baby Bear$/i), misfortune = level(relics, /^Mr\. Misfortune$/i);
  const removeRefund = (bear >= 2 ? 20 : bear ? 10 : 0) + (misfortune ? 8 : 0); // Mr. Misfortune level 2 gives the 8 as Max Sanity
  const stool = level(relics, /Cartographer.s Stool/i), bottle = level(relics, /Cartographer.s Medicine Bottle/i);
  const previewRefund = (stool >= 2 ? 12 : stool ? 6 : 0) + (bottle ? 5 : 0); // for revealing a previewed Cell
  const removeSanity = steles.map((s) => Math.max(0, (s.cost || 10) - removeRefund));
  const removeTurns = removeSanity.map((v) => Math.max(1, v / exploreCost)); // a removal is at least one turn

  // where the Clock Tower can be
  let candidates;
  if (exitTile) candidates = [exitTile.index]; // previewed (Torn Map)
  else candidates = board.filter((t) => !t.explored && !stuck[t.index] && !(t.preview && t.name)
    && Math.abs(t.row - start.row) + Math.abs(t.col - start.col) >= EXIT_MIN_DISTANCE).map((t) => t.index);
  if (!candidates.length) return { found: null, steps: [], candidates: [], exploreCost };
  let candMask = candidates.reduce((m, c) => m | (1 << c), 0);

  const known = board.map((t) => (!t.explored && t.preview && t.name ? t.name : ''));
  const stepCost = board.map((t, i) => 1 - valueOf(BONUS, known[i]) + valueOf(PENALTY, known[i]) - (known[i] ? previewRefund / exploreCost : 0));

  // who opens whom: neighbours (4, 8, or everything with Glasses level 2); revealed Ruins open nothing
  const nb = board.map((t) => (glasses >= 2 ? board.map((u) => u.index).filter((j) => j !== t.index) : around(t.index, glasses >= 1)));
  const blindOpen = board.map((t) => blindAmulet >= 2 && around(t.index, true).some((n) => board[n].explored && board[n].kind === 'stele' && /Blindness/i.test(board[n].name)));
  const E0 = board.reduce((m, t) => (t.explored ? m | (1 << t.index) : m), 0);
  const shut = board.reduce((m, t) => (t.explored && t.name === 'Ruins' && !boots ? m | (1 << t.index) : m), 0);
  const isOpen = (E, D, c) => {
    if (on(E, c) || stuck[c] || (sealMask[c] & ~D)) return false;
    const open = E & ~shut; // Cells the plan explores are unknown, so they're assumed to open their neighbours
    for (const n of nb[c]) if (on(open, n)) return true;
    return blindOpen[c];
  };

  // distances between Cells over everything that could ever open (used to keep only moves that lead somewhere);
  // a revealed Ruins is a wall: nothing can be opened through it
  const dist = board.map((_, from) => {
    const d = Array(25).fill(Infinity); d[from] = 0; const q = [from];
    while (q.length) { const x = q.shift(); if (x !== from && on(shut, x)) continue; for (const y of around(x, glasses >= 1)) if (d[y] === Infinity && !stuck[y]) { d[y] = d[x] + 1; q.push(y); } }
    return d;
  });
  // only Cells that open their neighbours count (a revealed Ruins is right beside its Cells but opens none of them)
  // a candidate nothing can ever open (boxed in by revealed Ruins, say) can't be where the Clock Tower is
  const reachable = new Set();
  { const q = []; for (let i = 0; i < 25; i++) if (on(E0 & ~shut, i)) { reachable.add(i); q.push(i); }
    while (q.length) { const x = q.shift(); for (const y of nb[x]) if (!reachable.has(y) && !stuck[y] && !on(shut, y)) { reachable.add(y); q.push(y); } } }
  if (blindAmulet >= 2) board.forEach((t, i) => { if (blindOpen[i]) reachable.add(i); });
  candidates = candidates.filter((c) => reachable.has(c));
  if (!candidates.length) return { found: null, steps: [], candidates: [], exploreCost };
  candMask = candidates.reduce((m, c) => m | (1 << c), 0);

  const near0 = board.map((_, r) => { let m = Infinity; for (let i = 0; i < 25; i++) if (on(E0 & ~shut, i) && dist[r][i] < m) m = dist[r][i]; return m; });
  const closer = (near, c) => near.map((v, r) => (dist[r][c] < v ? dist[r][c] : v));

  const memo = new Map();
  let states = 0, overflow = false;
  /** The cheapest expected cost from explored set E with removed steles D; near[r] = how far E is from Cell r. */
  function best(E, D, near) {
    const Rm = candMask & ~E;
    if (!Rm) return { v: 0 };
    const key = E + D * STELE_BITS;
    const hit = memo.get(key); if (hit) return hit;
    if (++states > MAX_STATES) { overflow = true; return { v: Infinity }; }
    const R = candidates.filter((c) => on(Rm, c));
    let closest = Infinity; for (const r of R) if (near[r] < closest) closest = near[r];
    const openAfter = (E2) => { let n = 0; for (let x = 0; x < 25; x++) if (isOpen(E2, D, x)) n++; return n; };
    // which moves to look at: a Cell that isn't a candidate is first only tried on the way to the nearest candidates;
    // if that finds nothing (they're sealed off, say), on the way to any candidate; and then anything at all
    function moves(width) {
      const leadsOn = (c) => width >= 2 || R.some((r) => (width >= 1 || near[r] === closest) && dist[r][c] < near[r]);
      let out = { v: Infinity };
      for (let c = 0; c < 25; c++) {
        if (!isOpen(E, D, c)) continue;
        const isCand = on(Rm, c);
        if (!isCand && stepCost[c] >= 1 && !leadsOn(c)) continue;
        const pNot = isCand ? (R.length - 1) / R.length : 1;
        const v = stepCost[c] + pNot * best(E | (1 << c), D, closer(near, c)).v;
        if (!out.move) out = { v, room: keepOpen ? openAfter(E | (1 << c)) : 0, move: { action: 'explore', index: c } }; // any legal move beats none
        else if (keepOpen) {
          const room = openAfter(E | (1 << c)) - (center ? centreDistance(c) / 10 : 0);
          if (v < out.v - keepOpen || (v <= out.v + keepOpen && room > out.room)) out = { v, room, move: { action: 'explore', index: c } };
        } else if (v < out.v) out = { v, move: { action: 'explore', index: c } };
      }
      for (let k = 0; k < steles.length; k++) {
        if (on(D, k)) continue;
        const after = D | (1 << k);
        // a removal helps when it unseals a Cell that matters; in the wider searches, taking off one of several seals
        // on it counts too (a Cell sealed by two steles needs both removed)
        let helps = false;
        for (let c = 0; c < 25 && !helps; c++) if (on(sealMask[c], k) && (width >= 1 || !(sealMask[c] & ~after)) && !on(E, c) && (on(Rm, c) || leadsOn(c))) helps = true;
        if (!helps) continue;
        const v = removeTurns[k] + best(E, after, near).v;
        if (!out.move || v < out.v) out = { v, move: { action: 'remove', index: steles[k].index, stele: k } };
      }
      return out;
    }
    let out = moves(0);
    if (!out.move && !overflow) out = moves(1);
    if (!out.move && !overflow) out = moves(2);
    memo.set(key, out);
    return out;
  }

  let steps = [];
  best(E0, 0, near0);
  if (!overflow) {
    let E = E0, D = 0, near = near0;
    for (let guard = 0; guard < 40; guard++) {
      const b = best(E, D, near);
      if (!b.move) break;
      steps.push(b.move);
      if (b.move.action === 'explore') { E |= 1 << b.move.index; near = closer(near, b.move.index); } else D |= 1 << b.move.stele;
    }
  } else {
    steps = nearestFirst();
  }

  /** Fallback when the board is too open to search: walk to the nearest possible Cell, again and again. */
  function nearestFirst() {
    const out = []; let e = E0;
    for (let guard = 0; guard < 40; guard++) {
      const Rm = candMask & ~e;
      if (!Rm) break;
      // breadth-first over explorations from the explored area to the closest remaining candidate
      const prev = Array(25).fill(-2), q = [];
      for (let c = 0; c < 25; c++) if (isOpen(e, 0, c)) { prev[c] = -1; q.push(c); }
      let goal = -1;
      while (q.length && goal < 0) { const x = q.shift(); if (on(Rm, x)) { goal = x; break; } for (const y of nb[x]) if (prev[y] === -2 && !on(e, y) && !stuck[y] && !sealMask[y]) { prev[y] = x; q.push(y); } }
      if (goal < 0) break;
      const path = []; for (let x = goal; x !== -1; x = prev[x]) path.unshift(x);
      for (const x of path) { out.push({ action: 'explore', index: x }); e |= 1 << x; }
    }
    return out;
  }

  // expected and worst-case turns along the route (no bonuses: just explorations and removals)
  let pLeft = 1, expected = 0, turns = 0, left = candidates.length, sanity = 0;
  for (const s of steps) {
    s.sanity = s.action === 'explore' ? Math.max(0, exploreCost - (known[s.index] ? previewRefund : 0)) : removeSanity[s.stele];
    const t = s.action === 'explore' ? 1 : removeTurns[s.stele];
    turns += t; expected += pLeft * t; sanity += s.sanity;
    if (s.action === 'explore' && on(candMask, s.index)) { pLeft *= (left - 1) / left; left--; }
  }
  return {
    found: null, known: exitTile ? exitTile.index : null, candidates, steps, value: overflow ? null : best(E0, 0, near0).v,
    expectedTurns: Math.round(expected * 10) / 10, worstTurns: Math.round(turns * 10) / 10, worstSanity: sanity, exploreCost,
    searched: overflow ? 'nearest-first' : 'full', states,
  };
}

module.exports = { plan, around, EXIT_MIN_DISTANCE };
