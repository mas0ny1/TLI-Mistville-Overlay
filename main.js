// Mistville Overlay: a small card over Torchlight: Infinite with advice (what to pick, Sanity warnings, build
// progress) and the day's board, kept up to date from the game's own log (UE_game.log). It only reads the log: no
// screen capture, no clicks, no administrator rights, and nothing is sent anywhere.

const { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeImage, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { createParser } = require('./parser');
const { importBackups } = require('./backups');
const { buildView } = require('./view');
const { createHistory } = require('./history');
const advisor = require('./advisor/adapt');

if (!app.requestSingleInstanceLock()) app.quit();

// --log=<file> follows that log instead of finding the game's; --snapshot=<png> saves a picture of the card and quits (tests)
const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const LOG_OVERRIDE = arg('log');
const SNAPSHOT = arg('snapshot');
const STEAM_APP = '1974050'; // Torchlight: Infinite on Steam
const LOG_IN_GAME = ['UE_game', 'TorchLight', 'Saved', 'Logs', 'UE_game.log'];
const HOTKEYS = { toggle: 'Control+Alt+M', clickThrough: 'Control+Alt+Shift+M' }; // defaults; the Settings page can change them
const RECENT_EVENTS = 100; // the Monitor page's event stream
const WIDTH = 360;
const POLL_MS = 400;

// ---------- Settings and a small debug log ----------

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
// route: numbered steps to the Clock Tower (off by default); details: build progress while exploring (on by default)
// policy: the strategy settings (thresholds, weights); hotkeys: your own; mainAt: where the main window was
const settings = Object.assign({ logPath: null, at: null, visible: true, clickThrough: false, showOutside: false, folded: false, route: false, details: true,
  policy: null, hotkeys: {}, mainAt: null },
  (() => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { return {}; } })());
const saveSettings = () => { try { fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true }); fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch (e) { /* not kept */ } };
// Old Stuff and Food IDs learned from your bag (the offers name things only by ID), kept between sessions
const LEARNED_FILE = path.join(app.getPath('userData'), 'learned-ids.json');
const learned = (() => { try { return JSON.parse(fs.readFileSync(LEARNED_FILE, 'utf8')); } catch (e) { return { relicIds: {}, foodIds: {} }; } })();
let learnedCount = Object.keys(learned.relicIds || {}).length + Object.keys(learned.foodIds || {}).length;
function saveLearned(state) {
  const n = Object.keys(state.relicIds).length + Object.keys(state.foodIds).length;
  if (n <= learnedCount) return;
  learnedCount = n;
  try { fs.writeFileSync(LEARNED_FILE, JSON.stringify({ relicIds: state.relicIds, foodIds: state.foodIds }, null, 2)); } catch (e) { /* not kept */ }
}
const LOG_FILE = path.join(app.getPath('userData'), 'overlay.log');
// every run, for the History tab; and the gain cards (what you just got, and what it pairs with)
const history = createHistory(path.join(app.getPath('userData'), 'history'));
const gain = advisor.gainTracker();
let strategy = advisor.policy(settings.policy); // the thresholds and weights as the Settings page saved them
let recent = []; // the last RECENT_EVENTS events, for the Monitor page
function note(...parts) { try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${parts.join(' ')}\n`); } catch (e) { /* no debug log */ } }
const statOf = (p) => { try { return fs.statSync(p); } catch (e) { return null; } };

// ---------- Finding the game's log ----------

function regQuery(key, value) {
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/v', value], { windowsHide: true }, (err, out) => {
      const m = !err && new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`).exec(out);
      resolve(m ? m[1].trim() : null);
    });
  });
}
/** Your choice; else each Steam library with the game; else the launcher's folders. Newest wins. */
async function findLog() {
  if (LOG_OVERRIDE) return { file: path.resolve(LOG_OVERRIDE), by: 'given' };
  if (settings.logPath && statOf(settings.logPath)) return { file: settings.logPath, by: 'chosen' };
  const candidates = [];
  const roots = new Map();
  const addRoot = (p) => p && roots.set(path.resolve(p).toLowerCase(), path.resolve(p));
  for (const [key, value] of [['HKCU\\Software\\Valve\\Steam', 'SteamPath'], ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'], ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath']]) addRoot(await regQuery(key, value));
  addRoot('C:\\Program Files (x86)\\Steam');
  const libraries = new Map(roots);
  for (const root of roots.values()) {
    try {
      const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) { const lib = path.resolve(m[1].replace(/\\\\/g, '\\')); libraries.set(lib.toLowerCase(), lib); }
    } catch (e) { /* not a Steam folder */ }
  }
  for (const lib of libraries.values()) {
    try {
      const acf = fs.readFileSync(path.join(lib, 'steamapps', `appmanifest_${STEAM_APP}.acf`), 'utf8');
      const m = /"installdir"\s+"([^"]+)"/.exec(acf);
      if (m) candidates.push(path.join(lib, 'steamapps', 'common', m[1], ...LOG_IN_GAME));
    } catch (e) { /* not in this library */ }
  }
  for (const base of ['C:\\Program Files (x86)\\Torchlight Infinite', 'C:\\Program Files\\Torchlight Infinite']) candidates.push(path.join(base, 'Game', ...LOG_IN_GAME));
  const there = candidates.map((p) => ({ p, st: statOf(p) })).filter((x) => x.st && x.st.isFile()).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
  return there.length ? { file: there[0].p, by: 'found' } : { file: null, by: 'not found' };
}

