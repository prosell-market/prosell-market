/**
 * ProSell Backend - FULL MONOLITH (Uncut Version)
 * Includes: Shop API, Admin API, Drive Upload, Notifications, Helpers.
 */

const SPREADSHEET_ID = "1Bv6jeLhN_XAs7qyjNmamoYHpW2jSAAtQrk47NkcXSfA";
const API_KEY = ""; // Опциональная защита
const ADMIN_TOKEN = "ps_admin_2026_02_13";

// --- AUTHORIZATION TRIGGER (Запусти вручную один раз!) ---
function doDriveCheck() {
  const folders = DriveApp.getFolders();
  console.log("Drive Access Granted. Folders iterator created.");
}

/* ==========================================================================
   ENTRY POINTS
   ========================================================================== */

function doGet(e) { return handleRequest_(e); }
function doPost(e) { return handleRequest_(e); }

function handleRequest_(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    let action = String(p.action || "data").trim();
    if (!action) action = "data";

    if (API_KEY && String(p.key || "") !== API_KEY) {
      return json_({ ok: false, error: "unauthorized" });
    }

    // --- PUBLIC / SHOP ENDPOINTS ---
    if (action === "health" || action === "ping") return json_(health_());
    if (action === "data") return json_(getInitialData_());
    if (action === "order") return json_(createOrder_(e));
    if (action === "notifications") return json_(getUserOrdersList_(e));
    if (action === "notifications_read") return json_({ ok: true }); 

    // --- ADMIN ENDPOINTS ---
    if (action === "admin_orders") return json_(adminGetOrders_(e));
    if (action === "admin_update_order_status") return json_(adminUpdateOrderStatus_(e));
    if (action === "admin_products") return json_(adminGetProducts_(e));
    if (action === "admin_save_product") return json_(adminSaveProduct_(e));
    if (action === "admin_delete_product") return json_(adminDeleteProduct_(e));
    if (action === "admin_upload_image") return json_(adminUploadImage_(e));

    return json_({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ==========================================================================
   CORE HELPERS
   ========================================================================== */

function getSS_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseJsonMaybe_(v) {
  try { return JSON.parse(v); } catch (e) { return null; }
}

function toNum_(v, def) {
  if (v === "" || v == null) return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function toBool_(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v || "").trim().toLowerCase();
  return (s === "true" || s === "yes" || s === "1");
}

function readSheetData_(sheetName) {
  const ss = getSS_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0].map(String);
  return data.slice(1).map(row => rowToObj_(headers, row));
}

function rowToObj_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { 
    if(h) obj[h] = row[i]; 
  });
  return obj;
}

function ensureHeaders_(sh, headers) {
  if (sh.getLastColumn() < 1) {
    sh.appendRow(headers);
    return;
  }
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  headers.forEach(k => {
    if (h.indexOf(k) === -1) {
      sh.insertColumnAfter(sh.getLastColumn());
      sh.getRange(1, sh.getLastColumn()).setValue(k);
    }
  });
}

// --- CONFIG HELPERS ---
function readUiConfig_() {
  const ss = getSS_();
  const sh = ss.getSheetByName("ui_config");
  if (!sh) return {};
  
  const values = sh.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (!key) continue;
    out[key] = values[i][1];
  }
  return out; // Возвращаем сырой объект
}

function applyUiDefaults_(ui) {
  return ui || {}; // Заглушка, если конфига нет
}

function health_() {
  return { ok: true, ts: new Date().toISOString() };
}

/* ==========================================================================
   SHOP LOGIC
   ========================================================================== */

function getInitialData_() {
  const ui = readUiConfig_();
  
  // Категории
  const categories = readSheetData_("categories").map(x => ({
    id: String(x.id), name: String(x.name), icon: x.icon || "fa-tag", sort: toNum_(x.sort, 100)
  })).sort((a,b) => a.sort - b.sort);

  // Товары
  const products = readSheetData_("products").map(x => ({
    id: String(x.id), 
    category_id: String(x.category || ""), 
    name: String(x.title || ""), 
    price: toNum_(x.price, 0),
    old_price: x.old_price ? toNum_(x.old_price, null) : null,
    image_url: x.image_url || "",
    stock: toBool_(x.in_stock) ? 999 : 0,
    specs: parseJsonMaybe_(x.specs_json) || {},
    // ВАЖНО: Маппинг описания. Если есть 'desc' - берем его, иначе 'specs' (для совместимости)
    desc: String(x.desc || x.specs || "") 
  }));

  // Баннеры (если есть таблица)
  let banners = [];
  try {
    banners = readSheetData_("banners").map(x => ({
      title: String(x.title || ""),
      text: String(x.text || ""),
      icon: String(x.icon || "fa-star"),
      is_hot: toBool_(x.is_hot)
    }));
  } catch(e) { console.log("No banners sheet"); }

  return { ui: applyUiDefaults_(ui), categories: categories, products: products, banners: banners };
}

function createOrder_(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = getSS_();
    
    let sh = ss.getSheetByName("Orders");
    if (!sh) { 
      sh = ss.insertSheet("Orders"); 
      sh.appendRow(["ts", "order_id", "tg_id", "name", "phone", "city", "comment", "total", "items_json", "status"]); 
    }

    const orderId = "ORD-" + Utilities.getUuid().slice(0,8).toUpperCase();
    
    // В поле comment кладем адрес или комментарий
    const commentVal = payload.profile?.comment || payload.profile?.address || "";

    sh.appendRow([
      new Date().toISOString(),
      orderId,
      payload.tg?.id || "",
      payload.profile?.name,
      payload.profile?.phone,
      payload.profile?.city,
      commentVal,
      payload.total,
      JSON.stringify(payload.items || []),
      "new"
    ]);
    
    return { ok: true, order_id: orderId };
  } catch(err) { return { ok: false, error: String(err) }; }
}

