// ProSell Frontend API helper (GitHub Pages -> Google Apps Script)

// 1) Put your current deployed /exec url here
const DATA_URL = "https://script.google.com/macros/s/AKfycbx8HBoD02RlpQ45Fg-WOwkH2gbcKhmprUMRLHjbXGYxvQ08viZgO7nyZTd7dtm2OW2E/exec";

// 2) Optional: if you enabled API_KEY in Apps Script, put it here too
const API_KEY = ""; // same as API_KEY in Code.gs

function buildUrl(action, params) {
  const u = new URL(DATA_URL);
  u.searchParams.set("action", action);
  if (API_KEY) u.searchParams.set("key", API_KEY);
  if (params) {
    Object.keys(params).forEach(k => {
      if (params[k] === undefined || params[k] === null) return;
      u.searchParams.set(k, String(params[k]));
    });
  }
  return u.toString();
}

async function getJson(url) {
  const r = await fetch(url, { method: "GET" });
  return await r.json();
}

async function postJson(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  return await r.json();
}

window.API = {
  // Public
  health: () => getJson(buildUrl("health")),
  getData: () => getJson(buildUrl("data")),
  createOrder: (payload) => postJson(buildUrl("order"), payload),
  getNotifications: (tg_id) => getJson(buildUrl("notifications", { tg_id })),
  markNotificationRead: (tg_id, id) => postJson(buildUrl("notifications_read"), { tg_id, id }),

  // Admin
  adminGetOrders: (token, includeArchived) =>
    getJson(buildUrl("admin_orders", {
      token,
      include_archived: includeArchived ? "1" : ""
    })),

  adminSetOrderStatus: (token, order_id, status) =>
    postJson(buildUrl("admin_order_status"), { token, order_id, status })
};
