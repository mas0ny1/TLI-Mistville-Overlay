// Checks the advisor part of the overlay without a log:
//   - advisor/ is what advisor/sync.js makes from the source checkout (when you give its path)
//   - the advisor's loader accepts its catalog without a warning; the overlay's Old Stuff and Food names are in it
//   - the overlay's Cell names cover every tile the advice looks at
//   - parser events reach the history (once per run, even when the log is read again) and the gain cards
//   - the result screen ends a run when you leave Mistville or start another, not when a new day follows it; a run
//     the log picks up mid-way (the game restarted during it) still ends
//   - an offer (pick, Trader, upgrade, Food pick) opens when the log says and stays until you get something or a new day;
//     at a Trader, a refresh shows once the log pauses and buying keeps it open until you leave
//   - days 1-5 rank Mr. Misfortune and Baby Bear with the early Sanity recovery Old Stuff
//   - the card's suggestions are the advisor's top six for the offer and nothing else; offers are still read (offers.js)
//   - the Settings page: one changed field takes effect over the defaults; the Bank default shown is the one used
//   - the log-format warning: quiet on a normal log (with a real client's other debug lines mixed in), up when many
//     Mistville lines aren't recognised or the day / Sanity lines can't be read, and nothing counted outside Mistville
//   - a new day doesn't warn from yesterday's Sanity; suggestions actually on offer are marked
//   - each build says what it still needs (Key and Important pieces marked), the closest build is marked, and days
//     1-5 without a Coin source say so
//   - the Sanity bar: a new day's recovery, Sanatoriums still to use, and how full the next floor starts if you head
//     out now
//   - the run history keeps what an analysis needs (boards, offers, suggestions, fights, costs, a copy of the log
//     lines that parses back to the same run), and older logs are read into it once
//   - no code file names the app the advisor comes from
//   node test/check-advisor.js [path to the source checkout]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = path.join(__dirname, '..', 'advisor');
let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };
const section = (title, fn) => { const before = failures; fn(); console.log(`${failures === before ? '✓' : '✗'} ${title}`); };
const asyncSection = async (title, fn) => { const before = failures; await fn(); console.log(`${failures === before ? '✓' : '✗'} ${title}`); };

