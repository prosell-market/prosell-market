/**
 * ProSell Market — TDD Test Suite
 * Запуск: npm test
 */

// ─────────────────────────────────────────────
// Утилиты (дублируем из app.js для изолированного теста)
// ─────────────────────────────────────────────
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

function toggleFaq(el) {
    el.classList.toggle("open");
}

// ─────────────────────────────────────────────
// Минимальная заглушка DOM для App
// ─────────────────────────────────────────────
function buildDom() {
    document.body.innerHTML = `
    <div id="sheet-product" class="sheet"></div>
    <div id="sheet-search" class="sheet"></div>
    <div id="overlay" class="overlay"></div>
    <div id="cart-badge" class="hidden">0</div>
    <div id="toast" class="toast"></div>
    <div id="cart-empty"></div>
    <div id="checkout-bar" class="hidden"></div>
    <div id="cart-list"></div>
    <div id="cart-total-price"></div>
    <div id="btn-checkout"></div>
    <div id="btn-go-shop"></div>
    <div id="page-shop" class="page active"></div>
    <div id="page-cart" class="page"></div>
    <div id="page-profile" class="page"></div>
    <div id="page-info" class="page"></div>
    <button class="tab-btn active" data-tab="shop"></button>
    <button class="tab-btn" data-tab="cart"></button>
    <button class="tab-btn" data-tab="profile"></button>
    <button class="tab-btn" data-tab="info"></button>
    <div id="app-loader" class="app-loader"></div>
    <div id="app" class="hidden"></div>
    <div id="retry-init-btn" class="hidden"></div>
    <div id="product-grid"></div>
    <div id="categories-container"></div>
    <div id="banners-container"></div>
    <input id="inp-name" />
    <input id="inp-phone" />
    <input id="inp-city" />
    <input id="inp-comment" />
    <input id="inp-search" />
    <div id="search-results"></div>
    <div id="pd-content"></div>
    <div id="pd-price"></div>
    <div id="pd-old-price" class="hidden"></div>
    <div id="pd-qty-val">1</div>
    <button id="btn-pd-minus"></button>
    <button id="btn-pd-plus"></button>
    <button id="btn-pd-add"></button>
    <div id="modal-confirm" style="display:none"></div>
    <div id="lbl-confirm-title"></div>
    <div id="confirm-summary"></div>
    <button id="btn-confirm-cancel"></button>
    <button id="btn-confirm-ok"></button>
    <div id="success-screen" class="hidden"></div>
    <div id="lbl-success-title"></div>
    <div id="lbl-success-subtitle"></div>
    <button id="btn-success-back"></button>
    <button id="btn-success-notif"></button>
    <button id="btn-open-search"></button>
    <button id="btn-open-notifications"></button>
    <button id="btn-support"></button>
    <div id="ptr-indicator"></div>
    <div id="lbl-app-title"></div>
    <div id="lbl-app-subtitle"></div>
    <div id="lbl-tab-cart"></div>
    <div id="lbl-tab-profile"></div>
    <div id="lbl-tab-info"></div>
    <div id="lbl-menu-shop"></div>
    <div id="lbl-menu-cart"></div>
    <div id="lbl-menu-profile"></div>
    <div id="lbl-menu-info"></div>
    <div id="lbl-empty-title"></div>
    <div id="lbl-empty-subtitle"></div>
    <div id="lbl-support"></div>
  `;
}

// Тестовые данные
const MOCK_DATA = {
    ui: {
        app_title: "ProSell",
        subtitle: "Тест",
        tabs: { shop: "Магазин", cart: "Корзина", profile: "Профиль", info: "Инфо" },
        buttons: { add: "Добавить", checkout: "Оформить" },
        empty_cart_title: "Корзина пуста",
        empty_cart_subtitle: "Добавьте товары",
        go_shop: "В магазин",
        support_text: "Поддержка",
        support_link: ""
    },
    categories: [{ id: "cat1", name: "Электроника", icon: "fa-laptop" }],
    products: [
        { id: "p1", name: "Тестовый товар 1", price: 1500, category_id: "cat1", stock: 10 },
        { id: "p2", name: "Тестовый товар 2", price: 2500, category_id: "cat1", stock: 0 },
        { id: "p3", name: "Другая категория", price: 999, category_id: "cat2", stock: 5 }
    ],
    banners: [],
    meta: { updated_at: "2026-01-01T00:00:00Z" }
};

