(function () {
  const STORAGE_KEY = "zarah_products_v1";
  const ADMIN_KEY   = "zarah_admin_session";
  const ADMIN_PATH_KEY = "zarah_admin_path"; // url secret token verification

  // ---------- access control ----------
  // Esta página es solo accesible para el equipo. En producción se debe
  // restringir el acceso a IPs específicas a nivel de servidor (nginx, Vercel,
  // .htaccess, etc). Aquí solo pedimos contraseña de inicio de sesión.

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
  function isAuth() { return sessionStorage.getItem(ADMIN_KEY) === "ok"; }
  function setAuth(v) {
    if (v) sessionStorage.setItem(ADMIN_KEY, "ok");
    else sessionStorage.removeItem(ADMIN_KEY);
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
    setTimeout(() => document.getElementById("loginPass").focus(), 80);
  }
  function showApp() {
    document.getElementById("loginShell").style.display = "none";
    document.getElementById("appShell").style.display = "grid";
    renderStats();
    renderTable();
  }

  function tryLogin() {
    const pw = document.getElementById("loginPass").value;
    if (pw === window.ADMIN_PASSWORD) {
      setAuth(true);
      document.querySelector(".login-card .err").classList.remove("show");
      showApp();
    } else {
      const err = document.querySelector(".login-card .err");
      err.textContent = "Contraseña incorrecta.";
      err.classList.add("show");
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

  // ---------- image modal ----------
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
  document.addEventListener("DOMContentLoaded", () => {
    state.products = loadProducts();

    // Auth state
    if (isAuth()) showApp();
    else showLogin();

    // Login form
    document.getElementById("loginSubmit").onclick = tryLogin;
    document.getElementById("loginPass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryLogin();
    });

    // Logout
    document.getElementById("logoutBtn").onclick = () => {
      if (confirm("¿Cerrar sesión?")) {
        setAuth(false);
        document.getElementById("loginPass").value = "";
        showLogin();
      }
    };

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
