// api.js - Networking layer
const DATA_URL = "https://script.google.com/macros/s/AKfycbwNEl-b5MGzzJZ6_9HO8VeJajQ4VVpHhWRt0uEL7A42o87pxrJc8zLHi8hywEG4DduE/exec";

// If you enable API_KEY in Code.gs - set it here too
const API_KEY = "";

// helper
function buildUrl(action, extraParams = {}) {
  const url = new URL(DATA_URL);
  url.searchParams.set("action", action);
  if (API_KEY) url.searchParams.set("key", API_KEY);

  Object.keys(extraParams || {}).forEach(k => {
    const v = extraParams[k];
    if (v !== undefined && v !== null && String(v) !== "") url.searchParams.set(k, String(v));
  });

  return url.toString();
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
      // text/plain -> "simple request" (no preflight)
      fetchOptions.headers["Content-Type"] = "text/plain;charset=utf-8";
      fetchOptions.body = JSON.stringify(body || {});
    }

    const attemptFetch = async (attempt) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const r = await fetch(url, { ...fetchOptions, signal: controller.signal });
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

  // shop
  async health() {
    return this.fetchJson("health");
  },
  async getData() {
    return this.fetchJson("data");
  },
  async createOrder(payload) {
    return this.fetchJson("order", { method: "POST", body: payload, retries: 1 });
  },

  // user notifications
  async getNotifications(tgId) {
    return this.fetchJson("notifications", { params: { tg_id: tgId || "" }, retries: 0 });
  },
  async markNotificationRead(tgId, notifId) {
    return this.fetchJson("notifications_read", {
      method: "POST",
      body: { tg_id: tgId || "", notif_id: notifId || "" },
      retries: 0
    });
  },

  // admin
  async adminGetOrders(token) {
    return this.fetchJson("admin_orders", { params: { token: token || "" }, retries: 0 });
  },
  async adminGetNotifications(token) {
    return this.fetchJson("admin_notifications", { params: { token: token || "" }, retries: 0 });
  },
  async adminUpdateOrderStatus(token, orderId, status) {
    return this.fetchJson("admin_update_order_status", {
      method: "POST",
      body: { token: token || "", order_id: orderId || "", status: status || "" },
      retries: 0
    });
  }
};

window.API = API;