/**
 * SmarklinkEdu GAS backend
 * Install this file in the Apps Script project and deploy as a Web App:
 * Execute as: Me | Access: Anyone
 *
 * All requests must come through the Vercel server-side API proxy.
 * The shared API secret is sent only from Vercel to this script over HTTPS.
 */

const APP = {
  name: "SmarklinkEdu",
  systemsSheet: "Systems",
  settingsSheet: "Settings",
  sessionTtlSeconds: 21600,
  maxLogoBytes: 1024 * 1024
};

function initializeSmarklinkEdu() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty("SPREADSHEET_ID");
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create("SmarklinkEdu Database");
    spreadsheetId = spreadsheet.getId();
    props.setProperty("SPREADSHEET_ID", spreadsheetId);
  }

  ensureSheet_(spreadsheet, APP.systemsSheet, [
    "id", "name", "version", "url", "manualUrl", "category", "icon", "sortOrder", "updatedAt"
  ]);
  ensureSheet_(spreadsheet, APP.settingsSheet, ["key", "value"]);

  const systemsSheet = spreadsheet.getSheetByName(APP.systemsSheet);
  if (systemsSheet.getLastRow() <= 1) {
    const seed = getSeedSystems_();
    systemsSheet.getRange(2, 1, seed.length, 9).setValues(seed);
    systemsSheet.setFrozenRows(1);
    systemsSheet.autoResizeColumns(1, 9);
  }

  const settingsSheet = spreadsheet.getSheetByName(APP.settingsSheet);
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.getRange(2, 1, 2, 2).setValues([
      ["appName", APP.name],
      ["logoUrl", ""]
    ]);
  }

  if (!props.getProperty("API_SECRET")) {
    props.setProperty("API_SECRET", randomSecret_());
  }
  if (!props.getProperty("AUTH_PEPPER")) {
    props.setProperty("AUTH_PEPPER", randomSecret_());
  }

  let initialPassword = "";
  if (!props.getProperty("ADMIN_PASSWORD_HASH")) {
    initialPassword = randomSecret_().slice(0, 22);
    const salt = randomSecret_().slice(0, 32);
    props.setProperties({
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD_SALT: salt,
      ADMIN_PASSWORD_HASH: passwordHash_(initialPassword, salt),
      PASSWORD_CHANGE_REQUIRED: "true"
    });
  }

  Logger.log("SmarklinkEdu initialized.");
  Logger.log("DATABASE_URL: " + spreadsheet.getUrl());
  Logger.log("API_SECRET (copy to Vercel GAS_API_SECRET): " + props.getProperty("API_SECRET"));
  if (initialPassword) {
    Logger.log("ONE-TIME ADMIN USERNAME: admin");
    Logger.log("ONE-TIME ADMIN PASSWORD (change after first login): " + initialPassword);
  } else {
    Logger.log("Admin credentials already exist; they were not changed.");
  }
}

function doGet() {
  return json_({ ok: true, app: APP.name, status: "online", message: "Use the Vercel frontend API proxy." });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty("API_SECRET");
    if (!expectedSecret || !constantTimeEquals_(String(body.apiSecret || ""), expectedSecret)) {
      return json_({ ok: false, message: "Unauthorized API request" });
    }

    const action = String(body.action || "");
    if (action === "publicData") return json_(publicData_());
    if (action === "login") return json_(login_(body));

    const username = requireSession_(body.sessionToken);
    if (!username) return json_({ ok: false, message: "กรุณาเข้าสู่ระบบใหม่" });

    switch (action) {
      case "me":
        return json_({
          ok: true,
          user: username,
          passwordChangeRequired: props.getProperty("PASSWORD_CHANGE_REQUIRED") === "true"
        });
      case "adminData":
        return json_(adminData_());
      case "changePassword":
        return json_(changePassword_(body));
      case "logout":
        CacheService.getScriptCache().remove("session_" + String(body.sessionToken || ""));
        return json_({ ok: true, message: "ออกจากระบบแล้ว" });
      case "saveSystem":
        return json_(saveSystem_(body.system || {}));
      case "deleteSystem":
        return json_(deleteSystem_(String(body.id || "")));
      case "saveSettings":
        return json_(saveSettings_(body.settings || {}));
      default:
        return json_({ ok: false, message: "Unknown action" });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, message: err && err.message ? err.message : "Internal error" });
  }
}

