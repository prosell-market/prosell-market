// app.js - Main Application Logic

function getTelegramSafe() {
  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  if (tg) return tg;

  // Safe stub for browser testing
  return {
    platform: "browser",
    initDataUnsafe: {},
    ready() {},
    expand() {},
    close() {},
    HapticFeedback: null,
    MainButton: {
      show() {},
      hide() {},
      setText() {},
      onClick() {},
      offClick() {}
    },
    openTelegramLink(url) { window.open(url, "_blank"); },
    openLink(url) { window.open(url, "_blank"); }
  };
}

const App = {
  state: {
    data: null,
    cart: [],
    profile: { name: "", phone: "", city: "", comment: "" },
    activeTab: "shop",
    activeCategory: "all",
    isSubmitting: false,
    productSheet: { id: null, qty: 1 }
  },

  tg: getTelegramSafe(),
  storageKeys: { cart: "prosell_cart_anon", profile: "prosell_profile_anon" },

  init() {
    try { this.tg.expand(); } catch (e) {}
    try { this.tg.ready(); } catch (e) {}

    const userId = this.tg.initDataUnsafe?.user?.id || "anon";
    this.storageKeys = {
      cart: "prosell_cart_" + userId,
      profile: "prosell_profile_" + userId
    };

    this.loadState();
    this.toggleLoader(true);
    this.bindEvents();
    this.fetchData();
  },

  loadState() {
    try {
      const savedCart = localStorage.getItem(this.storageKeys.cart);
      if (savedCart) this.state.cart = JSON.parse(savedCart);

      const savedProfile = localStorage.getItem(this.storageKeys.profile);
      if (savedProfile) {
        this.state.profile = JSON.parse(savedProfile);
      } else if (this.tg.initDataUnsafe?.user) {
        const u = this.tg.initDataUnsafe.user;
        this.state.profile.name = [u.first_name, u.last_name].filter(Boolean).join(" ");
      }
    } catch (e) {
      console.error("State load error", e);
    }
  },

  saveState() {
    try {
      localStorage.setItem(this.storageKeys.cart, JSON.stringify(this.state.cart));
      localStorage.setItem(this.storageKeys.profile, JSON.stringify(this.state.profile));
    } catch (e) {}

    this.updateBadge();
    this.updateMainButton();
  },

  async fetchData() {
    try {
      const response = await API.getData();
      if (!response) throw new Error("Empty response");

      this.state.data = response;
      this.renderApp();

      this.toggleLoader(false);
      document.getElementById("app").classList.remove("hidden");
    } catch (e) {
      console.error(e);
      this.useFallbackData();
      this.renderApp();

      this.toggleLoader(false);
      document.getElementById("app").classList.remove("hidden");
      document.getElementById("retry-init-btn").classList.remove("hidden");
      this.showToast("Сервер недоступен: включен демо-режим", "error");
    }
  },

  useFallbackData() {
    this.state.data = {
      ui: {
        app_title: "ProSell Demo",
        subtitle: "Каталог временно недоступен",
        tabs: { shop: "Магазин", cart: "Корзина", profile: "Профиль", info: "Инфо" },
        buttons: { add: "Добавить", checkout: "Оформить" },
        empty_cart_title: "Корзина пуста",
        empty_cart_subtitle: "Добавьте товары из каталога",
        go_shop: "В магазин",
        support_text: "Поддержка",
        support_link: ""
      },
      categories: [],
      products: [],
      meta: { updated_at: new Date().toISOString() }
    };
  },

  renderApp() {
    const ui = this.state.data?.ui || {};
    const safeText = (id, txt) => {
      const el = document.getElementById(id);
      if (el && typeof txt === "string" && txt.length) el.textContent = txt;
    };

    safeText("lbl-app-title", ui.app_title || "ProSell");
    safeText("lbl-app-subtitle", ui.subtitle || "");
    safeText("lbl-tab-cart", ui.tabs?.cart || "Корзина");
    safeText("lbl-tab-profile", ui.tabs?.profile || "Профиль");
    safeText("lbl-tab-info", ui.tabs?.info || "Инфо");

    safeText("lbl-menu-shop", ui.tabs?.shop || "Магазин");
    safeText("lbl-menu-cart", ui.tabs?.cart || "Корзина");
    safeText("lbl-menu-profile", ui.tabs?.profile || "Профиль");
    safeText("lbl-menu-info", ui.tabs?.info || "Инфо");

    safeText("lbl-empty-title", ui.empty_cart_title || "Корзина пуста");
    safeText("lbl-empty-subtitle", ui.empty_cart_subtitle || "Добавьте товары");
    safeText("lbl-support", ui.support_text || "Поддержка");

    const catContainer = document.getElementById("categories-container");
    catContainer.innerHTML = "";

    const cats = [{ id: "all", name: ui.all_category_name || "Все", icon: "fa-layer-group" }].concat(this.state.data?.categories || []);
    cats.forEach((cat) => {
      const btn = document.createElement("div");
      btn.className = "chip " + (this.state.activeCategory === cat.id ? "active" : "");
      const icon = cat.icon ? String(cat.icon) : "fa-tag";
      btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(cat.name || "")}`;
      btn.addEventListener("click", () => this.setCategory(cat.id));
      catContainer.appendChild(btn);
    });

    this.renderProducts();

    document.getElementById("inp-name").value = this.state.profile.name || "";
    document.getElementById("inp-phone").value = this.state.profile.phone || "";
    document.getElementById("inp-city").value = this.state.profile.city || "";
    document.getElementById("inp-comment").value = this.state.profile.comment || "";

    this.updateBadge();
    this.updateMainButton();

    if (this.state.activeTab === "cart") this.renderCart();
  },

  renderProducts() {
    const grid = document.getElementById("product-grid");
    grid.innerHTML = "";

    const products = this.state.data?.products || [];
    const filtered = (this.state.activeCategory === "all")
      ? products
      : products.filter((p) => p.category_id === this.state.activeCategory);

    filtered.forEach((p) => {
      const el = document.createElement("div");
      el.className = "card";

      const badge = p.badge ? `<div class="badge">${escapeHtml(String(p.badge))}</div>` : "";
      const img = p.image_url
        ? `<img src="${escapeAttr(p.image_url)}" loading="lazy" alt="">`
        : `<i class="fa-solid fa-box-open"></i>`;

      const disabled = (typeof p.stock === "number" && p.stock <= 0) ? "disabled" : "";

      el.innerHTML = `
        ${badge}
        <div class="card-img-wrap" data-open="${escapeAttr(p.id)}">${img}</div>
        <div class="card-title" data-open="${escapeAttr(p.id)}">${escapeHtml(p.name || "")}</div>
        <div class="card-footer">
          <div>
            <span class="price">${formatMoney(p.price)}</span>
            ${p.old_price ? `<span class="price-old">${formatMoney(p.old_price)}</span>` : ""}
          </div>
          <button class="btn-add-sm" data-add="${escapeAttr(p.id)}" ${disabled} aria-label="В корзину">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      `;

      el.querySelectorAll("[data-open]").forEach((x) => x.addEventListener("click", () => this.openProduct(p.id)));
      const addBtn = el.querySelector("[data-add]");
      addBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.addToCart(p.id, 1);
      });

      grid.appendChild(el);
    });
  },

  renderCart() {
    const container = document.getElementById("cart-list");
    container.innerHTML = "";

    const ui = this.state.data?.ui || {};
    const emptyEl = document.getElementById("cart-empty-state");
    const summaryEl = document.getElementById("cart-summary");

    if (!this.state.cart.length) {
      emptyEl.classList.remove("hidden");
      summaryEl.classList.add("hidden");
      document.getElementById("btn-go-shop").textContent = ui.go_shop || "В магазин";
      return;
    }

    emptyEl.classList.add("hidden");
    summaryEl.classList.remove("hidden");

    let total = 0;

    this.state.cart.forEach((item) => {
      const product = (this.state.data?.products || []).find((p) => p.id === item.id);
      if (!product) return;

      total += (Number(product.price) || 0) * item.qty;

      const el = document.createElement("div");
      el.className = "cart-item";
      el.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(product.name || "")}</div>
          <div class="cart-item-sku">${escapeHtml(product.sku || "")}</div>
          <div class="cart-item-price">${formatMoney(product.price)}</div>
        </div>

        <div class="qty-control-sm">
          <button class="btn-qty-sm" data-qminus="${escapeAttr(item.id)}" aria-label="Минус"><i class="fa-solid fa-minus"></i></button>
          <span>${item.qty}</span>
          <button class="btn-qty-sm" data-qplus="${escapeAttr(item.id)}" aria-label="Плюс"><i class="fa-solid fa-plus"></i></button>
        </div>

        <button class="btn-del" data-del="${escapeAttr(item.id)}" aria-label="Удалить"><i class="fa-solid fa-trash"></i></button>
      `;

      el.querySelector("[data-qminus]").addEventListener("click", () => this.changeQty(item.id, -1));
      el.querySelector("[data-qplus]").addEventListener("click", () => this.changeQty(item.id, 1));
      el.querySelector("[data-del]").addEventListener("click", () => this.removeFromCart(item.id));

      container.appendChild(el);
    });

    document.getElementById("cart-total-price").textContent = formatMoney(total);
    document.getElementById("btn-checkout").textContent = ui.buttons?.checkout || "Оформить";
  },

  setCategory(id) {
    this.state.activeCategory = id;
    this.renderApp();
  },

  addToCart(id, qty = 1) {
    const product = (this.state.data?.products || []).find((p) => p.id === id);
    if (!product) return;

    if (typeof product.stock === "number" && product.stock <= 0) return;

    const existing = this.state.cart.find((i) => i.id === id);
    if (existing) existing.qty += qty;
    else this.state.cart.push({ id, qty });

    this.saveState();
    this.haptic("selection");
    this.showToast("Добавлено в корзину");
  },

  changeQty(id, delta) {
    const item = this.state.cart.find((i) => i.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) this.removeFromCart(id);
    else {
      this.saveState();
      this.renderCart();
      this.haptic("selection");
    }
  },

  removeFromCart(id) {
    this.state.cart = this.state.cart.filter((i) => i.id !== id);
    this.saveState();
    this.renderCart();
    this.haptic("selection");
  },

  switchTab(tab) {
    this.state.activeTab = tab;

    document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
    const page = document.getElementById("page-" + tab);
    if (page) page.classList.add("active");

    document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("active"));
    const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (btn) btn.classList.add("active");

    if (tab === "cart") this.renderCart();

    this.updateMainButton();
  },

  openProduct(id) {
    const product = (this.state.data?.products || []).find((p) => p.id === id);
    if (!product) return;

    this.state.productSheet.id = id;
    this.state.productSheet.qty = 1;

    const sheet = document.getElementById("sheet-product");
    const body = document.getElementById("product-detail-body");

    let specsHtml = "";
    if (product.specs && typeof product.specs === "object") {
      specsHtml = '<div class="pd-specs">';
      Object.entries(product.specs).forEach(([k, v]) => {
        specsHtml += `<div class="spec-row"><span class="spec-label">${escapeHtml(k)}</span><span>${escapeHtml(String(v))}</span></div>`;
      });
      specsHtml += "</div>";
    }

    const img = product.image_url ? `<img src="${escapeAttr(product.image_url)}" class="pd-img" alt="">` : "";

    body.innerHTML = `
      ${img}
      <div class="pd-title">${escapeHtml(product.name || "")}</div>
      <div>${escapeHtml(product.desc || "")}</div>
      ${specsHtml}
    `;

    document.getElementById("pd-price").textContent = formatMoney(product.price);

    const oldEl = document.getElementById("pd-old-price");
    if (product.old_price) {
      oldEl.textContent = formatMoney(product.old_price);
      oldEl.classList.remove("hidden");
    } else {
      oldEl.classList.add("hidden");
      oldEl.textContent = "";
    }

    document.getElementById("pd-qty-val").textContent = String(this.state.productSheet.qty);

    const btnAdd = document.getElementById("btn-pd-add");
    const btnAddLabel = document.getElementById("lbl-btn-add");

    if (typeof product.stock === "number" && product.stock <= 0) {
      btnAdd.disabled = true;
      btnAddLabel.textContent = "Нет в наличии";
    } else {
      btnAdd.disabled = false;
      btnAddLabel.textContent = this.state.data?.ui?.buttons?.add || "Добавить";
    }

    sheet.classList.add("active");
  },

  closeSheet(name) {
    const sheet = document.getElementById("sheet-" + name);
    if (sheet) sheet.classList.remove("active");
  },

  productQtyChange(delta) {
    const id = this.state.productSheet.id;
    if (!id) return;

    const product = (this.state.data?.products || []).find((p) => p.id === id);
    if (!product) return;

    let next = this.state.productSheet.qty + delta;
    if (next < 1) next = 1;

    if (typeof product.stock === "number" && product.stock > 0) {
      if (next > product.stock) next = product.stock;
    }

    this.state.productSheet.qty = next;
    document.getElementById("pd-qty-val").textContent = String(next);
    this.haptic("selection");
  },

  productAddFromSheet() {
    const id = this.state.productSheet.id;
    if (!id) return;

    const qty = this.state.productSheet.qty || 1;
    this.addToCart(id, qty);
    this.closeSheet("product");
  },

  initCheckout() {
    if (!this.state.cart.length) return;

    const p = this.state.profile;
    const errors = [];

    if (!p.name || p.name.trim().length < 2) errors.push("name");
    if (!p.city || p.city.trim().length < 2) errors.push("city");

    const phone = String(p.phone || "").replace(/\s+/g, "");
    if (!phone || phone.length < 6) errors.push("phone");

    if (errors.length) {
      this.switchTab("profile");
      this.showToast("Заполните профиль для заказа", "error");
      errors.forEach((k) => {
        const el = document.getElementById("inp-" + k);
        if (el) el.style.borderColor = "var(--danger)";
      });
      return;
    }

    this.openConfirmModal();
  },

  openConfirmModal() {
    const modal = document.getElementById("modal-confirm");
    const summary = document.getElementById("confirm-summary");
    const ui = this.state.data?.ui || {};

    document.getElementById("lbl-confirm-title").textContent = ui.buttons?.confirm || "Подтверждение";

    let html = `<strong>${escapeHtml(this.state.profile.name)}</strong> (${escapeHtml(this.state.profile.phone)})<br>${escapeHtml(this.state.profile.city)}`;
    if (this.state.profile.comment) html += `<br>${escapeHtml(this.state.profile.comment)}`;
    html += `<hr style="margin:8px 0;border:0;border-top:1px dashed #ccc">`;

    let total = 0;

    this.state.cart.forEach((item) => {
      const product = (this.state.data?.products || []).find((p) => p.id === item.id);
      if (!product) return;

      const line = (Number(product.price) || 0) * item.qty;
      total += line;

      html += `${escapeHtml(product.name || "")} x${item.qty} - <b>${formatMoney(line)}</b><br>`;
    });

    html += `<hr style="margin:8px 0;border:0;border-top:1px solid #000"><b>Итого: ${formatMoney(total)}</b>`;

    summary.innerHTML = html;
    modal.classList.add("active");
  },

  async confirmOrder() {
    if (this.state.isSubmitting) return;
    this.state.isSubmitting = true;

    const btnOk = document.getElementById("btn-confirm-ok");
    const btnCancel = document.getElementById("btn-confirm-cancel");
    const originalText = btnOk.textContent;

    btnOk.textContent = "Отправка...";
    btnOk.disabled = true;
    btnCancel.disabled = true;

    try {
      let total = 0;

      const items = this.state.cart.map((item) => {
        const product = (this.state.data?.products || []).find((p) => p.id === item.id);
        if (!product) return null;

        const price = Number(product.price) || 0;
        total += price * item.qty;

        return {
          id: item.id,
          sku: product.sku || "",
          name: product.name || "",
          price,
          qty: item.qty
        };
      }).filter(Boolean);

      const tgUser = this.tg.initDataUnsafe?.user || {};

      const payload = {
        source: "miniapp",
        ts: Date.now(),
        tg: {
          id: tgUser.id || null,
          username: tgUser.username || "",
          first_name: tgUser.first_name || "",
          last_name: tgUser.last_name || ""
        },
        profile: { ...this.state.profile },
        items,
        total,
        meta: { app_version: "1.0.0", platform: this.tg.platform || "unknown" }
      };

      const res = await API.createOrder(payload);

      if (res && res.ok) {
        this.handleOrderSuccess(res.order_id || "");
      } else {
        throw new Error(res?.error || "Order failed");
      }
    } catch (e) {
      console.error(e);
      this.showToast("Ошибка заказа. Попробуйте снова.", "error");

      btnOk.textContent = originalText;
      btnOk.disabled = false;
      btnCancel.disabled = false;
      this.state.isSubmitting = false;
      return;
    }

    btnOk.textContent = originalText;
    btnOk.disabled = false;
    btnCancel.disabled = false;
    this.state.isSubmitting = false;
  },

  handleOrderSuccess(orderId) {
    document.getElementById("modal-confirm").classList.remove("active");

    this.state.cart = [];
    this.saveState();
    this.renderCart();

    const ui = this.state.data?.ui || {};
    const title = ui.order_success_title || "Заказ принят";
    const subtitle = ui.order_success_subtitle || "Спасибо! Мы свяжемся с вами для подтверждения.";

    document.getElementById("lbl-success-title").textContent = orderId ? (title + " #" + orderId) : title;
    document.getElementById("lbl-success-subtitle").textContent = subtitle;

    document.getElementById("btn-success-back").textContent = ui.back_to_shop || "Вернуться в магазин";
    document.getElementById("screen-success").classList.remove("hidden");

    this.haptic("success");
  },

  toggleLoader(show) {
    const el = document.getElementById("app-loader");
    if (!el) return;
    if (show) el.classList.remove("hidden");
    else el.classList.add("hidden");
  },

  showToast(msg, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = msg;
    toast.style.background = (type === "error") ? "var(--danger)" : "rgba(0,0,0,0.8)";
    toast.classList.add("active");
    setTimeout(() => toast.classList.remove("active"), 2600);
  },

  haptic(type) {
    const h = this.tg.HapticFeedback;
    if (!h) return;
    try {
      if (type === "selection") h.selectionChanged();
      if (type === "success") h.notificationOccurred("success");
    } catch (e) {}
  },

  updateBadge() {
    const count = this.state.cart.reduce((a, b) => a + (b.qty || 0), 0);
    const badge = document.getElementById("badge-cart");
    if (!badge) return;

    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  },

  updateMainButton() {
    const mb = this.tg.MainButton;
    if (!mb) return;

    if (this.state.activeTab === "cart" && this.state.cart.length > 0 && this.state.data) {
      const total = this.state.cart.reduce((sum, item) => {
        const p = (this.state.data?.products || []).find((x) => x.id === item.id);
        return sum + ((Number(p?.price) || 0) * item.qty);
      }, 0);

      mb.setText("Оформить - " + formatMoney(total));
      mb.show();
      mb.onClick(this.mainButtonHandler);
    } else {
      mb.hide();
      mb.offClick(this.mainButtonHandler);
    }
  },

  mainButtonHandler() {
    App.initCheckout();
  },

  bindEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.tab));
    });

    ["inp-name", "inp-phone", "inp-city", "inp-comment"].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        el.style.borderColor = "transparent";
        const key = id.replace("inp-", "");
        this.state.profile[key] = el.value;
        this.saveState();
      });
    });

    document.getElementById("btn-open-search").addEventListener("click", () => {
      document.getElementById("sheet-search").classList.add("active");
      setTimeout(() => document.getElementById("inp-search").focus(), 80);
    });

    document.getElementById("inp-search").addEventListener("input", (e) => {
      const q = String(e.target.value || "").toLowerCase().trim();
      const resContainer = document.getElementById("search-results");
      resContainer.innerHTML = "";
      if (q.length < 2) return;

      const hits = (this.state.data?.products || []).filter((p) => {
        const name = String(p.name || "").toLowerCase();
        const sku = String(p.sku || "").toLowerCase();
        return name.includes(q) || sku.includes(q);
      }).slice(0, 30);

      hits.forEach((p) => {
        const row = document.createElement("div");
        row.className = "search-result-item";
        row.innerHTML = `<div><b>${escapeHtml(p.name || "")}</b></div><div style="font-size:12px;color:#888">${formatMoney(p.price)}</div>`;
        row.addEventListener("click", () => {
          this.openProduct(p.id);
          this.closeSheet("search");
        });
        resContainer.appendChild(row);
      });
    });

    document.getElementById("btn-checkout").addEventListener("click", () => this.initCheckout());

    document.getElementById("btn-confirm-cancel").addEventListener("click", () => {
      document.getElementById("modal-confirm").classList.remove("active");
    });
    document.getElementById("btn-confirm-ok").addEventListener("click", () => this.confirmOrder());

    document.getElementById("btn-success-back").addEventListener("click", () => {
      document.getElementById("screen-success").classList.add("hidden");
      this.switchTab("shop");
    });
    document.getElementById("btn-success-notif").addEventListener("click", () => {
      window.location.href = "notifications.html";
    });

    document.getElementById("btn-open-notifications").addEventListener("click", () => {
      window.location.href = "notifications.html";
    });

    document.getElementById("btn-go-shop").addEventListener("click", () => this.switchTab("shop"));

    document.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => this.closeSheet(el.dataset.close));
    });

    document.getElementById("retry-init-btn").addEventListener("click", () => {
      document.getElementById("retry-init-btn").classList.add("hidden");
      this.toggleLoader(true);
      this.fetchData();
    });

    document.getElementById("btn-support").addEventListener("click", () => {
      const url = this.state.data?.ui?.support_link;
      if (!url) return;
      if (this.tg.openTelegramLink) this.tg.openTelegramLink(url);
      else window.open(url, "_blank");
    });

    document.getElementById("btn-pd-minus").addEventListener("click", () => this.productQtyChange(-1));
    document.getElementById("btn-pd-plus").addEventListener("click", () => this.productQtyChange(1));
    document.getElementById("btn-pd-add").addEventListener("click", () => {
      if (document.getElementById("btn-pd-add").disabled) return;
      this.productAddFromSheet();
    });
  }
};

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0 ₽";
  return n.toLocaleString("ru-RU") + " ₽";
}

App.init();