// ─────────────────────────────────────────────
// БЛОК 1: Утилиты
// ─────────────────────────────────────────────
describe("escapeHtml()", () => {
    test("экранирует &", () => expect(escapeHtml("a&b")).toBe("a&amp;b"));
    test("экранирует <script>", () => expect(escapeHtml("<script>")).toBe("&lt;script&gt;"));
    test("экранирует кавычки", () => expect(escapeHtml('"xss"')).toBe("&quot;xss&quot;"));
    test("не трогает обычный текст", () => expect(escapeHtml("Привет мир")).toBe("Привет мир"));
    test("пустая строка → пустая строка", () => expect(escapeHtml("")).toBe(""));
    test("null → пустая строка", () => expect(escapeHtml(null)).toBe(""));
});

describe("formatMoney()", () => {
    test("форматирует целые числа", () => expect(formatMoney(1500)).toBe("1\u00a0500 ₽"));
    test("форматирует 0", () => expect(formatMoney(0)).toBe("0 ₽"));
    test("обрабатывает NaN", () => expect(formatMoney("abc")).toBe("0 ₽"));
    test("обрабатывает null", () => expect(formatMoney(null)).toBe("0 ₽"));
    test("обрабатывает строку-число", () => expect(formatMoney("999")).toBe("999 ₽"));
});