// ---------- Following the log ----------

// the parser keeps each Mistville log line for the run history's copy, and the suggested order each offer opened with
const parserOptions = { keepLines: true, suggest: (s) => { const r = advisor.ranking(s, strategy); return r ? r.items.map((x) => x.name) : null; } };
const follow = { file: null, by: '', pos: 0, born: 0, parser: createParser(learned, parserOptions), decoder: new TextDecoder('utf-8'), busy: false, lastLook: 0 };
let importing = false, importedFor = null; // the game's older logs, read into the run history once per log followed

async function readMore() {
  if (follow.busy) return;
  follow.busy = true;
  try {
    if ((!follow.file || !statOf(follow.file)) && Date.now() - follow.lastLook > 5000) {
      follow.lastLook = Date.now();
      const found = await findLog();
      if (found.file !== follow.file) { Object.assign(follow, { file: found.file, by: found.by, pos: 0, born: 0 }); restart(); note(`log (${found.by}):`, found.file || 'none'); rebuildMenu(); }
    }
    const st = follow.file && statOf(follow.file);
    if (!st) return;
    // the game starts a new log each launch: smaller than where we were, or a different file
    if (st.size < follow.pos || (follow.born && st.birthtimeMs !== follow.born)) { note('log restarted'); restart(); }
    follow.born = st.birthtimeMs;
    // nothing new: a board or bag listing the log stopped on is complete, so it shows now
    if (st.size === follow.pos) { const settled = follow.parser.settle(); if (takeEvents() || settled) push(); return; }
    const fh = await fs.promises.open(follow.file, 'r');
    let changed = false;
    try {
      const buf = Buffer.alloc(1 << 20);
      while (follow.pos < st.size) {
        const { bytesRead } = await fh.read(buf, 0, Math.min(buf.length, st.size - follow.pos), follow.pos);
        if (!bytesRead) break;
        follow.pos += bytesRead;
        if (follow.parser.feed(follow.decoder.decode(buf.subarray(0, bytesRead), { stream: true }))) changed = true;
        if (takeEvents()) changed = true;
      }
    } finally { await fh.close(); }
    if (changed) push();
    if (follow.file !== importedFor) importOlderLogs();
  } catch (e) { note('reading the log failed:', String((e && e.message) || e)); } finally { follow.busy = false; }
}
/** Runs in the game's older logs (sessions the overlay didn't see) go into the history too, in the background. */
function importOlderLogs() {
  if (importing || !follow.file) return;
  importing = true;
  const file = follow.file;
  importBackups(file, history, () => createParser(learned, parserOptions), note)
    .then((n) => { if (n) note(`${n} older log(s) read into the run history`); })
    .catch((e) => note('reading older logs failed:', String((e && e.message) || e)))
    .finally(() => { importing = false; importedFor = file; });
}
function restart() { follow.pos = 0; follow.parser.reset(); follow.decoder = new TextDecoder('utf-8'); history.close(); gain.reset(); recent = []; push(); }
/** The parser's new events go to the run history and the gain cards. */
function takeEvents() {
  const events = [];
  for (const e of follow.parser.drain()) {
    if (e.type === 'Line') { history.line(e.text); continue; } // a log line for the run's copy, not an event
    events.push(e); history.record(e); gain.apply(e);
  }
  // the Monitor's event stream leaves out the boards (the history keeps them)
  if (events.length) { recent.push(...events.map((e) => (e.tiles ? Object.assign({}, e, { tiles: undefined }) : e))); if (recent.length > RECENT_EVENTS) recent.splice(0, recent.length - RECENT_EVENTS); }
  return events.length > 0;
}

// ---------- The card ----------

