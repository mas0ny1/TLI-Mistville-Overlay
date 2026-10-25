// What the card and the main window both draw: the run history and review, the catalog, build progress and
// event list. Each page keeps a `ui` object ({ runs, review, cat, catPart, catFilter, openBuild }) and passes clicks
// on [data-…] elements to MistPanels.click(), which loads what's asked for and redraws.
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };
  var ARCH = { General: 'general', Preview: 'preview', Stele: 'stele', Food: 'food' };

  // one small coloured mark per kind of Cell (by name first: Banks, Sanatoriums and Alchemy share a tile type)
  var MARKS = [
    [/^Bank/i, '$', 'bank'], [/Sanatorium/i, '✚', 'sanatorium'], [/Mistville Trader/i, 'T', 'trader'], [/Alchemy/i, '⚒', 'alchemy'],
    [/Unknown Old Stuff/i, '★', 'oldstuff'], [/Unknown Food/i, '♨', 'food'], [/Watch Tower/i, '♜', 'tower'], [/Folklores/i, '✦', 'folk'],
    [/Tentacle/i, '≈', 'tentacle'], [/^Ruins$/i, '▪', 'ruins'], [/Stele/i, '◆', 'stele'], [/Clock Tower/i, 'C', 'exit'], [/Place of Awakening/i, 'S', 'start'],
  ];
  function mark(t) {
    for (var i = 0; i < MARKS.length; i++) if (MARKS[i][0].test(t.name || '')) return MARKS[i];
    if (t.kind === 'start') return [null, 'S', 'start'];
    if (t.kind === 'exit') return [null, 'C', 'exit'];
    if (t.kind === 'stele') return [null, '◆', 'stele'];
    return null;
  }

  // the flags: must = "must-pick" (⭐), high = "recommended"
  function flag(x) { return x.priority === 'must' ? '<span class="tag must">⭐ must-pick</span>' : x.priority === 'high' ? '<span class="tag rec">recommended</span>' : ''; }
  function archTag(a) { return a ? '<span class="arch ' + (ARCH[a] || '') + '">' + esc(a) + '</span>' : ''; }

  // ---------- events ----------

  var RESULT = { win: ['Cleared', 'win'], fail: ['Failed', 'fail'] };
  var resultOf = function (r) { return RESULT[r] || ['Running', 'run']; };
  var fmtTime = function (ts) { return ts ? new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'; };
  var clock = function (ts) { return ts ? new Date(ts).toLocaleTimeString([], { hour12: false }) : ''; };
  var duration = function (r) { return r.endedAt != null ? Math.max(0, Math.floor((r.endedAt - r.startedAt) / 6e4)) + ' min' : '—'; };
  var OFFER_KINDS = { relic: 'Old Stuff pick', food: 'Food pick', shop: 'Trader', furnaceUpgrade: 'Workshop upgrade', intel: 'Mistville Intel' };

  // the event list, one line each
  function eventSummary(e) {
    switch (e.type) {
      case 'RunStart': return 'Run start (day ' + e.day + (e.dungeon ? ', dungeon ' + e.dungeon : '') + (e.intel ? ', Intel ' + e.intel : '') + ')';
      case 'DayBegin': return 'Day ' + e.day + ' begins' + (e.dayExploreCost != null ? ' (cost ' + e.dayExploreCost + '/Cell)' : '');
      case 'AttrChanged': return e.key + ' → ' + e.value;
      case 'MapSnapshot': return 'Map snapshot (day ' + e.day + ', ' + e.known + ' Cells known' + (e.tiles ? ', board saved' : '') + ')';
      case 'TileExplored': return 'Explored Cell ' + e.index;
      case 'TileInteracted': return 'Used Cell ' + e.index + (e.name ? ': ' + e.name : '') + (e.params && e.params.length ? ' (params ' + e.params.join('/') + ')' : '');
      case 'TileClicked': return 'Clicked ' + e.target + (e.index != null ? ' #' + e.index : '');
      case 'TileVanished': return 'Cell ' + e.index + ' vanished';
      case 'OfferOpened': return 'Opened ' + (OFFER_KINDS[e.kind] || e.kind) + (e.tileIndex != null ? ' (Cell ' + e.tileIndex + ')' : '') + (e.suggested && e.suggested.length ? '; suggested ' + e.suggested.slice(0, 3).join(', ') + (e.suggested.length > 3 ? '…' : '') : '');
      case 'OfferContents': return 'On offer: ' + e.relics.concat(e.foods).map(function (o) { return (o.name || '#' + o.id) + (o.price != null ? ' ' + o.price : '') + (o.bought ? ' (bought)' : ''); }).join(', ');
      case 'BoardOpened': return 'Board opened' + (e.sanity != null ? ' (Sanity ' + e.sanity + ')' : '');
      case 'BoardClosed': return 'Board closed' + (e.sanity != null ? ' (Sanity ' + e.sanity + ')' : '');
      case 'CostChanged': return 'Explore cost ' + (e.explore ?? '?') + (e.base != null ? ' (base ' + e.base + ')' : '');
      case 'Dungeon': return 'Dungeon ' + e.id;
      case 'IntelItem': return 'Intel gave ' + e.name;
      case 'RelicGained': return 'Got Old Stuff: ' + e.name;
      case 'RelicBagUpdated': return 'Old Stuff bag updated (' + e.relics.length + ' items)';
      case 'FoodBagUpdated': return 'Food bag updated (' + e.foods.length + ' items)';
      case 'FoodUsed': return 'Ate ' + (e.name || 'Food') + ' (slot ' + e.slot + ')';
      case 'EncounterOpened': return 'Folklore event (ID ' + e.encounterId + ')';
      case 'EncounterSelected': return 'Event choice (ID ' + e.encounterId + ', option ' + e.option + ')';
      case 'Toast': return 'Message: ' + e.text;
      case 'RunEnd': return e.result === 'win' ? '★ Run cleared' : '✖ Run failed';
      default: return e.type;
    }
  }
  function eventRows(events) {
    return events.map(function (e) { return '<div class="ev"><code>' + esc(clock(e.at)) + '</code><code class="et">' + esc(e.type) + '</code><span>' + esc(eventSummary(e)) + '</span></div>'; }).join('');
  }

  // ---------- History: the run history and review ----------

  function history(ui) {
    var h = ['<div class="ctrl"><h2>Run history</h2><button class="btn" data-act="refresh-history">Refresh</button></div>'];
    if (ui.runs === null || ui.runs === undefined) return h.concat('<div class="muted">Loading…</div>').join('');
    h.push('<div class="muted small">' + plural(ui.runs.length, 'run') + ' (saved automatically while you play)</div>');
    if (!ui.runs.length) return h.concat('<div class="muted">No runs yet: play a run and it\'s recorded automatically.</div>').join('');
    h.push('<div class="scroll short">' + ui.runs.map(function (r) {
      var res = resultOf(r.result), sel = ui.review && ui.review.summary.runId === r.runId;
      return '<div class="hrow' + (sel ? ' sel' : '') + '" data-run="' + esc(r.runId) + '"><span class="ht">' + esc(fmtTime(r.startedAt)) + '</span><span>Day ' + esc(r.maxDay) + '</span>' +
        '<span class="res ' + res[1] + '">' + res[0] + '</span><span class="hend muted">' + esc(r.endedAt ? 'ended ' + fmtTime(r.endedAt) : '') + '</span><span class="muted">' + esc(duration(r)) + '</span><span class="go">' + (sel ? '▾' : 'Review ▸') + '</span></div>';
    }).join('') + '</div>');
    if (ui.review) h.push(review(ui.review));
    return h.join('');
  }

  function review(d) {
    var s = d.summary, ev = d.events || [], res = resultOf(s.result);
    var sanity = ev.filter(function (e) { return e.type === 'AttrChanged' && e.attr === 1; });
    var dayEnd = [], day = 0, lastSanity = -1;
    ev.forEach(function (e) {
      if (e.type === 'RunStart') day = e.day;
      else if (e.type === 'DayBegin') { if (day > 0 && lastSanity >= 0 && e.day !== day) dayEnd.push({ day: day, sanity: lastSanity }); day = e.day; }
      if (e.type === 'AttrChanged' && e.attr === 1) lastSanity = e.value;
    });
    if (day > 0 && lastSanity >= 0) dayEnd.push({ day: day, sanity: lastSanity });
    var unused = [];
    ev.forEach(function (e) { if (e.type === 'FoodBagUpdated') unused = e.foods.filter(function (f) { return f.uses > 0; }); });
    var gained = ev.filter(function (e) { return e.type === 'RelicGained'; }).map(function (e) { return e.name; });
    var chart = '';
    if (sanity.length >= 2) {
      var W = 320, H = 80, vals = sanity.map(function (p) { return p.value; });
      var min = Math.min.apply(null, vals.concat(0)), max = Math.max.apply(null, vals.concat(1)), span = max - min || 1;
      var pts = sanity.map(function (p, i) { return (i / (sanity.length - 1) * W).toFixed(1) + ',' + (H - (p.value - min) / span * (H - 8) - 4).toFixed(1); }).join(' ');
      chart = '<svg class="schart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="#9fb4ff" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
    } else chart = '<div class="muted">No Sanity changes recorded in this run.</div>';
    var stat = function (label, value, warn) { return '<div class="st"><span>' + label + '</span><b' + (warn ? ' class="no"' : '') + '>' + value + '</b></div>'; };
    return '<div class="review"><h2>Review · ' + esc(fmtTime(s.startedAt)) + ' (' + res[0] + ')</h2>' +
      '<div class="stats5">' + stat(s.result === 'fail' ? 'Died on' : 'Reached', 'Day ' + esc(s.maxDay), s.result === 'fail') + stat('Events', ev.length) + stat('Sanity samples', sanity.length) + stat('Old Stuff gained', gained.length) + stat('Duration', esc(duration(s))) + '</div>' +
      '<div class="sub">Sanity over time</div>' + chart +
      (dayEnd.length ? '<div class="chips">' + dayEnd.map(function (p) { return '<span class="chip">Day ' + p.day + ' end <b>' + p.sanity + '</b></span>'; }).join('') + '</div>' : '') +
      '<div class="sub">Unused Food (end of run)</div><div class="chips">' + (unused.length ? unused.map(function (f) { return '<span class="chip food">' + esc(f.name) + ' <b>×' + f.uses + '</b></span>'; }).join('') : '<span class="muted">None: all eaten, or none found this run</span>') + '</div>' +
      '<div class="sub">Old Stuff gained</div><div class="chips">' + (gained.length ? gained.map(function (n) { return '<span class="chip">' + esc(n) + '</span>'; }).join('') : '<span class="muted">No Old Stuff gained this run</span>') + '</div>' +
      '<div class="sub">Events (' + ev.length + ', oldest first)</div><div class="scroll events">' + eventRows(ev) + '</div></div>';
  }

  // ---------- Catalog: the catalog (Old Stuff before / after upgrade, Food, the 15-day costs) ----------

  function idTag(x) {
    if (x.id != null) return '<span class="idt cat" title="ID from the catalog">catalog ' + x.id + '</span>';
    if (x.seenId != null) return '<span class="idt seen" title="ID seen in your bag">seen ' + x.seenId + '</span>';
    return '<span class="idt none">not seen yet</span>';
  }
  function tierText(t1, t2) { return !t1 && !t2 ? '' : !t1 ? t2 : !t2 || t2 === t1 ? t1 : t1 + ' → ' + t2; }
  function pairsHtml(x) {
    var h = (x.pairs || []).map(function (p) { return '<div class="pair"><b>' + esc(p.with) + '</b>: ' + esc(p.note) + '</div>'; }).join('');
    if (x.requires && x.requires.length) h += '<div class="pair req">Needs: ' + esc(x.requires.join('/')) + (x.requiresAny ? ' (any one)' : '') + '</div>';
    return h;
  }

  function catalog(ui) {
    var cat = ui.cat, part = ui.catPart || 'relics', filter = ui.catFilter || '';
    var h = ['<div class="ctrl"><h2>Catalog</h2><button class="btn" data-act="refresh-catalog">Refresh</button></div>'];
    if (!cat) return h.concat('<div class="muted">Loading…</div>').join('');
    var mapped = cat.relics.filter(function (r) { return r.id != null || r.seenId != null; }).length;
    h.push('<div class="muted small">Old Stuff: ' + cat.relics.length + ' (with ID: ' + mapped + ') · Food: ' + cat.foods.length + '</div>');
    var pill = function (attr, val, cur, label) { return '<button class="pill' + (cur === val ? ' on' : '') + '" data-' + attr + '="' + val + '">' + label + '</button>'; };
    h.push('<div class="pills">' + pill('part', 'relics', part, 'Old Stuff') + pill('part', 'foods', part, 'Food') + pill('part', 'costs', part, '15-day costs') + '</div>');
    if (part === 'relics') {
      h.push('<div class="pills">' + pill('filter', '', filter, 'All Old Stuff') + pill('filter', 'unmapped', filter, 'Without ID only') + pill('filter', 'mapped', filter, 'With ID only') + '</div>');
      var list = cat.relics.filter(function (r) { var known = r.id != null || r.seenId != null; return filter === 'unmapped' ? !known : filter === 'mapped' ? known : true; });
      h.push('<div class="sub">Old Stuff (before / after upgrade)</div><div class="scroll cat">' + list.map(function (r) {
        return '<div class="crow" data-x="1"><div class="cn"><b>' + esc(r.name) + '</b>' + flag(r) + archTag(r.archetype) + idTag(r) + '</div>' +
          (tierText(r.tier1, r.tier2) ? '<div class="ctags">' + esc(tierText(r.tier1, r.tier2)) + (r.upgradeCost != null ? ' · upgrade ' + r.upgradeCost : '') + '</div>' : '') +
          '<div class="ceff">' + esc(r.effect) + '</div>' +
          '<div class="cmore">' + (r.upgradeEffect ? '<div class="cup">Upgraded: ' + esc(r.upgradeEffect) + '</div>' : '') + pairsHtml(r) + (r.note ? '<div class="cnote">' + esc(r.note) + '</div>' : '') + '</div></div>';
      }).join('') + '</div><div class="muted small cathint">Click an Old Stuff for its upgrade, pairs and notes.</div>');
    } else if (part === 'foods') {
      h.push('<div class="sub">Food (names as the log writes them)</div><div class="scroll cat">' + cat.foods.map(function (f) {
        return '<div class="crow" data-x="1"><div class="cn"><b>' + esc(f.name) + '</b>' + archTag(f.archetype) + (f.initialUses != null ? '<span class="uses">×' + f.initialUses + '</span>' : '') + idTag(f) + '</div>' +
          '<div class="ceff">' + esc(f.effect) + '</div><div class="cmore">' + pairsHtml(f) + (f.note ? '<div class="cnote">' + esc(f.note) + '</div>' : '') + '</div></div>';
      }).join('') + '</div>');
    } else {
      h.push('<div class="sub">15-day cost table</div><div class="chips">' + cat.dailyExploreCost.map(function (c, i) { return '<span class="chip">Day ' + (i + 1) + ' <small>Explore ' + c + ' / Stele ' + cat.dailyClearCost[i] + '</small></span>'; }).join('') + '</div>');
    }
    return h.join('');
  }

  // ---------- build progress and the bag ----------

  // build progress: advice, then each group as one row (click for what it still needs, its members, Lv1 / Lv2 and pair hints)
  // a build's progress as a bar, one segment per piece it needs: green counted (Lv2), amber an upgrade away, dark missing
  function segBar(bar) {
    if (!bar || !bar.target) return '';
    var h = '';
    for (var i = 0; i < bar.target; i++) h += '<i class="' + (i < bar.lv2 ? 'g' : i < bar.lv2 + bar.lv1 ? 'u' : 'm') + '"></i>';
    return '<span class="segs" title="' + bar.lv2 + ' of ' + bar.target + ' counted' + (bar.lv1 ? ', ' + bar.lv1 + ' an upgrade away' : '') + '">' + h + '</span>';
  }
  // what it still needs, as chips: grey to get, amber (↑) to upgrade, gold edge a Key piece, faint gold an Important one;
  // a pair's pieces joined by +
  function needChips(needs) {
    if (!needs) return '';
    var chip = function (x) {
      var mark = x.key ? ' key' : x.important ? ' imp' : '';
      return '<span class="nchip' + (x.upgrade ? ' up' : '') + mark + '"' + (mark ? ' title="' + (x.key ? 'Key' : 'Important') + ' piece"' : '') + '>' + (x.upgrade ? '↑ ' : '') + esc(x.name) + '</span>';
    };
    var label = needs.mode === 'pair' ? (needs.left === 1 ? 'a pair' : needs.left + ' pairs') : needs.mode === 'any' ? 'any ' + (needs.left === 1 ? 'one' : needs.left) : '';
    return '<div class="needs">' + (label ? '<span class="nlab">' + label + ':</span>' : '') + needs.options.map(function (o) {
      return '<span class="nopt">' + o.pieces.map(chip).join('<span class="nsep">' + (needs.mode === 'pair' ? '+' : 'or') + '</span>') +
        (o.have ? '<span class="nhave">with your ' + esc(o.have) + '</span>' : '') + '</span>';
    }).join('') + '</div>';
  }
  function buildProgress(b, openBuild) {
    if (!b) return '';
    var firstOwn = true;
    return '<div><h2>Build progress</h2>' + (b.advice ? '<div class="advice">' + esc(b.advice) + '</div>' : '') + '<div class="bgroups">' + b.groups.map(function (g) {
      var open = openBuild === g.id;
      var st = g.status === 'done' ? ['done', 'Done'] : g.status === 'near' ? ['near', 'Almost'] : ['open', 'Not yet'];
      // the builds of your own come after the advisor's groups, under their own heading
      var head = g.own && firstOwn ? (firstOwn = false, '<div class="sub bown">Your builds <small>(only Lv2 counts; the suggestions don\'t use these)</small></div>') : '';
      // the closest to complete of the Preview, Omen and Food builds
      var closest = g.closest ? ' <span class="bbest">closest</span>' : '';
      var title = (g.closest ? 'The closest to complete of the Preview, Omen and Food builds · ' : '') + (g.missing ? g.missing + ' · ' : '') + (open ? 'Click to collapse' : 'Click for what it still needs');
      return head + '<div class="bg' + (open ? ' open' : '') + (g.closest ? ' closest' : '') + '"><div class="bgrow" data-build="' + esc(g.id) + '" title="' + esc(title) + '">' +
        '<span class="tw">' + (open ? '▾' : '▸') + '</span><span class="bl">' + esc(g.label) + closest + '</span>' + segBar(g.bar) + '<span class="bc">' + g.owned + '/' + g.target + '</span><span class="bs ' + st[0] + '">' + st[1] + '</span></div>' +
        // opened: what it still needs, then each of its Old Stuff
        (open ? needChips(g.needs) + '<div class="bmem">' + (g.members.length ? g.members.map(function (m) { return '<div class="mrow"><span>' + esc(m.name) + (m.hint ? ' <small>(' + esc(m.hint) + ')</small>' : '') + '</span><span class="ms ' + m.cls + '">' + esc(m.text) + '</span></div>'; }).join('') : '<p class="muted">Loading the group\'s members…</p>') + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
  }
  function relicChips(relics) {
    return relics.length ? relics.map(function (r) { return '<span class="chip ' + (ARCH[r.archetype] || '') + '" title="' + esc([r.archetype, r.tier1 === r.tier2 || !r.tier2 ? r.tier1 : r.tier1 + ' → ' + r.tier2].filter(Boolean).join(' · ')) + '">' + esc(r.name) + '<span class="lv">Lv' + (r.level + 1) + '</span>' + (r.intel ? ' <i>(Intel)</i>' : '') + '</span>'; }).join('') : '<span class="muted">None yet</span>';
  }
  function foodChips(items) {
    return items.length ? items.map(function (f) { return '<span class="chip food">' + esc(f.name) + ' <b>×' + esc(f.uses) + '</b></span>'; }).join('') : '<span class="muted">None yet</span>';
  }

  // ---------- clicks ----------

  var SELECTOR = '[data-act],[data-run],[data-part],[data-filter],[data-build],[data-x]';
  function keepScroll(fn) {
    var boxes = Array.prototype.map.call(document.querySelectorAll('.scroll'), function (b) { return b.scrollTop; });
    fn();
    Array.prototype.forEach.call(document.querySelectorAll('.scroll'), function (b, i) { if (boxes[i] != null) b.scrollTop = boxes[i]; });
  }
  function loadHistory(ui, api, draw) { ui.runs = null; draw(); api.history().then(function (list) { ui.runs = list || []; draw(); }); }
  function loadCatalog(ui, api, draw) { ui.cat = null; draw(); api.catalog().then(function (c) { ui.cat = c; draw(); }); }
  /** A click on a History / Catalog / build-progress element: true when it was one. fit() follows height changes. */
  function click(e, ui, api, draw, fit) {
    var el = e.target.closest(SELECTOR);
    if (!el) return false;
    var d = el.dataset;
    if (d.act === 'refresh-history') loadHistory(ui, api, draw);
    else if (d.act === 'refresh-catalog') loadCatalog(ui, api, draw);
    else if (d.run) {
      if (ui.review && ui.review.summary.runId === d.run) { ui.review = null; keepScroll(draw); }
      else api.run(d.run).then(function (detail) { ui.review = detail; keepScroll(draw); });
    }
    else if (d.part != null) { ui.catPart = d.part; draw(); }
    else if (d.filter != null) { ui.catFilter = d.filter; draw(); }
    else if (d.build) { ui.openBuild = ui.openBuild === d.build ? null : d.build; keepScroll(draw); }
    else if (d.x) { el.classList.toggle('open'); if (fit) fit(); }
    else return false;
    return true;
  }

  // ---------- the Sanity bar (sanity.js): how full the next floor starts if you head out now ----------

  // green: it starts full; amber: on 90% of Max Sanity or more; red: less (on day 15: whether there's enough to finish).
  // The white tick is where to stop exploring so it starts full; the lighter part, Sanatoriums revealed and not used
  // yet; striped while the log hasn't given today's Sanity yet (it's what the day should start on)
  function sanityTip(p) {
    var extra = p.gain - 10 - Math.floor(p.max * 0.3);
    var short = p.lastDay ? 0 : p.max - p.nextStart;
    return [
      'Sanity ' + p.sanity + ' of ' + p.max + (p.expected ? ' (what today should start on: the log gives it at your first action)' : '') +
        (p.sanatoriums ? '; +' + p.waiting + ' from ' + plural(p.sanatoriums, 'Sanatorium') + ' revealed and not used yet' : ''),
      p.lastDay ? 'Day 15, the last floor: keep about ' + p.stopAt + (p.findToday ? ' (~' + p.findToday + ' to find the Clock Tower, ' + p.keep + ' for it)' : ' for the Clock Tower')
        : 'Heading out now, the next floor starts on ~' + p.nextStart + ' of ' + p.max + ' (' + Math.floor(p.nextStart / p.max * 100) + '%)' + (p.findToday ? ', after ~' + p.findToday + ' to find today\'s Clock Tower' : ''),
      p.lastDay ? '' : 'A new day gives back ' + p.gain + ' (10 + 30% of Max Sanity' + (extra > 0 ? ' + ' + extra + ' from Old Stuff' : '') + '): end the day on ' + p.fullHeal + '+ to start the next one full',
      p.spare >= 0 ? 'You can spend ' + p.spare + ' more (~' + plural(p.spareCells, 'Cell') + ' at ' + p.cost + ')' + (p.lastDay ? '' : ' and still start it full')
        : p.lastDay ? (-p.spare) + ' short' : 'To start it full: ~' + short + ' more (a Sanatorium gives ' + p.sanatorium + ', or recovery Food)',
      p.reserve && !p.lastDay ? 'Odd day: keep ' + p.reserve + '+ for the Clock Tower' : '',
    ].filter(Boolean).join('\n');
  }
  function sanityBar(p) {
    if (!p || !p.max) return '';
    var pct = function (n) { return Math.max(0, Math.min(100, n / p.max * 100)).toFixed(1) + '%'; };
    var label = p.lastDay ? (p.spare >= 0 ? p.spare + ' spare' : (-p.spare) + ' under')
      : p.spare < 0 && p.nextStart < p.max ? 'tmrw ' + Math.floor(p.nextStart / p.max * 100) + '%' : p.spare < p.cost ? 'head out' : (p.expected ? '~' : '') + p.spare + ' spare';
    var waiting = p.waiting ? '<i class="hpwait" style="left:' + pct(p.sanity) + ';width:' + pct(Math.min(p.waiting, p.max - p.sanity)) + '"></i>' : '';
    return '<span class="hp ' + p.level + (p.expected ? ' expected' : '') + '" title="' + esc(sanityTip(p)) + '"><span class="hpbar"><i class="hpfill" style="width:' + pct(p.sanity) + '"></i>' + waiting +
      '<i class="hpmark" style="left:' + pct(p.stopAt) + '"></i></span><span class="hplab">' + esc(label) + '</span></span>';
  }

  // ---------- no Coin source yet (days 1-5, none of the Economy engine's Old Stuff held) ----------

  function coinWarning(f) {
    var n = f && f.noCoinSource;
    if (!n || !n.length) return '';
    var list = n.length > 1 ? n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1] : n[0];
    return '<div class="fadvice yellow coinwarn"><b>No Coin source yet</b> · look for ' + esc(list) + '</div>';
  }

  // ---------- "the log format may have changed" (parser.js formatAlert) ----------

  function formatText(a) {
    if (a.missing) {
      var what = a.missing.length > 1 ? a.missing.slice(0, -1).join(', ') + ' or ' + a.missing[a.missing.length - 1] : a.missing[0];
      return 'The board has opened ' + a.boardOpens + ' times, but no ' + what + ' line was recognised.';
    }
    return 'Unrecognised Mistville lines: ' + a.unknown.toLocaleString() + ' of ' + a.lines.toLocaleString() + ' (' + (a.ratio * 100).toFixed(1) + '%).';
  }

  window.MistPanels = { mark: mark, esc: esc, plural: plural, ARCH: ARCH, flag: flag, archTag: archTag, eventSummary: eventSummary, eventRows: eventRows, formatText: formatText, coinWarning: coinWarning, sanityBar: sanityBar, sanityTip: sanityTip,
    history: history, catalog: catalog, buildProgress: buildProgress, relicChips: relicChips, foodChips: foodChips, resultOf: resultOf,
    loadHistory: loadHistory, loadCatalog: loadCatalog, click: click, keepScroll: keepScroll };
})();