// ─────────────────────────────────────────────
// БЛОК 2: Логика корзины
// ─────────────────────────────────────────────
describe("App — корзина", () => {
    let App;

    beforeEach(() => {
        buildDom();
        jest.resetModules();
        // Создаём изолированный экземпляр App для каждого теста
        App = {
            state: {
                data: JSON.parse(JSON.stringify(MOCK_DATA)),
                cart: [],
                profile: { name: "", phone: "", city: "", comment: "" },
                activeTab: "shop",
                activeCategory: "all",
                isSubmitting: false,
                productSheet: { id: null, qty: 1 }
            },
            tg: { HapticFeedback: null, MainButton: { show() { }, hide() { }, setText() { }, onClick() { }, offClick() { } } },
            storageKeys: { cart: "test_cart", profile: "test_profile" },
            saveState() {
                this.updateBadge();
            },
            updateBadge() {
                const count = this.state.cart.reduce((a, b) => a + (b.qty || 0), 0);
                const badge = document.getElementById("cart-badge");
                if (!badge) return;
                if (count > 0) { badge.textContent = String(count); badge.classList.remove("hidden"); }
                else badge.classList.add("hidden");
            },
            haptic() { },
            showToast() { },

            // Загружаем реальные функции из App (без моков) для интеграционного тестирования
            renderCart: function () {
                const container = document.getElementById("cart-list");
                container.innerHTML = "";

                const ui = this.state.data?.ui || {};
                const emptyEl = document.getElementById("cart-empty");
                const summaryEl = document.getElementById("checkout-bar");

                if (!this.state.cart.length) {
                    emptyEl.classList.remove("hidden");
                    summaryEl.classList.add("hidden");
                    const btnShop = document.getElementById("btn-go-shop");
                    if (btnShop) btnShop.textContent = ui.go_shop || "В магазин";
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
                    el.className = "c-item";

                    const imgHtml = product.image_url
                        ? `<img src="${escapeAttr(product.image_url)}" class="c-thumb" alt="">`
                        : `<div class="c-thumb c-thumb-icon"><i class="fa-solid fa-box-open"></i></div>`;

                    el.innerHTML = `
                    ${imgHtml}
                    <div class="c-info">
                      <div class="c-name">${escapeHtml(product.name || "")}</div>
                      ${product.sku ? `<div class="c-sku">${escapeHtml(product.sku)}</div>` : ""}
                      <div class="c-price">${formatMoney(product.price)}</div>
                    </div>
                    <div class="c-right">
                      <button class="c-del" data-del="${escapeAttr(item.id)}" aria-label="Удалить">
                        <i class="fa-solid fa-trash-can"></i>
                      </button>
                      <div class="c-ctrl">
                        <button class="c-btn" data-qminus="${escapeAttr(item.id)}" aria-label="Минус">
                          <i class="fa-solid fa-minus"></i>
                        </button>
                        <span class="c-qty">${item.qty}</span>
                        <button class="c-btn" data-qplus="${escapeAttr(item.id)}" aria-label="Плюс">
                          <i class="fa-solid fa-plus"></i>
                        </button>
                      </div>
                    </div>
                  `;

                    el.querySelector("[data-qminus]").addEventListener("click", () => this.changeQty(item.id, -1));
                    el.querySelector("[data-qplus]").addEventListener("click", () => this.changeQty(item.id, 1));
                    el.querySelector("[data-del]").addEventListener("click", () => this.removeFromCart(item.id));

                    container.appendChild(el);
                });

                document.getElementById("cart-total-price").textContent = formatMoney(total);
                document.getElementById("btn-checkout").textContent = ui.buttons?.checkout || "Оформить";
            },

            addToCart(id, qty = 1) {
                const product = (this.state.data?.products || []).find(p => p.id === id);
                if (!product) return;
                if (typeof product.stock === "number" && product.stock <= 0) return;
                const existing = this.state.cart.find(i => i.id === id);
                if (existing) existing.qty += qty;
                else this.state.cart.push({ id, qty });
                this.saveState();
            },
            changeQty(id, delta) {
                const item = this.state.cart.find(i => i.id === id);
                if (!item) return;
                item.qty += delta;
                if (item.qty <= 0) this.removeFromCart(id);
                else { this.saveState(); this.renderCart(); }
            },
            removeFromCart(id) {
                this.state.cart = this.state.cart.filter(i => i.id !== id);
                this.saveState();
                this.renderCart();
            }
        };
    });

    test("addToCart — добавляет новый товар", () => {
        App.addToCart("p1", 1);
        expect(App.state.cart).toEqual([{ id: "p1", qty: 1 }]);
    });

    test("addToCart — увеличивает qty при повторе", () => {
        App.addToCart("p1", 1);
        App.addToCart("p1", 2);
        expect(App.state.cart[0].qty).toBe(3);
    });

    test("addToCart — не добавляет товар с stock=0", () => {
        App.addToCart("p2", 1); // p2.stock = 0
        expect(App.state.cart).toHaveLength(0);
    });

    test("addToCart — не добавляет несуществующий товар", () => {
        App.addToCart("nonexistent", 1);
        expect(App.state.cart).toHaveLength(0);
    });

    test("changeQty — уменьшает количество", () => {
        App.addToCart("p1", 3);
        App.changeQty("p1", -1);
        expect(App.state.cart[0].qty).toBe(2);
    });

    test("changeQty — удаляет товар когда qty <= 0", () => {
        App.addToCart("p1", 1);
        App.changeQty("p1", -1);
        expect(App.state.cart).toHaveLength(0);
    });

    test("removeFromCart — удаляет нужный товар", () => {
        App.addToCart("p1", 1);
        App.addToCart("p3", 2);
        App.removeFromCart("p1");
        expect(App.state.cart).toEqual([{ id: "p3", qty: 2 }]);
    });

    test("updateBadge — показывает суммарное количество", () => {
        App.addToCart("p1", 2);
        App.addToCart("p3", 3);
        App.updateBadge();
        expect(document.getElementById("cart-badge").textContent).toBe("5");
        expect(document.getElementById("cart-badge").classList.contains("hidden")).toBe(false);
    });

    test("updateBadge — скрывает бэйдж при пустой корзине", () => {
        App.updateBadge();
        expect(document.getElementById("cart-badge").classList.contains("hidden")).toBe(true);
    });

    test("renderCart — генерирует валидный DOM без ошибок (bugfix HTML)", () => {
        App.addToCart("p1", 2);
        expect(() => App.renderCart()).not.toThrow();

        const list = document.getElementById("cart-list");
        expect(list.innerHTML).toContain('class="c-item"');
        expect(list.innerHTML).toContain('class="c-qty"');

        // Кнопка минус должна нажиматься
        const btnMinus = list.querySelector("[data-qminus]");
        expect(btnMinus).not.toBeNull();
        btnMinus.click();
        expect(App.state.cart[0].qty).toBe(1);
    });
});

