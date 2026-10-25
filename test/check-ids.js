// Checks the Old Stuff and Food names and IDs a UE_game.log shows against the overlay's tables (oldstuff.js, foods.js)
// and the advisor's catalog (advisor/catalog.json), and lists what doesn't match for you to review. It changes nothing.
//   node test/check-ids.js "<UE_game.log>"
// Read from the log: the bag listings (遗物名 … 遗物ID / 道具名 … 道具ID), Old Stuff handed to you (新增遗物) and
// upgraded (遗物升级), and the IDs on offer at Old Stuff Cells, Food Cells and the Trader.
'use strict';
const fs = require('fs');
const path = require('path');
const { createParser } = require('../parser');
const { BY_ID } = require('../oldstuff');
const { FOOD_IDS } = require('../foods');

const file = process.argv[2];
if (!file) { console.error('usage: node test/check-ids.js <UE_game.log>'); process.exit(1); }
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'advisor', 'catalog.json'), 'utf8'));
const catRelic = new Map(catalog.relics.map((r) => [r.name, r]));
const catFood = new Map(catalog.foods.map((f) => [f.name, f]));

// name -> Set of IDs, and ID -> Set of names, as the log shows them
const seen = { relic: new Map(), food: new Map() }, byId = { relic: new Map(), food: new Map() };
const add = (kind, name, id) => {
  name = name.trim();
  (seen[kind].get(name) || seen[kind].set(name, new Set()).get(name)).add(id);
  (byId[kind].get(id) || byId[kind].set(id, new Set()).get(id)).add(name);
};
const offered = { relic: new Set(), food: new Set() };
const p = createParser();
let lastBoard = null;
for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
  const line = raw.replace(/\r$/, '');
  let m;
  if ((m = /遗物名:(.+?) 遗物ID(\d+)/.exec(line))) add('relic', m[1], +m[2]);
  if ((m = /道具名:(.+?) 道具ID(\d+)/.exec(line))) add('food', m[1], +m[2]);
  p.feed(raw + '\n');
  p.drain();
  const b = p.state.board;
  if (b && b !== lastBoard) {
    lastBoard = b;
    for (const t of b) if (t.offer) { t.offer.relics.forEach((o) => o.id != null && offered.relic.add(o.id)); t.offer.items.forEach((o) => o.id != null && offered.food.add(o.id)); }
  }
}

const problems = [];
const report = (title, rows) => { if (rows.length) { problems.push(title); console.log(`\n${title} (${rows.length})`); rows.forEach((r) => console.log('  ' + r)); } };
const ids = (set) => [...set].sort((a, b) => a - b).join(', ');
const odd = (name) => /[’‘“”]/.test(name) || name !== name.trim();

console.log(`${path.basename(file)}: ${seen.relic.size} Old Stuff and ${seen.food.size} Food names with IDs; ${offered.relic.size} Old Stuff and ${offered.food.size} Food IDs on offer`);

// Old Stuff
report('Old Stuff the log names differently from oldstuff.js (same ID)', [...byId.relic].filter(([id, n]) => BY_ID.has(id) && !n.has(BY_ID.get(id).name))
  .map(([id, n]) => `ID ${id}: log "${[...n].join('" / "')}", oldstuff.js "${BY_ID.get(id).name}"`));
report('Old Stuff IDs not in oldstuff.js (learned from the bag at run time)', [...byId.relic].filter(([id]) => !BY_ID.has(id)).map(([id, n]) => `ID ${id}: "${[...n].join('" / "')}"`));
report('Old Stuff names the catalog doesn\'t have (the advisor won\'t recognise them)', [...seen.relic.keys()].filter((n) => !catRelic.has(n)).map((n) => `"${n}" (ID ${ids(seen.relic.get(n))})`));
report('Old Stuff whose ID differs from the catalog', [...seen.relic].filter(([n, s]) => catRelic.has(n) && catRelic.get(n).id != null && !s.has(catRelic.get(n).id))
  .map(([n, s]) => `"${n}": log ID ${ids(s)}, catalog ID ${catRelic.get(n).id}`));
const catNoId = [...seen.relic].filter(([n]) => catRelic.has(n) && catRelic.get(n).id == null).map(([n, s]) => `"${n}": log ID ${ids(s)}`);
if (catNoId.length) console.log(`\nOld Stuff the catalog has no ID for; the log confirms the name (${catNoId.length})\n  ${catNoId.join('\n  ')}`);

// Food
report('Food the log names differently from foods.js (same ID)', [...byId.food].filter(([id, n]) => FOOD_IDS[id] && !n.has(FOOD_IDS[id]))
  .map(([id, n]) => `ID ${id}: log "${[...n].join('" / "')}", foods.js "${FOOD_IDS[id]}"`));
report('Food IDs not in foods.js (worth adding there)', [...byId.food].filter(([id]) => !FOOD_IDS[id]).map(([id, n]) => `ID ${id}: "${[...n].join('" / "')}"`));
report('Food names the catalog doesn\'t have (the advisor won\'t recognise them)', [...seen.food.keys()].filter((n) => !catFood.has(n)).map((n) => `"${n}" (ID ${ids(seen.food.get(n))})`));
report('Food whose ID differs from the catalog', [...seen.food].filter(([n, s]) => catFood.has(n) && catFood.get(n).id != null && !s.has(catFood.get(n).id))
  .map(([n, s]) => `"${n}": log ID ${ids(s)}, catalog ID ${catFood.get(n).id}`));

// names with characters the advisor compares exactly (a curly apostrophe won't match the catalog's straight one)
report('Names with curly quotes or spaces at the ends', [...seen.relic.keys(), ...seen.food.keys()].filter(odd).map((n) => JSON.stringify(n)));

// offers name things only by ID
const knownRelic = (id) => BY_ID.has(id) || byId.relic.has(id);
const knownFood = (id) => FOOD_IDS[id] || byId.food.has(id);
report('Old Stuff offered that the overlay can\'t name (no ID match)', [...offered.relic].filter((id) => !knownRelic(id)).map((id) => `ID ${id}`));
report('Food offered that the overlay can\'t name (no ID match)', [...offered.food].filter((id) => !knownFood(id)).map((id) => `ID ${id}`));

// what this log couldn't confirm
const unseenRelic = catalog.relics.filter((r) => !seen.relic.has(r.name)).map((r) => r.name);
const unseenFood = catalog.foods.filter((f) => !seen.food.has(f.name)).map((f) => f.name);
console.log(`\nNot in this log, so not confirmed: ${unseenRelic.length} Old Stuff, ${unseenFood.length} Food`);
console.log(`  Food: ${unseenFood.join(', ')}`);
console.log(problems.length ? `\n${problems.length} thing(s) to review above.` : '\nEverything this log shows matches.');
process.exit(problems.length ? 1 : 0);
