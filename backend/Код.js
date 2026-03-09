/**
 * ProSell Backend - FULL MONOLITH (Uncut Version)
 * Includes: Shop API, Admin API, Drive Upload, Notifications, Helpers.
 */

const SPREADSHEET_ID = "1Bv6jeLhN_XAs7qyjNmamoYHpW2jSAAtQrk47NkcXSfA";
const API_KEY = ""; // Опциональная защита
const ADMIN_TOKEN = "ps_admin_2026_02_13";

// --- AUTHORIZATION TRIGGER (Запусти вручную один раз!) ---
function doDriveCheck() {
  // Тестируем ЧТЕНИЕ
  const folders = DriveApp.getFolders();
  // Тестируем ЗАПИСЬ — создаём тестовую папку и сразу удаляем
  const testFolder = DriveApp.createFolder("_ProSell_Drive_Auth_Test_");
  testFolder.setTrashed(true);
  console.log("Drive Access Granted (read + write). Authorization OK!");
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
    if (action === "debug_logs") return json_(getDebugLogs_());
    if (action === "debug_sheet") {
      const sh = getSS_().getSheetByName("products");
      const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      const data = sh.getRange(Math.max(2, sh.getLastRow() - 5), 1, 5, sh.getLastColumn()).getValues();
      return json_({ headers: h, maxCol: sh.getMaxColumns(), lastCol: sh.getLastColumn(), rows: data });
    }
    if (action === "debug_write_test") {
      const sh = getSS_().getSheetByName("products");
      const data = sh.getDataRange().getValues();
      const col = data[0].map(String).indexOf("specs_json") + 1;
      sh.getRange(2, col).setValue("TEST_SAVE_123");
      SpreadsheetApp.flush();
      const readBack = sh.getRange(2, col).getValue();
      return json_({ col: col, readBack: readBack });
    }

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

function readSheetData_(sheetName, maxRows) {
  const ss = getSS_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  // Оптимизация: читаем только последние maxRows строк
  var startRow = 2;
  var numRows = lastRow - 1;
  if (maxRows && numRows > maxRows) {
    startRow = lastRow - maxRows + 1;
    numRows = maxRows;
  }

  const data = sh.getRange(startRow, 1, numRows, lastCol).getValues();
  return data.map(row => rowToObj_(headers, row));
}

function rowToObj_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    // Берем только ПЕРВОЕ вхождение колонки, чтобы защититься от багов с дубликатами заголовков
    if (h && obj[h] === undefined) obj[h] = row[i];
  });
  return obj;
}

function ensureHeaders_(sh, headers) {
  if (sh.getLastColumn() < 1) {
    sh.appendRow(headers);
    return;
  }
  let lastCol = sh.getLastColumn();
  const maxCol = sh.getMaxColumns();
  const h = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  headers.forEach(k => {
    if (h.indexOf(k) === -1) {
      lastCol++;
      if (lastCol > sh.getMaxColumns()) {
        sh.insertColumnAfter(sh.getMaxColumns());
      }
      sh.getRange(1, lastCol).setValue(k);
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
  const cache = CacheService.getScriptCache();
  const cacheKey = "prosell_catalog_data";

  // 1. Пытаемся отдать кеш (Мгновенный ответ)
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      return parsed; // Возвращаем сразу, не трогая Google Таблицу
    } catch (e) { }
  }

  // 2. Если кеша нет — читаем таблицу (Тяжелая операция)
  const ui = readUiConfig_();

  // Категории
  const categories = readSheetData_("categories").map(x => ({
    id: String(x.id), name: String(x.name), icon: x.icon || "fa-tag", sort: toNum_(x.sort, 100)
  })).sort((a, b) => a.sort - b.sort);

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
    // Описание — единый источник: если есть desc/specs текст, его используем
    desc: String(x.desc || x.specs || "")
  }));

  // Если у товара есть текстовое описание — убираем JSON specs чтобы не дублировалось
  products.forEach(function (p) {
    if (p.desc) p.specs = {};
  });

  // Баннеры
  let banners = [];
  try {
    const bannersRaw = readSheetData_("banners");
    if (bannersRaw && bannersRaw.length > 0) {
      bannersRaw.forEach(x => {
        if (x.image_url) {
          banners.push({
            id: String(x.id || Math.random().toString(36).substring(7)),
            image_url: String(x.image_url || ""),
            link: String(x.link || "")
          });
        }
      });
    }
  } catch (e) { console.log("No banners sheet"); }

  const result = { ui: applyUiDefaults_(ui), categories: categories, products: products, banners: banners };

  // 3. Сохраняем результат в кеш на 5 минут (300 секунд)
  try {
    cache.put(cacheKey, JSON.stringify(result), 300);
  } catch (e) { }

  return result;
}

