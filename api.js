// api.js - Networking layer
// Вставь сюда URL деплоя Google Apps Script Web App (именно /exec, не /dev)
const DATA_URL = "https://script.google.com/macros/s/AKfycbwdLRpVupqLaeCcs9ytblLsjKtU2V5-7U_-ejtJqLPyVs5ZpyF-loCf9EdHn-Um3f_1/exec";

const API = {
  async fetchJson(action, options = {}) {
    const { method = "GET", body = null, timeout = 15000, retries = 1 } = options;

    // action может быть: "data", "order", "notifications", "notifications_read"
    const url = new URL(DATA_URL);
    url.searchParams.set("action", action);

    const fetchOptions = {
      method,
      cache: "no-store",
      headers: {}
    };

    if (method === "POST") {
      // text/plain -> "simple request" без preflight
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
    const url = new URL(DATA_URL);
    url.searchParams.set("action", "notifications");
    if (tgId) url.searchParams.set("tg_id", String(tgId));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const r = await fetch(url.toString(), { method: "GET", cache: "no-store", signal: controller.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  },

  async markNotificationRead(tgId, notifId) {
    return this.fetchJson("notifications_read", {
      method: "POST",
      body: { tg_id: tgId || "", id: notifId || "" },
      retries: 0
    });
  }
};
