// Run history: each run's summary (when it started and ended, the furthest day, cleared / failed / ongoing), every
// event the parser queued during it (for the History tab's review, and for analysing runs later), and a copy of its
// Mistville log lines, so a run can be read again with a better parser one day.
//
// Kept in <userData>/history: index.json (the summaries), events/<run>.json, raw/<run>.log.gz (the log lines; a plain
// .log while the run is being read) and imported.json (older logs already read). A run is named by the log time it
// started at, so reading the same log again (the overlay reads the whole log each time it starts) rewrites the same
// run instead of adding a copy. A run left unfinished (you quit, or the game restarted) stays "ongoing".
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LEAD_IN = 500; // at most this many log lines from the last map load, copied in front of a run's own

function createHistory(dir) {
  const eventsDir = path.join(dir, 'events');
  const rawDir = path.join(dir, 'raw');
  const indexFile = path.join(dir, 'index.json');
  const importedFile = path.join(dir, 'imported.json');
  const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return {}; } };
  const index = readJson(indexFile);
  const imported = readJson(importedFile);
  const writers = new Set(); // the live log's, and an older log's while it's read
  const rawFile = (runId, gz) => path.join(rawDir, runId + (gz ? '.log.gz' : '.log'));
  const writeIndex = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(indexFile, JSON.stringify(index, null, 1)); } catch (e) { /* not kept */ } };

  /** One log's runs, written as it's read. */
  function writer() {
    let current = null; // { summary, events, lines: log lines not yet written } of the run being read
    let leadIn = []; // log lines since the last map load: a run's copy starts with them
    let timer = null;

    function save() {
      clearTimeout(timer); timer = null;
      if (!current) return;
      try {
        fs.mkdirSync(eventsDir, { recursive: true });
        fs.mkdirSync(rawDir, { recursive: true });
        index[current.summary.runId] = current.summary;
        fs.writeFileSync(path.join(eventsDir, current.summary.runId + '.json'), JSON.stringify(current.events));
        if (current.lines.length) { fs.appendFileSync(rawFile(current.summary.runId), current.lines.join('\n') + '\n'); current.lines = []; }
      } catch (e) { /* not kept */ }
      writeIndex();
    }
    const later = () => { if (!timer) timer = setTimeout(save, 1500); };
    /** The run is done with: save it and compress its log lines. */
    function finish() {
      if (!current) return;
      save();
      const id = current.summary.runId;
      try {
        if (fs.existsSync(rawFile(id))) { fs.writeFileSync(rawFile(id, true), zlib.gzipSync(fs.readFileSync(rawFile(id)))); fs.unlinkSync(rawFile(id)); }
      } catch (e) { /* not kept */ }
      current = null;
    }
    function begin(at, day) {
      finish();
      if (at == null) return;
      const id = String(at);
      current = { summary: { runId: id, startedAt: at, endedAt: null, maxDay: day || 0, result: 'ongoing' }, events: [], lines: [] };
      try { // read again: its copy starts over
        fs.mkdirSync(rawDir, { recursive: true });
        fs.rmSync(rawFile(id, true), { force: true });
        fs.writeFileSync(rawFile(id), leadIn.length ? leadIn.join('\n') + '\n' : '');
      } catch (e) { /* not kept */ }
    }

    const w = {
      /** One parser event: a RunStart opens a run; a day seen with no run open (the log began mid-run) opens one too. */
      record(event) {
        if (event.type === 'RunStart' || (event.type === 'DayBegin' && !current)) begin(event.at, event.day);
        if (!current) return;
        current.events.push(event);
        const s = current.summary;
        if (event.type === 'DayBegin') s.maxDay = Math.max(s.maxDay, event.day);
        if (event.type === 'RunEnd') { s.endedAt = event.at; s.result = event.result; }
        later();
      },
      /** One Mistville log line (the parser's keepLines), for the run's copy of the log. */
      line(text) {
        if (/LogLoad: LoadMap/.test(text)) leadIn = [];
        leadIn.push(text);
        if (leadIn.length > LEAD_IN) leadIn.shift();
        if (current) { current.lines.push(text); later(); }
      },
      /** The log was replaced, or read to its end: whatever was being read is finished with. */
      close() { finish(); writers.delete(w); },
      flush: save,
      current: () => current,
    };
    writers.add(w);
    return w;
  }

  const live = writer();
  const open = () => [...writers].map((w) => w.current()).filter(Boolean);
  return {
    record: (e) => live.record(e),
    line: (text) => live.line(text),
    close() { live.close(); writers.add(live); },
    flush() { for (const w of writers) w.flush(); },
    /** Another log's runs (an older log read into the history), written alongside the live one's. */
    writer,
    /** Summaries, newest first. */
    list() {
      for (const c of open()) index[c.summary.runId] = c.summary;
      return Object.values(index).sort((a, b) => b.startedAt - a.startedAt);
    },
    /** A run's summary and events, or null. */
    detail(runId) {
      const c = open().find((x) => x.summary.runId === String(runId));
      if (c) return { summary: c.summary, events: c.events };
      const summary = index[runId];
      if (!summary) return null;
      try { return { summary, events: JSON.parse(fs.readFileSync(path.join(eventsDir, runId + '.json'), 'utf8')) }; } catch (e) { return { summary, events: [] }; }
    },
    /** A run's copy of its log lines, as text, or null. */
    rawLog(runId) {
      try { return zlib.gunzipSync(fs.readFileSync(rawFile(String(runId), true))).toString('utf8'); } catch (e) { /* not compressed yet */ }
      try { return fs.readFileSync(rawFile(String(runId)), 'utf8'); } catch (e) { return null; }
    },
    /** Whether an older log (by name and size) has been read into the history already. */
    imported: (key) => !!imported[key],
    markImported(key) {
      imported[key] = Date.now();
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(importedFile, JSON.stringify(imported, null, 1)); } catch (e) { /* not kept */ }
    },
  };
}

module.exports = { createHistory };
