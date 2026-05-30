import { supabase } from "./supabase-config.js";

(function () {
  const STORAGE_KEY = "zarah_products_v1";
  const ADMIN_PATH_KEY = "zarah_admin_path"; // url secret token verification

  // ---------- access control ----------
  // Esta página es solo accesible para el equipo. En producción se debe
  // restringir el acceso a IPs específicas a nivel de servidor (nginx, Vercel,
  // .htaccess, etc). Aquí solo pedimos contraseña de inicio de sesión.

  const SALES_KEY    = "zarah_sales_v1";
  const CLIENTS_KEY  = "zarah_clients_v1";
  const SETTINGS_KEY = "zarah_settings_v1";
  const THEME_KEY    = "zarah_theme_v1";
  const ACCENT_KEY   = "zarah_accent_v1";
  const PASSWORD_KEY = "zarah_password_v1";

  // ---------- state ----------
  let state = {
    products: [],
    search: "",
    filter: "all",
    sort: "default",
    editingId: null
  };

  // ---------- persistence ----------
  const CAT_MIGRATE = {
    globos: "detalles",
    numbers: "detalles",
    arcos: "equipos",
    helio: "equipos"
  };
  function migrateProducts(list) {
    let changed = false;
    list.forEach(p => {
      if (!Array.isArray(p.cats)) {
        p.cats = [p.cat || "detalles"];
        delete p.cat;
        changed = true;
      }
      p.cats = p.cats.map(c => CAT_MIGRATE[c] || c);
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
  function saveProducts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
  }

  // ---------- helpers ----------
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function toast(msg, kind) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.className = "toast", 2200);
  }

  // ---------- render: login ----------
  function showLogin() {
    document.getElementById("loginShell").style.display = "grid";
    document.getElementById("appShell").style.display = "none";
    setTimeout(() => document.getElementById("loginEmail").focus(), 80);
  }
  function showApp() {
    document.getElementById("loginShell").style.display = "none";
    document.getElementById("appShell").style.display = "grid";
    renderStats();
    renderTable();
    applyThemeFromStorage();
    applyAccentFromStorage();
  }

  // ---------- THEME + ACCENT ----------
  function applyThemeFromStorage() {
    const theme = localStorage.getItem(THEME_KEY) || "light";
    document.body.setAttribute("data-theme", theme);
    const radio = document.querySelector(`input[name="theme"][value="${theme}"]`);
    if (radio) radio.checked = true;
  }
  function applyAccentFromStorage() {
    const accent = localStorage.getItem(ACCENT_KEY) || "#c75a87";
    document.documentElement.style.setProperty("--rose", accent);
    document.documentElement.style.setProperty("--pink", accent);
    document.querySelectorAll(".acc-sw").forEach(b => {
      b.classList.toggle("active", b.dataset.color === accent);
    });
  }
  function setTheme(t) {
    localStorage.setItem(THEME_KEY, t);
    applyThemeFromStorage();
    toast("Tema actualizado", "success");
  }
  function setAccent(c) {
    localStorage.setItem(ACCENT_KEY, c);
    applyAccentFromStorage();
    toast("Color de marca actualizado", "success");
  }

  // ---------- VIEW SWITCHER ----------
  function switchView(v) {
    document.querySelectorAll(".sb-nav .item").forEach(i => i.classList.toggle("active", i.dataset.view === v));
    document.querySelectorAll(".view").forEach(s => {
      s.style.display = s.dataset.view === v ? "" : "none";
    });
    if (v === "ventas") renderSales();
    if (v === "clientes") renderClients();
    if (v === "ajustes") renderSettings();
  }

  // ---------- SALES ----------
  function getSales() {
    try { return JSON.parse(localStorage.getItem(SALES_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function setSales(arr) { localStorage.setItem(SALES_KEY, JSON.stringify(arr)); renderSales(); }
  function renderSales() {
    const list = document.getElementById("salesList");
    if (!list) return;
    const sales = getSales().sort((a, b) => b.date - a.date);

    const pending = sales.filter(s => s.status === "pending").length;
    const done = sales.filter(s => s.status === "done").length;
    const revenue = sales.filter(s => s.status === "done").reduce((s, x) => s + Number(x.total || 0), 0);
    document.getElementById("salesTotal").textContent = sales.length;
    document.getElementById("salesPending").textContent = pending;
    document.getElementById("salesDone").textContent = done;
    document.getElementById("salesRevenue").textContent = revenue.toFixed(0);

    if (!sales.length) {
      list.innerHTML = `
        <div class="sale-empty">
          <div class="ic">🧾</div>
          <div class="t">Aún no hay pedidos registrados</div>
          <div>Cuando registres una venta o un cliente la confirme, aparecerá aquí.</div>
        </div>`;
      return;
    }
    list.innerHTML = sales.map(s => {
      const date = new Date(s.date);
      const dateStr = date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) +
        " · " + date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
      const summary = s.summary || (s.items || []).map(i => i.name).join(", ") || "Pedido manual";
      return `
        <div class="sale-card ${s.status === "done" ? "done" : s.status === "cancelled" ? "cancelled" : ""}" data-id="${s.id}">
          <div class="sale-status" title="${s.status}"></div>
          <div class="sale-meta">
            <div class="sale-date">${escapeHTML(dateStr)} · ${s.status === "done" ? "Completada" : s.status === "cancelled" ? "Cancelada" : "Pendiente"}</div>
            <div class="sale-summary">${escapeHTML(summary)}</div>
            ${s.customer ? `<div class="sale-customer">Cliente: <strong>${escapeHTML(s.customer)}</strong></div>` : ""}
          </div>
          <div class="sale-total">S/ ${Number(s.total || 0).toFixed(2)}</div>
          <div class="sale-actions">
            ${s.status !== "done" ? `<button class="sale-btn done-btn" data-act="done" title="Marcar completada"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ""}
            <button class="sale-btn del-btn" data-act="del" title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
          </div>
        </div>`;
    }).join("");
  }

  function addManualSale() {
    const summary = prompt("¿Qué producto(s) se vendieron?");
    if (!summary) return;
    const totalStr = prompt("¿Total de la venta? (S/)");
    const total = parseFloat(totalStr);
    if (isNaN(total)) { toast("Total inválido"); return; }
    const customer = prompt("Nombre del cliente (opcional):") || "";
    const sales = getSales();
    sales.push({
      id: "s" + Date.now(),
      date: Date.now(),
      summary, total, customer,
      status: "done",
      items: []
    });
    setSales(sales);
    toast("Venta registrada", "success");
  }

  // ---------- CLIENTS ----------
  function getClients() {
    try { return JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function setClients(arr) { localStorage.setItem(CLIENTS_KEY, JSON.stringify(arr)); renderClients(); }
  function renderClients() {
    const grid = document.getElementById("clientsGrid");
    if (!grid) return;
    const clients = getClients();
    if (!clients.length) {
      grid.innerHTML = `
        <div class="sale-empty" style="grid-column: 1 / -1">
          <div class="ic">👥</div>
          <div class="t">Aún no tienes clientes guardados</div>
          <div>Añade tus compradores frecuentes para mantener su contacto a mano.</div>
        </div>`;
      return;
    }
    grid.innerHTML = clients.map(c => {
      const initial = (c.name || "?").trim().charAt(0).toUpperCase();
      const phoneClean = (c.phone || "").replace(/\D/g, "");
      return `
        <div class="client-card" data-id="${c.id}">
          <div class="client-av">${escapeHTML(initial)}</div>
          <div class="client-name">${escapeHTML(c.name)}</div>
          ${c.phone ? `<div class="client-phone">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            ${escapeHTML(c.phone)}
          </div>` : ""}
          ${c.notes ? `<div class="client-notes">${escapeHTML(c.notes)}</div>` : ""}
          <div class="client-actions">
            ${phoneClean ? `<a class="client-wa" href="https://wa.me/${phoneClean}" target="_blank" rel="noopener">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg>
              WhatsApp
            </a>` : ""}
            <button class="client-del" data-act="del">Eliminar</button>
          </div>
        </div>`;
    }).join("");
  }
  function addClient() {
    const name = prompt("Nombre del cliente:");
    if (!name || !name.trim()) return;
    const phone = prompt("Teléfono (con código de país, ej: 51994684237):") || "";
    const notes = prompt("Notas (opcional, ej: prefiere rosas rosadas):") || "";
    const clients = getClients();
    clients.unshift({
      id: "c" + Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      notes: notes.trim()
    });
    setClients(clients);
    toast("Cliente añadido", "success");
  }

  // ---------- SETTINGS ----------
  function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function setSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
  function renderSettings() {
    const s = getSettings();
    document.getElementById("setStoreName").value = s.storeName || "Zarah's";
    document.getElementById("setWhatsapp").value  = s.whatsapp  || "51994684237";
    document.getElementById("setHours").value     = s.hours     || "Lun – Sáb · 9:00 a.m. – 6:00 p.m.";
    document.getElementById("setArea").value      = s.area      || "Callao y Lima";
  }
  function saveStoreInfo() {
    const s = {
      storeName: document.getElementById("setStoreName").value.trim() || "Zarah's",
      whatsapp:  document.getElementById("setWhatsapp").value.replace(/\D/g, "") || "51994684237",
      hours:     document.getElementById("setHours").value.trim(),
      area:      document.getElementById("setArea").value.trim()
    };
    setSettings(s);
    toast("Datos guardados", "success");
  }
  function changePassword() {
    const hint = document.getElementById("passHint");
    const oldP = document.getElementById("setPassOld").value;
    const newP = document.getElementById("setPassNew").value;
    const cnf  = document.getElementById("setPassConfirm").value;
    const expected = localStorage.getItem(PASSWORD_KEY) || window.ADMIN_PASSWORD;

    hint.className = "settings-hint";
    if (oldP !== expected) {
      hint.textContent = "La contraseña actual es incorrecta.";
      hint.classList.add("error"); return;
    }
    if (!newP || newP.length < 6) {
      hint.textContent = "La nueva contraseña debe tener al menos 6 caracteres.";
      hint.classList.add("error"); return;
    }
    if (newP !== cnf) {
      hint.textContent = "La confirmación no coincide.";
      hint.classList.add("error"); return;
    }
    localStorage.setItem(PASSWORD_KEY, newP);
    document.getElementById("setPassOld").value = "";
    document.getElementById("setPassNew").value = "";
    document.getElementById("setPassConfirm").value = "";
    hint.textContent = "Contraseña actualizada correctamente.";
    hint.classList.add("success");
    toast("Contraseña actualizada", "success");
  }
  function exportBackup() {
    const data = {
      products: state.products,
      sales: getSales(),
      clients: getClients(),
      settings: getSettings(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zarah-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Respaldo descargado", "success");
  }
  function resetCatalog() {
    if (!confirm("¿Estás seguro? Se restablecerá el catálogo a su estado original y se perderán tus cambios.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.products = loadProducts();
    renderTable();
    renderStats();
    toast("Catálogo restablecido", "success");
  }

  async function tryLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const pw    = document.getElementById("loginPass").value;
    const err   = document.querySelector(".login-card .err");
    const btn   = document.getElementById("loginSubmit");

    err.classList.remove("show");

    if (!email || !pw) {
      err.textContent = "Ingresa tu email y contraseña.";
      err.classList.add("show");
      return;
    }

    // Estado "esperando": deshabilita el botón y muestra feedback,
    // guardando el contenido original (SVG incluido) para restaurarlo.
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Verificando…";

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) {
        err.textContent = error.message;
        err.classList.add("show");
      } else {
        showApp();
      }
    } catch (e) {
      err.textContent = e.message || "No se pudo conectar. Revisa tu conexión.";
      err.classList.add("show");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  // ---------- render: stats ----------
  function renderStats() {
    const total = state.products.length;
    const onSale = state.products.filter(p => p.oldPrice && p.oldPrice > p.price).length;
    const avg = total ? Math.round(state.products.reduce((s, p) => s + Number(p.price), 0) / total) : 0;
    const cats = new Set(state.products.map(p => p.cat)).size;
    document.getElementById("statTotal").textContent = total;
    document.getElementById("statOferta").textContent = onSale;
    document.getElementById("statAvg").textContent = avg;
    document.getElementById("statCats").textContent = cats;
  }

  // ---------- render: table ----------
  function getFiltered() {
    let list = state.products.slice();
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (state.filter !== "all") list = list.filter(p => Array.isArray(p.cats) && p.cats.includes(state.filter));
    if (state.sort === "name") list.sort((a,b) => a.name.localeCompare(b.name));
    if (state.sort === "price-asc") list.sort((a,b) => a.price - b.price);
    if (state.sort === "price-desc") list.sort((a,b) => b.price - a.price);
    if (state.sort === "oferta") list.sort((a,b) => (b.oldPrice ? 1 : 0) - (a.oldPrice ? 1 : 0));
    return list;
  }

  function renderTable() {
    const tbody = document.getElementById("tableBody");
    const list = getFiltered();
    tbody.innerHTML = "";

    if (!list.length) {
      tbody.innerHTML = `
        <div class="empty-state">
          <div class="ic">🌷</div>
          <div class="t">No hay productos</div>
          <div class="d">Ajusta los filtros o añade uno nuevo.</div>
        </div>`;
      return;
    }

    list.forEach(p => {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.id = p.id;
      const onSale = !!(p.oldPrice && p.oldPrice > p.price);
      const cats = Array.isArray(p.cats) ? p.cats : [];
      const catLabels = cats
        .map(id => (window.CATEGORIES.find(c => c.id === id) || {}).label)
        .filter(Boolean);

      row.innerHTML = `
        <div class="thumb ${p.img ? "" : "empty"}"
             style="${p.img ? `background-image:url('${escapeHTML(p.img)}')` : ""}"
             title="Cambiar foto">${p.img ? "" : "Sin foto"}</div>
        <input class="name-input" data-field="name" value="${escapeHTML(p.name)}">
        <button class="cat-picker" data-action="open-cats" title="Editar categorías">
          ${catLabels.length
            ? catLabels.map(l => `<span class="cat-chip">${escapeHTML(l)}</span>`).join("")
            : `<span class="cat-empty">Sin categoría</span>`}
          <span class="cat-edit">✎</span>
        </button>
        <input class="price-input" data-field="price" value="${Number(p.price).toFixed(2)}">
        <input class="old-input" data-field="oldPrice" value="${p.oldPrice ? Number(p.oldPrice).toFixed(2) : ""}" placeholder="—">
        <div class="toggle ${onSale ? "on" : ""}" data-action="toggle-oferta" title="En oferta"></div>
        <button class="feat-btn" data-action="open-features" title="Editar características">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span class="feat-count">${(p.features || []).filter(Boolean).length}</span>
        </button>
        <button class="delete-btn" data-action="delete" title="Eliminar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      `;
      tbody.appendChild(row);
    });
  }

  // ---------- inline updates ----------
  function updateField(id, field, value) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (field === "name") {
      p.name = String(value).trim() || p.name;
    } else if (field === "price") {
      const n = parseFloat(value);
      if (!isNaN(n) && n > 0) p.price = n;
    } else if (field === "oldPrice") {
      const v = String(value).trim();
      if (!v) { delete p.oldPrice; delete p.badge; }
      else {
        const n = parseFloat(v);
        if (!isNaN(n) && n > p.price) {
          p.oldPrice = n;
          if (!p.badge) p.badge = "Oferta";
        }
      }
    } else if (field === "cat") {
      // legacy single-cat input no longer used
      p.cats = [value];
    }
    saveProducts();
    renderStats();
  }

  function toggleOferta(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (p.oldPrice && p.oldPrice > p.price) {
      delete p.oldPrice;
      delete p.badge;
      toast("Oferta desactivada");
    } else {
      p.oldPrice = Math.round(p.price * 1.2);
      p.badge = "Oferta";
      toast("Oferta activada — ajusta el precio original si lo necesitas", "success");
    }
    saveProducts(); renderTable(); renderStats();
  }

  function deleteProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (confirm(`¿Eliminar "${p.name}"?`)) {
      state.products = state.products.filter(x => x.id !== id);
      saveProducts(); renderTable(); renderStats();
      toast("Producto eliminado");
    }
  }

  function addProduct() {
    const id = "p" + Date.now();
    state.products.unshift({
      id, name: "Nuevo producto", cats: ["detalles"], price: 100, img: ""
    });
    saveProducts(); renderTable(); renderStats();
    toast("Producto añadido — edita los datos", "success");
    setTimeout(() => {
      const first = document.querySelector(`.row[data-id="${id}"] .name-input`);
      if (first) { first.focus(); first.select(); }
    }, 50);
  }

  // ---------- categories popover ----------
  function openCatsPopover(rowEl, productId) {
    closeCatsPopover();
    const p = state.products.find(x => x.id === productId);
    if (!p) return;
    const cats = new Set(p.cats || []);

    const pop = document.createElement("div");
    pop.className = "cats-pop";
    pop.id = "catsPop";
    pop.innerHTML = `
      <div class="cats-pop-head">Categorías de este producto</div>
      <div class="cats-pop-list">
        ${window.CATEGORIES.filter(c => c.id !== "all").map(c => `
          <label class="cats-pop-item ${cats.has(c.id) ? "on" : ""}" data-cat="${c.id}">
            <span class="check">${cats.has(c.id) ? "✓" : ""}</span>
            ${escapeHTML(c.label)}
          </label>
        `).join("")}
      </div>
      <div class="cats-pop-foot">
        <button class="cats-pop-done">Listo</button>
      </div>
    `;
    document.body.appendChild(pop);

    // position next to the row's cat-picker button
    const btn = rowEl.querySelector(".cat-picker");
    const r = btn.getBoundingClientRect();
    pop.style.top  = (window.scrollY + r.bottom + 6) + "px";
    pop.style.left = (window.scrollX + r.left) + "px";

    // interactions
    pop.addEventListener("click", (e) => {
      const item = e.target.closest(".cats-pop-item");
      if (item) {
        const cat = item.dataset.cat;
        if (cats.has(cat)) cats.delete(cat); else cats.add(cat);
        p.cats = [...cats];
        if (p.cats.length === 0) p.cats = ["detalles"]; // siempre al menos una
        saveProducts();
        // refresh popover visual + table row + stats
        item.classList.toggle("on", cats.has(cat));
        item.querySelector(".check").textContent = cats.has(cat) ? "✓" : "";
        renderTable();
        renderStats();
        // re-attach popover position to new row element
        const newRow = document.querySelector(`.row[data-id="${productId}"]`);
        if (newRow) {
          const nb = newRow.querySelector(".cat-picker").getBoundingClientRect();
          pop.style.top  = (window.scrollY + nb.bottom + 6) + "px";
          pop.style.left = (window.scrollX + nb.left) + "px";
        }
      }
      if (e.target.closest(".cats-pop-done")) closeCatsPopover();
    });

    // close on outside click
    setTimeout(() => {
      document.addEventListener("mousedown", outsideCloseHandler, { once: true });
    }, 0);
  }
  function outsideCloseHandler(e) {
    const pop = document.getElementById("catsPop");
    if (!pop) return;
    if (pop.contains(e.target) || e.target.closest(".cat-picker")) {
      document.addEventListener("mousedown", outsideCloseHandler, { once: true });
    } else {
      closeCatsPopover();
    }
  }
  function closeCatsPopover() {
    const pop = document.getElementById("catsPop");
    if (pop) pop.remove();
  }

  // ---------- features modal ----------
  function openFeaturesModal(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.editingId = id;
    const m = document.getElementById("featuresModal");
    document.getElementById("featProductName").textContent = p.name;
    const list = document.getElementById("featList");
    list.innerHTML = "";
    const current = Array.isArray(p.features) ? p.features : [];
    if (current.length === 0) current.push("");
    current.forEach(f => addFeatRow(f));
    m.classList.add("open");
  }
  function addFeatRow(value = "") {
    const list = document.getElementById("featList");
    const row = document.createElement("div");
    row.className = "feat-row";
    row.innerHTML = `
      <span class="feat-dash">—</span>
      <input type="text" class="feat-input" maxlength="80" placeholder="Ej. Incluye tarjeta dedicatoria">
      <button class="feat-row-del" title="Eliminar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;
    const input = row.querySelector("input");
    input.value = value;
    row.querySelector(".feat-row-del").onclick = () => {
      row.remove();
      if (document.querySelectorAll("#featList .feat-row").length === 0) addFeatRow("");
    };
    // Enter → si está vacío, guarda; si tiene texto, salta a la siguiente fila (o crea una nueva)
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const allRows = Array.from(document.querySelectorAll("#featList .feat-row"));
      const idx = allRows.indexOf(row);
      const isLast = idx === allRows.length - 1;
      if (!input.value.trim() && allRows.length > 1) {
        // Enter en una fila vacía → guarda todo
        saveFeatures();
        return;
      }
      if (isLast) {
        // Última fila con contenido → crea una nueva y enfoca
        if (input.value.trim()) {
          addFeatRow("");
          const newInput = document.querySelector("#featList .feat-row:last-child input");
          if (newInput) newInput.focus();
        } else {
          // Última fila vacía → guarda
          saveFeatures();
        }
      } else {
        // Salta a la siguiente fila
        const next = allRows[idx + 1].querySelector("input");
        if (next) next.focus();
      }
    });
    list.appendChild(row);
    return input;
  }
  function saveFeatures() {
    const id = state.editingId;
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const values = Array.from(document.querySelectorAll("#featList input"))
      .map(i => i.value.trim())
      .filter(Boolean);
    if (values.length) p.features = values;
    else delete p.features;
    saveProducts();
    closeFeaturesModal();
    renderTable();
    toast("Características guardadas", "success");
  }
  function closeFeaturesModal() {
    document.getElementById("featuresModal").classList.remove("open");
  }
  function openImageModal(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.editingId = id;
    document.getElementById("imageModal").classList.add("open");
    document.querySelectorAll("#imageModal .tab-btn").forEach((b, i) => b.classList.toggle("active", i===0));
    document.querySelectorAll("#imageModal .tab-panel").forEach((b, i) => b.classList.toggle("active", i===0));
    document.getElementById("urlInput").value = p.img || "";
    const prev = document.querySelector("#imageModal .upload-preview");
    if (p.img) {
      prev.style.backgroundImage = `url("${p.img}")`;
      prev.classList.add("show");
    } else {
      prev.classList.remove("show");
      prev.style.backgroundImage = "";
    }
    window.__pendingImage = null;
  }
  function closeImageModal() {
    document.getElementById("imageModal").classList.remove("open");
    state.editingId = null;
  }
  function applyImage(src) {
    const p = state.products.find(x => x.id === state.editingId);
    if (!p) return;
    p.img = src;
    saveProducts();
    closeImageModal();
    renderTable();
    toast("Imagen actualizada", "success");
  }
  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) { toast("Selecciona una imagen válida"); return; }
    const r = new FileReader();
    r.onload = (e) => {
      const prev = document.querySelector("#imageModal .upload-preview");
      prev.style.backgroundImage = `url("${e.target.result}")`;
      prev.classList.add("show");
      window.__pendingImage = e.target.result;
    };
    r.readAsDataURL(file);
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    state.products = loadProducts();

    // Auth state — verifica si ya hay sesión activa en Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session) showApp();
    else showLogin();

    // Login form
    document.getElementById("loginSubmit").onclick = tryLogin;
    const onEnter = (e) => { if (e.key === "Enter") tryLogin(); };
    document.getElementById("loginEmail").addEventListener("keydown", onEnter);
    document.getElementById("loginPass").addEventListener("keydown", onEnter);

    // Logout
    document.getElementById("logoutBtn").onclick = async () => {
      if (confirm("¿Cerrar sesión?")) {
        await supabase.auth.signOut();
        document.getElementById("loginEmail").value = "";
        document.getElementById("loginPass").value = "";
        showLogin();
      }
    };

    // Sidebar navigation
    document.querySelectorAll(".sb-nav .item").forEach(it => {
      it.onclick = () => {
        const v = it.dataset.view;
        if (v) switchView(v);
      };
    });

    // Ventas
    document.getElementById("btnNewSale").onclick = addManualSale;
    document.getElementById("salesList").addEventListener("click", (e) => {
      const card = e.target.closest(".sale-card"); if (!card) return;
      const act = e.target.closest("[data-act]")?.dataset.act;
      const id  = card.dataset.id;
      const sales = getSales();
      const i = sales.findIndex(s => s.id === id);
      if (i < 0) return;
      if (act === "done") { sales[i].status = "done"; setSales(sales); toast("Marcada como completada", "success"); }
      if (act === "del")  { if (confirm("¿Eliminar este registro?")) { sales.splice(i, 1); setSales(sales); toast("Pedido eliminado"); } }
    });

    // Clientes
    document.getElementById("btnNewClient").onclick = addClient;
    document.getElementById("clientsGrid").addEventListener("click", (e) => {
      const card = e.target.closest(".client-card"); if (!card) return;
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "del") {
        const clients = getClients().filter(c => c.id !== card.dataset.id);
        setClients(clients);
        toast("Cliente eliminado");
      }
    });

    // Ajustes — Tema
    document.querySelectorAll('input[name="theme"]').forEach(r => {
      r.onchange = () => setTheme(r.value);
    });

    // Ajustes — Acento
    document.getElementById("accentSwatches").addEventListener("click", (e) => {
      const sw = e.target.closest(".acc-sw");
      if (sw) setAccent(sw.dataset.color);
    });

    // Ajustes — Información tienda
    document.getElementById("saveStoreInfo").onclick = saveStoreInfo;

    // Ajustes — Contraseña
    document.getElementById("savePass").onclick = changePassword;

    // Ajustes — Backup + reset
    document.getElementById("btnExport").onclick = exportBackup;
    document.getElementById("btnReset").onclick = resetCatalog;

    // Add product
    document.getElementById("btnNew").onclick = addProduct;

    // Search
    document.getElementById("searchInput").addEventListener("input", (e) => {
      state.search = e.target.value; renderTable();
    });

    // Filter
    const filterSel = document.getElementById("filterSelect");
    filterSel.innerHTML = window.CATEGORIES.map(c =>
      `<option value="${c.id}">${escapeHTML(c.label)}</option>`).join("");
    filterSel.addEventListener("change", (e) => { state.filter = e.target.value; renderTable(); });

    // Sort
    document.getElementById("sortSelect").addEventListener("change", (e) => {
      state.sort = e.target.value; renderTable();
    });

    // Table interactions
    const tbody = document.getElementById("tableBody");
    tbody.addEventListener("click", (e) => {
      const row = e.target.closest(".row"); if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest(".thumb")) openImageModal(id);
      else if (e.target.closest("[data-action=open-cats]")) openCatsPopover(row, id);
      else if (e.target.closest("[data-action=open-features]")) openFeaturesModal(id);
      else if (e.target.closest("[data-action=toggle-oferta]")) toggleOferta(id);
      else if (e.target.closest("[data-action=delete]")) deleteProduct(id);
    });
    tbody.addEventListener("change", (e) => {
      const row = e.target.closest(".row"); if (!row) return;
      const id = row.dataset.id;
      const field = e.target.dataset.field;
      if (field) updateField(id, field, e.target.value);
    });
    tbody.addEventListener("blur", (e) => {
      const row = e.target.closest(".row"); if (!row) return;
      const id = row.dataset.id;
      const field = e.target.dataset.field;
      if (field) {
        updateField(id, field, e.target.value);
        renderTable();
      }
    }, true);

    // Image modal
    document.querySelectorAll("#imageModal .tab-btn").forEach((b, i) => {
      b.onclick = () => {
        document.querySelectorAll("#imageModal .tab-btn").forEach(x => x.classList.remove("active"));
        document.querySelectorAll("#imageModal .tab-panel").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        document.querySelectorAll("#imageModal .tab-panel")[i].classList.add("active");
      };
    });

    // Features modal
    document.getElementById("featAddBtn").onclick = () => addFeatRow("");
    document.getElementById("featSave").onclick = saveFeatures;
    document.getElementById("featuresModal").addEventListener("click", (e) => {
      if (e.target.id === "featuresModal" || e.target.closest("[data-close]")) closeFeaturesModal();
    });
    const zone = document.getElementById("uploadZone");
    const fileIn = document.getElementById("fileInput");
    zone.onclick = () => fileIn.click();
    fileIn.onchange = (e) => handleFile(e.target.files[0]);
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("drag"); };
    zone.ondragleave = () => zone.classList.remove("drag");
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove("drag"); handleFile(e.dataTransfer.files[0]); };

    document.getElementById("imageSave").onclick = () => {
      const tab = document.querySelector("#imageModal .tab-btn.active").dataset.tab;
      if (tab === "upload") {
        if (window.__pendingImage) applyImage(window.__pendingImage);
        else toast("Sube una imagen primero");
      } else {
        const url = document.getElementById("urlInput").value.trim();
        if (!url) { toast("Pega una URL"); return; }
        applyImage(url);
      }
    };

    document.querySelectorAll(".modal-overlay").forEach(ov => {
      ov.addEventListener("click", (e) => { if (e.target === ov) closeImageModal(); });
      ov.querySelectorAll("[data-close]").forEach(b => b.onclick = closeImageModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeImageModal();
    });
  });
})();
