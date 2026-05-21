/* Productos page — catálogo público (solo lectura).
   La administración se hace desde admin.html — el cliente nunca ve botones de edición. */
(function () {
  const STORAGE_KEY = "zarah_products_v1";
  const PER_PAGE = 12;

  let state = {
    products: [],
    filter: "all",
    sort: "default",
    page: 1
  };

  // ---------- migración: cat (string) → cats (array) + remap antiguo ----------
  const CAT_MIGRATE = {
    globos: "detalles",
    numbers: "detalles",
    arcos: "equipos",
    helio: "equipos"
  };
  function migrateProducts(list) {
    let changed = false;
    list.forEach(p => {
      // cat string → cats array
      if (!Array.isArray(p.cats)) {
        const single = p.cat || "detalles";
        p.cats = [single];
        delete p.cat;
        changed = true;
      }
      // remap viejos
      p.cats = p.cats.map(c => CAT_MIGRATE[c] || c);
      // dedupe
      p.cats = [...new Set(p.cats)];
    });
    return changed;
  }

  function loadProducts() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved) && saved.length) {
        if (migrateProducts(saved)) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        return saved;
      }
    } catch (e) {}
    const init = JSON.parse(JSON.stringify(window.INITIAL_PRODUCTS));
    migrateProducts(init);
    return init;
  }

  // ---------- helpers ----------
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function priceText(p) {
    const cur = `S/ ${Number(p.price).toFixed(2)}`;
    if (p.oldPrice && p.oldPrice > p.price) {
      return `<s>S/ ${Number(p.oldPrice).toFixed(2)}</s>${cur}`;
    }
    return cur;
  }
  function saveAmount(p) {
    if (p.oldPrice && p.oldPrice > p.price) return `AHORRA S/ ${(p.oldPrice - p.price).toFixed(2)}`;
    return "";
  }
  function toast(msg, kind) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.className = "toast", 2200);
  }

  // ---------- render ----------
  function getFiltered() {
    let list = state.products.slice();
    if (state.filter !== "all") {
      list = list.filter(p => Array.isArray(p.cats) && p.cats.includes(state.filter));
    }
    if (state.sort === "price-asc")  list.sort((a,b) => a.price - b.price);
    if (state.sort === "price-desc") list.sort((a,b) => b.price - a.price);
    if (state.sort === "name")       list.sort((a,b) => a.name.localeCompare(b.name));
    return list;
  }

  function render() {
    const grid = document.getElementById("catalog");
    const list = getFiltered();
    const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PER_PAGE;
    const visible = list.slice(start, start + PER_PAGE);

    grid.innerHTML = "";

    visible.forEach(p => {
      const card = document.createElement("article");
      card.className = "p-card";
      card.dataset.id = p.id;
      card.innerHTML = `
        ${p.badge ? `<span class="p-badge">${escapeHTML(p.badge)}</span>` : ""}
        <div class="p-img">
          ${p.img
            ? `<img src="${escapeHTML(p.img)}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'Imagen no disponible'}))">`
            : `<div class="ph">Sin imagen</div>`}
          <button class="p-fav" aria-label="Favorito">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <div class="p-quick">
            Ver opciones
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
          </div>
        </div>
        <div class="p-body">
          <div class="p-name">${escapeHTML(p.name)}</div>
          <div class="p-price-row">${priceText(p)}</div>
          ${saveAmount(p) ? `<div class="p-save">${saveAmount(p)}</div>` : ""}
        </div>
      `;
      grid.appendChild(card);
    });

    renderPagination(totalPages);
    document.getElementById("resultCount").textContent =
      `${list.length} ${list.length === 1 ? "producto" : "productos"}`;
  }

  function renderPagination(total) {
    const pag = document.getElementById("pagination");
    pag.innerHTML = "";
    const mk = (label, page, opts = {}) => {
      const b = document.createElement("button");
      b.innerHTML = label;
      if (opts.arrow) b.className = "arrow";
      if (opts.active) b.className = "active";
      if (opts.disabled) b.disabled = true;
      b.onclick = () => { state.page = page; render(); window.scrollTo({top: 0, behavior:"smooth"}); };
      return b;
    };
    pag.appendChild(mk(
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg>`,
      Math.max(1, state.page - 1),
      { arrow: true, disabled: state.page === 1 }
    ));
    for (let i = 1; i <= total; i++) {
      pag.appendChild(mk(String(i), i, { active: i === state.page }));
    }
    pag.appendChild(mk(
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>`,
      Math.min(total, state.page + 1),
      { arrow: true, disabled: state.page === total }
    ));
  }

  // ---------- chips ----------
  function renderChips() {
    const wrap = document.getElementById("chips");
    wrap.innerHTML = "";
    window.CATEGORIES.forEach(c => {
      const b = document.createElement("button");
      b.className = "chip" + (state.filter === c.id ? " active" : "");
      b.textContent = c.label;
      b.onclick = () => { state.filter = c.id; state.page = 1; renderChips(); render(); };
      wrap.appendChild(b);
    });
  }

  // ---------- product modal ----------
  const MAX_NAME_CHARS = 25;
  const MAX_DEDI_WORDS = 100;

  function countWords(s) {
    return (s.trim().match(/\S+/g) || []).length;
  }

  function updateModalValidation() {
    const nameField = document.getElementById("pm-name-field");
    const nameInput = document.getElementById("pm-custom-name");
    const nameCounter = document.getElementById("pm-name-counter");
    const dediInput = document.getElementById("pm-dedi");
    const dediCounter = document.getElementById("pm-dedi-counter");
    const btnAdd = document.getElementById("pm-add");
    const btnReserve = document.getElementById("pm-reserve");

    let valid = true;
    let warnings = [];

    // Nombre personalizado (solo si el campo está visible)
    if (nameField.style.display !== "none") {
      const v = nameInput.value;
      const over = v.length > MAX_NAME_CHARS;
      nameCounter.textContent = `${v.length} / ${MAX_NAME_CHARS}`;
      nameCounter.classList.toggle("over", over);
      nameInput.classList.toggle("invalid", over);
      if (over) { valid = false; warnings.push(`El nombre tiene ${v.length - MAX_NAME_CHARS} caracteres de más.`); }
    }

    // Dedicatoria
    const dv = dediInput.value;
    const dw = countWords(dv);
    const dover = dw > MAX_DEDI_WORDS;
    dediCounter.textContent = `${dw} / ${MAX_DEDI_WORDS} palabras`;
    dediCounter.classList.toggle("over", dover);
    dediInput.classList.toggle("invalid", dover);
    if (dover) { valid = false; warnings.push(`La dedicatoria tiene ${dw - MAX_DEDI_WORDS} palabras de más.`); }

    btnAdd.disabled = !valid;
    btnReserve.classList.toggle("disabled", !valid);
    if (!valid) btnReserve.setAttribute("aria-disabled", "true");
    else btnReserve.removeAttribute("aria-disabled");

    const warnEl = document.getElementById("pm-warning");
    if (!valid) {
      warnEl.textContent = "⚠ " + warnings.join(" ");
      warnEl.classList.add("show");
    } else {
      warnEl.classList.remove("show");
    }
    return valid;
  }

  function getModalExtras() {
    const nameField = document.getElementById("pm-name-field");
    const customName = (nameField.style.display !== "none")
      ? document.getElementById("pm-custom-name").value.trim()
      : "";
    const dedi = document.getElementById("pm-dedi").value.trim();
    return { customName, dedi };
  }

  function buildWhatsappMsg(p, extras) {
    let msg = `Hola Zarah's, quisiera reservar el producto "${p.name}" (S/ ${Number(p.price).toFixed(2)}).`;
    if (extras.customName) msg += `\n\nNombre para personalizar: ${extras.customName}`;
    if (extras.dedi) msg += `\n\nDedicatoria de la tarjeta:\n"${extras.dedi}"`;
    msg += "\n\n¿Está disponible?";
    return msg;
  }

  function openProductModal(p) {
    const m = document.getElementById("productModal");
    if (!m) return;
    document.getElementById("pm-img").style.backgroundImage = p.img ? `url("${p.img}")` : "";
    document.getElementById("pm-name").textContent = p.name;
    document.getElementById("pm-cats").innerHTML = (p.cats || [])
      .map(id => (window.CATEGORIES.find(c => c.id === id) || {}).label)
      .filter(Boolean)
      .map(l => `<span class="pm-cat-chip">${escapeHTML(l)}</span>`)
      .join("");
    document.getElementById("pm-price").innerHTML = priceText(p);
    const saveEl = document.getElementById("pm-save");
    const sa = saveAmount(p);
    saveEl.style.display = sa ? "" : "none";
    saveEl.textContent = sa;
    document.getElementById("pm-badge").style.display = p.badge ? "" : "none";
    document.getElementById("pm-badge").textContent = p.badge || "";

    // Reset campos
    document.getElementById("pm-custom-name").value = "";
    document.getElementById("pm-dedi").value = "";

    // Mostrar campo de nombre solo si la categoría "Globo Personalizado" está
    const hasGlobo = Array.isArray(p.cats) && p.cats.includes("globo-pers");
    document.getElementById("pm-name-field").style.display = hasGlobo ? "" : "none";

    // Setup live validation
    document.getElementById("pm-custom-name").oninput = updateModalValidation;
    document.getElementById("pm-dedi").oninput = updateModalValidation;
    updateModalValidation();

    // Wire reserve link (se construye en runtime al hacer click)
    const reserveBtn = document.getElementById("pm-reserve");
    reserveBtn.onclick = (e) => {
      if (!updateModalValidation()) {
        e.preventDefault();
        toast("Revisa los campos: hay límites excedidos");
        return;
      }
      const extras = getModalExtras();
      const msg = encodeURIComponent(buildWhatsappMsg(p, extras));
      reserveBtn.href = `https://wa.me/51954304366?text=${msg}`;
      // continuar con la navegación normal
    };

    // Wire add-to-cart
    document.getElementById("pm-add").onclick = () => {
      if (!updateModalValidation()) {
        toast("Revisa los campos: hay límites excedidos");
        return;
      }
      const extras = getModalExtras();
      addToCart(p, extras);
      closeProductModal();
      toast(`"${p.name}" añadido al carrito`, "success");
    };

    m.classList.add("open");
  }
  function closeProductModal() {
    const m = document.getElementById("productModal");
    if (m) m.classList.remove("open");
  }

  // ---------- cart ----------
  const CART_KEY = "zarah_cart_v1";
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function setCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartBadge(); }
  function addToCart(p, extras) {
    const c = getCart();
    const item = { id: p.id, name: p.name, price: p.price, img: p.img, qty: 1 };
    if (extras && extras.customName) item.customName = extras.customName;
    if (extras && extras.dedi) item.dedi = extras.dedi;
    // Si hay personalización, lo añadimos como item nuevo (no merge)
    if ((extras && (extras.customName || extras.dedi))) {
      c.push(item);
    } else {
      const existing = c.find(x => x.id === p.id && !x.customName && !x.dedi);
      if (existing) existing.qty = (existing.qty || 1) + 1;
      else c.push(item);
    }
    setCart(c);
  }
  function updateCartBadge() {
    const c = getCart();
    const total = c.reduce((s, x) => s + (x.qty || 1), 0);
    let badge = document.querySelector(".nav-icon .badge");
    const cartBtn = document.querySelector('[aria-label="Carrito"]');
    if (!cartBtn) return;
    if (total > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge";
        cartBtn.appendChild(badge);
      }
      badge.textContent = total;
    } else if (badge) {
      badge.remove();
    }
  }

  // ---------- public actions ----------
  function handleCardClick(e) {
    const card = e.target.closest(".p-card");
    if (!card) return;
    const id = card.dataset.id;
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    if (e.target.closest(".p-fav")) {
      e.stopPropagation();
      e.target.closest(".p-fav").classList.toggle("on");
      return;
    }
    // Cualquier otro click en la card abre el modal con las dos opciones
    openProductModal(p);
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    state.products = loadProducts();
    renderChips();
    render();
    updateCartBadge();

    document.getElementById("sortSelect").addEventListener("change", (e) => {
      state.sort = e.target.value; render();
    });
    document.getElementById("catalog").addEventListener("click", handleCardClick);

    // Product modal close
    const pm = document.getElementById("productModal");
    if (pm) {
      pm.addEventListener("click", (e) => {
        if (e.target === pm || e.target.closest("[data-close]")) closeProductModal();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeProductModal();
    });

    // Re-render si otro tab (admin) cambia productos
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        state.products = loadProducts();
        render();
      }
      if (e.key === CART_KEY) updateCartBadge();
    });
  });
})();
