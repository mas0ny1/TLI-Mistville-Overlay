// What the open Old Stuff pick, Food pick or Trader offers, named. The parser reads each Cell's offer from the log (the
// Old Stuff and Food IDs, and at a Trader the prices and what's been bought); this names them with oldstuff.js,
// foods.js and the IDs learned from your bag. The suggested order itself goes by the kind of offer, not by what's on
// it; this highlights the suggestions actually on offer, and the run history keeps what each offer had.
'use strict';

const { BY_ID } = require('./oldstuff');

const relicName = (id, s) => (BY_ID.get(id) || {}).name || (s.relicIds && s.relicIds[id]) || null;
const foodName = (id, s) => (s.foodIds && s.foodIds[id]) || null; // the parser starts foodIds from foods.js

/**
 * The open offer's contents, from the parser's state: { kind, cell, relics: [{ id, name, price, bought }], foods: [...] }
 * (name null while the ID is unknown; price and bought only at a Trader), or null when no Old Stuff pick, Food pick or
 * Trader is open or the log hasn't listed what it offers. It's the list at the Cell the offer opened at, else at the
 * Cell you last clicked or used (the log can name the Cell after the offer has opened).
 */
function currentOffer(s) {
  const open = s.offer;
  if (!open || !['relic', 'food', 'shop'].includes(open.kind) || !s.board) return null;
  const named = (list, name) => list.filter((o) => o.id != null).map((o) => ({ id: o.id, name: name(o.id, s), price: o.price, bought: o.bought }));
  for (const cell of [open.cell, s.lastTile]) {
    const offer = cell != null && s.board[cell] && s.board[cell].offer;
    if (offer && (offer.relics.some((o) => o.id != null) || offer.items.some((o) => o.id != null))) {
      return { kind: open.kind, cell, relics: named(offer.relics, relicName), foods: named(offer.items, foodName) };
    }
  }
  return null;
}

module.exports = { currentOffer };