let card = null, mainWin = null, tray = null, quitting = false, lastView = null, pushTimer = null, lastNoted = '', lastAlert = '';
function push() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    lastView = Object.assign(buildView(follow.parser.state, gain.current, strategy), { log: follow.file ? { file: follow.file, by: follow.by } : null, folded: settings.folded, clickThrough: settings.clickThrough,
      settings: { route: !!settings.route, details: !!settings.details } });
    saveLearned(follow.parser.state);
    const where = lastView.inMistville ? `in Mistville (${follow.parser.state.map}), run ${follow.parser.state.run} day ${lastView.day}, ${lastView.relics.length} Old Stuff, ${lastView.combat ? 'board closed (combat)' : 'board open'}` : `not in Mistville (${follow.parser.state.map || 'no map yet'})`;
    if (where !== lastNoted) { lastNoted = where; note(where); }
    const alert = lastView.logCheck.alert ? JSON.stringify(lastView.logCheck.alert) : '';
    if (alert && !lastAlert) note('the log format may have changed:', alert, '| last unrecognised lines:', JSON.stringify(lastView.logCheck.recent.slice(-5)));
    lastAlert = alert;
    if (card && !card.isDestroyed()) card.webContents.send('view', lastView);
    sendMain();
    updateCard();
  }, 120);
}
/** The main window gets the card's view, the recent events and the log's status. */
function sendMain() {
  if (!mainWin || mainWin.isDestroyed() || !lastView) return;
  mainWin.webContents.send('view', Object.assign({}, lastView, { events: recent, cardVisible: settings.visible, logChosen: !!settings.logPath }));
}
const wanted = () => settings.visible && (settings.showOutside || (lastView && lastView.inMistville));
function updateCard() {
  if (!card || card.isDestroyed()) return;
  if (wanted()) { if (!card.isVisible()) { card.showInactive(); note('card shown'); } card.setAlwaysOnTop(true, 'screen-saver'); } else if (card.isVisible()) { card.hide(); note('card hidden'); }
  rebuildMenu();
}
const onScreen = (b) => screen.getAllDisplays().some((d) => { const a = d.workArea; return b.x + 60 > a.x && b.x < a.x + a.width - 60 && b.y >= a.y - 10 && b.y < a.y + a.height - 40; });
function makeCard() {
  const area = screen.getPrimaryDisplay().workArea;
  const at = settings.at && onScreen(settings.at) ? settings.at : { x: area.x + area.width - WIDTH - 24, y: area.y + 120 };
  card = new BrowserWindow({
    x: at.x, y: at.y, width: WIDTH, height: 200, show: false, frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false,
    fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, hasShadow: false, title: 'Mistville Overlay', icon: appIcon(),
    webPreferences: { preload: path.join(__dirname, 'overlay', 'preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false, spellcheck: false },
  });
  card.setAlwaysOnTop(true, 'screen-saver');
  card.loadFile(path.join(__dirname, 'overlay', 'overlay.html'));
  card.webContents.on('will-navigate', (e) => e.preventDefault());
  card.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  card.webContents.on('did-finish-load', () => { if (lastView) card.webContents.send('view', lastView); applyClickThrough(); });
  card.webContents.on('console-message', (e) => { if (e.level === 'error') note('card:', String(e.message || '').slice(0, 300)); });
  card.on('moved', () => { const b = card.getBounds(); settings.at = { x: b.x, y: b.y }; saveSettings(); });
  card.on('close', (e) => { if (!quitting) { e.preventDefault(); setVisible(false); } });
}
// ---------- The main window: monitor, history, catalog and settings ----------

function openMain() {
  if (mainWin && !mainWin.isDestroyed()) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); return; }
  const b = settings.mainAt && onScreen(settings.mainAt) ? settings.mainAt : { width: 1180, height: 820 };
  mainWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width || 1180, height: b.height || 820, minWidth: 820, minHeight: 560, show: false, backgroundColor: '#0a0f1e',
    title: 'Mistville Overlay', icon: appIcon(), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'overlay', 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false },
  });
  mainWin.loadFile(path.join(__dirname, 'overlay', 'window.html'));
  mainWin.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWin.webContents.on('did-finish-load', sendMain);
  mainWin.webContents.on('console-message', (e) => { if (e.level === 'error') note('main window:', String(e.message || '').slice(0, 300)); });
  mainWin.once('ready-to-show', () => mainWin.show());
  const keep = () => { if (!mainWin.isMinimized() && !mainWin.isMaximized()) { settings.mainAt = mainWin.getBounds(); saveSettings(); } };
  mainWin.on('moved', keep); mainWin.on('resized', keep);
  mainWin.on('closed', () => { mainWin = null; });
}
const fromMain = (e) => mainWin && !mainWin.isDestroyed() && e.sender === mainWin.webContents;

