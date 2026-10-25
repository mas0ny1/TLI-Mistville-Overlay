// Reads Torchlight: Infinite's UE_game.log as it grows and keeps the Mistville state: day, sanity, coins, Old Stuff,
// food and the 5x5 board. Feed it text in any chunk sizes; it only acts on whole lines.
//
// What the game writes (season 6, "S6"):
//   LogLoad: LoadMap: /Game/Art/Season/S6/Maps/WuDuYiZhi02/...   a Mistville map (WuDu = Mistville)
//   ... S6Maze Run / S6Maze Destory                               the board opens / closes
//   当前层数:3                                                   day (floor) 3 of the run; day 1 starts a new run
//   属性名:1.理智 变化值:71 / 属性名:3.金币 变化值:231            sanity / coins, the new value
//   遗物背包变化: + 遗物序号:0等级:0 遗物名:Baby Bear 遗物ID66      the whole Old Stuff bag, one line each
//   道具背包变化: + 道具序号:0 剩余使用次数:1 道具名:... 道具ID22    the whole item (food) bag
//   ... S6GamePlay uiindex = 1..25 + two trees                    every tile after each change: name, explored,
//                                                                 previewed, sealed (bBlock), reachable (Status)
//   MsgMgr@:Show MsgValue = Obtained Old Stuff:Amulet: Poverty    the game's own message
//   交互地块 12 / 探索地块 12 / 使用道具 0 / 遇到遭遇 ID = 5 ...      what you did on the board
// Unexplored tiles are logged without a name or type, so nothing here shows more than the game does.
//
// Besides the state, it queues events (drain()): RunStart, DayBegin, AttrChanged,
// RelicGained, RelicBagUpdated, FoodBagUpdated, OfferOpened, TileClicked/Interacted/Explored/Vanished, FoodUsed,
// EncounterOpened/Selected, MapSnapshot, Toast and RunEnd, each stamped with the log's time. History and the gain
// cards are built from them.

'use strict';

const { FOOD_IDS } = require('./foods');
const { currentOffer } = require('./offers');

const TILE_KIND = { 0: 'hidden', 1: 'start', 2: 'stele', 3: 'oldstuff', 4: 'food', 5: 'trader', 6: 'building', 98: 'clearing', 99: 'exit' };
const TIMESTAMPED = /^\[(\d{4})\.(\d\d)\.(\d\d)-(\d\d)\.(\d\d)\.(\d\d):(\d{3})\]\[\s*\d+\]/;

function emptyTile(i) {
  return { index: i, row: Math.floor(i / 5), col: i % 5, kind: 'hidden', name: '', content: '', explored: false, preview: false, sealed: false, reachable: false, done: false, cost: 0, offer: null };
}
// the Mistville screens the card follows (the game's page names); S6PrepareExplore is Mistville Intel, before day 1
// (its 3 offers aren't logged; confirming buys one, "pass" skips it; there's no advice for it)
const SCREENS = { S6ChooseRelic: 'choose', S6Shop: 'shop', S6Furnace: 'furnace', S6ChooseItem: 'food', S6PrepareExplore: 'intel' };
// the same screens as the advisor's offer kinds
const OFFER_KIND = { choose: 'relic', shop: 'shop', furnace: 'furnaceUpgrade', food: 'food', intel: 'intel' };
// what the first line of an "AreaDoInteraction" block says when a pick, the Trader or an upgrade opens; it comes as you
// step on the Cell (or use a Food that upgrades Old Stuff), before the screen itself
const DO_INTERACTION = [['选择遗物', 'relic'], ['选择道具', 'food'], ['商店', 'shop'], ['熔炉遗物升级', 'furnaceUpgrade'], ['道具功能：遗物升级', 'furnaceUpgrade']];
const ATTRS = { 1: 'Sanity', 2: 'Max Sanity', 3: 'Coins', 4: 'Food slots', 24: 'Food use', 32: 'Free Trader refreshes', 1000: 'Day progress' };
const OMEN = /^Bad Omen Stele - (Blindness|Anxiety|Poverty|Anorexia)$/; // the steles the daily tip counts removals of