function createOrder_(e) {
  // Инициализируем блокировку: если 30 человек купят одновременно, они выстроятся в очередь (ждем до 10 секунд)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { ok: false, error: "Система перегружена, попробуйте через пару секунд" };
  }

  try {
    const rawPayload = e.postData.contents;
    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch (parseErr) {
      appendDebug_("JSON Parse Error", rawPayload, String(parseErr));
      return { ok: false, error: "Invalid JSON" };
    }
    const ss = getSS_();

    // Логируем входящий payload для дебага
    appendDebug_("createOrder payload", JSON.stringify(payload), "");

    const headers = ["ts", "order_id", "tg_id", "name", "phone", "city", "comment", "total", "items_json", "status", "idem_key"];
    let sh = ss.getSheetByName("Orders");
    if (!sh) {
      sh = ss.insertSheet("Orders");
      sh.appendRow(headers);
    } else {
      ensureHeaders_(sh, headers);
    }

    // Валидация данных
    if (!payload.items || !payload.items.length) {
      return { ok: false, error: "Корзина пуста" };
    }
    if (!payload.total || payload.total <= 0) {
      return { ok: false, error: "Некорректная сумма" };
    }
    if (!payload.profile?.name || !payload.profile?.phone) {
      return { ok: false, error: "Укажите имя и телефон" };
    }

    // Защита от дублей по idempotency_key
    const idemKey = payload.idempotency_key || "";
    if (idemKey) {
      const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      const idemCol = h.indexOf("idem_key");
      if (idemCol !== -1) {
        const lastRow = sh.getLastRow();
        // Проверяем последние 100 строк на дубль
        var checkStart = Math.max(2, lastRow - 100);
        if (lastRow >= checkStart) {
          var existingKeys = sh.getRange(checkStart, idemCol + 1, lastRow - checkStart + 1, 1).getValues();
          for (var k = 0; k < existingKeys.length; k++) {
            if (String(existingKeys[k][0]) === idemKey) {
              return { ok: true, order_id: "DUP", message: "Заказ уже создан" };
            }
          }
        }
      }
    }

    const orderId = "ORD-" + Utilities.getUuid().slice(0, 8).toUpperCase();

    // В поле comment кладем адрес или комментарий
    const commentVal = payload.profile?.comment || payload.profile?.address || "";

    const dataRange = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const h = dataRange.map(String);
    const newRow = new Array(h.length).fill("");

    const rowMap = {
      "ts": new Date().toISOString(),
      "order_id": orderId,
      "tg_id": payload.tg?.id || "",
      "tg_username": payload.tg?.username || payload.tg?.first_name || "",
      "name": payload.profile?.name || "",
      "phone": payload.profile?.phone || "",
      "city": payload.profile?.city || "",
      "comment": commentVal,
      "total": payload.total || 0,
      "items_json": JSON.stringify(payload.items || []),
      "status": "new",
      "idem_key": idemKey
    };

    Object.keys(rowMap).forEach(key => {
      const colIdx = h.indexOf(key);
      if (colIdx !== -1) {
        newRow[colIdx] = rowMap[key];
      }
    });

    // Безопасность: если каких-то колонок вообще нет (даже после ensureHeaders_), они запишутся в конец
    // чтобы не потерять важные данные, если таблица была сломана пользователем.
    if (h.indexOf("total") === -1) newRow[h.length] = payload.total;
    if (h.indexOf("status") === -1) newRow[h.length + 1] = "new";

    sh.appendRow(newRow);

    return { ok: true, order_id: orderId };
  } catch (err) {
    appendDebug_("createOrder_ Error", "", String(err));
    return { ok: false, error: String(err) };
  } finally {
    // В любом случае освобождаем блокировку очереди
    lock.releaseLock();
  }
}

