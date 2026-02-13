// ProSell API client (for GitHub Pages)
// Update SCRIPT_URL when you redeploy Apps Script.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztH4aMMnNI3J4ZOhr9HJS6-ETNy8TQ50cyjE7s4WDes6vceYejNsAZwbgLZst0pkqV/exec";

function qs(params) {
  const u = new URLSearchParams();
  Object.keys(params || {}).forEach(k => {
    const v = params[k];
    if (v !== undefined && v !== null && String(v) !== "") u.set(k, String(v));
  });
  return u.toString();
}

async function getJSON(url) {
  const r = await fetch(url, { method: "GET" });
  return await r.json();
}

async function postJSON(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  return await r.json();
}

const API = {
  async ping() {
    return getJSON(`${SCRIPT_URL}?${qs({ action: "ping" })}`);
  },

  // Public shop data (optional)
  async getProducts() {
    return getJSON(`${SCRIPT_URL}?${qs({ action: "products" })}`);
  },
  async getCategories() {
    return getJSON(`${SCRIPT_URL}?${qs({ action: "categories" })}`);
  },
  async getUiConfig() {
    return getJSON(`${SCRIPT_URL}?${qs({ action: "ui_config" })}`);
  },

  // Create order (shop -> backend)
  async createOrder(orderPayload) {
    return postJSON(`${SCRIPT_URL}?${qs({ action: "create_order" })}`, orderPayload);
  },

  // Notifications (optional)
  async listNotifications(tgId) {
    return getJSON(`${SCRIPT_URL}?${qs({ action: "notifications_list", tg_id: tgId })}`);
  },
  async readNotification(tgId, notifId) {
    return postJSON(`${SCRIPT_URL}?${qs({ action: "notifications_read" })}`, { tg_id: tgId, notif_id: notifId });
  },

  // Admin
  async adminGetOrders(token) {
    return getJSON(`${SCRIPT_URL}?${qs({ action: "admin_orders", token })}`);
  },

  async adminUpdateOrderStatus(token, order_id, status) {
    return postJSON(`${SCRIPT_URL}?${qs({ action: "admin_update_order_status" })}`, { token, order_id, status });
  },

  // Backward compatible alias (если в админке старое имя)
  async adminSetOrderStatus(token, order_id, status) {
    return this.adminUpdateOrderStatus(token, order_id, status);
  },

  async adminGetNotifications(token) {
    return getJSON(`${SCRIPT_URL}?${qs({ action: "admin_notifications", token })}`);
  }
};

window.API = API;
