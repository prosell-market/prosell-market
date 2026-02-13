// ProSell front API helper

// 1) Впиши сюда свой текущий /exec URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbycw_LkTdzPPQtwEjh_b4H-HcDxlV-bufLvABzHVvLiNphqwemcw5D7f02RNdw3y-aF/exec";

// 2) Если в Code.gs заполнил API_KEY, то впиши сюда то же значение, иначе оставь ""
const API_KEY = "";

/* Internal helpers */

function buildUrl(params) {
  const u = new URL(SCRIPT_URL);
  Object.keys(params || {}).forEach(k => {
    if (params[k] !== undefined && params[k] !== null) u.searchParams.set(k, String(params[k]));
  });
  if (API_KEY) u.searchParams.set("key", API_KEY);
  return u.toString();
}

async function getJson(params) {
  const url = buildUrl(params);
  const res = await fetch(url, { method: "GET" });
  return await res.json();
}

async function postForm(params) {
  const body = new URLSearchParams();
  Object.keys(params || {}).forEach(k => {
    if (params[k] !== undefined && params[k] !== null) body.set(k, String(params[k]));
  });
  if (API_KEY) body.set("key", API_KEY);

  const res = await fetch(SCRIPT_URL, { method: "POST", body });
  return await res.json();
}

/* Public API */

window.API = {
  // Health
  ping: () => getJson({ action: "ping" }),

  // Store data
  getData: () => getJson({ action: "data" }),

  // Orders (store)
  createOrder: (order) => {
    // order: { tg_id, name, phone, city, comment, items: [] }
    const payload = {
      action: "create_order",
      tg_id: order && order.tg_id ? order.tg_id : "",
      name: order && order.name ? order.name : "",
      phone: order && order.phone ? order.phone : "",
      city: order && order.city ? order.city : "",
      comment: order && order.comment ? order.comment : "",
      items: JSON.stringify((order && order.items) ? order.items : [])
    };
    return postForm(payload);
  },

  // Notifications (user)
  getNotifications: (tgId) => getJson({ action: "notifications", tg_id: tgId }),
  markNotificationRead: (tgId, notifId) => postForm({ action: "notifications_read", tg_id: tgId, id: notifId }),

  // Admin
  adminGetOrders: (token) => getJson({ action: "admin_orders", token: token }),
  adminSetOrderStatus: (token, orderId, status) => postForm({
    action: "admin_order_status",
    token: token,
    order_id: orderId,
    status: status
  }),

  adminGetNotifications: (token) => getJson({ action: "admin_notifications", token: token })
};