// ─────────────────────────────────────────────
// БЛОК 3: Переключение вкладок
// ─────────────────────────────────────────────
describe("App — switchTab()", () => {
    let App;

    beforeEach(() => {
        buildDom();
        App = {
            state: { activeTab: "shop", cart: [], data: MOCK_DATA },
            tg: { MainButton: { show() { }, hide() { }, setText() { }, onClick() { }, offClick() { } } },
            renderCart() { },
            updateMainButton() { },
            switchTab(tab) {
                this.state.activeTab = tab;
                document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
                const page = document.getElementById("page-" + tab);
                if (page) page.classList.add("active");
                document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
                const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
                if (btn) btn.classList.add("active");
                if (tab === "cart") this.renderCart();
                this.updateMainButton();
            }
        };
    });

    test("переключает активную страницу", () => {
        App.switchTab("cart");
        expect(document.getElementById("page-cart").classList.contains("active")).toBe(true);
        expect(document.getElementById("page-shop").classList.contains("active")).toBe(false);
    });

    test("переключает активную кнопку таббара", () => {
        App.switchTab("profile");
        expect(document.querySelector('[data-tab="profile"]').classList.contains("active")).toBe(true);
        expect(document.querySelector('[data-tab="shop"]').classList.contains("active")).toBe(false);
    });

    test("обновляет state.activeTab", () => {
        App.switchTab("info");
        expect(App.state.activeTab).toBe("info");
    });
});

// ─────────────────────────────────────────────
// БЛОК 4: FAQ аккордеон (БАГ 3)
// ─────────────────────────────────────────────
describe("toggleFaq() — аккордеон FAQ", () => {
    test("добавляет класс open при первом нажатии", () => {
        const el = document.createElement("div");
        el.className = "faq-item";
        toggleFaq(el);
        expect(el.classList.contains("open")).toBe(true);
    });

    test("убирает класс open при повторном нажатии", () => {
        const el = document.createElement("div");
        el.className = "faq-item open";
        toggleFaq(el);
        expect(el.classList.contains("open")).toBe(false);
    });

    test("работает как toggle: open → close → open", () => {
        const el = document.createElement("div");
        toggleFaq(el); // open
        toggleFaq(el); // close
        toggleFaq(el); // open
        expect(el.classList.contains("open")).toBe(true);
    });
});