// The log-format check ("the log format may have changed"), kept to Mistville's own lines: the game's other debug lines
// (music, fights, town) change from patch to patch, so counting every [Game] line would warn with nothing wrong.
// Counted while in Mistville: every "[Game] S6…" line (Mistville's systems) and the lines of its log blocks and board
// dumps. It warns at 500 lines or more with 5% of them not recognised.
const FORMAT_MIN_LINES = 500;
const FORMAT_UNKNOWN_RATIO = 0.05;
const S6_LINE = /(^|[^\w])S6[A-Z]/; // S6GMMgr, S6GamePlay, S6Maze, S6Shop…
// the S6 lines the parser reads, and those it skips ("@" / "::" debug lines, S6ShopItem, S6GamePlay…)
const S6_KNOWN = [/^S6GMMgr:PushLog \S+ Id:\d+/, /^S6\w+ (Run|Destory|Destroy)\s*$/, /OpenView S6/, /S6PrepareExplore_C_Btn/, /^S6ShopItem/, /^S6GamePlay/, /@|::/];
const RECENT_UNKNOWN = 20; // the last ones kept to show
// what a run starts with, until the log says otherwise
const START = { sanity: 120, maxSanity: 120, coins: 200, foodSlots: 4 };
// the timestamped lines the run history keeps a copy of (with every line of Mistville's log blocks and board dumps)
const KEEP_LINE = /S6[A-Z]|LogLoad: LoadMap|MsgMgr@:Show MsgValue/;

// a Cell as the run history keeps it: its index, then only what's set (kind, name, explored, previewed, sealed,
// reachable, done, cost)
function tileRecord(t) {
  const r = { i: t.index };
  if (t.kind !== 'hidden') r.k = t.kind;
  if (t.name) r.n = t.name;
  if (t.explored) r.e = 1;
  if (t.preview) r.p = 1;
  if (t.sealed) r.s = 1;
  if (t.reachable) r.r = 1;
  if (t.done) r.d = 1;
  if (t.cost) r.c = t.cost;
  return r;
}

/**
 * learned: { relicIds, foodIds } kept from earlier sessions. options: keepLines (queue each Mistville log line as a
 * { type: 'Line', text } entry among the events, for the run history's copy of the log); suggest (state => the
 * suggested order's names when an offer opens, kept with it).
 */
