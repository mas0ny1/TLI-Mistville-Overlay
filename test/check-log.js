// Replays a UE_game.log through the parser in small chunks and prints what the overlay would know at each day (with
// build progress and advice), the runs it would record, then checks the exit rule (Clock Tower at least 4
// steps from the start) on every board that found it, and what the log-format check counted (whether the card would
// say the log format may have changed, and the Mistville lines it didn't recognise).
//   node test/check-log.js "<path to UE_game.log>"
'use strict';
const fs = require('fs');
const { createParser, formatAlert } = require('../parser');
const { buildView, EXIT_MIN_DISTANCE } = require('../view');

const file = process.argv[2];
if (!file) { console.error('usage: node test/check-log.js <UE_game.log>'); process.exit(1); }
const p = createParser();
const decoder = new TextDecoder('utf-8');
const fd = fs.openSync(file, 'r');
const buf = Buffer.alloc(64 * 1024);
let lastDay = -1, lastRun = -1, boards = 0, lastBoard = null;
const exits = [];
const runs = []; // what the History tab would record: { start, end, maxDay, result, events }
let firstAlert = null; // when the log-format warning would first have shown
const show = (why) => {
  const v = buildView(p.state);
  const f = v.explore;
  console.log(`\n[${why}] run ${p.state.run} day ${v.day} | map ${p.state.map} | sanity ${v.sanity} (peak ${v.sanityPeak}) | coins ${v.coins}`);
  console.log('  old stuff:', v.relics.map((r) => `${r.name} Lv${r.level + 1}${r.archetype ? ' [' + r.archetype + ']' : ' [not in the catalog]'}`).join('; ') || '(none)');
  console.log('  food:', v.items.map((x) => `${x.name} ×${x.uses}${x.archetype ? '' : ' [not in the catalog]'}`).join('; ') || '(none)');
  if (f) {
    console.log('  builds:', f.builds ? f.builds.summary : '-', '|', f.builds && f.builds.advice ? f.builds.advice : 'all done');
    console.log('  budget:', f.tilesLeft != null ? `~${f.tilesLeft} cells left at ${f.exploreCost}` : 'cost unknown', '|', f.clearHint || '', '|', f.dailyTip || '');
    if (f.advice) console.log(`  advice (${f.adviceLevel}): ${f.advice}`);
  }
};
const take = () => {
  for (const e of p.drain()) {
    if (e.type === 'RunStart' || (e.type === 'DayBegin' && !runs.length)) runs.push({ start: e.at, end: null, maxDay: e.day || 0, result: 'ongoing', events: 0 });
    const r = runs[runs.length - 1];
    if (!r) continue;
    r.events++;
    if (e.type === 'DayBegin') r.maxDay = Math.max(r.maxDay, e.day);
    if (e.type === 'RunEnd') { r.end = e.at; r.result = e.result; }
  }
};
let n;
while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
  p.feed(decoder.decode(buf.subarray(0, n), { stream: true }));
  take();
  const s = p.state;
  if (!firstAlert && formatAlert(s)) firstAlert = { run: s.run, day: s.day, alert: formatAlert(s) };
  if (s.board && s.board !== lastBoard) {
    boards++; lastBoard = s.board;
    const start = s.board.find((t) => t.kind === 'start'), exit = s.board.find((t) => t.kind === 'exit');
    if (start && exit) {
      const key = `${s.run}/${s.day}`;
      if (!exits.some((e) => e.key === key)) exits.push({ key, d: Math.abs(start.row - exit.row) + Math.abs(start.col - exit.col), start: [start.row, start.col], exit: [exit.row, exit.col] });
    }
  }
  if (s.run !== lastRun || s.day !== lastDay) { if (lastDay !== -1) show('day changed'); lastRun = s.run; lastDay = s.day; }
}
show('end of log');
const v = buildView(p.state);
if (v.board) {
  console.log('\n  last board (S start, E exit, ? exit candidate, x sealed, . explored, # hidden):');
  for (let r = 0; r < 5; r++) console.log('   ', v.board.slice(r * 5, r * 5 + 5).map((t) => (t.kind === 'start' ? 'S' : t.kind === 'exit' ? 'E' : v.exit.cells.includes(t.index) ? '?' : t.sealed ? 'x' : t.explored ? '.' : '#')).join(' '));
}
console.log(`\nboard snapshots: ${boards}`);
console.log('runs (History):', runs.map((r) => `\n  ${new Date(r.start).toISOString()} · day ${r.maxDay} · ${r.result} · ${r.events} events${r.end ? ' · ' + Math.round((r.end - r.start) / 6e4) + ' min' : ''}`).join('') || 'none');
console.log('exit distance check:', exits.map((e) => `run/day ${e.key}: start ${e.start} exit ${e.exit} = ${e.d}`).join('\n                     '));
const bad = exits.filter((e) => e.d < EXIT_MIN_DISTANCE);
console.log(bad.length ? `RULE BROKEN on ${bad.length} board(s)` : `rule holds on all ${exits.length} boards with a known exit`);
const c = p.state.logCheck;
console.log(`\nlog-format check: ${c.lines} Mistville lines, ${c.unknown} not recognised (${c.lines ? (c.unknown / c.lines * 100).toFixed(2) : 0}%), board opened ${c.boardOpens} times;` +
  ` read ${c.read.day} day, ${c.read.Sanity} Sanity and ${c.read.board} board lines`);
console.log(firstAlert ? `  WOULD WARN "the log format may have changed" from run ${firstAlert.run} day ${firstAlert.day}: ${JSON.stringify(firstAlert.alert)}` : '  no warning: the format looks as expected');
if (c.recent.length) console.log('  last unrecognised lines:\n    ' + c.recent.join('\n    '));
