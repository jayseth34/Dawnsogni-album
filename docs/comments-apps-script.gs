/**
 * DAWN SOGNI — song comments backend (Google Apps Script)
 *
 * Setup (once):
 *  1. Create a new Google Sheet (any name).
 *  2. Extensions → Apps Script. Delete what's there and paste this whole file.
 *  3. Change ADMIN_KEY below to your own secret word (used in admin to delete comments).
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as: Me      Who has access: Anyone
 *     Click Deploy, allow access, and copy the Web app URL (ends with /exec).
 *  5. In your site admin → Artist & settings → paste the URL into "Comments link", then Publish.
 *
 * Moderation: delete the row in the "Comments" tab, type anything in its "hidden"
 * column, or use the Comments panel in admin.
 */

const ADMIN_KEY = 'change-this-secret';
const SHEET = 'Comments';

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(['id', 'track', 'name', 'text', 'time', 'hidden']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// stop spreadsheet formulas being injected through a comment
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

function rows_() {
  const sh = sheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    .filter((r) => r[0] && !r[5])
    .map((r) => ({ id: String(r[0]), track: String(r[1]), name: String(r[2]), text: String(r[3]), time: new Date(r[4]).getTime() }));
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let list = rows_();
  if (p.track) list = list.filter((c) => c.track === p.track);
  list.sort((a, b) => b.time - a.time);
  return json_({ ok: true, comments: list.slice(0, p.track ? 500 : 300) });
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'Bad request' }); }

  if (b.action === 'check') return json_({ ok: b.key === ADMIN_KEY });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (b.action === 'delete') {
      if (b.key !== ADMIN_KEY) return json_({ ok: false, error: 'Wrong admin key' });
      const sh = sheet_();
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
      for (let i = ids.length - 1; i >= 1; i--) if (String(ids[i][0]) === String(b.id)) sh.deleteRow(i + 1);
      return json_({ ok: true });
    }

    if (b.website) return json_({ ok: true }); // honeypot field filled → bot

    const name = String(b.name || '').trim().slice(0, 40);
    const text = String(b.text || '').trim().slice(0, 600);
    const track = String(b.track || '').trim().slice(0, 80);
    if (!name || !text || !track) return json_({ ok: false, error: 'Name and comment are required' });
    if ((text.match(/https?:\/\//gi) || []).length > 1) return json_({ ok: false, error: 'Too many links' });

    // block exact repeats for 2 minutes
    const cache = CacheService.getScriptCache();
    const dup = 'd:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, track + name + text));
    if (cache.get(dup)) return json_({ ok: false, error: 'Already posted' });
    cache.put(dup, '1', 120);

    const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), track: track, name: name, text: text, time: Date.now() };
    sheet_().appendRow([c.id, c.track, safe_(c.name), safe_(c.text), new Date(c.time), '']);
    return json_({ ok: true, comment: c });
  } finally {
    lock.releaseLock();
  }
}