const sourceDir = process.argv[2];
section(sourceDir ? 'advisor/ matches the source' : 'advisor/ vs the source: skipped (no path given)', () => {
  if (!sourceDir) return;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mist-advisor-'));
  try {
    fs.mkdirSync(path.join(tmp, 'advisor'));
    fs.copyFileSync(path.join(HERE, 'sync.js'), path.join(tmp, 'advisor', 'sync.js'));
    execFileSync(process.execPath, [path.join(tmp, 'advisor', 'sync.js'), path.resolve(sourceDir)], { stdio: 'pipe' });
    for (const f of ['engine.js', 'catalog.json', 'synergy.json']) {
      if (!fs.readFileSync(path.join(tmp, 'advisor', f)).equals(fs.readFileSync(path.join(HERE, f)))) fail(`${f} differs: run node advisor/sync.js ${sourceDir}`);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

const engine = require('../advisor/engine');
const adapt = require('../advisor/adapt');
const { ITEMS } = require('../oldstuff');
const { FOOD_IDS } = require('../foods');

section('the advisor loads its catalog; the overlay\'s names are in it', () => {
  const { catalog, warnings } = engine.loadCatalog(HERE);
  if (!catalog) return fail('no catalog');
  warnings.forEach((w) => fail('the catalog loader: ' + w));
  const relics = new Map(catalog.relics.map((r) => [r.name, r]));
  const foods = new Set(catalog.foods.map((f) => f.name));
  for (const x of ITEMS) {
    if (!relics.has(x.name)) fail(`oldstuff.js "${x.name}" is not in the catalog`);
    else if (relics.get(x.name).id != null && x.id != null && relics.get(x.name).id !== x.id) console.log(`  · ${x.name}: oldstuff.js ID ${x.id}, the catalog ${relics.get(x.name).id} (a known, unconfirmed ID conflict)`);
  }
  for (const n of new Set(Object.values(FOOD_IDS))) if (!foods.has(n)) fail(`foods.js "${n}" is not in the catalog`);
});

section('every tile the advice looks at has an overlay Cell name', () => {
  // the advisor compares these tile names in code: the start, the Clock Tower, Sanatoriums, Banks and the steles
  const needed = ['Bench', 'Clock Tower', 'Sanatorium', 'Bank', 'Stele · Blindness', 'Stele · Anxiety', 'Stele · Poverty', 'Stele · Anorexia'];
  const named = { 'Place of Awakening': 'start', 'Clock Tower': 'exit', Sanatorium: '', Bank: '', 'Bad Omen Stele - Blindness': '', 'Bad Omen Stele - Anxiety': '', 'Bad Omen Stele - Poverty': '', 'Bad Omen Stele - Anorexia': '' };
  const got = Object.entries(named).map(([name, kind]) => engine.TILE_NAMES[String(adapt.tileIdOf({ name, kind, explored: true }))]);
  needed.forEach((n) => got.includes(n) || fail(`no overlay Cell becomes the advisor's "${n}"`));
});

section('parser events reach the history once per run, and the gain cards', () => {
  const { createParser } = require('../parser');
  const { createHistory } = require('../history');
  // a few lines in the log's format (reference: the parser's header)
  const T = (s) => `[2026.10.23-05.${s}:000][  0]`;
  const lines = [T('00.00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', T('00.01') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:1', '当前层数:1',
    '属性名:1.理智 变化值:120', T('00.02') + '[Game] S6GMMgr:PushLog AreaMazeChange Id:2', '新增遗物:', '遗物名:Baby Bear 遗物ID66', '遗物背包变化:', '遗物序号:0等级:0 遗物名:Baby Bear 遗物ID66',
    T('00.03') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:3', '当前层数:2', '属性名:1.理智 变化值:0', T('00.04') + '[Game] x'].join('\n') + '\n';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mist-hist-'));
  try {
    const history = createHistory(tmp);
    const gain = adapt.gainTracker();
    let card = null;
    for (let pass = 0; pass < 2; pass++) { // the overlay reads the whole log again each time it starts
      const p = createParser();
      p.feed(lines);
      for (const e of p.drain()) { history.record(e); gain.apply(e); if (e.type === 'RelicGained') card = gain.current; }
      history.close();
    }
    const runs = history.list();
    if (runs.length !== 1) fail(`${runs.length} runs recorded, expected 1`);
    const r = runs[0] || {};
    if (r.maxDay !== 2 || r.result !== 'fail') fail(`run summary: day ${r.maxDay}, ${r.result}`);
    const types = (history.detail(r.runId) || { events: [] }).events.map((e) => e.type);
    const want = ['RunStart', 'DayBegin', 'AttrChanged', 'RelicGained', 'RelicBagUpdated', 'DayBegin', 'AttrChanged', 'RunEnd'];
    if (types.join() !== want.join()) fail(`events: ${types.join(', ')}`);
    if (!card || card.name !== 'Baby Bear' || !/Sanity/.test(card.effect)) fail('gain card for Baby Bear');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

section('the result screen ends a run (the third end-of-run signal)', () => {
  const { createParser } = require('../parser');
  const T = (s) => `[2026.10.23-06.${s}:000][  0]`;
  const start = [T('00.00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', T('00.01') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:1', '当前层数:1', '属性名:1.理智 变化值:90'];
  const result = T('05.00') + '[UI] OpenView S6Result';
  const ends = (after) => {
    const p = createParser();
    p.feed(start.concat(result, after, T('09.59') + '[Game] x').join('\n') + '\n');
    return p.drain().filter((e) => e.type === 'RunEnd' || e.type === 'RunStart').map((e) => e.type === 'RunEnd' ? `${e.result}@${new Date(e.at).toISOString().slice(11, 19)}` : 'start').join(' ');
  };
  const cases = [
    ['back to town', [T('06.00') + 'LogLoad: LoadMap: /Game/Art/Maps/Town/Town'], 'start win@06:05:00'],
    ['a new day after it', [T('06.00') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:2', '当前层数:2'], 'start'],
    ['Sanity 0 after it', [T('06.00') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:2', '属性名:1.理智 变化值:0'], 'start fail@06:06:00'],
  ];
  for (const [what, after, want] of cases) { const got = ends(after); if (got !== want) fail(`${what}: ${got || 'nothing'}, expected ${want}`); }
  // a log that begins mid-run (the game restarted during it): the run still ends, and the history keeps its result
  const p = createParser();
  p.feed([T('00.00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', T('00.01') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:1', '当前层数:3',
    T('01.00') + '[Game] S6GMMgr:PushLog AreaMazeChange Id:2', '属性名:1.理智 变化值:0', T('09.59') + '[Game] x'].join('\n') + '\n');
  const mid = p.drain();
  const end = mid.find((e) => e.type === 'RunEnd');
  if (!end || end.result !== 'fail' || mid.some((e) => e.type === 'RunStart')) fail('a run picked up mid-way: ' + mid.filter((e) => /^Run/.test(e.type)).map((e) => e.type + ' ' + (e.result || '')).join(', '));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mist-mid-')), w = require('../history').createHistory(dir).writer();
  for (const e of mid) w.record(e);
  w.close();
  const listed = require('../history').createHistory(dir).list();
  if (listed.length !== 1 || listed[0].result !== 'fail' || listed[0].maxDay !== 3) fail('a run picked up mid-way in the history: ' + JSON.stringify(listed));
  fs.rmSync(dir, { recursive: true, force: true });
});

// an overlay game state (the parser's shape) on day `day`: the start in the middle, the Clock Tower previewed in a corner
function overlayState(day, extra) {
  const board = Array.from({ length: 25 }, (_, i) => ({ index: i, row: Math.floor(i / 5), col: i % 5, kind: 'hidden', name: '', explored: false, preview: false,
    sealed: false, reachable: [7, 11, 13, 17].includes(i), cost: [7, 11, 13, 17].includes(i) ? 5 : 0, offer: null }));
  Object.assign(board[12], { kind: 'start', name: 'Place of Awakening', explored: true });
  Object.assign(board[0], { kind: 'exit', name: 'Clock Tower', preview: true });
  return Object.assign({ run: 1, day, sanity: 40, maxSanity: 100, coins: 120, ended: null, exploreCost: 5, daily: { sanatorium: 0, bank: 0, stone: 0 },
    relics: [{ id: 66, name: 'Baby Bear', level: 0 }, { id: 31, name: 'Guild Medal - Old Stuff', level: 1 }], items: [{ id: 22, name: 'Golden Worm Cheese', uses: 1 }],
    board, relicIds: {}, foodIds: Object.assign({}, FOOD_IDS) }, extra);
}

section('an offer opens when the log says, and stays until you get something or a new day', () => {
  const { createParser } = require('../parser');
  const T = (t) => `[2026.10.23-08.${t}:000][  0]`;
  const G = (t, msg) => T(t) + 'TLLua: Display: [Game] ' + msg;
  const p = createParser();
  const feed = (lines) => p.feed(lines.join('\n') + '\n');
  const open = () => (p.state.offer ? `${p.state.offer.kind}@${p.state.offer.cell}` : 'none');
  feed([T('00.00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', G('00.01', 'S6GMMgr:PushLog AreaDungeonData Id:1'), '当前层数:1']);
  const cases = [
    ['stepping on the Trader', [G('01.00', 'S6GMMgr:PushLog AreaClick Id:2'), '点击：Tile 索引：12', G('01.01', 'S6GMMgr:PushLog AreaDoInteraction Id:3'), '商店'], 'shop@12'],
    ['its screen opening and closing', [G('01.02', 'S6Shop Run'), G('01.03', 'S6Shop Destory')], 'shop@12'],
    ['buying something (the bag is listed)', [G('01.04', 'S6GMMgr:PushLog AreaMazeChange Id:4'), '遗物背包变化:', '遗物序号:0等级:0 遗物名:Baby Bear 遗物ID66', G('01.05', 'S6Maze Run')], 'none'],
    ['using a Food that upgrades Old Stuff', [G('02.00', 'S6GMMgr:PushLog AreaDoInteraction Id:5'), '道具功能：遗物升级'], 'furnaceUpgrade@12'],
    ['a new day', [G('03.00', 'S6GMMgr:PushLog AreaDungeonData Id:6'), '当前层数:2'], 'none'],
    ['an Old Stuff pick from its screen alone', [G('04.00', 'S6GMMgr:PushLog AreaInteractTile Id:7'), '交互地块 7', G('04.01', 'S6ChooseRelic Run')], 'relic@7'],
    ['taking one', [G('04.02', 'S6GMMgr:PushLog AreaMazeChange Id:8'), '新增遗物:', '遗物名:Beak Mask 遗物ID11', G('04.03', 'S6ChooseRelic Destory')], 'none'],
  ];
  for (const [what, lines, want] of cases) { feed(lines); if (open() !== want) fail(`${what}: ${open()}, expected ${want}`); }
  const opened = p.drain().filter((e) => e.type === 'OfferOpened').map((e) => e.kind).join();
  if (opened !== 'shop,furnaceUpgrade,relic') fail(`offers opened: ${opened} (once each)`);
});

section('the card\'s suggestions are the advisor\'s top six for the offer, and nothing else', () => {
  const { catalog } = adapt;
  for (const day of [2, 7, 13]) {
    for (const kind of ['relic', 'shop', 'furnaceUpgrade', 'food']) {
      const s = overlayState(day, { offer: { kind, cell: 7 }, lastTile: 7 });
      s.board[7].offer = { relics: [{ id: 43, price: 90, bought: false }], items: [{ id: 22, price: 30, bought: false }] }; // what the log listed
      const r = adapt.ranking(s);
      const want = engine.buildOfferRanking(adapt.gameState(s), catalog, kind).items.slice(0, 6);
      if (!r || Object.keys(r).sort().join() !== 'best,buildSummary,items,kind,phaseStrategy') { fail(`day ${day} ${kind}: ${r ? Object.keys(r).join(', ') : 'nothing'}`); continue; }
      const shape = (x) => [x.name, x.priority ?? null, x.familyNote ?? x.reason].join('|');
      if (r.items.map((x) => [x.name, x.priority ?? null, x.note].join('|')).join() !== want.map(shape).join()) fail(`day ${day} ${kind}: not the advisor's order`);
    }
  }
  if (adapt.ranking(overlayState(1, { offer: { kind: 'intel', cell: null } })) !== null) fail('Mistville Intel has a list (the advisor has none)');
  // offers are still read and named, for later: an Old Stuff by oldstuff.js, a Food by foods.js
  const { currentOffer } = require('../offers');
  const s = overlayState(5, { offer: { kind: 'shop', cell: 7 }, lastTile: 7 });
  s.board[7].offer = { relics: [{ id: 43, price: 90, bought: false }, { id: 999, price: 50, bought: true }], items: [{ id: 22, price: 30, bought: false }] };
  const o = currentOffer(s);
  const want = `${ITEMS.find((x) => x.id === 43).name} 90,#999 50 bought|Golden Worm Cheese 30`;
  const got = o && [o.relics, o.foods].map((l) => l.map((x) => `${x.name || '#' + x.id} ${x.price}${x.bought ? ' bought' : ''}`).join()).join('|');
  if (got !== want) fail(`offer read as ${got}, expected ${want}`);
  if (currentOffer(overlayState(5, { offer: null, lastTile: 7 })) !== null) fail('an offer with none open');
});

section('the Settings page: one changed field takes effect; the Bank default shown is the one used', () => {
  const s = overlayState(3); // odd day, Clock Tower found but not reached, 40 Sanity
  const hint = (pol) => engine.computeBudget(adapt.gameState(s), pol, adapt.catalog).bufferHint;
  if (hint(adapt.policy(null)) !== null) fail('odd-day reminder at 40 Sanity with the default reserve (30)');
  const pol = adapt.policy({ weights: { buffer: { reserveSanity: 45 } } });
  if (!/45/.test(hint(pol) || '')) fail('a saved odd-day reserve of 45 has no effect');
  const d = engine.VALUE_WEIGHTS;
  if (pol.weights.remainingDaysTotal !== d.remainingDaysTotal || pol.weights.situational !== d.situational || pol.weights.detourRoi !== d.detourRoi) fail('the other weights don\'t keep the defaults');
  if (adapt.defaults().weights.detourRoi.bankGold !== 80) fail(`Bank default ${adapt.defaults().weights.detourRoi.bankGold}, the one used is 80`);
  const page = fs.readFileSync(path.join(__dirname, '..', 'overlay', 'window.js'), 'utf8');
  if (!page.includes("'default ' + dw.detourRoi.bankGold")) fail('the Settings page doesn\'t take the Bank default from the advisor');
});

section('the log-format warning ("the log format may have changed")', () => {
  const { createParser, formatAlert } = require('../parser');
  // a few Mistville days in the log's format: day and Sanity lines, the board opening, a 25-Cell board dump
  const mistLog = ({ days = 3, day = (d) => `当前层数:${d}`, sanity = (v) => `属性名:1.理智 变化值:${v}`, extraS6 = 0, noise = [], map = 'Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02' }) => {
    let t = 0;
    const T = () => { const x = t++; const two = (n) => String(n).padStart(2, '0'); return `[2026.10.23-${two(7 + Math.floor(x / 3600))}.${two(Math.floor(x / 60) % 60)}.${two(x % 60)}:000][  0]`; };
    const G = (msg) => T() + 'TLLua: Display: [Game] ' + msg;
    const out = [T() + 'LogLoad: LoadMap: /Game/Art/' + map];
    let n = 0;
    const mix = () => { for (let i = 0; i < 3 && noise.length; i++) out.push(T() + noise[n++ % noise.length]); };
    for (let d = 1; d <= days; d++) {
      out.push(G('S6GMMgr:PushLog AreaDungeonData Id:' + d), day(d), '当前地牢ID:3', '基础探索理智消耗:5');
      mix();
      out.push(G('S6GMMgr:PushLog AreaMazeChange Id:' + (100 + d)), '属性变化:', sanity(120 - d * 10), '属性名:3.金币 变化值:50');
      out.push(G('S6Maze Run'));
      for (let i = 1; i <= 25; i++) {
        out.push(G('S6GamePlay uiindex = ' + i), G(''), '+Base+Name [' + (i === 13 ? 'Place of Awakening' : '') + ']', '+IsExplored [' + (i === 13) + ']', '+IsPreview [false]',
          '+TileType [' + (i === 13 ? 1 : 0) + ']', G(''), '+bBlock [false]', '+Status [' + ([8, 12, 14, 18].includes(i) ? 1 : 0) + ']', '+Cost [5]', '+bDone [false]');
        if (i % 5 === 0) mix();
      }
      for (let k = 0; k < extraS6; k++) out.push(G('S6MazeV2 TileState = ' + k));
      out.push(G('S6Maze Destory'));
      mix();
    }
    return out.join('\n') + '\n';
  };
  const read = (text) => { const p = createParser(); p.feed(text); return p.state; };
  // the other debug lines the game writes: 94 different ones from a current English client's log (music, fights, UI,
  // another season's screens), without their timestamps
  const noise = require('./client-lines.json');

  const normal = read(mistLog({ noise }));
  const c = normal.logCheck;
  if (formatAlert(normal)) fail(`a normal log warns: ${JSON.stringify(formatAlert(normal))}`);
  if (c.lines < 500 || c.unknown || c.boardOpens !== 3 || !c.read.day || !c.read.Sanity || !c.read.board) fail(`a normal log counted ${JSON.stringify(c)}`);

  if (formatAlert(read(mistLog({ days: 1, extraS6: 40 })))) fail('warns before 500 Mistville lines');
  const changed = formatAlert(read(mistLog({ extraS6: 40, noise })));
  if (!changed || !(changed.ratio >= 0.05) || changed.unknown !== 120) fail(`many unrecognised Mistville lines: ${JSON.stringify(changed)}`);

  const renamed = formatAlert(read(mistLog({ day: (d) => `当前天数:${d}`, sanity: (v) => `属性ID:1 理智 ${v}` })));
  if (!renamed || (renamed.missing || []).join() !== 'day,Sanity') fail(`day and Sanity lines renamed: ${JSON.stringify(renamed)}`);

  const town = read(mistLog({ map: 'Maps/Town/Town', extraS6: 300 }));
  if (town.logCheck.lines || formatAlert(town)) fail(`counted outside Mistville: ${JSON.stringify(town.logCheck)}`);
});

section('no code file names the app the advisor comes from', () => {
  const name = new RegExp(['fog', 'light'].join(''), 'i'); // spelt in parts so this file doesn't name it either
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' || e.name.startsWith('.') ? []
    : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const file of walk(path.join(__dirname, '..')).filter((f) => /\.(js|json|html|css|bat)$/.test(f))) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => { if (name.test(line)) fail(`${path.relative(path.join(__dirname, '..'), file)}:${i + 1}`); });
  }
});

section('a new day doesn\'t warn from yesterday\'s Sanity; suggestions on offer are marked', () => {
  const { createParser } = require('../parser');
  const T = (t) => `[2026.10.23-09.${t}:000][  0]`;
  const p = createParser();
  p.feed([T('00.00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', T('00.01') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:1', '当前层数:1', T('00.02') + '[Game] x'].join('\n') + '\n');
  // a run starts from what every run starts with, until the log says
  const st = p.state;
  if (st.sanity !== 120 || st.maxSanity !== 120 || st.coins !== 200 || st.foodSlots !== 4 || !st.sanityRead) fail(`a new run starts at ${[st.sanity, st.maxSanity, st.coins, st.foodSlots, st.sanityRead]}`);
  p.feed([T('00.03') + '[Game] S6GMMgr:PushLog AreaMazeChange Id:2', '属性名:1.理智 变化值:79', T('00.04') + '[Game] x'].join('\n') + '\n');
  const read = [p.state.sanityRead];
  p.feed([T('01.00') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:3', '当前层数:2', T('01.01') + '[Game] x'].join('\n') + '\n');
  read.push(p.state.sanityRead);
  p.feed([T('01.02') + '[Game] S6GMMgr:PushLog AreaMazeChange Id:4', '属性名:1.理智 变化值:120', T('01.03') + '[Game] x'].join('\n') + '\n');
  read.push(p.state.sanityRead);
  if (read.join() !== 'true,false,true') fail(`Sanity read through a day change: ${read.join()}`);
  const low = (sanityRead) => {
    const s = overlayState(5, { sanity: 10, sanityRead });
    Object.assign(s.board[0], { kind: 'hidden', name: '', preview: false }); // the Clock Tower not found yet: a warning can show
    return adapt.exploring(s);
  };
  if (low(false).warning || !low(false).sanityPending) fail('warns before today\'s Sanity is read');
  if (!low(true).warning || low(true).warning.level !== 'red') fail('no warning once today\'s Sanity is read');

  // at a pick or the Trader, the suggestions actually on offer are marked (the order doesn't change)
  for (const kind of ['relic', 'shop']) {
    const s = overlayState(2, { offer: { kind, cell: 7 }, lastTile: 7 });
    const top = adapt.ranking(s).items[0].name;
    const id = (ITEMS.find((x) => x.name === top) || {}).id;
    s.board[7].offer = { relics: [{ id, price: kind === 'shop' ? 200 : null, bought: false }], items: [] };
    const r = adapt.ranking(s);
    const marked = r.items.filter((x) => x.offered).map((x) => x.name + (x.offered.price != null ? ' ' + x.offered.price : ''));
    if (r.items[0].name !== top || marked.join() !== top + (kind === 'shop' ? ' 200' : '')) fail(`${kind}: marked ${marked.join() || 'nothing'}, expected ${top}`);
  }
  // none of the six on offer: the highest of what is, with its place in the order
  const pick = overlayState(2, { offer: { kind: 'relic', cell: 7 }, lastTile: 7 });
  const order = engine.buildOfferRanking(adapt.gameState(pick), adapt.catalog, 'relic').items.map((x) => x.name);
  const idOf = (name) => (ITEMS.find((x) => x.name === name) || {}).id;
  pick.board[7].offer = { relics: [order[11], order[8]].map((name) => ({ id: idOf(name), price: null, bought: false })), items: [] };
  const best = adapt.ranking(pick).best;
  if (!best || best.name !== order[8] || best.rank !== 9 || !best.offered) fail(`best of the offer: ${JSON.stringify(best)}, expected ${order[8]} at 9`);
  pick.board[7].offer.relics.push({ id: idOf(order[2]), price: null, bought: false });
  if (adapt.ranking(pick).best !== null) fail('a best of the offer though one of the six is on offer');
  const food = overlayState(2, { offer: { kind: 'food', cell: 7 }, lastTile: 7 });
  food.board[7].offer = { relics: [], items: [{ id: 22, price: null, bought: false }] };
  if (adapt.ranking(food).items.some((x) => x.offered)) fail('a Food pick marks your own Food as on offer');
});

section('what a pick offers is found when the log names its Cell late, or draws the board again without it', () => {
  const { createParser } = require('../parser');
  const { currentOffer } = require('../offers');
  const T = (t) => `[2026.10.23-12.00.${t}:000][  0]`;
  const G = (t, msg) => T(t) + 'TLLua: Display: [Game] ' + msg;
  // a board: the start in the middle, and Cell 7 as the given name, with what it offers (none: not listed)
  const board = (t, name, offered) => {
    const out = [];
    for (let i = 1; i <= 25; i++) {
      out.push(G(t, 'S6GamePlay uiindex = ' + i), G(t, ''));
      if (i === 13) out.push('+Base+Name [Place of Awakening]', '+IsExplored [true]', '+TileType [1]');
      else if (i === 8) out.push('+Base+Name [' + name + ']', '+IsExplored [true]', '+TileType [' + (name === 'Clearing' ? 98 : 3) + ']', ...offered.map((id, n) => `+Detail+RelicList+${n + 1} [${id}]`));
      else out.push('+Base+Name []', '+IsExplored [false]', '+TileType [0]');
      out.push(G(t, ''), '+bBlock [false]', '+Status [0]', '+Cost [4]');
    }
    return out;
  };
  const p = createParser();
  const feed = (lines) => p.feed(lines.join('\n') + '\n');
  const offered = () => { const o = currentOffer(p.state); return o ? o.relics.map((x) => x.id).join('/') + '@' + o.cell : 'none'; };
  feed([T('00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', G('01', 'S6GMMgr:PushLog AreaDungeonData Id:1'), '当前层数:1', ...board('02', 'Unknown Old Stuff', [43, 44])]);
  const steps = [
    ['the pick opening before the log names its Cell', [G('03', 'S6GMMgr:PushLog AreaDoInteraction Id:2'), '选择遗物'], 'none'],
    ['then the Cell named', [G('04', 'S6GMMgr:PushLog AreaInteractTile Id:3'), '交互地块 7'], '43/44@7'],
    ['the board drawn again without what the Cell offers', [...board('05', 'Unknown Old Stuff', []), G('06', 'x')], '43/44@7'],
    ['the Cell used (a Clearing now)', [...board('07', 'Clearing', []), G('08', 'x')], 'none'],
  ];
  for (const [what, lines, want] of steps) { feed(lines); if (offered() !== want) fail(`${what}: ${offered()}, expected ${want}`); }
});

section('at a Trader: its stock shows once the log pauses (a refresh), and buying keeps it open until you leave', () => {
  const { createParser } = require('../parser');
  const { currentOffer } = require('../offers');
  const T = (t) => `[2026.10.23-13.00.${t}:000][  0]`;
  const G = (t, msg) => T(t) + 'TLLua: Display: [Game] ' + msg;
  // a board with the Trader on Cell 7 selling the given Old Stuff: [id, price, bought]; Cells `from` to `upto` only
  const board = (t, stock, upto = 25, from = 1) => {
    const out = [];
    for (let i = from; i <= upto; i++) {
      out.push(G(t, 'S6GamePlay uiindex = ' + i), G(t, ''));
      if (i === 13) out.push('+Base+Name [Place of Awakening]', '+IsExplored [true]', '+TileType [1]');
      else if (i === 8) {
        out.push('+Base+Name [Mistville Trader]', '+IsExplored [true]', '+TileType [5]');
        stock.forEach(([id, price, bought], n) => out.push((n ? '|      |         +' : '+Detail+RelicList+') + (n + 1) + '+BeBuy [' + !!bought + ']', '|      |         | +Price [' + price + ']', '|      |         | +Id [' + id + ']'));
      } else out.push('+Base+Name []', '+IsExplored [false]', '+TileType [0]');
      out.push(G(t, ''), '+bBlock [false]', '+Status [0]', '+Cost [4]');
    }
    return out;
  };
  const p = createParser();
  const feed = (lines) => p.feed(lines.join('\n') + '\n');
  const shown = () => { const o = p.state.offer && currentOffer(p.state); return !p.state.offer ? 'closed' : o ? o.relics.map((x) => x.name + (x.bought ? ' (bought)' : '')).join(', ') : 'open, nothing listed'; };
  feed([T('00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', G('01', 'S6GMMgr:PushLog AreaDungeonData Id:1'), '当前层数:2',
    ...board('02', [[20, 70], [63, 250]]), G('03', 'S6GMMgr:PushLog AreaInteractTile Id:2'), '交互地块 7', G('04', 'S6Shop Run'), G('04', 'S6GMMgr:PushLog AreaDoInteraction Id:3'), '商店 Id = 7000 FunctionId = 700']);
  const steps = [
    ['the Trader open', [], 'Shopping List, Watchful Purse'],
    ['a refresh, the log not yet paused', [G('05', 'S6GMMgr:PushLog AreaInteractTile Id:4'), '交互地块 7 1', ...board('05', [[47, 300], [20, 70]])], 'Shopping List, Watchful Purse'],
    ['the log pauses', 'settle', "Filth Eater's Wages, Shopping List"],
    ['buying one: it\'s handed over and the bag listed', [G('06', 'S6GMMgr:PushLog AreaInteractTile Id:5'), '交互地块 7 0 9', G('06', 'S6GMMgr:PushLog AreaMazeChange Id:6'), '新增遗物:', "遗物名:Filth Eater's Wages 遗物ID47", '遗物背包变化:', "遗物序号:0等级:0 遗物名:Filth Eater's Wages 遗物ID47"], "Filth Eater's Wages, Shopping List"],
    ['a pause: the bag listing the log stopped on is taken', 'settle', "Filth Eater's Wages, Shopping List", () => p.state.relics.map((r) => r.name).join() === "Filth Eater's Wages"],
    ['the board drawn again, then a pause', [...board('07', [[47, 300, true], [20, 70]])], "Filth Eater's Wages, Shopping List"],
    ['', 'settle', "Filth Eater's Wages (bought), Shopping List"],
    ['half a board, then a pause: it waits for the rest', [...board('08', [[63, 250], [20, 70]], 10)], "Filth Eater's Wages (bought), Shopping List"],
    ['', 'settle', "Filth Eater's Wages (bought), Shopping List"],
    ['the rest of it', [...board('08', [[63, 250], [20, 70]], 25, 11), G('08', 'x')], 'Watchful Purse, Shopping List'],
    ['leaving the Trader', [G('09', 'S6Shop Destory')], 'closed'],
  ];
  for (const [what, lines, want, check] of steps) {
    if (lines === 'settle') p.settle(); else feed(lines);
    if (shown() !== want) fail(`${what || 'then'}: ${shown()}, expected ${want}`);
    if (check && !check()) fail(`${what}: the bag is ${p.state.relics.map((r) => r.name).join() || 'empty'}`);
  }
  // leaving a Trader without buying keeps the suggestions, as before; taking a pick ends them, as before
  feed([G('10', 'S6GMMgr:PushLog AreaInteractTile Id:7'), '交互地块 7', G('10', 'S6Shop Run'), G('11', 'S6Shop Destory')]);
  if (!p.state.offer || p.state.offer.kind !== 'shop') fail('leaving a Trader without buying closed its suggestions');
  feed([G('12', 'S6GMMgr:PushLog AreaInteractTile Id:8'), '交互地块 3', G('12', 'S6ChooseRelic Run'), G('13', 'S6GMMgr:PushLog AreaMazeChange Id:9'), '新增遗物:', '遗物名:Baby Bear 遗物ID66']);
  if (p.state.offer) fail('taking a pick didn\'t end its suggestions: ' + JSON.stringify(p.state.offer));
});

section('days 1-5: Mr. Misfortune and Baby Bear are early Sanity recovery Old Stuff, after Ms. Grumpy', () => {
  const order = (day, relics) => engine.buildOfferRanking(adapt.gameState(overlayState(day, { relics })), adapt.catalog, 'relic', engine.VALUE_WEIGHTS).items;
  for (const day of [1, 5]) {
    const items = order(day, []);
    const at = (n) => items.findIndex((x) => x.name === n);
    const grumpy = at('Ms. Grumpy');
    if (at('Mr. Misfortune') !== grumpy + 1 || at('Baby Bear') !== grumpy + 2) fail(`day ${day}: Ms. Grumpy ${grumpy + 1}, Mr. Misfortune ${at('Mr. Misfortune') + 1}, Baby Bear ${at('Baby Bear') + 1}`);
    if (!/Early · Sanity recovery/.test(items[at('Mr. Misfortune')].reason) || at('Mr. Misfortune') > at("Cartographer's Medicine Bottle")) fail(`day ${day}: Mr. Misfortune: ${items[at('Mr. Misfortune')].reason}`);
  }
  // from day 6 the order is the advisor's own: Mr. Misfortune with the Max Sanity pairs
  if (!/Mid · Max Sanity/.test(order(6, []).find((x) => x.name === 'Mr. Misfortune').reason)) fail('day 6 order changed');
});

section('each build says what it still needs; only Lv2 Old Stuff counts', () => {
  const s = overlayState(3, { relics: [{ name: 'Baby Bear', level: 0 }, { name: 'Guild Medal - Old Stuff', level: 1 }, { name: "Cartographer's Purse", level: 1 }] });
  const groups = new Map(adapt.exploring(s).builds.groups.map((g) => [g.label, g]));
  const want = {
    'Economy engine': [1, null],
    'Vendor Items': [1, 'needs: Chief Trader\'s Statue or Shopping List'],
    'Max Sanity pairs': [0, 'one pair of: Cartographer\'s Medicine Bottle (with your Cartographer\'s Purse); Filth Eater\'s Wages + Mr. Misfortune; Wriggling Money Jar (with your Coin gain Old Stuff)'],
    'Stele healing': [0, 'any one of: upgrade Baby Bear, Watchful Purse'],
    'Preview build': [1, 'needs: Cartographer\'s Quill, Cartographer\'s Medicine Bottle, Cartographer\'s Stool'],
    'Omen build': [0, 'needs: Filth Eater\'s Wages (key), Mr. Misfortune (important), Filth Eater\'s Dinner (important), upgrade Baby Bear, Ms. Grumpy, Anxious Black Goat\'s Horn, Amulet: Anxiety'],
  };
  for (const [label, [owned, missing]] of Object.entries(want)) {
    const g = groups.get(label);
    if (!g || g.owned !== owned || g.missing !== missing) fail(`${label}: ${g ? g.owned + ' · ' + g.missing : 'not shown'}, expected ${owned} · ${missing}`);
  }
  if (!groups.get('Omen build').own || groups.get('Economy engine').own) fail('the overlay\'s own builds aren\'t told apart from the advisor\'s groups');
  // for the card's bars and chips, as the card gets them (through JSON): counted / an upgrade away / target, and each
  // slot's pieces, with the half of a pair you have
  const sent = (label) => JSON.parse(JSON.stringify(groups.get(label)));
  const bars = { 'Vendor Items': '1/0/2', 'Stele healing': '0/1/1', 'Preview build': '1/0/4', 'Economy engine': '1/0/1', 'Omen build': '0/1/7' };
  for (const [label, want] of Object.entries(bars)) { const b = sent(label).bar; if (`${b.lv2}/${b.lv1}/${b.target}` !== want) fail(`${label} bar ${b.lv2}/${b.lv1}/${b.target}, expected ${want}`); }
  const pair = sent('Max Sanity pairs').needs;
  if (pair.mode !== 'pair' || pair.options[0].have !== "Cartographer's Purse" || pair.options[0].pieces.map((x) => x.name).join() !== "Cartographer's Medicine Bottle") fail('pair chips: ' + JSON.stringify(pair.options[0]));
  const heal = sent('Stele healing').needs;
  if (heal.mode !== 'any' || heal.left !== 1 || !heal.options[0].pieces[0].upgrade) fail('Stele healing chips: ' + JSON.stringify(heal));
  if (sent('Economy engine').needs !== null) fail('a done group still needs something');
  if (groups.has('Trader boost') || !/Vendor Items/.test(adapt.ranking(overlayState(2, { offer: { kind: 'relic', cell: 7 } })).phaseStrategy)) fail('"Trader boost" not renamed "Vendor Items"');
  // the advisor counts a group's Old Stuff at Lv2 only: the same Old Stuff at Lv1 doesn't count
  const lv = (level) => adapt.exploring(overlayState(3, { relics: [{ name: "Banker's IOU", level }] })).builds.groups.find((g) => g.label === 'Economy engine');
  if (lv(0).owned !== 0 || lv(0).status === 'done' || lv(1).owned !== 1 || lv(1).status !== 'done') fail(`Economy engine with Banker's IOU at Lv1 ${lv(0).owned}/${lv(0).status}, at Lv2 ${lv(1).owned}/${lv(1).status}`);
});

section('Important pieces after the Key ones; no Coin source yet on days 1-5; the closest build is marked', () => {
  const groupsOf = (relics, day = 3) => adapt.exploring(overlayState(day, relics ? { relics } : {})).builds.groups;
  // the Food build: its two Key pieces, then the Important one, then the rest; marked in the members and the chips
  const food = JSON.parse(JSON.stringify(groupsOf([]).find((g) => g.id === 'food')));
  const hints = food.members.slice(0, 4).map((m) => m.name + ':' + m.hint).join();
  if (hints !== "Delicious Condiment:key,Chief Trader's Statue:key,Guild Medal - Food:important,Healthy Condiment:null") fail('Food build members: ' + hints);
  const chips = food.needs.options.map((o) => o.pieces[0]).map((x) => x.name + ':' + (x.key ? 'key' : x.important ? 'important' : '-')).slice(0, 4).join();
  if (chips !== "Delicious Condiment:key,Chief Trader's Statue:key,Guild Medal - Food:important,Healthy Condiment:-") fail('Food build chips: ' + chips);
  // the card's chips and the closest tag, drawn by panels.js
  const vm = require('vm'), win = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'overlay', 'panels.js'), 'utf8'), { window: win });
  const P = win.MistPanels;
  const drawn = P.buildProgress({ groups: [Object.assign(food, { closest: true })] }, 'food');
  if (!/class="nchip key"[^>]*>Delicious Condiment/.test(drawn) || !/class="nchip imp"[^>]*>Guild Medal - Food/.test(drawn) || !/class="nchip">Healthy Condiment/.test(drawn)) fail('the Food build\'s chips aren\'t drawn key / important / plain');
  if (!/class="bg open closest"/.test(drawn) || !/bbest">closest/.test(drawn)) fail('the closest build isn\'t drawn marked');
  // closed (as every build starts), a build is one row: its bar, count and tags, no chips or members
  const shut = P.buildProgress({ groups: [food] }, null);
  if (/nchip|bmem/.test(shut) || !/class="segs"/.test(shut) || !/bbest">closest/.test(shut)) fail('a closed build: ' + shut);

  // no Coin source: none of the Economy engine's four held, at any level, on days 1-5 of a running run
  const coin = (day, extra) => adapt.exploring(overlayState(day, extra)).noCoinSource;
  const four = "Banker's IOU,Cartographer's Purse,Filth Eater's Wages,Amulet: Poverty";
  if ((coin(1) || []).join() !== four || (coin(5) || []).join() !== four) fail(`no Coin source on days 1 and 5: ${coin(1)} / ${coin(5)}`);
  if (coin(6) !== null) fail('the no-Coin-source warning shows on day 6');
  if (coin(3, { relics: [{ name: 'Amulet: Poverty', level: 0 }] }) !== null) fail('a Coin source held at Lv1 still warns');
  if (coin(3, { ended: 'lose' }) !== null) fail('the no-Coin-source warning shows after the run ended');
  const line = P.coinWarning({ noCoinSource: coin(2) });
  if (!/No Coin source yet/.test(line) || !line.includes("Banker&#39;s IOU, Cartographer&#39;s Purse, Filth Eater&#39;s Wages or Amulet: Poverty")) fail('the warning line: ' + line);
  if (P.coinWarning({ noCoinSource: null }) !== '') fail('the warning drawn with a Coin source held');

  // the closest of Preview, Omen and Food: the larger share counted (Lv2), then the larger share an upgrade away
  const closest = (relics) => groupsOf(relics).filter((g) => g.closest).map((g) => g.id).join();
  const lv2 = (...names) => names.map((name) => ({ name, level: 1 }));
  if (closest([]) !== '') fail(`a build marked closest with no pieces: ${closest([])}`);
  if (closest(lv2("Cartographer's Purse", "Filth Eater's Wages", 'Mr. Misfortune')) !== 'omen') fail('Omen 2/7 over Preview 1/4: ' + closest(lv2("Cartographer's Purse", "Filth Eater's Wages", 'Mr. Misfortune')));
  if (closest(lv2("Cartographer's Purse", "Cartographer's Quill", "Filth Eater's Wages", 'Mr. Misfortune')) !== 'preview') fail('Preview 2/4 over Omen 2/7');
  if (closest([{ name: 'Baby Bear', level: 0 }]) !== 'omen') fail('a build an upgrade away isn\'t the closest');
  const even = lv2('Delicious Condiment', "Filth Eater's Wages").concat([{ name: 'Healthy Condiment', level: 0 }]);
  if (closest(even) !== 'food') fail('with the same share counted, the one with more an upgrade away isn\'t the closest: ' + closest(even));
  if (closest(lv2('Delicious Condiment', "Filth Eater's Wages")) !== 'omen,food') fail('a tie marks: ' + closest(lv2('Delicious Condiment', "Filth Eater's Wages")));
  const done = lv2("Cartographer's Purse", "Cartographer's Quill", "Cartographer's Medicine Bottle", "Cartographer's Stool", 'Delicious Condiment');
  if (closest(done) !== 'food') fail('a finished build is still marked closest: ' + closest(done));
  if (groupsOf(lv2('Delicious Condiment')).some((g) => g.closest && !['preview', 'omen', 'food'].includes(g.id))) fail('a group outside Preview, Omen and Food marked closest');
});

section('the Sanity bar: how full the next floor starts if you head out now', () => {
  const { sanityPlan, newDayGain, sanatoriumGain } = require('../sanity');
  // what a new day gave back in the run history: 10 + 30% of Max Sanity, a Fluffy Old Blanket 8% more, Sleeping Spice 20
  const gains = [newDayGain(120, []), newDayGain(130, []), newDayGain(160, []), newDayGain(120, [{ name: 'Fluffy Old Blanket', level: 0 }]), newDayGain(120, [{ name: 'Sleeping Spice', level: 0 }])];
  if (gains.join() !== '46,49,58,55,66') fail('a new day gives back ' + gains);
  // and a Sanatorium: 20, Sanatorium Contract 7 more, Special Protection Pass 10 more
  const sanas = [sanatoriumGain([]), sanatoriumGain([{ name: 'Sanatorium Contract', level: 0 }]), sanatoriumGain([{ name: 'Special Protection Pass', level: 0 }])];
  if (sanas.join() !== '20,27,30') fail('a Sanatorium gives ' + sanas);
  const base = { run: 1, day: 6, ended: null, maxSanity: 120, sanity: 102, sanityRead: true, exploreCost: 8, baseExploreCost: 8, relics: [] };
  const plan = (extra, route = { found: 3 }, pois = null) => sanityPlan(Object.assign({}, base, extra), route, {}, pois);
  const brief = (q) => q && [q.sanity, q.keep, q.findToday, q.spare, q.level, q.lastDay ? '-' : q.nextStart].join(' ');
  const twoSana = { list: [{ label: 'Sanatorium', unused: [3, 8] }] };
  const cases = [
    // Max Sanity 120: a new day gives back 46, so ending the day on 74 starts the next floor full (green)
    ['day 6 at 102', {}, undefined, '102 74 0 28 ok 120'],
    ['still full, less than a Cell to spare', { sanity: 80 }, undefined, '80 74 0 6 ok 120'],
    // below that: amber while the next floor still starts on 90% of Max Sanity (108) or more, red below
    ['the next floor on 116', { sanity: 70 }, undefined, '70 74 0 -4 low 116'],
    ['the next floor on 109', { sanity: 63 }, undefined, '63 74 0 -11 low 109'],
    ['the next floor on 106', { sanity: 60 }, undefined, '60 74 0 -14 out 106'],
    // the Clock Tower still to find: what the route expects it to cost comes off first (102 − 40 + 46 = 108)
    ['the Clock Tower still to find', {}, { found: null, expectedTurns: 5, exploreCost: 8 }, '102 74 40 -12 low 108'],
    ['the Clock Tower still to find, lower', { sanity: 98 }, { found: null, expectedTurns: 5, exploreCost: 8 }, '98 74 40 -16 out 104'],
    ['no board yet', { sanity: 120 }, null, '120 74 0 46 ok 120'],
    // the log hasn't given today's Sanity: what the day starts on (yesterday's 60 + 46)
    ['the day\'s Sanity not given yet', { sanity: 60, sanityRead: false }, undefined, '106 74 0 32 ok 120'],
    // Sanatoriums revealed and not used: 40 more to come (54 with Sanatorium Contract)
    ['Sanatoriums still to use', { sanity: 70 }, undefined, '70 74 0 36 ok 120', twoSana],
    ['Sanatoriums with the Contract', { sanity: 70, relics: [{ name: 'Sanatorium Contract', level: 0 }] }, undefined, '70 74 0 50 ok 120', twoSana],
    // a Fluffy Old Blanket gives back 55: the full-heal line drops to 65
    ['a Fluffy Old Blanket', { sanity: 70, relics: [{ name: 'Fluffy Old Blanket', level: 0 }] }, undefined, '70 65 0 5 ok 120'],
    ['Max Sanity 400', { sanity: 300, maxSanity: 400 }, undefined, '300 270 0 30 ok 400'],
    // day 15 has no next floor: keep the odd-day reserve (30), or a Cell if that's more, to finish
    ['day 15', { day: 15, exploreCost: 20, baseExploreCost: 50, sanity: 300, maxSanity: 400 }, undefined, '300 30 0 270 ok -'],
    ['day 15, a Cell dearer than the reserve', { day: 15, exploreCost: 50, baseExploreCost: 50, sanity: 300, maxSanity: 400 }, undefined, '300 50 0 250 ok -'],
    ['day 15, short', { day: 15, exploreCost: 50, baseExploreCost: 50, sanity: 40, maxSanity: 400 }, undefined, '40 50 0 -10 out -'],
  ];
  for (const [what, extra, route, want, pois] of cases) { const got = brief(plan(extra, route, pois)); if (got !== want) fail(`${what}: ${got}, expected ${want}`); }
  if (plan({ ended: 'fail' }) !== null || plan({ run: 0 }) !== null || plan({ sanity: null }) !== null) fail('a Sanity bar outside a run');
  // the day boundary: ending day 6 on 74 starts day 7 full, and the bar says so before the board's route is known
  const night = plan({ sanity: 74 }), morning = plan({ day: 7, exploreCost: 10, baseExploreCost: 10, sanity: 74, sanityRead: false }, null);
  if (night.level !== 'ok' || morning.sanity !== 120 || morning.level !== 'ok') fail(`ending the day on the full-heal line: ${brief(night)}, then ${brief(morning)}`);
  // the card draws it: the fill at Sanity, Sanatoriums still to use lighter, the tick where to stop, the label and
  // colour, the details as its tooltip
  const vm = require('vm'), win = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'overlay', 'panels.js'), 'utf8'), { window: win });
  const P = win.MistPanels;
  const ok = P.sanityBar(plan({}));
  if (!/class="hp ok"/.test(ok) || !/hpfill" style="width:85\.0%"/.test(ok) || !/hpmark" style="left:61\.7%"/.test(ok) || !/hplab">28 spare</.test(ok)) fail('the bar drawn: ' + ok);
  // the Clock Tower still to find: the tick sits where to stop (114 = 74 + 40)
  if (!/hpmark" style="left:95\.0%"/.test(P.sanityBar(plan({ sanity: 110 }, { found: null, expectedTurns: 5, exploreCost: 8 })))) fail('the tick isn\'t where to stop');
  if (!/hpwait" style="left:58\.3%;width:33\.3%"/.test(P.sanityBar(plan({ sanity: 70 }, undefined, twoSana)))) fail('Sanatoriums still to use aren\'t drawn');
  if (!/Heading out now, the next floor starts on ~120 of 120 \(100%\)/.test(ok) || !/end the day on 74\+ to start the next one full/.test(ok) || !/You can spend 28 more \(~3 Cells at 8\) and still start it full/.test(ok)) fail('the bar\'s details: ' + ok);
  if (!/To start it full: ~14 more \(a Sanatorium gives 20, or recovery Food\)/.test(P.sanityBar(plan({ sanity: 60 })))) fail('what starting full still needs isn\'t said');
  const labels = [plan({}), plan({ sanity: 80 }), plan({ sanity: 70 }), plan({ sanity: 60 }), plan({ sanity: 60, sanityRead: false }),
    plan({ day: 15, exploreCost: 50, baseExploreCost: 50, sanity: 40, maxSanity: 400 })].map((q) => /hplab">([^<]*)</.exec(P.sanityBar(q))[1]);
  if (labels.join(' | ') !== '28 spare | head out | tmrw 96% | tmrw 88% | ~32 spare | 10 under') fail('the bar\'s labels: ' + labels.join(' | '));
  if (!/class="hp ok expected"/.test(P.sanityBar(plan({ sanity: 60, sanityRead: false }))) || P.sanityBar(null) !== '') fail('the bar while the day\'s Sanity isn\'t given, or outside a run');
  // and the card's view carries it
  const { buildView } = require('../view');
  const view = buildView(Object.assign(require('../parser').createParser().state, overlayState(6, { maxSanity: 120, sanity: 102, sanityRead: true })));
  if (!view.sanityPlan || view.sanityPlan.max !== 120 || view.sanityPlan.fullHeal !== 74) fail('the view\'s Sanity bar: ' + JSON.stringify(view.sanityPlan));
});

// a run in the log's format: Intel bought, day 1 with its costs, the bags, the board (an Old Stuff Cell offering two),
// stepping on it, eating, the board closing, Sanity 0; then back to town
function runLog(day = '22', minute = '09') {
  const T = (t) => `[2026.10.${day}-10.${minute}.${t}:000][  0]`;
  const G = (t, msg) => T(t) + 'TLLua: Display: [Game] ' + msg;
  const dump = [];
  for (let i = 1; i <= 25; i++) {
    const at = i - 1;
    dump.push(G('05', 'S6GamePlay uiindex = ' + i), G('05', ''));
    if (at === 12) dump.push('+Base+Name [Place of Awakening]', '+IsExplored [true]', '+TileType [1]');
    else if (at === 7) dump.push('+Base+Name [Unknown Old Stuff]', '+IsExplored [true]', '+TileType [3]', '+Detail+RelicList+1 [43]', '+Detail+RelicList+2 [44]');
    else dump.push('+Base+Name []', '+IsExplored [false]', '+TileType [0]');
    dump.push(G('05', ''), '+bBlock [false]', '+Status [' + ([7, 11, 13, 17].includes(at) ? 1 : 0) + ']', '+Cost [4]');
  }
  return [T('00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02', G('01', 'UIButton@ S6PrepareExplore_C_BtnConfirm'),
    G('02', 'S6GMMgr:PushLog AreaDungeonData Id:1'), '当前层数:1', '当前地牢ID:3', '基础探索理智消耗:5', '探索理智修正结果:4',
    G('03', 'S6GMMgr:PushLog AreaMazeChange Id:2'), '属性变化:', '属性名:1.理智 变化值:120', '遗物背包变化:', '遗物序号:0等级:0 遗物名:Baby Bear 遗物ID66',
    '道具背包变化:', '道具序号:0 剩余使用次数:2 道具名:Golden Caviar 道具ID11', G('04', 'S6Maze Run'), ...dump,
    G('06', 'S6GMMgr:PushLog AreaInteractTile Id:3'), '交互地块 7', G('07', 'S6GMMgr:PushLog AreaDoInteraction Id:4'), '选择遗物',
    G('08', 'S6GMMgr:PushLog AreaUseItem Id:5'), '使用道具 0', G('09', 'S6Maze Destory'),
    G('10', 'S6GMMgr:PushLog AreaMazeChange Id:6'), '属性名:1.理智 变化值:0', T('11') + 'LogLoad: LoadMap: /Game/Art/Maps/Town/Town'].join('\n') + '\n';
}
const suggest = (s) => { const r = adapt.ranking(s); return r ? r.items.map((x) => x.name) : null; };
const intoHistory = (p, h) => { for (const e of p.drain()) { if (e.type === 'Line') h.line(e.text); else h.record(e); } };

section('the run history keeps what an analysis of your runs needs', () => {
  const { createParser } = require('../parser');
  const { createHistory } = require('../history');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mist-runs-'));
  try {
    const history = createHistory(tmp);
    const p = createParser({}, { keepLines: true, suggest });
    p.feed(runLog());
    intoHistory(p, history);
    history.close();
    const run = history.list()[0] || {};
    const ev = (history.detail(run.runId) || { events: [] }).events;
    const one = (type) => ev.find((e) => e.type === type) || {};
    if (run.result !== 'fail') fail(`run ended ${run.result}`);
    if (one('RunStart').intel !== 'bought' || one('Dungeon').id !== 3 || one('IntelItem').name !== 'Baby Bear') fail('run setup: ' + JSON.stringify([one('RunStart'), one('Dungeon'), one('IntelItem')]));
    const costs = ev.filter((e) => e.type === 'CostChanged').pop() || {};
    if (costs.explore !== 4 || costs.base !== 5) fail('explore cost: ' + JSON.stringify(costs));
    const board = (ev.find((e) => e.type === 'MapSnapshot' && e.tiles) || {}).tiles || [];
    if (board.length !== 25 || board[7].n !== 'Unknown Old Stuff' || !board[7].e || board[12].k !== 'start' || !board[8].r !== true || board[8].c !== 4) fail('board: ' + JSON.stringify(board.slice(7, 9)));
    if (one('TileInteracted').name !== 'Unknown Old Stuff' || one('FoodUsed').name !== 'Golden Caviar') fail('names: ' + JSON.stringify([one('TileInteracted'), one('FoodUsed')]));
    const opened = one('OfferOpened');
    if (opened.kind !== 'relic' || !(opened.suggested && opened.suggested.length === 6)) fail('offer opened: ' + JSON.stringify(opened));
    const names = (one('OfferContents').relics || []).map((o) => o.id + ' ' + o.name).join();
    const want = [43, 44].map((id) => id + ' ' + ITEMS.find((x) => x.id === id).name).join();
    if (names !== want) fail(`offer contents: ${names}, expected ${want}`);
    if (one('BoardOpened').sanity !== 120 || one('BoardClosed').sanity !== 120) fail('fight markers: ' + JSON.stringify([one('BoardOpened'), one('BoardClosed')]));
    // the run's copy of its log lines starts at its map load and parses back to the same run
    const raw = history.rawLog(run.runId) || '';
    if (!/^\[[^\]]+\]\[\s*\d+\]LogLoad: LoadMap: \S+WuDu/.test(raw) || !fs.existsSync(path.join(tmp, 'raw', run.runId + '.log.gz'))) fail('the log copy: ' + raw.slice(0, 120));
    const again = createParser({}, { suggest });
    again.feed(raw);
    const types = (list) => list.filter((e) => e.type !== 'Line').map((e) => e.type).join();
    if (types(again.drain()) !== types(ev)) fail('the log copy parses back to different events');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

async function older() {
  await asyncSection('older logs are read into the run history, once each', async () => {
    const { createParser } = require('../parser');
    const { createHistory } = require('../history');
    const { importBackups, backupsOf } = require('../backups');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mist-older-'));
    try {
      const logs = path.join(tmp, 'Logs');
      fs.mkdirSync(logs);
      fs.writeFileSync(path.join(logs, 'UE_game.log'), '');
      fs.writeFileSync(path.join(logs, 'notes.log'), 'not a game log');
      // the older log: the run above, then one that ends on the result screen as the game closes
      const T = (t) => `[2026.10.21-11.00.${t}:000][  0]`;
      fs.writeFileSync(path.join(logs, 'UE_game-backup-2026.10.21-10.00.00.log'), runLog('21', '09') + [T('00') + 'LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/WuDuYiZhi02',
        T('01') + '[Game] S6GMMgr:PushLog AreaDungeonData Id:9', '当前层数:1', T('02') + '[Game] S6GMMgr:PushLog AreaMazeChange Id:10', '属性名:1.理智 变化值:50', T('03') + '[Game] OpenView S6Result'].join('\n'));
      if (backupsOf(path.join(logs, 'UE_game.log')).length !== 1) fail('older logs found: ' + backupsOf(path.join(logs, 'UE_game.log')).join());
      const history = createHistory(path.join(tmp, 'history'));
      const make = () => createParser({}, { keepLines: true, suggest });
      const first = await importBackups(path.join(logs, 'UE_game.log'), history, make);
      const second = await importBackups(path.join(logs, 'UE_game.log'), history, make);
      const runs = history.list().map((r) => r.result).join();
      if (first !== 1 || second !== 0) fail(`read ${first} then ${second} older logs, expected 1 then 0`);
      if (runs !== 'win,fail') fail(`runs from the older log: ${runs}`);
      if (!history.rawLog(history.list()[1].runId)) fail('no log copy for an imported run');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
  console.log(failures ? `\n${failures} problem(s)` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}
older();