function login_(body) {
  const props = PropertiesService.getScriptProperties();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const savedUser = props.getProperty("ADMIN_USERNAME");
  const salt = props.getProperty("ADMIN_PASSWORD_SALT");
  const savedHash = props.getProperty("ADMIN_PASSWORD_HASH");
  if (!savedUser || !salt || !savedHash || username !== savedUser ||
      !constantTimeEquals_(passwordHash_(password, salt), savedHash)) {
    return { ok: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }
  const token = randomSecret_() + randomSecret_();
  CacheService.getScriptCache().put("session_" + token, username, APP.sessionTtlSeconds);
  return {
    ok: true,
    user: username,
    sessionToken: token,
    passwordChangeRequired: props.getProperty("PASSWORD_CHANGE_REQUIRED") === "true"
  };
}

function requireSession_(token) {
  if (!token) return null;
  return CacheService.getScriptCache().get("session_" + String(token));
}

function changePassword_(body) {
  const password = String(body.newPassword || "");
  if (password.length < 12) return { ok: false, message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร" };
  const props = PropertiesService.getScriptProperties();
  const salt = randomSecret_().slice(0, 32);
  props.setProperties({
    ADMIN_PASSWORD_SALT: salt,
    ADMIN_PASSWORD_HASH: passwordHash_(password, salt),
    PASSWORD_CHANGE_REQUIRED: "false"
  });
  return { ok: true, message: "เปลี่ยนรหัสผ่านเรียบร้อย" };
}

function publicData_() {
  return { ok: true, systems: readSystems_(), settings: readSettings_() };
}

function adminData_() {
  return { ok: true, systems: readSystems_(), settings: readSettings_() };
}

function readSystems_() {
  const sheet = getSpreadsheet_().getSheetByName(APP.systemsSheet);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  return values.filter(row => row[0]).map(row => ({
    id: String(row[0]),
    name: String(row[1] || ""),
    version: String(row[2] || ""),
    url: String(row[3] || ""),
    manualUrl: String(row[4] || ""),
    category: String(row[5] || "ระบบสารสนเทศ"),
    icon: String(row[6] || "▣"),
    sortOrder: Number(row[7] || 999),
    updatedAt: row[8] ? String(row[8]) : ""
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}

function saveSystem_(system) {
  const name = String(system.name || "").trim();
  const url = String(system.url || "").trim();
  if (!name) return { ok: false, message: "กรุณาระบุชื่อระบบ" };
  if (!isHttpUrl_(url)) return { ok: false, message: "URL ระบบไม่ถูกต้อง" };
  const manualUrl = String(system.manualUrl || "").trim();
  if (manualUrl && !isHttpUrl_(manualUrl)) return { ok: false, message: "URL คู่มือไม่ถูกต้อง" };

  const sheet = getSpreadsheet_().getSheetByName(APP.systemsSheet);
  const id = String(system.id || Utilities.getUuid());
  const values = [
    id, name, String(system.version || ""), url, manualUrl,
    String(system.category || "ระบบสารสนเทศ"), String(system.icon || "▣"),
    Math.max(1, Number(system.sortOrder || sheet.getLastRow())), new Date().toISOString()
  ];
  const lastRow = sheet.getLastRow();
  let targetRow = 0;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
    const index = ids.indexOf(id);
    if (index >= 0) targetRow = index + 2;
  }
  if (targetRow) sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
  return { ok: true, message: "บันทึกระบบเรียบร้อย", systems: readSystems_() };
}

function deleteSystem_(id) {
  if (!id) return { ok: false, message: "ไม่พบรหัสระบบ" };
  const sheet = getSpreadsheet_().getSheetByName(APP.systemsSheet);
  if (sheet.getLastRow() < 2) return { ok: false, message: "ไม่พบข้อมูล" };
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String);
  const index = ids.indexOf(id);
  if (index < 0) return { ok: false, message: "ไม่พบระบบที่ต้องการลบ" };
  sheet.deleteRow(index + 2);
  return { ok: true, message: "ลบระบบเรียบร้อย" };
}

function saveSettings_(settings) {
  const sheet = getSpreadsheet_().getSheetByName(APP.settingsSheet);
  const appName = String(settings.appName || APP.name).trim().slice(0, 100);
  let logoUrl = String(settings.logoUrl || "").trim();

  if (settings.logoDataUrl) {
    const match = String(settings.logoDataUrl).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return { ok: false, message: "รูปแบบโลโก้ไม่ถูกต้อง" };
    const bytes = Utilities.base64Decode(match[2]);
    if (bytes.length > APP.maxLogoBytes) return { ok: false, message: "ไฟล์โลโก้ต้องมีขนาดไม่เกิน 1 MB" };
    const mime = match[1];
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const blob = Utilities.newBlob(bytes, mime, "SmarklinkEdu-logo." + ext);
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    logoUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
  }

  setSetting_(sheet, "appName", appName);
  setSetting_(sheet, "logoUrl", logoUrl);
  return { ok: true, message: "บันทึกการตั้งค่าเรียบร้อย", settings: readSettings_() };
}

function readSettings_() {
  const sheet = getSpreadsheet_().getSheetByName(APP.settingsSheet);
  const result = { appName: APP.name, logoUrl: "" };
  if (sheet.getLastRow() < 2) return result;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(row => {
    if (row[0]) result[String(row[0])] = String(row[1] || "");
  });
  return result;
}

function setSetting_(sheet, key, value) {
  const last = sheet.getLastRow();
  if (last >= 2) {
    const keys = sheet.getRange(2, 1, last - 1, 1).getValues().flat().map(String);
    const index = keys.indexOf(key);
    if (index >= 0) {
      sheet.getRange(index + 2, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูล กรุณารัน initializeSmarklinkEdu()");
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#eaf0ff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSeedSystems_() {
  const rows = [
    ["ระบบจองยานพาหนะ V.3.2", "", "https://108links.com/sdulpcar", "https://108links.com/cardusit", "การจอง", "🚗", 1],
    ["ระบบจองห้องเรียน V.1.4", "", "https://108links.com/ClassRoomer", "https://108links.com/classdu", "การจอง", "🏫", 2],
    ["ระบบแจ้งซ่อมออนไลน์ V 2.0", "", "https://108links.com/sdulpfix", "https://108links.com/fixbook", "งานบริการ", "🛠️", 3],
    ["ระบบบริจาคออนไลน์", "", "https://108links.com/donation-sdulp", "https://108links.com/Donation", "งานบริการ", "💝", 4],
    ["ระบบตรวจเช็คห้อง Online", "", "https://dun.ct.ws/?p=yEWzI", "", "งานบริการ", "🔎", 5],
    ["ระบบจัดการครุภัณฑ์หอประชุม", "", "https://vq7yqu.short.gy/WXllUr", "", "งานสำนักงาน", "🎤", 6],
    ["ระบบฐานข้อมูล LAMPANGPROUND", "", "https://lampang-pround.lampangpround-official.workers.dev/", "", "ฐานข้อมูล", "📊", 7],
    ["ระบบปฏิทินการปฏิบัติงาน", "", "https://thlink.info/calendarsdu", "", "งานสำนักงาน", "🗓️", 8],
    ["ระบบเบิกจ่ายพัสดุ", "", "https://108links.com/sre", "", "งานสำนักงาน", "📦", 9],
    ["ระบบครุภัณฑ์สำนักงาน", "", "https://dun.ct.ws/?p=ams", "", "งานสำนักงาน", "🗄️", 10],
    ["ระบบจองห้องประชุม", "", "https://108links.com/meeting-room", "", "การจอง", "🪑", 11]
  ];
  return rows.map(row => [
    Utilities.getUuid(), row[0], row[1], row[2], row[3], row[4], row[5], row[6], new Date().toISOString()
  ]);
}

function passwordHash_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty("AUTH_PEPPER") || "";
  // Iterated HMAC-SHA256 slows offline guessing if a stored hash is ever exposed.
  let digest = Utilities.computeHmacSha256Signature(
    String(password) + ":" + salt,
    pepper,
    Utilities.Charset.UTF_8
  );
  for (let i = 0; i < 10000; i++) {
    digest = Utilities.computeHmacSha256Signature(digest, pepper, Utilities.Charset.UTF_8);
  }
  return digest.map(byte => ("0" + ((byte & 255).toString(16))).slice(-2)).join("");
}

function randomSecret_() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
}

function constantTimeEquals_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isHttpUrl_(value) {
  return /^https?:\/\//i.test(value);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
