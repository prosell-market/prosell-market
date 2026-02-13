// api.js - Networking layer
// ВАЖНО: тут должна быть ссылка именно вида https://script.google.com/macros/s/.../exec (без ?action=...)
const DATA_URL = "https://script.google.com/macros/s/AKfycbx8Qaz0tpIl2Ev5aT5MIVymZhhi46XBlS_bwdyhw90FwbRiUfZve749TKqrFqfeqHwq/exec";

// Если позже включишь защиту API_KEY в Apps Script - впиши сюда такой же ключ.
// Сейчас оставь пустым, чтобы магазин не сломался.
const API_KEY = "";

function buildUrl(action, extraParams = {}) {
  const url = new URL(DATA_URL);
  url.searchParams.set("action", action);

  if (API_KEY) url.searchParams.set("key", API_KEY);

  for (const k in extraParams) {
    if (!Object.prototype.hasOwnProperty.call(extraParams, k)) continue;
    const v = extraParams[k];
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  return url;
}

const API = {
  async fetchJson(action, options = {}) {
    const { method = "GET", body = null, timeout = 15000, retries = 1, params = {} } = options;

    const url = buildUrl(action, params);

    const fetchOptions = {
      method,
      cache: "no-store",
      headers: {}
    };

    if (method === "POST") {
      // text/plain -> без preflight
      fetchOptions.headers["Content-Type"] = "text/plain;charset=utf-8";
      fetchOptions.body = JSON.stringify(body || {});
    }

    const attemptFetch = async (attempt) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const r = await fetch(url.toString(), { ...fetchOptions, signal: controller.signal });
        clearTimeout(timer);

        if (!r.ok) throw new Error("HTTP " + r.status);

        return await r.json();
      } catch (err) {
        clearTimeout(timer);
        if (attempt < retries) {
          await new Promise((res) => setTimeout(res, 900));
          return attemptFetch(attempt + 1);
        }
        throw err;
      }
    };

    return attemptFetch(0);
  },

  async getData() {
    return this.fetchJson("data");
  },

  async createOrder(payload) {
    return this.fetchJson("order", { method: "POST", body: payload, retries: 1 });
  },

  async getNotifications(tgId) {
    return this.fetchJson("notifications", { method: "GET", params: { tg_id: tgId } });
  },

  async markNotificationRead(tgId, notifId) {
    return this.fetchJson("notifications_read", {
      method: "POST",
      body: { tg_id: tgId || "", id: notifId || "" },
      retries: 0
    });
  },

  // Админ: получить последние заказы (требует token в Apps Script)
  async adminGetOrders(token) {
    return this.fetchJson("admin_orders", { method: "GET", params: { token: token || "" }, retries: 0 });
  },

  // Админ: получить все уведомления (требует token в Apps Script)
  async adminGetNotifications(token) {
    return this.fetchJson("admin_notifications", { method: "GET", params: { token: token || "" }, retries: 0 });
  }
};
