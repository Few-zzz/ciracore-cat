/**
 * Google Apps Script — วางใน Google Sheet: ส่วนขยาย > Apps Script แล้ว Deploy เป็น Web app
 * cira_behavior.py (ใน CiRA) ส่งสรุปพฤติกรรมแมวรายนาทีมาเก็บ (POST)
 * dashboard ดึงกลับไปแสดง (GET)
 * วิธีติดตั้งดูที่ README.md หัวข้อ "บันทึกลง Google Sheet"
 */
const SHEET_NAME = "cat_minutes";
// ลำดับคอลัมน์ต้องตรงกับ SHEET_HEAD ใน cira_behavior.py และ dashboard/lib/sheets.ts
const HEADER = ["minute_ts", "datetime", "monitored_s", "cat_count",
  "sleep", "walk", "play", "sit", "eat", "stand", "poop"];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (!checkSecret_(body.secret)) return json_({ error: "forbidden" });

  const lock = LockService.getScriptLock();   // กันสองคำขอเขียนพร้อมกันจนแถวซ้ำ
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const last = lastTs_(sh);
    // เก็บเฉพาะนาทีที่ใหม่กว่าแถวสุดท้าย (ส่งซ้ำได้ ไม่เกิดแถวซ้ำ)
    const rows = (body.rows || []).filter((r) => Number(r[0]) > last);
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
    return json_({ ok: true, appended: rows.length, last: rows.length ? rows[rows.length - 1][0] : last });
  } finally {
    lock.releaseLock();
  }
}

// GET ?secret=...&after=<minute_ts>  -> แถวที่ minute_ts > after
function doGet(e) {
  if (!checkSecret_(e.parameter.secret)) return json_({ error: "forbidden" });
  const sh = sheet_();
  const n = sh.getLastRow() - 1;                // จำนวนแถวข้อมูล (ไม่นับหัวตาราง)
  if (n < 1) return json_({ rows: [], last: 0 });

  const after = Number(e.parameter.after || 0);
  const ts = sh.getRange(2, 1, n, 1).getValues().map((r) => Number(r[0]));
  const last = ts[n - 1];
  const start = ts.findIndex((t) => t > after);
  if (start < 0) return json_({ rows: [], last: last });

  const rows = sh.getRange(2 + start, 1, n - start, HEADER.length).getValues()
    .map((r) => [Number(r[0]), null].concat(r.slice(2).map(Number)));   // ไม่ส่งคอลัมน์ datetime กลับ
  return json_({ rows: rows, last: last });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange("A:A").setNumberFormat("0");   // epoch ms ไม่ให้แสดงเป็น 1.8E+12
  }
  return sh;
}

function lastTs_(sh) {
  const n = sh.getLastRow();
  return n < 2 ? 0 : Number(sh.getRange(n, 1).getValue());
}

function checkSecret_(s) {
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  return Boolean(secret) && s === secret;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
