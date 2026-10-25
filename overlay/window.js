// The main window: Monitor (the run's stats, build progress, today's visits, the known map, the bag, the event
// stream), History and Catalog (panels.js, as in the card) and Settings (the strategy page: warning
// thresholds, value weights, hotkeys). Only Monitor redraws as the game goes on; the others redraw when you act on them.
(function () {
  var api = window.MistCard, P = window.MistPanels, esc = P.esc;
  var $ = function (id) { return document.getElementById(id); };
  var page = 'monitor', last = null, policy = null, status = { text: '', err: false };
  var ui = { runs: null, review: null, cat: null, catPart: 'relics', catFilter: '', openBuild: null };

  // ---------- Monitor ----------

  function statusLabel(v) {
    if (!v.inMistville && !v.run) return ['Not started', ''];
    if (v.ended) return ['Ended · ' + v.day + ' days', 'end'];
    return v.day ? ['Running · day ' + v.day, 'run'] : ['Waiting for day 1', ''];
  }
  function monitor(v) {
    var f = v.explore || {}, h = [];
    var st = statusLabel(v);
    h.push('<div class="panel"><h2>Console</h2><div class="row"><span class="tagst ' + st[1] + '">' + esc(st[0]) + '</span>' +
      (v.log ? '<span class="muted">Following</span><code class="path">' + esc(v.log.file) + '</code>' : '<span class="no">Can’t find UE_game.log yet: start the game, or choose it.</span>') + '</div>' +
      '<div class="row"><button class="btn primary" data-do="card">' + (v.cardVisible ? 'Hide the card' : 'Show the card') + '</button>' +
      '<button class="btn" data-do="choose">Choose UE_game.log…</button>' + (v.logChosen ? '<button class="btn" data-do="auto">Find it automatically</button>' : '') +
      (v.inMistville ? '' : '<span class="muted small">Not in Mistville: the card shows when you enter.</span>') + '</div></div>');
    var lc = v.logCheck || {};
    if (lc.alert) h.push('<div class="panel logwarn"><h2>The log format may have changed</h2><div>' + esc(P.formatText(lc.alert)) +
      ' After a game update the overlay may read the log wrongly; until it’s updated, the card and these pages may be unreliable. ' +
      'The lines it didn’t recognise are listed below, and in the overlay’s own log (tray → Open the overlay’s own log).</div></div>');
    if (v.run && v.day) {
      var a = function (label, value, cls) { return '<div class="attr"><span>' + label + '</span><strong' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</strong></div>'; };
      h.push('<div class="panel"><h2>Run stats</h2><div class="attrs">' + a('Day', esc(v.day)) +
        a('Sanity', esc(v.sanity ?? '—') + (v.maxSanity ? ' <small>/ ' + esc(v.maxSanity) + '</small>' : '') + (f.sanityPending ? ' <small>(not updated yet today)</small>' : '')) + a('Coins', esc(v.coins ?? '—')) +
        a('Food slots', esc(v.foodSlots ?? '—')) + a('Cost today / Cell', esc(f.exploreCost ?? '—')) + a('Cells left', f.tilesLeft != null ? esc(f.tilesLeft) + ' Cells' : '—') +
        a('Stele removal today', esc(f.clearCost ?? '—')) + a('Free Trader refreshes', esc(v.freeRefresh ?? 0)) +
        a('Food use', v.canUseFood === false ? 'Blocked (Anorexia)' : 'OK', v.canUseFood === false ? 'warn' : '') + '</div>' +
        (f.advice ? '<div class="fadvice ' + esc(f.adviceLevel) + '">' + esc(f.advice) + '</div>' : '') + P.coinWarning(f) +
        (v.sanityPlan ? '<div class="hpline">' + P.sanityBar(v.sanityPlan) + '<div class="hptext">' + esc(P.sanityTip(v.sanityPlan)).replace(/\n/g, '<br>') + '</div></div>' : '') + '</div>');
      var d = v.daily || { sanatorium: 0, bank: 0, stone: 0 };
      h.push('<div class="panel">' + (f.builds ? P.buildProgress(f.builds, ui.openBuild) : '<h2>Build progress</h2><div class="muted">No build data yet.</div>') +
        '<h2>Today’s visits (counts only real interactions)</h2><div class="chips"><span class="chip">Due today <small>' + esc(f.todayGuarantee || 'nothing guaranteed') + '</small></span>' +
        '<span class="chip">Sanatorium <b>' + d.sanatorium + '</b></span><span class="chip">Bank <b>' + d.bank + '</b></span><span class="chip">Steles removed <b>' + d.stone + '</b></span></div></div>');
      h.push('<div class="cols"><div class="panel"><h2>Map (what’s known)</h2>' + map(v) + '</div>' +
        '<div class="panel"><h2>Bag</h2><div class="sub">Old Stuff (' + v.relics.length + ')</div><div class="chips">' + P.relicChips(v.relics) + '</div>' +
        '<div class="sub">Food (' + v.items.length + ')</div><div class="chips">' + P.foodChips(v.items) + '</div></div></div>');
    }
    var ev = (v.events || []).slice().reverse();
    h.push('<div class="panel"><h2>Events (last ' + ev.length + ')</h2>' + (ev.length ? '<div class="scroll events tall">' + P.eventRows(ev) + '</div>' : '<div class="muted">No events yet: they show as you play.</div>') + '</div>');
    // Mistville's lines the overlay didn't recognise, newest first
    if (lc.recent && lc.recent.length) h.push('<div class="panel"><details' + (lc.alert ? ' open' : '') + '><summary>Unrecognised Mistville lines (' + lc.unknown.toLocaleString() + ' of ' + lc.lines.toLocaleString() + ')</summary>' +
      '<div class="scroll short unknown">' + lc.recent.slice().reverse().map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div></details></div>');
    return '<div class="page">' + h.join('') + '</div>';
  }
  function map(v) {
    if (!v.board) return '<div class="muted">The board shows when the day’s board opens.</div>';
    var cand = {}; ((v.exit && v.exit.cells) || []).forEach(function (i) { cand[i] = true; });
    return '<div class="map">' + v.board.map(function (t) {
      var cls = ['tile'], m = P.mark(t), known = t.explored || t.preview;
      if (t.sealed && !t.explored) cls.push('blocked'); else if (t.explored) cls.push('explored'); else if (t.preview) cls.push('previewed');
      var label = known && t.name ? (m ? '<i class="m ' + m[2] + '">' + m[1] + '</i>' : '') + esc(t.name) : cand[t.index] && !t.explored ? '<span class="muted">Clock Tower?</span>' : '';
      if (cand[t.index] && !known) cls.push('cand');
      return '<div class="' + cls.join(' ') + '"><span class="ti">' + t.index + '</span><span class="tl">' + label + '</span>' +
        (t.reachable && !t.explored && t.cost > 0 ? '<span class="tc">-' + t.cost + '</span>' : '') + (t.sealed && !t.explored ? '<span class="tb" title="Sealed off">✕</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  // ---------- Settings: the strategy page ----------

  function val(x) { return x === null || x === undefined ? '' : String(x); }
  function settings() {
    if (!policy) return '<div class="page"><div class="panel"><h2>Settings</h2><div class="muted">Loading…</div></div></div>';
    var s = policy.saved || {}, d = policy.defaults, w = s.weights || {};
    var th = s.thresholds || {};
    var num = function (id, label, value, placeholder, hint, step) { return '<div class="field"><label for="' + id + '">' + label + '</label><input type="number" id="' + id + '" min="0" step="' + (step || 'any') + '" value="' + esc(val(value)) + '" placeholder="' + esc(placeholder) + '"><small>' + hint + '</small></div>'; };
    var text = function (id, label, value, placeholder, hint) { return '<div class="field"><label for="' + id + '">' + label + '</label><input type="text" id="' + id + '" value="' + esc(val(value)) + '" placeholder="' + esc(placeholder) + '" spellcheck="false"><small>' + hint + '</small></div>'; };
    var dw = d.weights;
    var advanced = Object.keys(w).length ? JSON.stringify(w, null, 2) : '';
    var check = function (key, on, label, sub) { return '<label class="set"><input type="checkbox" data-k="' + key + '"' + (on ? ' checked' : '') + '><span><b>' + label + '</b><br><small>' + sub + '</small></span></label>'; };
    return '<div class="page"><div class="panel"><h2>Strategy (thresholds / weights / hotkeys)</h2>' +
      '<p class="hint">Empty = the built-in default. Saving applies at once, no restart needed; the card recalculates live.</p><div class="form">' +
      num('yellow', 'Yellow warning ratio', th.yellowRatio, d.thresholds.yellowRatio, 'default ' + d.thresholds.yellowRatio + ' (worst-case cost / Sanity)', '0.05') +
      num('red', 'Red warning ratio', th.redRatio, d.thresholds.redRatio, 'default ' + d.thresholds.redRatio.toFixed(1), '0.05') +
      num('reserve', 'Odd-day Sanity reserve', w.buffer && w.buffer.reserveSanity, dw.buffer.reserveSanity, 'default ' + dw.buffer.reserveSanity + ' (reminds you below it)', '1') +
      num('sanatorium', 'Sanatorium restores', w.detourRoi && w.detourRoi.sanatoriumRest, dw.detourRoi.sanatoriumRest, 'default ' + dw.detourRoi.sanatoriumRest + ' Sanity (no fixed value known; tune it from play)', '1') +
      num('bank', 'Bank Coins', w.detourRoi && w.detourRoi.bankGold, dw.detourRoi.bankGold, 'default ' + dw.detourRoi.bankGold + ' (× ' + dw.situational.goldToSanity + ' = equivalent Sanity)', '1') +
      text('hkToggle', 'Show / hide the card', policy.hotkeys.toggle, d.hotkeys.toggle, 'default ' + d.hotkeys.toggle + ' (empty = default)') +
      text('hkClick', 'Click-through', policy.hotkeys.clickThrough, d.hotkeys.clickThrough, 'default ' + d.hotkeys.clickThrough + ' (empty = default)') +
      '</div><details' + (advanced ? ' open' : '') + '><summary>Advanced: full value-weights JSON (value-weights override)</summary>' +
      '<textarea id="weights" spellcheck="false" placeholder="Empty = built-in default; paste JSON to override (relicDailyValue / kindScores / situational / foodKinds …). Only what you give changes: the rest keeps the defaults.">' + esc(advanced) + '</textarea>' +
      '<div class="row"><button class="btn" data-do="defaults">Fill in the defaults</button></div></details>' +
      '<div class="row"><button class="btn primary" data-do="save">Save and apply</button><button class="btn" data-do="reset">Restore defaults</button>' +
      (status.text ? '<span class="status' + (status.err ? ' err' : '') + '">' + esc(status.text) + '</span>' : '') + '</div></div>' +
      '<div class="panel"><h2>The card</h2>' + check('route', policy.card.route, 'Route to the Clock Tower', 'Numbered steps for the cheapest exploring order.') +
      check('details', policy.card.details, 'Build progress while exploring', 'Each build with what it still needs, and your Old Stuff, under the grid.') + '</div></div>';
  }
  function readNumber(id) { var x = $(id).value.trim(); return x === '' ? null : Number(x); }
  function save() {
    var yellow = readNumber('yellow'), red = readNumber('red');
    var thresholds = null;
    if (yellow !== null || red !== null) {
      thresholds = { yellowRatio: yellow ?? policy.defaults.thresholds.yellowRatio, redRatio: red ?? policy.defaults.thresholds.redRatio };
      if (!(thresholds.yellowRatio > 0) || !(thresholds.redRatio > 0)) return setStatus('Thresholds must be positive', true);
    }
    var raw = $('weights').value.trim(), weights = {};
    if (raw) { try { weights = JSON.parse(raw); } catch (e) { return setStatus('Couldn’t parse the weights JSON; not saved', true); } }
    if (!weights || typeof weights !== 'object' || Array.isArray(weights)) return setStatus('The weights JSON must be an object; not saved', true);
    var reserve = readNumber('reserve'), sanatorium = readNumber('sanatorium'), bank = readNumber('bank');
    for (var x of [reserve, sanatorium, bank]) if (x !== null && !(x >= 0)) return setStatus('Values can’t be negative', true);
    if (reserve !== null) weights.buffer = Object.assign({}, weights.buffer, { reserveSanity: reserve });
    if (sanatorium !== null || bank !== null) {
      weights.detourRoi = Object.assign({}, weights.detourRoi);
      if (sanatorium !== null) weights.detourRoi.sanatoriumRest = sanatorium;
      if (bank !== null) weights.detourRoi.bankGold = bank;
    }
    var payload = { thresholds: thresholds, weights: Object.keys(weights).length ? weights : null, hotkeys: { toggle: $('hkToggle').value.trim(), clickThrough: $('hkClick').value.trim() } };
    api.setPolicy(payload).then(function (r) { setStatus(r.message, !r.ok); loadPolicy(); });
  }
  function setStatus(text, err) { status = { text: text, err: !!err }; draw(); }
  function loadPolicy() { api.getPolicy().then(function (p) { policy = p; if (page === 'settings') draw(); }); }

  // ---------- drawing ----------

  function draw() {
    Array.prototype.forEach.call(document.querySelectorAll('.nav'), function (b) { b.classList.toggle('on', b.dataset.page === page); });
    var html = page === 'history' ? '<div class="page"><div class="panel">' + P.history(ui) + '</div></div>'
      : page === 'catalog' ? '<div class="page"><div class="panel">' + P.catalog(ui) + '</div></div>'
      : page === 'settings' ? settings() : monitor(last || {});
    var main = $('main'), top = main.scrollTop;
    main.innerHTML = html;
    main.scrollTop = top;
  }
  function go(p) {
    page = p; status = { text: '', err: false };
    if (p === 'history') P.loadHistory(ui, api, draw);
    else if (p === 'catalog' && !ui.cat) P.loadCatalog(ui, api, draw);
    else if (p === 'settings') { policy = null; draw(); loadPolicy(); }
    else draw();
  }

  api.onView(function (v) { last = v; if (page === 'monitor') draw(); });
  document.querySelector('.side').addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) go(b.dataset.page); });
  $('main').addEventListener('click', function (e) {
    var el = e.target.closest('[data-do]');
    if (el) {
      var d = el.dataset.do;
      if (d === 'card') api.toggleCard();
      else if (d === 'choose') api.chooseLog();
      else if (d === 'auto') api.autoLog();
      else if (d === 'save') save();
      else if (d === 'reset') api.setPolicy({ thresholds: null, weights: null, hotkeys: { toggle: '', clickThrough: '' } }).then(function (r) { setStatus(r.ok ? 'Built-in defaults restored' : r.message, !r.ok); loadPolicy(); });
      else if (d === 'defaults') $('weights').value = JSON.stringify(policy.defaults.weights, null, 2);
      return;
    }
    P.click(e, ui, api, draw);
  });
  $('main').addEventListener('change', function (e) {
    var k = e.target && e.target.dataset && e.target.dataset.k;
    if (k) { api.setting(k, e.target.checked); policy.card[k] = e.target.checked; }
  });
  draw();
})();
