/**
 * BizConnect AI Studio — Login Tracker (Google Apps Script)
 * Paste into Extensions → Apps Script of the tracking spreadsheet, then
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 *
 * The Cloudflare Worker POSTs one JSON row per sign-in. Two tabs are maintained:
 *   Logins — every sign-in / sign-up event (append-only log)
 *   Users  — one row per member (first seen, last login, login count, credits…)
 */
const SHEET_TOKEN = 'PASTE_TOKEN_HERE'; // must match the Worker secret SHEET_TOKEN
const SHEET_ID = '1vIjsB01QW0UrNGOVrDcSkhmklV95-JHVJPhWYctJgOU'; // the "BizConnect AI Studio - Logins" spreadsheet

const LOGIN_HEADERS = ['Time (UTC)', 'Event', 'Email', 'Name', 'Referred by', 'Ref code', 'Credits', 'Login #', 'Country', 'City', 'Device'];
const USER_HEADERS = ['Email', 'Name', 'First seen (UTC)', 'Last login (UTC)', 'Logins', 'Credits', 'Referred by', 'Ref code', 'Country'];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out_('bad json'); }
  if (d.token !== SHEET_TOKEN) return out_('forbidden');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const logins = tab_(ss, 'Logins', LOGIN_HEADERS);
    logins.appendRow([d.time, d.event, d.email, d.name, d.referredBy, d.refCode, d.credits, d.logins, d.country, d.city, d.device]);

    const users = tab_(ss, 'Users', USER_HEADERS);
    const emails = users.getLastRow() > 1 ? users.getRange(2, 1, users.getLastRow() - 1, 1).getValues().map(r => String(r[0]).toLowerCase()) : [];
    const i = emails.indexOf(String(d.email).toLowerCase());
    if (i === -1) {
      users.appendRow([d.email, d.name, d.time, d.time, d.logins, d.credits, d.referredBy, d.refCode, d.country]);
    } else {
      const row = i + 2;
      users.getRange(row, 2).setValue(d.name);
      users.getRange(row, 4, 1, 3).setValues([[d.time, d.logins, d.credits]]);
      users.getRange(row, 9).setValue(d.country);
    }
  } finally {
    lock.releaseLock();
  }
  return out_('ok');
}

function tab_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0E1B33').setFontColor('#E7C878');
    sh.setFrozenRows(1);
  }
  return sh;
}

function out_(msg) { return ContentService.createTextOutput(msg); }
