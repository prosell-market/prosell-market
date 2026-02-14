// api.js - Networking layer
// Убедись, что этот URL соответствует твоему актуальному Apps Script (Deploy -> Web App URL)
const DATA_URL = "https://script.google.com/macros/s/AKfycbxDMVo0B_0bPgqNx36OowSjk93hzU5NiCEPFNo1GdXdlomaOp3aUO_xs2Si2PqheLOk/exec";

// Если используешь API_KEY в Code.gs, впиши его сюда
const API_KEY = "";

// --- Внутренние помощники ---

function buildUrl(action, extraParams = {}) {
  const url = new URL(DATA_URL);
  url.searchParams.set("action", action);
  if (API_KEY) url.searchParams.set("key", API_KEY);

  Object.keys(extraParams || {}).forEach(k => {
    const v = extraParams[k];
    if (v !== undefined && v !== null && String(v) !== "") {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

// Универсальная функция запроса (заменяет старые getJson/postForm для надежности)
async function fetchJson(action, options = {}) {
  const { method = "GET", body = null, params = {} } = options;
  const url = buildUrl(action, params);

  const fetchOptions = {
    method,
    cache: "no-store",
    headers: {}
  };

  // Если POST, отправляем как JSON (совместимо с твоим новым Backend)
  if (method === "POST") {
    fetchOptions.headers["Content-Type"] = "text/plain;charset=utf-8";
    fetchOptions.body = JSON.stringify(body || {});
  }

  try {
    const res = await fetch(url, fetchOptions);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.error("API Error:", action, err);
    throw err;
  }
}

// --- ПУБЛИЧНЫЙ API ---

window.API = {
  // 1. Магазин и Клиент
  async health() {
    return fetchJson("health");
  },

  async getData() {
    return fetchJson("data");
  },

  async createOrder(payload) {
    // payload должен содержать { tg, profile, items, total }
    return fetchJson("order", { method: "POST", body: payload });
  },

  // 2. Уведомления (Раздел "Мои заказы")
  async getNotifications(tgId) {
    return fetchJson("notifications", { params: { tg_id: tgId || "" } });
  },

  async markNotificationRead(tgId, notifId) {
    return fetchJson("notifications_read", {
      method: "POST",
      body: { tg_id: tgId || "", notif_id: notifId || "" }
    });
  },

  // 3. Админка: Заказы
  async adminGetOrders(token) {
    return fetchJson("admin_orders", { params: { token: token || "" } });
  },

  async adminGetNotifications(token) {
    return fetchJson("admin_notifications", { params: { token: token || "" } });
  },

  async adminUpdateOrderStatus(token, orderId, status) {
    return fetchJson("admin_update_order_status", {
      method: "POST",
      body: { token: token || "", order_id: orderId || "", status: status || "" }
    });
  },

  // 4. Админка: Товары (НОВОЕ)
  
  // Получить список товаров и категорий
  async fetchJson(action, options = {}) {
      // Экспортируем fetchJson чтобы admin.html мог его использовать напрямую если нужно
      return fetchJson(action, options);
  },

  async adminGetProducts(token) {
    return fetchJson("admin_products", { params: { token: token || "" } });
  },

  // Сохранить (создать или обновить) товар
  async adminSaveProduct(token, item) {
    return fetchJson("admin_save_product", {
      method: "POST",
      body: { token: token, item: item }
    });
  },

  // Удалить товар
  async adminDeleteProduct(token, id) {
    return fetchJson("admin_delete_product", {
      method: "POST",
      body: { token: token, id: id }
    });
  },

  // Загрузить картинку
  async adminUploadImage(token, base64Data, mimeType) {
    return fetchJson("admin_upload_image", {
      method: "POST",
      body: { token: token, data: base64Data, mime: mimeType }
    });
  }
};