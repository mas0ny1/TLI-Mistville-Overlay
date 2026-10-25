// Rebuilds advisor/ from the English source app's checkout (after `node scripts/build.js` there): copies its English
// catalog.json and synergy.json (with the overlay's own names and its one change to the early days' order), and writes
// engine.js from the advisor code in its main process (out/main/index.js), word for word. Run it again whenever the
// source changes.
//   node advisor/sync.js <path to the source checkout>
'use strict';
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) { console.error('usage: node advisor/sync.js <path to the source checkout>'); process.exit(1); }
const app = path.join(root, 'app');
const main = fs.readFileSync(path.join(app, 'out', 'main', 'index.js'), 'utf8');

// a piece of the source's main process, from the line starting with `from` to the end of the line starting with `to`
function cut(from, to) {
  const start = main.indexOf('\n' + from);
  if (start < 0) throw new Error(`not found in the source's main process: ${from}`);
  const endLine = main.indexOf('\n' + to, start);
  if (endLine < 0) throw new Error(`not found in the source's main process: ${to}`);
  return main.slice(start + 1, main.indexOf('\n', endLine + 1) + 1);
}

const pieces = [
  cut('const tiles = {', 'const TILE_NAMES$1'), // tile names by tile ID
  cut('function guaranteeOf', '}'), // what each day's board always has
  cut('const version$1 = 1;', 'function toIpcResult').replace(/function toIpcResult[^\n]*\n$/, ''), // weights → gain cards
];
const exported = ['loadCatalog', 'buildNameIndex', 'buildSynergyIndexes', 'evaluateBuilds', 'buildOfferRanking', 'computeBudget',
  'rankValueOptions', 'rankFoodsByTiming', 'familyOf', 'lookupClearCost', 'guaranteeOf', 'GainCardTracker', 'VALUE_WEIGHTS',
  'WARNING_THRESHOLDS', 'TILE_NAMES', 'FREE_CLEAR_FOODS'];

const header = `// The advisor: the Old Stuff ranking (day stages × categories × build groups), Food timing, Alchemy Workshop upgrade
// gain, Sanity warnings, Clock Tower reachability, detours, build progress and gain cards. adapt.js feeds it the
// overlay's state. Written by advisor/sync.js: don't edit it here; sync again instead.
'use strict';
const node_fs = require('fs');
const node_path = require('path');
`;
const body = pieces.join('');
const out = header + body + `module.exports = { ${exported.join(', ')} };\n`;
for (const name of exported) if (!new RegExp(`(function|class|const) ${name.replace('$', '\\$')}\\b`).test(body)) throw new Error(`${name} missing`);

// leave out the source's own name where its data notes mention it ("<name> EN: names are the English client's…"), and
// the overlay's own names for a few things: the Trader build group is "Vendor Items"
const unnamed = (text) => text.replace(/\b[A-Za-z]+ EN: names are/g, 'Names are').replace(/Trader boost/g, 'Vendor Items');
// the overlay's own change to the suggested order: Mr. Misfortune and Baby Bear join days 1-5's Sanity recovery Old
// Stuff, after Ms. Grumpy. Each gives Sanity back for every stele removed, and the early days remove about 3 a day.
const EARLY_SANITY = ['{ "name": "Ms. Grumpy" }, { "name": "Special Protection Pass" } ] }',
  '{ "name": "Ms. Grumpy" }, { "name": "Mr. Misfortune" }, { "name": "Baby Bear" }, { "name": "Special Protection Pass" } ] }'];
function ownOrder(text) {
  const at = text.indexOf(EARLY_SANITY[0]);
  const out = at < 0 ? text : text.slice(0, at) + EARLY_SANITY[1] + text.slice(at + EARLY_SANITY[0].length);
  const early = JSON.parse(out).guide.segments.find((g) => g.fromDay === 1).categories.find((c) => c.label === 'Sanity recovery');
  const names = early ? early.items.map((i) => i.name) : [];
  if (!names.includes('Mr. Misfortune') || !names.includes('Baby Bear')) throw new Error('synergy.json: the early Sanity recovery list has changed in the source; update EARLY_SANITY in sync.js');
  return out;
}
const here = __dirname;
fs.writeFileSync(path.join(here, 'engine.js'), unnamed(out));
fs.writeFileSync(path.join(here, 'catalog.json'), unnamed(fs.readFileSync(path.join(app, 'resource', 'catalog.json'), 'utf8')));
fs.writeFileSync(path.join(here, 'synergy.json'), ownOrder(unnamed(fs.readFileSync(path.join(app, 'resource', 'synergy.json'), 'utf8'))));
console.log(`advisor/: engine.js (${body.split('\n').length} lines), catalog.json, synergy.json`);