// hotkeys: the defaults, or what the Settings page saved; returns those another program has taken
function registerHotkeys() {
  globalShortcut.unregisterAll();
  const taken = [];
  hotkeysOn = {};
  for (const [which, fn] of [['toggle', () => setVisible(!settings.visible)], ['clickThrough', () => setClickThrough(!settings.clickThrough)]]) {
    const key = hotkey(which);
    try { hotkeysOn[which] = globalShortcut.register(key, fn); } catch (e) { hotkeysOn[which] = false; }
    if (!hotkeysOn[which]) { taken.push(key); note('hotkey taken by another program (or not a valid key):', key); }
  }
  rebuildMenu();
  return taken;
}
let hotkeysOn = {}; // which hotkeys registered: the tray menu shows only those
const hotkey = (which) => (settings.hotkeys && settings.hotkeys[which]) || HOTKEYS[which];

ipcMain.on('card:height', (e, h) => {
  if (!card || e.sender !== card.webContents || !Number.isFinite(h)) return;
  const b = card.getBounds(); const height = Math.max(60, Math.min(1400, Math.round(h)));
  if (height !== b.height) card.setBounds({ x: b.x, y: b.y, width: WIDTH, height });
});
ipcMain.on('card:hide', (e) => { if (card && e.sender === card.webContents) setVisible(false); });
// the History and Catalog tabs (card and main window) ask for their data when they open
const fromCard = (e) => card && e.sender === card.webContents;
const fromUs = (e) => fromCard(e) || fromMain(e);
ipcMain.handle('history:list', (e) => (fromUs(e) ? history.list() : []));
ipcMain.handle('history:run', (e, runId) => (fromUs(e) ? history.detail(String(runId)) : null));
ipcMain.handle('catalog:get', (e) => (fromUs(e) ? advisor.catalogView(follow.parser.state) : null));
ipcMain.on('main:open', (e) => { if (fromCard(e)) openMain(); });
ipcMain.on('card:toggle', (e) => { if (fromMain(e)) setVisible(!settings.visible); });
ipcMain.on('log:choose', (e) => { if (fromMain(e)) pickLog(); });
ipcMain.on('log:auto', (e) => { if (fromMain(e)) findLogAgain(); });
// the Settings page: the strategy settings and the hotkeys
ipcMain.handle('policy:get', (e) => (fromMain(e) ? {
  saved: settings.policy || {}, hotkeys: { toggle: (settings.hotkeys || {}).toggle || '', clickThrough: (settings.hotkeys || {}).clickThrough || '' },
  defaults: Object.assign(advisor.defaults(), { hotkeys: HOTKEYS }), card: { route: !!settings.route, details: !!settings.details },
} : null));
ipcMain.handle('policy:set', (e, p) => {
  if (!fromMain(e) || !p || typeof p !== 'object') return { ok: false, message: 'Not saved' };
  const t = p.thresholds;
  if (t && !(t.yellowRatio > 0 && t.redRatio > 0)) return { ok: false, message: 'Thresholds must be positive' };
  if (p.weights != null && (typeof p.weights !== 'object' || Array.isArray(p.weights))) return { ok: false, message: 'The weights must be a JSON object' };
  settings.policy = (t || p.weights) ? { thresholds: t || null, weights: p.weights || null } : null;
  const hk = p.hotkeys || {};
  settings.hotkeys = { toggle: String(hk.toggle || '').trim(), clickThrough: String(hk.clickThrough || '').trim() };
  saveSettings();
  strategy = advisor.policy(settings.policy);
  const taken = registerHotkeys();
  note('settings saved:', JSON.stringify({ thresholds: settings.policy && settings.policy.thresholds, weights: !!(settings.policy && settings.policy.weights), hotkeys: settings.hotkeys }));
  push();
  return taken.length ? { ok: false, message: `Saved, but ${taken.join(' and ')} couldn't be set (taken by another program, or not a valid key)` } : { ok: true, message: 'Saved; applies now' };
});
ipcMain.on('card:fold', (e, folded) => { if (card && e.sender === card.webContents) { settings.folded = !!folded; saveSettings(); push(); } });
// the card's settings menu: only these switches
ipcMain.on('card:setting', (e, key, value) => {
  if (!fromUs(e) || !['route', 'details'].includes(key)) return;
  settings[key] = !!value; saveSettings(); note(`setting ${key}: ${settings[key]}`); push();
});

