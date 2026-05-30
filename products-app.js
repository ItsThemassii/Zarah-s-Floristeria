/* Productos page — catálogo público (solo lectura).
   La administración se hace desde admin.html — el cliente nunca ve botones de edición. */
import { supabase } from "./supabase-config.js";
import { cargarConfig, aplicarConfigDom, CONFIG_DEFAULTS } from "./config-publico.js";

(function () {
  const STORAGE_KEY = "zarah_products_v1";
  const PER_PAGE = 12;

  // Configuración de la tienda (WhatsApp, etc.) leída desde Supabase en el init.
  // Empieza con los defaults para que los enlaces funcionen aunque, por alguna
  // razón, se intente usar antes de que termine la carga.
  let configTienda = { ...CONFIG_DEFAULTS };
  const waNumero = () => configTienda.whatsapp || CONFIG_DEFAULTS.whatsapp;

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

  // ---------- normalización Supabase → formato interno ----------
  // La tabla `productos` usa nombres de columna distintos a los que espera el
  // resto del código. Esta función traduce una fila de Supabase al objeto que
  // ya consumen render(), el modal, la búsqueda, etc. Así nada más cambia.
  function normalizarProducto(row) {
    return {
      // dataset.id siempre es string; convertimos para que las búsquedas
      // `x.id === id` sigan funcionando.
      id: String(row.id),
      name: row.nombre,
      price: Number(row.precio),
      oldPrice: (row.precio_anterior != null) ? Number(row.precio_anterior) : undefined,
      // no hay columna de texto "badge": la derivamos del flag en_oferta.
      badge: row.en_oferta ? "Oferta" : "",
      img: row.imagen_url || "",
      cats: Array.isArray(row.categorias) ? row.categorias : [],
      features: Array.isArray(row.caracteristicas) ? row.caracteristicas : []
    };
  }

  // Antes leía localStorage / window.INITIAL_PRODUCTS. Ahora trae el catálogo
  // desde Supabase. Devuelve el mismo formato de array que antes.
  async function loadProducts() {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("id", { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizarProducto);
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

  // ---------- estados de carga del catálogo ----------
  // 6 skeleton cards con pulse mientras Supabase responde.
  function showCatalogLoading() {
    const grid = document.getElementById("catalog");
    if (!grid) return;
    grid.classList.remove("catalog-enter");
    let html = "";
    for (let i = 0; i < 6; i++) {
      html += `
        <div class="skel-card" aria-hidden="true">
          <div class="skel-img"></div>
          <div class="skel-body">
            <div class="skel-line name"></div>
            <div class="skel-line price"></div>
          </div>
        </div>`;
    }
    grid.innerHTML = html;
  }

  // Mensaje amigable + botón Reintentar (vuelve a lanzar la carga).
  function showCatalogError() {
    const grid = document.getElementById("catalog");
    if (grid) {
      grid.classList.remove("catalog-enter");
      grid.innerHTML = `
        <div class="catalog-error">
          <div class="ce-emoji">🌸</div>
          <div class="ce-title">No pudimos cargar el catálogo</div>
          <p class="ce-text">Puede ser un problema momentáneo de conexión. Intenta de nuevo; si el problema persiste, escríbenos por WhatsApp y armamos tu pedido contigo.</p>
          <button class="catalog-retry" id="catalogRetry" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            Reintentar
          </button>
        </div>`;
      const btn = document.getElementById("catalogRetry");
      if (btn) btn.addEventListener("click", cargarCatalogo);
    }
    const rc = document.getElementById("resultCount");
    if (rc) rc.textContent = "— productos";
  }

  // Pinta las cards aplicando el fade-in suave solo esta vez (carga inicial /
  // reintento). Se quita la clase para que filtros, orden y paginación no
  // re-animen en cada render.
  function renderConFade() {
    const grid = document.getElementById("catalog");
    if (grid) grid.classList.add("catalog-enter");
    render();
    if (grid) setTimeout(() => grid.classList.remove("catalog-enter"), 1000);
  }

  // Flujo completo de carga del catálogo: skeleton → query → render / error.
  async function cargarCatalogo() {
    showCatalogLoading();
    try {
      state.products = await loadProducts();
      renderConFade();
      updateCartBadge();
      updateFavBadge();
    } catch (e) {
      console.error("Error cargando productos desde Supabase:", e);
      showCatalogError();
    }
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
    applyFavStates();
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
  const MAX_DEDI_CHARS = 150;

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
    const dc = dv.length;
    const dover = dc > MAX_DEDI_CHARS;
    dediCounter.textContent = `${dc} / ${MAX_DEDI_CHARS}`;
    dediCounter.classList.toggle("over", dover);
    dediInput.classList.toggle("invalid", dover);
    if (dover) { valid = false; warnings.push(`La dedicatoria tiene ${dc - MAX_DEDI_CHARS} caracteres de más.`); }

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
    let msg = `¡Hola Zarah's! 🌸\n\nQuisiera reservar el siguiente producto:\n\n`;
    msg += `*${p.name}*\n`;
    msg += `   • Precio: S/ ${Number(p.price).toFixed(2)}\n`;
    if (extras.customName) msg += `   • Personalizar con: "${extras.customName}"\n`;
    if (extras.dedi) msg += `   • Dedicatoria: "${extras.dedi}"\n`;
    msg += `\n¿Tienen disponibilidad? Quedo atenta(o) para coordinar la entrega y el pago. ¡Gracias! 💕`;
    return msg;
  }

  // ---------- registro automático de pedidos en Supabase ----------
  // Junta las dedicatorias no vacías de una lista de items en un solo texto.
  function dedicatoriaDe(items) {
    const ds = (items || []).map(i => i.dedi).filter(Boolean);
    return ds.length ? ds.join(" · ") : null;
  }

  // Guarda el pedido en la tabla `ventas` ANTES de abrir WhatsApp.
  // Es un "extra": se dispara sin await (fire-and-forget) para no bloquear la
  // navegación a WhatsApp. Si falla (red, permisos, etc.), solo se loguea: el
  // flujo principal del cliente nunca se interrumpe.
  function guardarVenta(venta) {
    supabase.from("ventas").insert({
      cliente_nombre: null,
      cliente_whatsapp: null,
      productos: venta.productos,
      total: venta.total,
      estado: "pendiente",
      dedicatoria: venta.dedicatoria || null,
      notas: null
    }).then(({ error }) => {
      if (error) console.log("No se pudo registrar el pedido en ventas:", error);
    }).catch(e => {
      console.log("No se pudo registrar el pedido en ventas:", e);
    });
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

    // Características (lista con "-" en mayúsculas)
    const featsEl = document.getElementById("pm-features");
    const featsWrap = document.getElementById("pm-features-wrap");
    const feats = Array.isArray(p.features) ? p.features.filter(f => f && f.trim()) : [];
    featsEl.innerHTML = feats.map(f => `<li>${escapeHTML(f.toUpperCase())}</li>`).join("");
    if (featsWrap) featsWrap.style.display = feats.length ? "" : "none";

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
      reserveBtn.href = `https://wa.me/${waNumero()}?text=${msg}`;

      // Registrar el pedido en `ventas` (1 producto) antes de abrir WhatsApp.
      // Fire-and-forget: no bloquea la navegación del enlace.
      const item = { id: p.id, name: p.name, price: p.price, img: p.img, qty: 1 };
      if (extras.customName) item.customName = extras.customName;
      if (extras.dedi) item.dedi = extras.dedi;
      guardarVenta({
        productos: [item],
        total: Number(p.price),
        dedicatoria: extras.dedi || null
      });
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

    // Hover-zoom on the image
    const imgEl = document.getElementById("pm-img");
    if (imgEl && p.img) {
      imgEl.onmousemove = (e) => {
        const r = imgEl.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        const lx = e.clientX - r.left;
        const ly = e.clientY - r.top;
        imgEl.style.setProperty("--zx", x + "%");
        imgEl.style.setProperty("--zy", y + "%");
        imgEl.style.setProperty("--lx", lx + "px");
        imgEl.style.setProperty("--ly", ly + "px");
        imgEl.classList.add("zoom");
      };
      imgEl.onmouseleave = () => imgEl.classList.remove("zoom");
    } else if (imgEl) {
      imgEl.onmousemove = null;
      imgEl.onmouseleave = null;
      imgEl.classList.remove("zoom");
    }
  }
  function closeProductModal() {
    const m = document.getElementById("productModal");
    if (m) m.classList.remove("open");
  }

  // ---------- favorites ----------
  const FAV_KEY = "zarah_favorites_v1";
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function setFavs(arr) { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); updateFavBadge(); }
  function toggleFav(id) {
    const favs = getFavs();
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1);
    else favs.push(id);
    setFavs(favs);
    // refresh card visual
    document.querySelectorAll(`.p-card[data-id="${id}"] .p-fav`).forEach(b => {
      b.classList.toggle("on", favs.includes(id));
    });
    return favs.includes(id);
  }
  function updateFavBadge() {
    // Only count favorites that still match an existing product
    const validIds = new Set(state.products.map(p => p.id));
    const favs = getFavs().filter(id => validIds.has(id));
    // Clean up stale IDs in localStorage if any were removed
    if (favs.length !== getFavs().length) {
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    }
    const total = favs.length;
    const btn = document.getElementById("btnFavs");
    if (!btn) return;
    let badge = btn.querySelector(".badge");
    if (total > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge";
        btn.appendChild(badge);
      }
      badge.textContent = total;
    } else if (badge) badge.remove();
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
    const validIds = new Set(state.products.map(p => p.id));
    const cleaned = getCart().filter(x => validIds.has(x.id));
    if (cleaned.length !== getCart().length) {
      localStorage.setItem(CART_KEY, JSON.stringify(cleaned));
    }
    const total = cleaned.reduce((s, x) => s + (x.qty || 1), 0);
    const btn = document.getElementById("btnCart");
    if (!btn) return;
    let badge = btn.querySelector(".badge");
    if (total > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge";
        btn.appendChild(badge);
      }
      badge.textContent = total;
    } else if (badge) badge.remove();
  }

  // ---------- side panel ----------
  function openSidePanel(kind) {
    const panel = document.getElementById("sidePanel");
    const overlay = document.getElementById("sideOverlay");
    const title = document.getElementById("spTitle");
    const body = document.getElementById("spBody");
    const foot = document.getElementById("spFoot");
    panel.dataset.kind = kind;
    if (kind === "favs") {
      title.innerHTML = `Tus <em>favoritos</em>`;
      foot.classList.remove("show");
      renderFavs(body);
    } else {
      title.innerHTML = `Tu <em>carrito</em>`;
      renderCart(body, foot);
    }
    panel.classList.add("open");
    overlay.classList.add("open");
  }
  function closeSidePanel() {
    document.getElementById("sidePanel").classList.remove("open");
    document.getElementById("sideOverlay").classList.remove("open");
  }

  function renderFavs(body) {
    const favs = getFavs();
    const items = favs
      .map(id => state.products.find(p => p.id === id))
      .filter(Boolean);
    if (!items.length) {
      body.innerHTML = `
        <div class="sp-empty">
          <div class="ic">♡</div>
          <div class="t">Sin favoritos aún</div>
          <div class="d">Toca el corazón en cualquier producto para guardarlo aquí.</div>
        </div>`;
      return;
    }
    body.innerHTML = "";
    items.forEach(p => {
      const el = document.createElement("div");
      el.className = "sp-item";
      el.dataset.id = p.id;
      el.innerHTML = `
        <div class="si-img" data-action="open" style="background-image:url('${escapeHTML(p.img || "")}')"></div>
        <div class="si-meta">
          <div class="si-name">${escapeHTML(p.name)}</div>
          <div class="si-price">S/ ${Number(p.price).toFixed(2)}</div>
          <button class="sp-favbtn" data-action="addcart">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-1.5 9h-13z"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
            Añadir al carrito
          </button>
        </div>
        <div class="si-actions">
          <button class="sp-remove" data-action="rmfav">Quitar</button>
        </div>
      `;
      body.appendChild(el);
    });
  }

  function renderCart(body, foot) {
    const cart = getCart();
    if (!cart.length) {
      body.innerHTML = `
        <div class="sp-empty">
          <div class="ic">🛒</div>
          <div class="t">Carrito vacío</div>
          <div class="d">Añade tus arreglos favoritos y procede a reservarlos por WhatsApp.</div>
        </div>`;
      foot.classList.remove("show");
      return;
    }
    body.innerHTML = "";
    cart.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "sp-item";
      el.dataset.idx = idx;
      const extra = [item.customName && `Para: ${item.customName}`, item.dedi && `"${item.dedi}"`]
        .filter(Boolean).join(" · ");
      el.innerHTML = `
        <div class="si-img" data-action="open" data-id="${item.id}" style="background-image:url('${escapeHTML(item.img || "")}')"></div>
        <div class="si-meta">
          <div class="si-name">${escapeHTML(item.name)}</div>
          <div class="si-price">S/ ${Number(item.price).toFixed(2)}</div>
          ${extra ? `<div class="si-extra">${escapeHTML(extra)}</div>` : ""}
        </div>
        <div class="si-actions">
          <div class="sp-qty">
            <button data-action="dec">−</button>
            <span class="n">${item.qty || 1}</span>
            <button data-action="inc">+</button>
          </div>
          <button class="sp-remove" data-action="rmcart">Quitar</button>
        </div>
      `;
      body.appendChild(el);
    });

    const total = cart.reduce((s, x) => s + Number(x.price) * (x.qty || 1), 0);
    foot.innerHTML = `
      <div class="sp-total">
        <div class="lbl">Total</div>
        <div class="val">S/ ${total.toFixed(2)}</div>
      </div>
      <a class="sp-checkout" id="spCheckout" target="_blank" rel="noopener">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg>
        Reservar por WhatsApp
      </a>
    `;
    foot.classList.add("show");

    // Build WhatsApp link
    let msg = "¡Hola Zarah's! 🌸\n\nQuisiera reservar los siguientes productos:\n\n";
    cart.forEach((it, i) => {
      const lineTotal = (Number(it.price) * (it.qty || 1)).toFixed(2);
      msg += `${i + 1}. *${it.name}*\n`;
      msg += `   • Cantidad: ${it.qty || 1}\n`;
      msg += `   • Precio unitario: S/ ${Number(it.price).toFixed(2)}\n`;
      msg += `   • Subtotal: S/ ${lineTotal}\n`;
      if (it.customName) msg += `   • Personalizar con: "${it.customName}"\n`;
      if (it.dedi) msg += `   • Dedicatoria: "${it.dedi}"\n`;
      msg += "\n";
    });
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `*TOTAL: S/ ${total.toFixed(2)}*\n\n`;
    msg += `¿Tienen disponibilidad? Quedo atenta(o) para coordinar la entrega y el pago. ¡Gracias! 💕`;
    const checkout = document.getElementById("spCheckout");
    checkout.href = `https://wa.me/${waNumero()}?text=${encodeURIComponent(msg)}`;

    // Registrar el pedido en `ventas` (carrito completo) antes de abrir WhatsApp.
    // Fire-and-forget: el enlace abre WhatsApp igual, falle o no la inserción.
    checkout.onclick = () => {
      guardarVenta({
        productos: cart,
        total: total,
        dedicatoria: dedicatoriaDe(cart)
      });
    };
  }

  function handleSidePanelClick(e) {
    const panel = document.getElementById("sidePanel");
    const kind = panel.dataset.kind;
    const item = e.target.closest(".sp-item");
    if (!item) return;
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (kind === "favs") {
      const id = item.dataset.id;
      const p = state.products.find(x => x.id === id);
      if (action === "open") {
        closeSidePanel();
        if (p) openProductModal(p);
      } else if (action === "addcart") {
        if (p) { addToCart(p); toast(`"${p.name}" añadido al carrito`, "success"); }
      } else if (action === "rmfav") {
        toggleFav(id);
        renderFavs(document.getElementById("spBody"));
      }
    } else {
      const idx = parseInt(item.dataset.idx, 10);
      const cart = getCart();
      if (action === "open") {
        const id = e.target.closest("[data-id]")?.dataset.id;
        const p = state.products.find(x => x.id === id);
        if (p) { closeSidePanel(); openProductModal(p); }
      } else if (action === "inc") {
        cart[idx].qty = (cart[idx].qty || 1) + 1;
        setCart(cart);
        renderCart(document.getElementById("spBody"), document.getElementById("spFoot"));
      } else if (action === "dec") {
        cart[idx].qty = Math.max(1, (cart[idx].qty || 1) - 1);
        setCart(cart);
        renderCart(document.getElementById("spBody"), document.getElementById("spFoot"));
      } else if (action === "rmcart") {
        cart.splice(idx, 1);
        setCart(cart);
        renderCart(document.getElementById("spBody"), document.getElementById("spFoot"));
      }
    }
  }

  // ---------- search ----------
  function openSearch() {
    const overlay = document.getElementById("searchOverlay");
    overlay.classList.add("open");
    setTimeout(() => document.getElementById("searchInput").focus(), 200);
  }
  function closeSearch() {
    document.getElementById("searchOverlay").classList.remove("open");
    document.getElementById("searchInput").value = "";
    document.getElementById("searchResults").classList.remove("show");
  }
  function renderSearchResults(q) {
    const res = document.getElementById("searchResults");
    if (!q.trim()) { res.classList.remove("show"); res.innerHTML = ""; return; }
    const ql = q.toLowerCase();
    const matches = state.products.filter(p => {
      if (p.name.toLowerCase().includes(ql)) return true;
      const cats = (p.cats || []).map(id => (window.CATEGORIES.find(c => c.id === id) || {}).label || "").join(" ").toLowerCase();
      return cats.includes(ql);
    }).slice(0, 8);
    res.classList.add("show");
    if (!matches.length) {
      res.innerHTML = `<div class="search-empty">No encontramos resultados para "${escapeHTML(q)}".</div>`;
      return;
    }
    res.innerHTML = matches.map(p => {
      const cats = (p.cats || []).map(id => (window.CATEGORIES.find(c => c.id === id) || {}).label).filter(Boolean).join(" · ");
      return `
        <div class="search-result" data-id="${p.id}">
          <div class="sr-img" style="background-image:url('${escapeHTML(p.img || "")}')"></div>
          <div class="sr-meta">
            <div class="sr-name">${escapeHTML(p.name)}</div>
            <div class="sr-cats">${escapeHTML(cats)}</div>
          </div>
          <div class="sr-price">S/ ${Number(p.price).toFixed(2)}</div>
        </div>
      `;
    }).join("");
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
      const on = toggleFav(id);
      toast(on ? "Añadido a favoritos" : "Quitado de favoritos");
      return;
    }
    // Cualquier otro click en la card abre el modal con las dos opciones
    openProductModal(p);
  }

  // Marca corazones llenos en cards al renderizar
  function applyFavStates() {
    const favs = new Set(getFavs());
    document.querySelectorAll(".p-card").forEach(c => {
      const id = c.dataset.id;
      const btn = c.querySelector(".p-fav");
      if (btn) btn.classList.toggle("on", favs.has(id));
    });
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    // Cargar la configuración de la tienda (WhatsApp, etc.) y aplicarla al DOM
    // ANTES de habilitar cualquier interacción, para que los enlaces de WhatsApp
    // (flotante y los que se arman al reservar) usen el número actualizado y no
    // el viejo hardcodeado. Si Supabase falla, cargarConfig() devuelve defaults.
    configTienda = await cargarConfig();
    aplicarConfigDom(configTienda);

    // Las categorías y los listeners no dependen de los datos de productos,
    // así que se preparan de inmediato mientras el catálogo carga.
    renderChips();

    document.getElementById("sortSelect").addEventListener("change", (e) => {
      state.sort = e.target.value; render();
    });
    document.getElementById("catalog").addEventListener("click", handleCardClick);

    // Nav: search / favs / cart
    document.getElementById("btnSearch").addEventListener("click", openSearch);
    document.getElementById("searchClose").addEventListener("click", closeSearch);
    document.getElementById("searchInput").addEventListener("input", (e) => renderSearchResults(e.target.value));
    document.getElementById("searchResults").addEventListener("click", (e) => {
      const r = e.target.closest(".search-result");
      if (!r) return;
      const p = state.products.find(x => x.id === r.dataset.id);
      if (p) { closeSearch(); openProductModal(p); }
    });

    document.getElementById("btnFavs").addEventListener("click", () => openSidePanel("favs"));
    document.getElementById("btnCart").addEventListener("click", () => openSidePanel("cart"));
    document.getElementById("spClose").addEventListener("click", closeSidePanel);
    document.getElementById("sideOverlay").addEventListener("click", closeSidePanel);
    document.getElementById("spBody").addEventListener("click", handleSidePanelClick);

    // Esc cierra cualquier panel/modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeProductModal();
        closeSidePanel();
        closeSearch();
      }
    });

    // Re-render si otro tab (admin) cambia productos
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        // loadProducts ahora es async (lee de Supabase); recargamos y re-pintamos.
        loadProducts().then(prods => { state.products = prods; render(); }).catch(() => {});
      }
      if (e.key === CART_KEY) updateCartBadge();
      if (e.key === FAV_KEY) { updateFavBadge(); applyFavStates(); }
    });

    // Re-attach product modal close
    const pm = document.getElementById("productModal");
    if (pm) {
      pm.addEventListener("click", (e) => {
        if (e.target === pm || e.target.closest("[data-close]")) closeProductModal();
      });
    }

    // Cargar el catálogo desde Supabase (skeleton → render con fade / error).
    // El resto del flujo (filtros, modal, etc.) funciona igual: solo cambió de
    // dónde vienen los productos.
    await cargarCatalogo();
  });
})();