function getUserOrdersList_(e) {
  const tgId = String(e.parameter.tg_id || "").trim();
  if (!tgId) return { ok: true, notifications: [] };

  const rows = readSheetData_("Orders");
  // Фильтруем и сортируем
  const userRows = rows.filter(r => String(r.tg_id) === tgId).sort((a,b) => new Date(b.ts) - new Date(a.ts));

  const out = userRows.map(r => {
    const items = parseJsonMaybe_(r.items_json);
    let title = "Заказ";
    if (items && items.length) title = items[0].name || "Товар";
    return {
      id: r.order_id, ts: r.ts, status: r.status || "new",
      total: toNum_(r.total, 0), title: title, text: r.comment || r.city
    };
  });
  return { ok: true, notifications: out };
}

/* ==========================================================================
   ADMIN LOGIC
   ========================================================================== */

function adminCheck_(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  if (p.token === ADMIN_TOKEN) return true;
  try { return JSON.parse(e.postData.contents).token === ADMIN_TOKEN; } catch(_) { return false; }
}

function adminGetOrders_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  const rows = readSheetData_("Orders");
  // Парсим items_json -> items, чтобы фронтенд корректно отображал товары в заказах
  const orders = rows.reverse().map(function(row) {
    row.items = parseJsonMaybe_(row.items_json) || [];
    return row;
  });
  return { ok: true, orders: orders };
}

function adminUpdateOrderStatus_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  const p = JSON.parse(e.postData.contents);
  const ss = getSS_();
  const sh = ss.getSheetByName("Orders");
  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const idCol = h.indexOf("order_id");
  const stCol = h.indexOf("status");
  
  if (idCol === -1 || stCol === -1) return { ok: false, error: "Bad columns" };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(p.order_id)) {
      sh.getRange(i + 1, stCol + 1).setValue(p.status);
      return { ok: true };
    }
  }
  return { ok: false, error: "Not found" };
}

// --- PRODUCT MANAGEMENT ---

function adminGetProducts_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  return { 
    ok: true, 
    products: readSheetData_("products"), 
    categories: readSheetData_("categories") 
  };
}

function adminSaveProduct_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  try {
    const p = JSON.parse(e.postData.contents);
    const item = p.item;
    const ss = getSS_();
    let sh = ss.getSheetByName("products");
    
    // Гарантируем заголовки. 
    // ВАЖНО: Твое описание сейчас в 'specs', но мы добавим 'desc' на будущее
    const headers = ["id", "category", "title", "price", "old_price", "in_stock", "image_url", "desc", "specs", "specs_json"];
    if (!sh) { sh = ss.insertSheet("products"); sh.appendRow(headers); }
    ensureHeaders_(sh, headers);
    
    const data = sh.getDataRange().getValues();
    const h = data[0].map(String);
    const idCol = h.indexOf("id");
    
    // Маппинг данных с Админки в Колонки таблицы
    // Мы пишем item.desc в колонку 'specs', чтобы не терять данные в твоей текущей структуре
    const map = {
      "id": "id", 
      "title": "title", 
      "price": "price", 
      "old_price": "old_price",
      "category": "category", 
      "image_url": "image_url",
      "desc": "specs", // <--- FIX: Пишем описание в specs, так как у тебя там текст
      "in_stock": "in_stock"
    };

    let rowIdx = -1;
    if (item.id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(item.id)) {
          rowIdx = i + 1;
          break;
        }
      }
    }

    if (rowIdx === -1) {
      rowIdx = sh.getLastRow() + 1;
      if (!item.id) item.id = "PRD-" + Utilities.getUuid().slice(0,6).toUpperCase();
    }

    Object.keys(map).forEach(key => {
      const colName = map[key];
      const colIdx = h.indexOf(colName);
      if (colIdx !== -1) {
        let val = item[key];
        if (val === undefined || val === null) val = "";
        sh.getRange(rowIdx, colIdx + 1).setValue(val);
      }
    });
    
    // Force stock=TRUE
    const stockIdx = h.indexOf("in_stock");
    if (stockIdx !== -1) sh.getRange(rowIdx, stockIdx + 1).setValue(true);

    return { ok: true };
  } catch(e) { return { ok: false, error: String(e) }; }
}

function adminDeleteProduct_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  const p = JSON.parse(e.postData.contents);
  const ss = getSS_();
  const sh = ss.getSheetByName("products");
  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const idIdx = h.indexOf("id");
  
  for(let i=1; i<data.length; i++) {
    if(String(data[i][idIdx]) === String(p.id)) {
      sh.deleteRow(i+1);
      return { ok: true };
    }
  }
  return { ok: false, error: "Not found" };
}

function adminUploadImage_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  try {
    const p = JSON.parse(e.postData.contents);
    const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime, "prod_" + Date.now() + ".jpg");
    
    // Ищем папку ProSell_Images
    const folderName = "ProSell_Images";
    const folders = DriveApp.getFoldersByName(folderName);
    let folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // Создаем файл
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Возвращаем ссылку
    return { ok: true, url: "https://lh3.googleusercontent.com/d/" + file.getId() };
  } catch(e) { 
    return { ok: false, error: "Drive Error: " + String(e) }; 
  }
}