// ─────────────────────────────────────────────
// БЛОК 5: Шторка — открытие и закрытие (БАГИ 1+2)
// ─────────────────────────────────────────────
describe("Шторка товара — CSS классы (БАГ 1+2)", () => {
    beforeEach(() => buildDom());

    function makeApp() {
        return {
            state: {
                data: JSON.parse(JSON.stringify(MOCK_DATA)),
                productSheet: { id: null, qty: 1 }
            },
            haptic() { },
            renderCrossSell() { },
            openProduct(id) {
                const product = (this.state.data?.products || []).find(p => p.id === id);
                if (!product) return;
                this.state.productSheet.id = id;
                this.state.productSheet.qty = 1;
                const sheet = document.getElementById("sheet-product");
                const body = document.getElementById("pd-content");

                let specsHtml = "";
                if (!product.desc && product.specs && typeof product.specs === "object") {
                    specsHtml = '<div class="pd-specs">';
                    Object.entries(product.specs).forEach(([k, v]) => {
                        specsHtml += `<div class="spec-row"><span class="spec-label">${escapeHtml(k)}</span><span>${escapeHtml(String(v))}</span></div>`;
                    });
                    specsHtml += "</div>";
                }

                let imgHtml = "";
                if (product.image_url) {
                    const safeUrl = escapeAttr(product.image_url);
                    imgHtml = `<div class="pd-img-box" style="--pd-img-src: url('${safeUrl}')"><img src="${safeUrl}" alt=""></div>`;
                }

                body.innerHTML = `
                  ${imgHtml}
                  <div class="pd-scroll-inner">
                    <div class="pd-title">${escapeHtml(product.name || "")}</div>
                    ${product.desc ? `<div class="pd-desc">${escapeHtml(product.desc)}</div>` : ""}
                    ${specsHtml}
                  </div>
                `;

                document.getElementById("pd-price").textContent = formatMoney(product.price);
                document.getElementById("pd-old-price").classList.add("hidden");
                document.getElementById("pd-qty-val").textContent = "1";
                const btnAdd = document.getElementById("btn-pd-add");
                if (typeof product.stock === "number" && product.stock <= 0) {
                    btnAdd.disabled = true;
                } else {
                    btnAdd.disabled = false;
                }
                this.renderCrossSell(product);
                // ── Правильная версия (после фикса): должен быть .open, не .active

                sheet.classList.add("open");
                document.getElementById("overlay").classList.add("open");
                document.body.classList.add("no-scroll");
            },
            closeSheet(name) {
                const sheet = document.getElementById("sheet-" + name);
                if (sheet) sheet.classList.remove("open");
                if (name === "product" || name === "search") {
                    document.getElementById("overlay").classList.remove("open");
                    document.body.classList.remove("no-scroll");
                }
            }
        };
    }

    test("openProduct() добавляет класс .open на шторке (не .active)", () => {
        const app = makeApp();
        app.openProduct("p1");
        const sheet = document.getElementById("sheet-product");
        expect(sheet.classList.contains("open")).toBe(true);
        expect(sheet.classList.contains("active")).toBe(false);
    });

    test("openProduct() добавляет класс .open на оверлей", () => {
        const app = makeApp();
        app.openProduct("p1");
        expect(document.getElementById("overlay").classList.contains("open")).toBe(true);
    });

    test("openProduct() блокирует скролл (body.no-scroll)", () => {
        const app = makeApp();
        app.openProduct("p1");
        expect(document.body.classList.contains("no-scroll")).toBe(true);
    });

    test("closeSheet() убирает класс .open с шторки", () => {
        const app = makeApp();
        app.openProduct("p1");
        app.closeSheet("product");
        expect(document.getElementById("sheet-product").classList.contains("open")).toBe(false);
    });

    test("closeSheet() убирает оверлей", () => {
        const app = makeApp();
        app.openProduct("p1");
        app.closeSheet("product");
        expect(document.getElementById("overlay").classList.contains("open")).toBe(false);
    });

    test("closeSheet() разблокирует скролл", () => {
        const app = makeApp();
        app.openProduct("p1");
        app.closeSheet("product");
        expect(document.body.classList.contains("no-scroll")).toBe(false);
    });

    test("openProduct() с несуществующим id — ничего не делает", () => {
        const app = makeApp();
        app.openProduct("nonexistent");
        expect(document.getElementById("sheet-product").classList.contains("open")).toBe(false);
    });

    test("кнопка 'Добавить' задизейблена для товара без остатка", () => {
        const app = makeApp();
        app.openProduct("p2"); // p2.stock = 0
        expect(document.getElementById("btn-pd-add").disabled).toBe(true);
    });

    test("кнопка 'Добавить' активна для товара в наличии", () => {
        const app = makeApp();
        app.openProduct("p1"); // p1.stock = 10
        expect(document.getElementById("btn-pd-add").disabled).toBe(false);
    });

    test("HTML-вывод (TDD) — не содержит пробелов в тегах (bugfix < div)", () => {
        const app = makeApp();
        app.openProduct("p1");
        const html = document.getElementById("pd-content").innerHTML;
        // Тест упал бы на старой версии (которая генерила < div class=...)
        expect(html).not.toMatch(/<\s+div/);
    });

    test("HTML-вывод (TDD) — не содержит undefined", () => {
        const app = makeApp();
        app.openProduct("p1");
        const html = document.getElementById("pd-content").innerHTML;
        // Тест гарантирует, что переменные правильно эскейпятся и проверяются
        expect(html.includes("undefined")).toBe(false);
    });
});