function appendDebug_(action, data, error) {
  try {
    const ss = getSS_();
    let sh = ss.getSheetByName("Debug");
    if (!sh) {
      sh = ss.insertSheet("Debug");
      sh.appendRow(["ts", "action", "data", "error"]);
    }
    sh.appendRow([new Date().toISOString(), action, data, error]);
  } catch (e) {
    console.error("Debug logger failed", e);
  }
}

function getDebugLogs_() {
  return { ok: true, logs: readSheetData_("Debug", 50) };
}

function getUserOrdersList_(e) {
  const tgId = String(e.parameter.tg_id || "").trim();
  if (!tgId) return { ok: true, notifications: [] };

  const rows = readSheetData_("Orders");
  // Фильтруем и сортируем
  const userRows = rows.filter(r => String(r.tg_id) === tgId).sort((a, b) => new Date(b.ts) - new Date(a.ts));

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
  try { return JSON.parse(e.postData.contents).token === ADMIN_TOKEN; } catch (_) { return false; }
}

function adminGetOrders_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  const rows = readSheetData_("Orders");
  // Парсим items_json -> items, чтобы фронтенд корректно отображал товары в заказах
  const orders = rows.reverse().map(function (row) {
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
  const raw = readSheetData_("products");
  const products = raw.map(function (x) {
    // Сначала пробуем desc, потом specs (текст)
    var textDesc = String(x.desc || x.specs || "").trim();

    // Если текстового описания нет — форматируем из specs_json
    if (!textDesc && x.specs_json) {
      var parsed = parseJsonMaybe_(String(x.specs_json));
      if (parsed && typeof parsed === "object") {
        textDesc = Object.entries(parsed)
          .map(function (entry) { return entry[0] + ": " + entry[1]; })
          .join(" | ");
      }
    }
    x.desc = textDesc;
    return x;
  });
  return {
    ok: true,
    products: products,
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

    // Скидываем кеш каталога при любом сохранении товара, чтобы изменения сразу появились на фронте
    CacheService.getScriptCache().remove("prosell_catalog_data");

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
      "in_stock": "in_stock"
    };

    // Описание пишем в обе колонки для совместимости
    const descMap = { "desc": "desc", "desc_to_specs": "specs" };

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
      if (!item.id) item.id = "PRD-" + Utilities.getUuid().slice(0, 6).toUpperCase();
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

    // Записываем описание в обе колонки (desc и specs) для совместимости
    var descVal = item.desc || "";
    var descIdx = h.indexOf("desc");
    var specsIdx = h.indexOf("specs");
    if (descIdx !== -1) sh.getRange(rowIdx, descIdx + 1).setValue(descVal);
    if (specsIdx !== -1) sh.getRange(rowIdx, specsIdx + 1).setValue(descVal);

    // Сохраняем переданный specs_json
    var specsJsonVal = item.specs_json || "";
    var specsJsonIdx = h.indexOf("specs_json");
    if (specsJsonIdx !== -1) sh.getRange(rowIdx, specsJsonIdx + 1).setValue(specsJsonVal);

    // Force stock=TRUE
    const stockIdx = h.indexOf("in_stock");
    if (stockIdx !== -1) sh.getRange(rowIdx, stockIdx + 1).setValue(true);

    SpreadsheetApp.flush(); // Гарантируем немедленное применение записи
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

function adminDeleteProduct_(e) {
  if (!adminCheck_(e)) return { ok: false, error: "403" };
  const p = JSON.parse(e.postData.contents);
  const ss = getSS_();
  const sh = ss.getSheetByName("products");
  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const idIdx = h.indexOf("id");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(p.id)) {
      sh.deleteRow(i + 1);
      CacheService.getScriptCache().remove("prosell_catalog_data");
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
  } catch (e) {
    return { ok: false, error: "Drive Error: " + String(e) };
  }
}