function setVisible(on) { settings.visible = !!on; saveSettings(); updateCard(); }
function applyClickThrough() { if (card && !card.isDestroyed()) card.setIgnoreMouseEvents(!!settings.clickThrough, { forward: true }); }
function setClickThrough(on) { settings.clickThrough = !!on; saveSettings(); applyClickThrough(); push(); rebuildMenu(); }

// ---------- Tray ----------

let icon = null;
/** A small teal ring, drawn here so the app needs no image files. */
function appIcon() {
  if (icon) return icon;
  const n = 32, buf = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - 15.5, y - 15.5), i = (y * n + x) * 4;
    const ring = d < 15 && d > 9.5, dot = d < 5;
    if (ring || dot) { buf[i] = 0xf0; buf[i + 1] = 0xc9; buf[i + 2] = 0x4c; buf[i + 3] = 255; } // BGRA: #4cc9f0
  }
  icon = nativeImage.createFromBitmap(buf, { width: n, height: n });
  return icon;
}
let menuKey = null;
function rebuildMenu() {
  if (!tray) return;
  const v = lastView;
  const status = !follow.file ? 'Game log not found yet' : v && v.inMistville ? `In Mistville · day ${v.day || '?'}` : 'Waiting for Mistville';
  // only when something on it changes: Windows closes a tray menu that's replaced while it opens, and the card updates
  // several times a second while the game logs, so a right-click often showed nothing
  const key = JSON.stringify([status, follow.file, settings.visible, settings.clickThrough, settings.showOutside, !!settings.logPath, hotkeysOn, hotkey('toggle'), hotkey('clickThrough')]);
  if (key === menuKey) return;
  menuKey = key;
  tray.setToolTip(`Mistville Overlay · ${status}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: status, enabled: false },
    { label: follow.file ? `Log: ${follow.file}` : 'Log: not found', enabled: false },
    { type: 'separator' },
    { label: 'Open the main window (monitor, history, catalog, settings)', click: openMain },
    { label: 'Show the overlay', type: 'checkbox', checked: settings.visible, accelerator: hotkeysOn.toggle ? hotkey('toggle') : undefined, click: (m) => setVisible(m.checked) },
    { label: 'Click-through (mouse passes to the game)', type: 'checkbox', checked: settings.clickThrough, accelerator: hotkeysOn.clickThrough ? hotkey('clickThrough') : undefined, click: (m) => setClickThrough(m.checked) },
    { label: 'Show outside Mistville too', type: 'checkbox', checked: settings.showOutside, click: (m) => { settings.showOutside = m.checked; saveSettings(); updateCard(); } },
    { label: 'Move back to the top right', click: () => { settings.at = null; saveSettings(); const a = screen.getPrimaryDisplay().workArea; card.setBounds({ x: a.x + a.width - WIDTH - 24, y: a.y + 120, width: WIDTH, height: card.getBounds().height }); } },
    { type: 'separator' },
    { label: 'Choose UE_game.log…', click: pickLog },
    ...(settings.logPath ? [{ label: 'Find the log automatically', click: findLogAgain }] : []),
    { label: 'Open the overlay’s own log', click: () => shell.openPath(LOG_FILE) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
}
function findLogAgain() { settings.logPath = null; saveSettings(); follow.file = null; follow.lastLook = 0; readMore(); }
async function pickLog() {
  const res = await dialog.showOpenDialog({ title: 'Choose UE_game.log', defaultPath: follow.file || undefined, properties: ['openFile'], filters: [{ name: 'Torchlight: Infinite log', extensions: ['log'] }] });
  if (res.canceled || !res.filePaths[0]) return;
  settings.logPath = res.filePaths[0]; saveSettings(); follow.file = null; follow.lastLook = 0; readMore();
}

// ---------- Start ----------

app.on('second-instance', () => setVisible(true));
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { quitting = true; history.flush(); });
app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(() => {
  app.setAppUserModelId('local.tli-tools.mistville-overlay');
  note(`Mistville Overlay ${app.getVersion()} starting`);
  makeCard();
  tray = new Tray(appIcon().resize({ width: 16, height: 16 }));
  tray.on('click', () => setVisible(!settings.visible));
  tray.on('double-click', openMain);
  registerHotkeys();
  readMore();
  setInterval(readMore, POLL_MS);
  if (SNAPSHOT) setTimeout(() => card.webContents.capturePage().then((img) => { fs.writeFileSync(SNAPSHOT, img.toPNG()); quitting = true; app.quit(); }), 4000);
});