function createParser(learned = {}, options = {}) {
  const state = {
    inMistville: false, map: '', mazeOpen: false,
    run: 0, day: 0, dungeon: 0,
    sanity: null, sanityPeak: null, coins: null,
    sanityRead: false, // the log has given Sanity since the day began (the game writes it when you first act on a new day)
    relics: [], items: [],
    board: null, boardDay: 0,
    seen: {}, // this day: Cell index -> every name it has shown (explored or previewed); used places turn into Clearings
    screen: null, // 'choose' (Old Stuff pick) · 'shop' (Mistville Trader) · 'furnace' (Alchemy Workshop) while one is open
    lastTile: null, // the Cell last clicked or interacted with (the one whose screen is open)
    // the pick, Trader, upgrade or Food pick the suggestions are for: { kind, cell }, from when it opens until you get
    // something, a bag is listed, or a new day or run starts (closing its screen doesn't end it)
    offer: null,
    // ID -> name: Old Stuff comes from oldstuff.js (and anything new is learned here); Food from foods.js plus your bag
    relicIds: Object.assign({}, learned.relicIds), foodIds: Object.assign({}, FOOD_IDS, learned.foodIds),
    intel: null, // 'bought' | 'skipped' for this run's Mistville Intel
    intelItem: null, // the Old Stuff it gave (the game only shows it at the next bag listing)
    obtained: [], // Old Stuff the game announced this run ("新增遗物"); anything else in the bag came from Intel
    lastMessage: '', lastMessageAt: null, updatedAt: null,
    maxSanity: null, canUseFood: true, freeRefresh: 0, foodSlots: null,
    exploreCost: null, baseExploreCost: null, // the day's explore cost as the log states it (after / before Old Stuff)
    daily: { sanatorium: 0, bank: 0, stone: 0 }, // today's Sanatorium, Bank and stele interactions (the daily tip)
    ended: null, // 'win' | 'fail' once this run is over
    // the log-format check (formatAlert): Mistville lines counted and not recognised (with the last few), how often the
    // board opened, and how many day, Sanity and board lines were read
    logCheck: { lines: 0, unknown: 0, recent: [], boardOpens: 0, read: { day: 0, Sanity: 0, board: 0 } },
  };
  let events = []; // queued for drain()
  // The third end-of-run signal: the result screen (OpenView S6Result). It can show before Sanity reaches 0, so it
  // only decides once nothing else does: a new run starts, or you leave Mistville, without a new day
  // or a clear / fail first. Then Sanity 0 means a fail, anything else a clear.
  let resultScreen = null; // the log time it opened at, while it waits
  let now = null; // the log's time of the last timestamped line: events take it
  const emit = (type, fields, at = now) => { events.push(Object.assign({ at, type }, fields)); };
  let intelPending = null; // Intel comes before day 1, so it's carried into the run that starts next
  let rest = '';
  let changed = false;
  let bag = null; // 'relic' | 'item' while reading a bag listing
  let bagList = [];
  let dump = null; // { tiles, index, phase, section } while reading a board dump
  let block = null; // the "S6GMMgr:PushLog <type>" block whose lines follow, without timestamps
  let blockStart = false; // its first line is still to come
  let lastBoard = null; // the board as last recorded (a snapshot keeps its Cells only when they changed)
  let lastOfferContents = null; // the open offer's contents as last recorded
  let loadedSinceDay = false; // a map was loaded since the last day line: a day 1 after it is a new run, even after a day 1

  const touch = () => { changed = true; };
  const timeOf = (m) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]); // the log's clock is UTC

  function newRun() {
    settleResultScreen();
    state.run++;
    state.relics = []; state.items = []; state.sanity = START.sanity; state.sanityPeak = START.sanity; state.coins = START.coins; state.board = null; state.boardDay = 0; state.seen = {};
    state.intel = intelPending; intelPending = null; state.intelItem = null; state.obtained = [];
    state.maxSanity = START.maxSanity; state.canUseFood = true; state.freeRefresh = 0; state.foodSlots = START.foodSlots; state.ended = null;
    state.offer = null; state.lastTile = null;
    lastBoard = null;
    emit('RunStart', { day: 1, dungeon: state.dungeon || null, intel: state.intel });
  }
  function endRun(result, at = now) {
    resultScreen = null;
    if (state.ended || !state.run) return;
    state.ended = result;
    emit('RunEnd', { result }, at);
  }
  function settleResultScreen() {
    if (resultScreen !== null) endRun(state.sanity === 0 ? 'fail' : 'win', resultScreen);
  }
  /** A pick, the Trader, an upgrade or a Food pick opened (once per Cell, however many lines say so). */
  function openOffer(kind) {
    if (state.offer && state.offer.kind === kind && state.offer.cell === state.lastTile) return;
    state.offer = { kind, cell: state.lastTile };
    let suggested = null;
    try { suggested = options.suggest ? options.suggest(state) : null; } catch (e) { suggested = null; }
    emit('OfferOpened', Object.assign({ kind, tileIndex: state.lastTile }, suggested ? { suggested } : null));
    lastOfferContents = null;
    noteOffer();
    touch();
  }
  /** What the open offer has (named, with the Trader's prices), each time the log shows it different. */
  function noteOffer() {
    const contents = currentOffer(state);
    const key = contents && JSON.stringify(contents);
    if (!contents || key === lastOfferContents) return;
    lastOfferContents = key;
    emit('OfferContents', contents);
  }
  /** You got something (an Old Stuff, or a bag listing): the suggestions end, except at a Trader still open, where they
   *  stay (with what you bought marked) until you leave it. */
  function tookSomething() {
    if (state.offer && state.offer.kind === 'shop' && state.screen === 'shop') state.offer.took = true;
    else state.offer = null;
  }
  function endBag() {
    tookSomething();
    if (bag === 'relic') {
      state.relics = bagList;
      emit('RelicBagUpdated', { relics: bagList.map((r) => ({ id: r.id, name: r.name, level: r.level })) });
      for (const r of bagList) state.relicIds[r.id] = r.name;
      if (state.intel === 'bought' && !state.intelItem) { const x = bagList.find((r) => !state.obtained.includes(r.name)); if (x) { state.intelItem = x.name; emit('IntelItem', { name: x.name }); } }
    }
    if (bag === 'item') {
      state.items = bagList; for (const r of bagList) state.foodIds[r.id] = r.name;
      emit('FoodBagUpdated', { foods: bagList.map((f) => ({ id: f.id, name: f.name, uses: f.uses })) });
    }
    bag = null; bagList = []; touch();
  }
  function endDump() {
    if (dump && dump.seen >= 25) {
      // a Cell keeps what it offers today when a later board doesn't list it again, until it's used (its name changes)
      if (state.board && state.boardDay === state.day) {
        for (const t of dump.tiles) { const was = state.board[t.index]; if (!t.offer && was && was.offer && was.name === t.name) t.offer = was.offer; }
      }
      state.board = dump.tiles; state.boardDay = state.day; state.logCheck.read.board++;
      const tiles = dump.tiles.map(tileRecord), key = JSON.stringify(tiles);
      emit('MapSnapshot', Object.assign({ day: state.day, known: dump.tiles.filter((t) => t.explored || t.preview).length }, key !== lastBoard ? { tiles } : null));
      lastBoard = key;
      if (state.offer) noteOffer();
      for (const t of dump.tiles) if (t.name && (t.explored || t.preview)) { const s = state.seen[t.index] = state.seen[t.index] || []; if (!s.includes(t.name)) s.push(t.name); }
      touch();
    }
    dump = null;
  }

  /** A "[Game] " message while in Mistville, for the log-format check. */
  function checkGameLine(msg) {
    const c = state.logCheck;
    if (/^S6Maze Run\s*$/.test(msg)) c.boardOpens++;
    if (!S6_LINE.test(msg)) return;
    c.lines++;
    if (S6_KNOWN.some((re) => re.test(msg))) return;
    c.unknown++;
    c.recent.push(msg.length > 200 ? msg.slice(0, 200) + '…' : msg);
    if (c.recent.length > RECENT_UNKNOWN) c.recent.shift();
  }

  function treeLine(line) {
    const t = dump.tiles[dump.index];
    if (!t) return;
    // what an Old Stuff Cell offers, or a Trader sells. An entry starts with its number: "+RelicList+1 [43]" (just the
    // ID: an Old Stuff Cell) or "+RelicList+1+BeBuy [false]" (a Trader's Id / Price / BeBuy, in any order: it varies)
    if (dump.phase === 1) {
      if (line.startsWith('+')) dump.inDetail = line.startsWith('+Detail');
      if (dump.inDetail) {
        if (line.includes('+RelicList')) dump.list = 'relics';
        else if (line.includes('+ItemList')) dump.list = 'items';
        const offer = t.offer || (t.offer = { relics: [], items: [] });
        const list = dump.list && offer[dump.list];
        if (!list) return;
        let field = null, value = null;
        const start = /\+(\d+)(?:\+(\w+))? \[([^\]]*)\]\s*$/.exec(line);
        if (start) {
          list.push({ id: null, price: null, bought: false });
          if (start[2]) { field = start[2]; value = start[3]; } else { list[list.length - 1].id = +start[3]; return; }
        } else {
          const f = /\+(\w+) \[([^\]]*)\]\s*$/.exec(line);
          if (f) { field = f[1]; value = f[2]; }
        }
        const e = list[list.length - 1];
        if (!e || !field) return;
        if (field === 'Id') e.id = +value; else if (field === 'Price') e.price = +value; else if (field === 'BeBuy') e.bought = value === 'true';
        return;
      }
    }
    if (line.includes('+Content+')) dump.section = 'content';
    else if (line.includes('+Base+')) dump.section = 'base';
    const m = /\+(\w+) \[([^\]]*)\]\s*$/.exec(line);
    if (!m) return;
    const [, key, value] = m;
    if (dump.phase === 1) {
      if (key === 'Name') { if (dump.section === 'content') t.content = value; else if (dump.section === 'base') t.name = value; }
      else if (key === 'IsExplored') t.explored = value === 'true';
      else if (key === 'IsPreview') t.preview = value === 'true';
      else if (key === 'TileType') t.kind = TILE_KIND[value] || 'other';
    } else if (dump.phase === 2) {
      if (key === 'bBlock') t.sealed = value === 'true';
      else if (key === 'Status') t.reachable = value === '1';
      else if (key === 'Cost') t.cost = +value || 0;
      else if (key === 'bDone') t.done = value === 'true';
      else if (key === 'bPreview' && value === 'true') t.preview = true;
    }
  }

  function line(raw) {
    const line = raw.replace(/\r$/, '');
    const ts = TIMESTAMPED.exec(line);
    // a copy for the run history, ahead of whatever the line itself brings about
    if (options.keepLines && (ts ? KEEP_LINE.test(line) || (dump && /\[Game\] $/.test(line)) : block || dump || bag)) events.push({ type: 'Line', text: line });

    if (ts) {
      now = timeOf(ts);
      if (bag) endBag();
      const body = line.slice(ts[0].length);
      const game = body.indexOf('[Game] ');
      const gameMsg = game >= 0 ? body.slice(game + 7).trim() : '';
      const header = /^S6GMMgr:PushLog (\S+) Id:\d+/.exec(gameMsg);
      if (header) { block = header[1]; blockStart = true; } else if (!(block && /^-{5,}/.test(gameMsg))) block = null; // a block lasts until the next timestamped line
      if (state.inMistville) checkGameLine(gameMsg);
      // a board dump: "S6GamePlay uiindex = N", then "[Game] " headers before each of its two trees
      const ui = /S6GamePlay uiindex = (\d+)/.exec(body);
      if (ui) {
        const n = +ui[1] - 1;
        if (n === 0 || !dump) { endDump(); dump = { tiles: Array.from({ length: 25 }, (_, i) => emptyTile(i)), seen: 0, index: -1, phase: 0, section: '' }; }
        dump.index = n; dump.phase = 0; dump.section = ''; dump.inDetail = false; dump.list = null; dump.seen = Math.max(dump.seen, n + 1);
        return;
      }
      if (dump && /\[Game\] $/.test(body)) { dump.phase++; dump.section = ''; return; }
      if (dump) endDump();

      const load = /LogLoad: LoadMap: (\S+)/.exec(body);
      if (load) {
        const name = load[1].split('/').pop();
        const mist = /\/Maps\/WuDu/i.test(load[1]);
        loadedSinceDay = true;
        if (!mist) settleResultScreen(); // back out of Mistville: the run the result screen showed is over
        if (mist !== state.inMistville || name !== state.map) { state.inMistville = mist; state.map = name; if (!mist) state.mazeOpen = false; touch(); }
        return;
      }
      if (/\[Game\] S6Maze Run\s*$/.test(body)) { state.mazeOpen = true; if (state.inMistville) emit('BoardOpened', { sanity: state.sanity }); touch(); return; }
      if (/\[Game\] S6Maze Destory\s*$/.test(body)) { state.mazeOpen = false; state.screen = null; if (state.inMistville) emit('BoardClosed', { sanity: state.sanity }); touch(); return; }
      if (/OpenView S6Result/.test(body)) { if (state.run && !state.ended) resultScreen = now; return; }
      const intelButton = /S6PrepareExplore_C_Btn(Confirm|Pass)/.exec(body);
      if (intelButton) { intelPending = intelButton[1] === 'Confirm' ? 'bought' : 'skipped'; return; }
      const page = /\[Game\] (S6ChooseRelic|S6Shop|S6Furnace|S6ChooseItem|S6PrepareExplore) (Run|Destory)\s*$/.exec(body);
      if (page) {
        if (page[2] === 'Run') { state.screen = SCREENS[page[1]]; openOffer(OFFER_KIND[state.screen]); }
        else if (state.screen === SCREENS[page[1]]) {
          state.screen = null;
          if (state.offer && state.offer.took) state.offer = null; // leaving a Trader you bought from
        }
        touch();
        return;
      }
      const msg = /MsgMgr@:Show MsgValue = (.+)$/.exec(body);
      // "Obtained Old Stuff:Baby Bear" gets its missing space; a colon inside the name ("Amulet: Poverty") already has one
      if (msg && state.inMistville) { state.lastMessage = msg[1].trim().replace(/^([^:]+):(?=\S)/, '$1: '); state.lastMessageAt = timeOf(ts); emit('Toast', { text: state.lastMessage }); touch(); }
      return;
    }

    if (state.inMistville && (block || dump)) state.logCheck.lines++; // a Mistville block's or dump's line

    // a pick, the Trader or an upgrade opening: the first line of an "AreaDoInteraction" block
    if (block === 'AreaDoInteraction' && blockStart && line.trim()) {
      blockStart = false;
      const opened = DO_INTERACTION.find(([start]) => line.trim().startsWith(start));
      if (opened) { openOffer(opened[1]); return; }
    }

    // inside a board dump: tree lines belong to the current tile
    if (dump && /^[+|]/.test(line)) { treeLine(line); return; }

    // bag listings run until the first line that isn't an entry
    if (bag) {
      const r = bag === 'relic' ? /^遗物序号:(\d+)等级:(\d+) 遗物名:(.+?) 遗物ID(\d+)\s*$/.exec(line) : /^道具序号:(\d+) 剩余使用次数:(\d+) 道具名:(.+?) 道具ID(\d+)\s*$/.exec(line);
      if (r) { bagList.push(bag === 'relic' ? { name: r[3].trim(), level: +r[2], id: +r[4] } : { name: r[3].trim(), uses: +r[2], id: +r[4] }); return; }
      endBag();
    }
    if (line === '遗物背包变化:') { bag = 'relic'; bagList = []; return; }
    if (line === '道具背包变化:') { bag = 'item'; bagList = []; return; }

    const floor = /^当前层数:(\d+)/.exec(line);
    if (floor) {
      const day = +floor[1];
      const fresh = day === 1 && (state.day !== 1 || loadedSinceDay);
      if (fresh) newRun();
      else if (!state.run) state.run = 1; // the log began mid-run (the game restarted during it): count it, so its end is recorded
      if (day !== state.day) { state.board = null; state.seen = {}; } // each day has a board of its own; the dump follows at once
      if (fresh || day !== state.day) {
        resultScreen = null; // a new day: the result screen wasn't the end of the run
        state.offer = null; state.lastTile = null;
        state.sanityRead = fresh; // a new run starts from its known Sanity; a new day waits for the log to say
        state.daily = { sanatorium: 0, bank: 0, stone: 0 }; state.exploreCost = null; state.baseExploreCost = null;
        emit('DayBegin', { day, dayExploreCost: null });
      }
      state.day = day; loadedSinceDay = false; state.logCheck.read.day++; touch();
      return;
    }
    // "新增遗物:" then "遗物名:Baby Bear 遗物ID66": Old Stuff the game hands you (an upgrade line ends in "等级:1")
    const added = /^遗物名:(.+?) 遗物ID(\d+)\s*$/.exec(line);
    if (added) {
      state.relicIds[+added[2]] = added[1].trim(); if (!state.obtained.includes(added[1].trim())) state.obtained.push(added[1].trim());
      tookSomething();
      emit('RelicGained', { id: +added[2], name: added[1].trim() });
      return;
    }
    // "点击：Tile 索引：12" (clicked) / "交互地块 12" (interacted): the Cell whose screen opens next
    const tile = /^(?:点击：Tile 索引：|交互地块 )(\d+)/.exec(line);
    if (tile) {
      state.lastTile = +tile[1];
      if (line.startsWith('交互地块')) {
        const params = line.slice(line.indexOf(tile[1]) + tile[1].length).trim();
        const t = state.board && state.board[+tile[1]];
        emit('TileInteracted', { index: +tile[1], name: (t && t.name) || null, params: params ? params.split(/\s+/).map(Number) : [] });
        // the daily tip counts what you actually used today: Sanatoriums, Banks and steles
        if (t && t.name === 'Sanatorium') state.daily.sanatorium++;
        else if (t && t.name === 'Bank') state.daily.bank++;
        else if (t && OMEN.test(t.name)) state.daily.stone++;
        touch();
      } else emit('TileClicked', { target: 'Tile', index: +tile[1] });
      return;
    }
    const act = /^(探索地块|地块消失|使用道具) (\d+)/.exec(line);
    if (act) {
      if (act[1] === '使用道具') emit('FoodUsed', { slot: +act[2], name: (state.items[+act[2]] || {}).name || null });
      else emit(act[1] === '探索地块' ? 'TileExplored' : 'TileVanished', { index: +act[2] });
      return;
    }
    const meet = /^遇到遭遇 ID = (\d+)/.exec(line);
    if (meet) { emit('EncounterOpened', { encounterId: +meet[1] }); return; }
    const choice = /^选择事件 (\d+) 选项 (\d+)/.exec(line);
    if (choice) { emit('EncounterSelected', { encounterId: +choice[1], option: +choice[2] }); return; }
    const cost = /^(探索理智修正结果|基础探索理智消耗):(\d+)/.exec(line);
    if (cost) {
      const was = [state.exploreCost, state.baseExploreCost];
      if (cost[1] === '探索理智修正结果') state.exploreCost = +cost[2]; else state.baseExploreCost = +cost[2];
      if (was[0] !== state.exploreCost || was[1] !== state.baseExploreCost) emit('CostChanged', { explore: state.exploreCost, base: state.baseExploreCost });
      touch();
      return;
    }
    const dungeon = /^当前地牢ID:(\d+)/.exec(line);
    if (dungeon) { if (+dungeon[1] !== state.dungeon) emit('Dungeon', { id: +dungeon[1] }); state.dungeon = +dungeon[1]; return; }
    const attr = /^属性名:(\d+)\.\S+ 变化值:(-?\d+)/.exec(line);
    if (attr) {
      const id = +attr[1], value = +attr[2];
      if (id === 1) { state.sanity = value; state.sanityPeak = Math.max(state.sanityPeak ?? 0, value); state.sanityRead = true; state.logCheck.read.Sanity++; touch(); }
      else if (id === 3) { state.coins = value; touch(); }
      else if (id === 2) { state.maxSanity = value; touch(); }
      else if (id === 24) { state.canUseFood = value !== 0; touch(); }
      else if (id === 32) { state.freeRefresh = value; touch(); }
      else if (id === 4) { state.foodSlots = value; touch(); }
      if (ATTRS[id] && id !== 1000) emit('AttrChanged', { attr: id, key: ATTRS[id], value });
      // the run's end: the day counter passing 15 is a clear; Sanity at 0 a fail
      if (id === 1000 && value === 16) endRun('win');
      if (id === 1 && value === 0) endRun('fail');
      return;
    }
  }

  return {
    state,
    /** Feeds text; returns true when the state changed. */
    feed(text) {
      changed = false;
      const parts = (rest + text).split('\n');
      rest = parts.pop();
      for (const p of parts) line(p);
      return changed;
    },
    /** The events since the last call, oldest first. */
    drain() { const out = events; events = []; return out; },
    /**
     * The log has gone quiet: a board or bag listing it ended on is complete (the game writes each in one go), so it's
     * taken now instead of when the next line comes (a Trader's refreshed stock shows at once). Returns true when the
     * state changed.
     */
    settle() {
      changed = false;
      if (bag) endBag();
      if (dump && dump.seen >= 25) endDump();
      return changed;
    },
    /** The end of a log that won't grow (an older log read into the history): a waiting result screen decides. */
    finish() { if (rest) { const last = rest; rest = ''; line(last); } if (bag) endBag(); endDump(); settleResultScreen(); },
    /** The log was replaced (the game restarted): start over. */
    reset() { rest = ''; bag = null; dump = null; block = null; blockStart = false; lastBoard = null; lastOfferContents = null; intelPending = null; events = []; now = null; resultScreen = null; Object.assign(state, createParser({ relicIds: state.relicIds, foodIds: state.foodIds }).state); },
  };
}

/**
 * "The log format may have changed", from the parser's state, while in Mistville or in a run: null, or
 * { unknown, lines, ratio } when too many of Mistville's lines aren't recognised, or { missing, boardOpens } when the
 * board has opened 3 times and no day, Sanity or board line was read (without a day line no run starts, so this
 * one doesn't wait for a run).
 */
function formatAlert(s) {
  const c = s.logCheck;
  if (!s.inMistville && !(s.run && !s.ended)) return null;
  if (c.lines >= FORMAT_MIN_LINES && c.unknown / c.lines >= FORMAT_UNKNOWN_RATIO) return { unknown: c.unknown, lines: c.lines, ratio: c.unknown / c.lines };
  const missing = Object.keys(c.read).filter((k) => c.read[k] === 0);
  if (c.boardOpens >= 3 && missing.length) return { missing, boardOpens: c.boardOpens };
  return null;
}

module.exports = { createParser, formatAlert, TILE_KIND, OFFER_KIND };
