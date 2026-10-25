// Replays a log and prints, each time an Old Stuff pick, Trader, upgrade or Food pick opened (when the card's suggestions
// drop down), what the log says was on offer (offers.js) and the suggested order, then what
// you actually took next.
//   node test/check-picks.js "<UE_game.log>" [max screens]
'use strict';
const fs = require('fs');
const { createParser } = require('../parser');
const { buildView } = require('../view');
const { currentOffer } = require('../offers');

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const max = +process.argv[3] || 40;
const p = createParser();
let prev = null, shown = 0, pending = null;
const flag = (x) => (x.priority === 'must' ? ' [must-pick]' : x.priority === 'high' ? ' [recommended]' : '');
for (const l of lines) {
  p.feed(l + '\n');
  p.drain();
  const s = p.state;
  if (pending && s.lastMessage !== pending.msg && /^Obtained Old Stuff/.test(s.lastMessage)) { console.log('    you took:', s.lastMessage.replace('Obtained Old Stuff: ', '')); pending = null; }
  const open = s.offer ? `${s.offer.kind} at Cell ${s.offer.cell}` : null;
  if (open === prev) continue;
  prev = open;
  if (!open || shown >= max) continue;
  shown++;
  const r = buildView(s).ranking;
  if (!r) { console.log(`\n[run ${s.run} day ${s.day}] ${open} · no suggestions (no run going, or Mistville Intel)`); continue; }
  console.log(`\n[run ${s.run} day ${s.day}] ${open} · coins ${s.coins}${s.intelItem ? ' · Intel gave ' + s.intelItem : ''}`);
  if (r.phaseStrategy) console.log('    ' + r.phaseStrategy);
  if (r.buildSummary) console.log('    builds: ' + r.buildSummary);
  const offer = currentOffer(s);
  const named = (o) => `${o.name || '#' + o.id}${o.price != null ? ' (' + o.price + (o.bought ? ', bought' : '') + ')' : ''}`;
  console.log('    on offer: ' + (offer ? [...offer.relics, ...offer.foods].map(named).join(' · ') : '(not listed in the log yet)'));
  console.log('    ' + (r.kind === 'furnaceUpgrade' ? 'upgrades' : r.kind === 'food' ? 'your food' : 'suggested') + ': ' + r.items.map((x, i) => `${i + 1}. ${x.name}${flag(x)}`).join('  '));
  if (s.offer.kind === 'relic') pending = { msg: s.lastMessage };
}
