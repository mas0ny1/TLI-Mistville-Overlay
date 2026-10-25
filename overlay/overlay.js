// The card over the game: draws the view main.js sends (view.js) and reports its height.
// Live: the advice line, the day's budget and tip, gain cards, then the counts of the day's places and the grid;
// at an Old Stuff pick, the Trader, an upgrade or a Food pick, the suggested order drops down under the board.
// History and Catalog: the run history and catalog (panels.js, shared with the main window), asked for when the
// tab opens. ⚙: the route, build progress, and the main window (monitor and settings).
(function () {
  var api = window.MistCard, P = window.MistPanels;
  var $ = function (id) { return document.getElementById(id); };
  var esc = P.esc, plural = P.plural, flag = P.flag;
  var fit = function () { api.height($('card').getBoundingClientRect().height + 12); };
  var folded = false, combat = false, peek = false, settingsOpen = false, last = null;
  var tab = 'live', gainTimer = null;
  var ui = { runs: null, review: null, cat: null, catPart: 'relics', catFilter: '', openBuild: null }; // History, Catalog, build progress
  var GAIN_CARD_MS = 6000; // a gain card shows for six seconds
  var cellName = function (i) { return 'row ' + (Math.floor(i / 5) + 1) + ' col ' + (i % 5 + 1); };

  var mark = P.mark;
  var POI_MARK = { Bank: ['$', 'bank'], Sanatorium: ['✚', 'sanatorium'], Trader: ['T', 'trader'], Alchemy: ['⚒', 'alchemy'], 'Old Stuff': ['★', 'oldstuff'], Food: ['♨', 'food'], 'Watch Tower': ['♜', 'tower'], Folklores: ['✦', 'folk'] };

  // ---------- Live, exploring: the advice lines, the counts and the grid ----------

  function counts(v) {
    var p = v.pois, hp = P.sanityBar(v.sanityPlan);
    if (!p || !p.list.length) return hp ? '<div class="counts">' + hp + '</div>' : '';
    var chips = p.list.map(function (x) {
      var m = POI_MARK[x.label] || ['•', ''];
      var done = x.total != null && x.found >= x.total && !x.unused.length;
      var n = x.total != null ? Math.min(x.found, x.total) + '/' + x.total + (x.found > x.total ? '+' + (x.found - x.total) : '') : String(x.found);
      var tip = x.label + ': ' + (x.total != null ? x.found + ' of ' + x.total + ' found' : x.found + ' found') + (x.unused.length ? ', not used yet: ' + x.unused.map(cellName).join(', ') : '') +
        (x.unused.length || x.missing ? ' (orange bar: revealed, not used yet; blue dashes: still hidden)' : '');
      // a bar under the count while any is left on the floor: orange if revealed but not used, blue dashes if still hidden
      var left = (x.unused.length ? ' unused' : '') + (x.missing ? ' hidden' : '');
      return '<span class="cnt' + (done ? ' done' : x.missing ? ' short' : '') + left + '" title="' + esc(tip) + '"><i class="m ' + m[1] + '">' + m[0] + '</i>' + n + (x.unused.length ? '<em>•' + x.unused.length + '</em>' : '') + '</span>';
    }).join('');
    var warn = '';
    if (p.exitFound && (p.missing.length || p.unused.length)) {
      var parts = [];
      if (p.missing.length) parts.push(p.missing.map(function (m) { return plural(m.n, m.label); }).join(', ') + ' hidden (' + plural(p.hidden, 'cell') + ' left)');
      if (p.unused.length) parts.push(p.unused.map(function (u) { return u.label + ' unused'; }).join(', '));
      warn = '<div class="leave"><b>Before the Clock Tower:</b> ' + esc(parts.join(' · ')) + '</div>';
    }
    return '<div class="counts">' + chips + hp + '</div>' + warn;
  }

  function board(v) {
    if (!v.board) return '';
    var showRoute = v.settings && v.settings.route;
    var route = v.route || { steps: [], candidates: [] };
    var cand = {}; (route.candidates || []).forEach(function (i) { cand[i] = true; });
    var step = {}, cut = {}, unusedCell = {};
    if (showRoute) (route.steps || []).forEach(function (s, n) { if (s.action === 'explore') step[s.index] = n + 1; else cut[s.index] = n + 1; });
    ((v.pois && v.pois.unused) || []).forEach(function (u) { u.cells.forEach(function (i) { unusedCell[i] = true; }); });
    var cells = v.board.map(function (t) {
      var cls = ['cell'], g = '', tip = t.name || (t.explored ? '' : 'Unexplored'), m = mark(t);
      if (t.explored) cls.push('explored');
      if (t.reachable && !t.explored && !t.sealed) cls.push('reachable');
      if (t.preview && !t.explored) cls.push('preview');
      if (step[t.index]) {
        cls.push('route', cand[t.index] ? 'cand' : 'via'); if (step[t.index] === 1) cls.push('next');
        g = String(step[t.index]); tip = (step[t.index] === 1 ? 'Explore this next' : 'Step ' + step[t.index]) + (t.name ? ' · ' + t.name : '');
      } else if (cut[t.index]) {
        cls.push('stele', 'cut'); if (cut[t.index] === 1) cls.push('next'); g = '✂'; tip = 'Remove this stele (step ' + cut[t.index] + ')';
      } else if (m && (t.explored || t.preview || t.kind === 'start' || t.kind === 'exit')) {
        cls.push('k-' + m[2]); g = m[1];
      } else if (t.sealed && !t.explored) { cls.push('sealed'); g = '✕'; tip = 'Sealed off'; }
      else if (cand[t.index] && !t.explored) { cls.push('cand'); g = '?'; tip = 'The Clock Tower could be here'; }
      if (unusedCell[t.index]) { cls.push('unused'); tip = (t.name || '') + ' · revealed, not used yet'; }
      return '<div class="' + cls.join(' ') + '" title="' + esc(tip) + '">' + g + '</div>';
    }).join('');
    var line = '';
    if (v.exit.found) line = '<span class="ok">Clock Tower found</span>';
    else if (route.known != null) line = '<span class="ok">Clock Tower previewed</span>';
    else if (route.candidates && route.candidates.length) line = '<span class="q">?</span> Clock Tower: ' + plural(route.candidates.length, 'possible cell');
    if (showRoute && route.steps && route.steps.length) line += ' · next: <b class="n1">' + (route.steps[0].action === 'explore' ? '1' : '✂') + '</b> · ~' + esc(route.expectedTurns) + ' turns';
    return '<div class="board">' + cells + '</div><div class="bline">' + line + '</div>';
  }

  // the advice line (Sanity warning, a sealed-off Clock Tower, the odd-day reserve, a worthwhile detour), no Coin
  // source yet, the day's budget and today's tip (the place every board has today, and what you've used)
  function adviceLines(v) {
    var f = v.explore;
    if (!f) return '';
    var h = [];
    if (f.advice) h.push('<div class="fadvice ' + esc(f.adviceLevel) + '">' + esc(f.advice) + '</div>');
    h.push(P.coinWarning(f));
    var budget = [];
    if (v.ended) budget.push(v.ended === 'win' ? '★ Run cleared' : '✖ Run failed');
    else if (f.tilesLeft != null) budget.push('<b>~' + esc(f.tilesLeft) + '</b> ' + (f.tilesLeft === 1 ? 'Cell' : 'Cells') + ' left');
    else budget.push('Cost unknown');
    if (f.clearHint) budget.push(esc(f.clearHint));
    if (f.sanityPending && !v.ended) budget.push('<span class="muted">Sanity updates when you first act</span>');
    h.push('<div class="budget">' + budget.join(' · ') + '</div>');
    if (f.dailyTip) h.push('<div class="dtip">' + esc(f.dailyTip) + '</div>');
    return h.join('');
  }

  // the gain card: what you just got (or upgraded), its effect, what it pairs with
  function gainCard(v) {
    var g = v.gainCard;
    if (!g || !g.at || Date.now() - g.at > GAIN_CARD_MS) return '';
    clearTimeout(gainTimer);
    gainTimer = setTimeout(function () { if (last) render(last); }, GAIN_CARD_MS - (Date.now() - g.at) + 50);
    var badge = g.upgraded ? 'Upgraded' : g.kind === 'relic' ? 'Old Stuff' : 'Food';
    return '<div class="gain"><div class="grow"><span class="gbadge ' + (g.upgraded ? 'up' : g.kind) + '">' + badge + '</span><b>' + esc(g.name) + '</b>' +
      (g.kind === 'food' && g.initialUses != null ? '<span class="uses">×' + esc(g.initialUses) + '</span>' : '') + '</div>' +
      '<div class="geff">' + esc(g.effect) + '</div>' +
      (g.synergyLines || []).map(function (l) { return '<div class="gsyn">' + esc(l) + '</div>'; }).join('') +
      (!g.upgraded && g.upgradeEffect ? '<div class="gup">Upgraded: ' + esc(g.upgradeEffect) + (g.upgradeCost != null ? ' (cost ' + esc(g.upgradeCost) + ')' : '') + '</div>' : '') + '</div>';
  }

  function foodLine(v) {
    var f = v.explore;
    if (!v.items.length && !(f && f.canUseFood === false)) return '';
    return '<div class="foodline"><span class="muted">Food:</span> ' + (v.items.length ? v.items.map(function (x) { return esc(x.name) + '<b>×' + esc(x.uses) + '</b>'; }).join(' · ') : '<span class="muted">none</span>') +
      (f && f.canUseFood === false ? ' <span class="no">Blocked (Anorexia)</span>' : '') + '</div>';
  }

  // ---------- an offer is open: the suggested order drops down under the board ----------

  // the top six for the kind of offer (not what's on it); it stays until you get something or a new day starts
  var TITLES = { relic: 'Old Stuff pick · suggested order', shop: 'Trader · suggested order', furnaceUpgrade: 'Workshop upgrade · by gain', food: 'Food pick · suggested order' };
  var EMPTY = { relic: 'Nothing left to suggest.', shop: 'Nothing left to suggest.', furnaceUpgrade: 'No Old Stuff to upgrade.', food: 'You hold no Food.' };
  var shownOffer = null; // the offer already on the card: it slides down only when it first opens

  function ranking(v) {
    var r = v.ranking, h = [];
    var key = r.kind + ':' + (v.offer ? v.offer.cell : '');
    var drop = key !== shownOffer;
    shownOffer = key;
    h.push('<h2>' + esc(TITLES[r.kind] || r.kind) + '</h2>');
    if (r.phaseStrategy) h.push('<div class="advice">' + esc(r.phaseStrategy) + '</div>');
    if (r.buildSummary) h.push('<div class="goals">' + esc(r.buildSummary) + '</div>');
    if (r.kind === 'food') h.push('<div class="sub">Your Food, by when to eat it</div>'); // what's listed at a Food pick
    // the ones actually on offer in this pick or Trader are highlighted, with the Trader's price
    var row = function (x, n) {
      var o = x.offered;
      var here = o ? '<span class="tag offer">' + (o.bought ? 'bought' : r.kind === 'shop' ? 'in stock' + (o.price != null ? ' · ' + esc(o.price) : '') : 'on offer') + '</span>' : '';
      return '<div class="rk' + (o ? ' offered' + (o.bought ? ' bought' : '') : '') + '"><span class="no">' + n + '</span><div class="rkb"><div class="rkt"><b>' + esc(x.name) + '</b>' + flag(x) + here + '</div>' +
        (x.note ? '<div class="why' + (x.owned ? ' owned' : '') + '">' + esc(x.note) + '</div>' : '') + '</div></div>';
    };
    h.push(r.items.length ? r.items.map(function (x, i) { return row(x, i + 1); }).join('') : '<div class="muted">' + EMPTY[r.kind] + '</div>');
    // none of the six on offer: the highest of what is, with its place in the order
    if (r.best) h.push('<div class="sub">Highest of what\'s on offer</div>' + row(r.best, r.best.rank));
    return '<div class="ranking offerpanel' + (drop ? ' drop' : '') + '">' + h.join('') + '</div>';
  }

  // ---------- build progress (Settings → Build progress) ----------

  function details(v) {
    return P.buildProgress(v.explore && v.explore.builds, ui.openBuild) +
      '<div><h2>Old Stuff (' + v.relics.length + ')</h2><div class="chips">' + P.relicChips(v.relics) + '</div></div>';
  }

  function settingsPanel(v) {
    var s = v.settings || {};
    var sw = function (key, on, label, sub) { return '<label class="set"><input type="checkbox" data-k="' + key + '"' + (on ? ' checked' : '') + '><span><b>' + label + '</b><br><small>' + sub + '</small></span></label>'; };
    return '<div class="settings"><h2>Settings</h2>' +
      sw('route', s.route, 'Route to the Clock Tower', 'Numbered steps for the cheapest exploring order.') +
      sw('details', s.details, 'Build progress while exploring', 'Each build with what it still needs (click one for its Old Stuff), and your Old Stuff, under the grid.') +
      '<button class="btn wide" data-act="open-main">Open the main window: monitor, history, catalog, settings</button></div>';
  }

  // ---------- drawing ----------

  function setFoldButton() {
    $('fold').textContent = (combat ? !peek : folded) ? '▸' : '▾';
    $('fold').title = combat ? (peek ? 'Fold up again until the fight ends' : 'Peek at the card during the fight') : 'Fold';
  }
  function tabs() {
    var t = function (id, label) { return '<button class="tab' + (tab === id ? ' on' : '') + '" data-tab="' + id + '">' + label + '</button>'; };
    return '<div class="tabs fold-hide">' + t('live', 'Live') + t('history', 'History') + t('catalog', 'Catalog') + '</div>';
  }

  function live(v) {
    var h = [];
    var alert = v.logCheck && v.logCheck.alert;
    if (alert) h.push('<div class="logwarn"><b>⚠ The log format may have changed</b><br>' + esc(P.formatText(alert)) + ' Until the overlay is updated the card may be wrong (main window → Monitor).</div>');
    if (!v.log) h.push('<div class="waiting">Can’t find UE_game.log yet. Start the game, or choose the log from the tray icon.</div>');
    else if (!v.inMistville) h.push('<div class="waiting">Not in Mistville. The card fills in when you enter.</div>');
    else {
      h.push(gainCard(v));
      h.push(adviceLines(v));
      h.push(counts(v));
      h.push(board(v));
      h.push(foodLine(v));
      if (v.ranking) h.push(ranking(v)); else shownOffer = null;
      if (v.intel === 'bought') h.push('<div class="muted">Intel bought: ' + (v.intelItem ? esc(v.intelItem) : 'its Old Stuff shows after your first pick') + '</div>');
      if (v.settings && v.settings.details) h.push('<div class="fold-hide stack">' + details(v) + '</div>');
    }
    if (v.message && v.messageAt && Date.now() - v.messageAt < 15000) h.push('<div class="msg">' + esc(v.message) + '</div>');
    return h.join('');
  }

  function render(v) {
    last = v;
    folded = !!v.folded;
    if (!!v.combat !== combat) { combat = !!v.combat; peek = false; }
    $('card').classList.toggle('combat', combat);
    $('card').classList.toggle('peek', peek);
    $('card').classList.toggle('folded', folded);
    $('card').classList.toggle('clickthrough', !!v.clickThrough);
    setFoldButton();
    $('day').innerHTML = v.day ? 'Day <b>' + esc(v.day) + '</b>' : '';
    $('sanity').innerHTML = v.sanity != null ? 'Sanity <b>' + esc(v.sanity) + '</b>' : '';
    $('coins').innerHTML = v.coins != null ? 'Coins <b>' + esc(v.coins) + '</b>' : '';
    // History and Catalog only redraw when you act on them, so their scroll and open rows stay put
    if (tab === 'live' || folded) draw();
  }
  function draw() {
    var v = last || { log: null, settings: {} };
    var current = folded ? 'live' : tab;
    var h = [tabs()];
    if (settingsOpen) h.push(settingsPanel(v));
    h.push(current === 'history' ? P.history(ui) : current === 'catalog' ? P.catalog(ui) : live(v));
    $('body').innerHTML = h.join('');
    fit();
  }

  api.onView(render);
  $('hide').onclick = function () { api.hide(); };
  $('gear').onclick = function () { settingsOpen = !settingsOpen; draw(); };
  $('fold').onclick = function () {
    if (combat) { peek = !peek; $('card').classList.toggle('peek', peek); setFoldButton(); } else api.fold(!folded);
  };
  $('body').addEventListener('change', function (e) { var k = e.target && e.target.dataset && e.target.dataset.k; if (k) api.setting(k, e.target.checked); });
  $('body').addEventListener('click', function (e) {
    var el = e.target.closest('[data-tab],[data-act="open-main"]');
    if (el && el.dataset.tab) { tab = el.dataset.tab; if (tab === 'history') P.loadHistory(ui, api, draw); else if (tab === 'catalog' && !ui.cat) P.loadCatalog(ui, api, draw); else draw(); }
    else if (el) api.openMain();
    else P.click(e, ui, api, draw, fit);
  });
  // the window follows the card's height while it folds and unfolds, once per frame
  var fitting = false;
  new ResizeObserver(function () { if (fitting) return; fitting = true; requestAnimationFrame(function () { fitting = false; fit(); }); }).observe($('card'));
  fit();
})();
