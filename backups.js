// Reads the game's older logs into the run history, so runs played while the overlay wasn't running are kept too. When
// the game starts it renames the last session's log to "<name>-backup-<date>.log" next to the new one; each such file
// is read once (by name and size).
'use strict';
const fs = require('fs');
const path = require('path');

/** The older logs next to the one the overlay follows, oldest first. */
function backupsOf(logFile) {
  const dir = path.dirname(logFile);
  const prefix = (path.basename(logFile, path.extname(logFile)) + '-backup-').toLowerCase();
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names.filter((n) => n.toLowerCase().startsWith(prefix) && /\.log$/i.test(n)).sort().map((n) => path.join(dir, n));
}

/** Gives a log's parser events and log lines to a history writer. */
function take(parser, w) {
  for (const e of parser.drain()) { if (e.type === 'Line') w.line(e.text); else w.record(e); }
}

/**
 * Reads every older log not read before into the history, a megabyte at a time so the card and the live log carry on.
 * makeParser() gives a fresh parser (with keepLines). Resolves to the number of logs read.
 */
async function importBackups(logFile, history, makeParser, note = () => {}) {
  let read = 0;
  for (const file of backupsOf(logFile)) {
    let st;
    try { st = fs.statSync(file); } catch (e) { continue; }
    const key = path.basename(file) + ':' + st.size;
    if (history.imported(key)) continue;
    const parser = makeParser(), w = history.writer(), decoder = new TextDecoder('utf-8');
    try {
      const fh = await fs.promises.open(file, 'r');
      try {
        const buf = Buffer.alloc(1 << 20);
        for (let pos = 0; pos < st.size;) {
          const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
          if (!bytesRead) break;
          pos += bytesRead;
          parser.feed(decoder.decode(buf.subarray(0, bytesRead), { stream: true }));
          take(parser, w);
          await new Promise((resolve) => setImmediate(resolve));
        }
      } finally { await fh.close(); }
      parser.feed(decoder.decode());
      parser.finish();
      take(parser, w);
    } catch (e) {
      note(`couldn't read ${path.basename(file)}:`, String((e && e.message) || e));
      w.close();
      continue;
    }
    w.close();
    history.markImported(key);
    read++;
    note(`read ${path.basename(file)} into the run history`);
  }
  return read;
}

module.exports = { backupsOf, importBackups };
