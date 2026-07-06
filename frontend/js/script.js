"use strict";
const API_BASE = "http://localhost:3000";
const API = "http://localhost:3000/vehiculos";
const API_SUC = "http://localhost:3000/sucursales";
const API_USUARIOS = "http://localhost:3000/usuarios";
let editingId = null;
let editingSucursalId = null;
let charts = { fuel: null, brands: null, years: null, perfil: null };
let currentView = "table";
let currentFilter = "all";
let currentTransmisionFilter = "all";
let yearFrom = "";
let yearTo = "";
let condicionFilter = "all";
let sucursalesView = "table";
let vehiculosCache = [];
let sucursalesCache = [];
let sucursalFilter = "all"; // 'all' o el id de una sucursal (empleado asignado o invitado seleccionado)
let dashboardSucursalFilter = "all";
let pageUI = {};
let lastActivePage = null;
let isAppShell = false;
let sharedInitialized = false;

// ─── SEGURIDAD ──────────
function getToken() {
  return localStorage.getItem("amToken") || "";
}
function isGuest() {
  return localStorage.getItem("amGuest") === "true";
}

// Theme is always dark — no toggle needed

if (!getToken() && !isGuest()) {
  window.location.replace("login.html");
}

// ─── DICCIONARIO ERRORES ───────────────────────
const errDict = {
  es: {
    req: "Campo obligatorio",
    anio: "Año: 1990–2026",
    precio: "Precio inválido",
    cant: "Mín. 1",
    codigo: "Código existe",
  },
  en: {
    req: "Required field",
    anio: "Year: 1990–2026",
    precio: "Invalid price",
    cant: "Min 1",
    codigo: "Code exists",
  },
};

function getLang() {
  return document.getElementById("lang-en")?.classList.contains("active")
    ? "en"
    : "es";
}

// ─── SIDEBAR ────────────────────────────────────
function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  if (!sidebar || !toggle) return;
  const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";

  sidebar.style.transition = "none";
  sidebar.classList.toggle("collapsed", isCollapsed);
  document.documentElement.classList.remove("pre-collapsed");
  void sidebar.offsetHeight;
  sidebar.style.transition = "";

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    localStorage.setItem("sidebarCollapsed", sidebar.classList.contains("collapsed"));
    setTimeout(() => resizeCharts(), 350);
  });

  // Sidebar links
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    const condicion = link.dataset.condicion;
    const page = link.dataset.page;
    if (isAppShell && page) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (condicion) sessionStorage.setItem("invCondicion", condicion);
        history.pushState(null, "", "#" + page);
        loadPage(page);
      });
    } else if (condicion) {
      link.addEventListener("click", () => {
        sessionStorage.setItem("invCondicion", condicion);
      });
    }
  });
}

function navigateTo(page) {
  const map = {
    dashboard: "dashboard", inventario: "inventario", registro: "registro",
    sucursales: "sucursales", nosotros: "nosotros", perfil: "perfil",
    "admin-usuarios": "admin"
  };
  const target = map[page] || page;
  if (!target) { showToast("Página no encontrada.", "error"); return; }
  if (isAppShell) {
    history.pushState(null, "", "#" + target);
    loadPage(target);
  } else {
    window.location.href = target + ".html";
  }
}

// ─── TABS DE REGISTRO (Vehículo / Sucursal) ────
function switchRegistroTab(tab) {
  if (tab === "sucursal" && !puedeGestionarSucursales()) {
    tab = "vehiculo";
  }
  document
    .querySelectorAll(".reg-tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".reg-tab-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(`reg-tab-btn-${tab}`)?.classList.add("active");
  document.getElementById(`reg-tab-${tab}`)?.classList.add("active");
}

// ─── PERMISOS POR ROL (UI) ──────────────────────
// Oculta cualquier elemento con .role-gated cuyo data-roles no incluya el rol actual.
function aplicarPermisosRol() {
  const usuario = getUsuario();
  const esInvitado = isGuest();
  const rol = esInvitado ? "empleado" : (usuario ? usuario.rol : null);

  document.querySelectorAll(".role-gated").forEach((el) => {
    const permitidos = (el.dataset.roles || "").split(",").map((r) => r.trim());
    const visible = rol && permitidos.includes(rol);
    el.style.display = visible ? "" : "none";
  });
}

// ─── RENDER USER INFO ──────────────────────────
function renderUserInfo() {
  const footer = document.getElementById("sidebar-footer");
  if (!footer) return;

  // Usamos variables para definir el contenido del usuario
  const isGuestUser = isGuest();
  const usuario = getUsuario();
  const nombre = usuario ? usuario.nombre : "Usuario";
  const avatar = usuario && usuario.avatar_url;
  const iniciales = nombre
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const firstName = nombre.split(" ")[0];
  const rol = usuario ? usuario.rol : "empleado";

  footer.innerHTML = `
        <button class="footer-logout" onclick="cerrarSesion()" title="${isGuestUser ? "Iniciar sesión" : "Cerrar sesión"}">
            <i data-lucide="power"></i>
            <span>${isGuestUser ? "Iniciar sesión" : "Cerrar sesión"}</span>
        </button>
        <div class="footer-user-row">
            <div class="avatar">
                ${isGuestUser ? "?" : avatar ? `<img src="${avatar.startsWith('http') ? avatar : API_BASE + avatar}" alt="${firstName}" />` : iniciales}
            </div>
            <div class="user-info">
                <div class="name">${isGuestUser ? "Invitado" : firstName}</div>
                <div class="role">${isGuestUser ? "Solo lectura" : rol}</div>
            </div>
        </div>
    `;

  if (window.lucide) lucide.createIcons();
}

function cerrarSesion() {
  localStorage.clear();
  window.location.replace("login.html");
}

// ─── DASHBOARD ──────────────────────────────────
function mostrarSaludo() {
  const greetingEl = document.getElementById("dashboard-greeting");
  if (!greetingEl) return;
  const usuario = getUsuario();
  const esInvitado = isGuest();
  const nombre = usuario ? usuario.nombre.split(" ")[0] : "";
  const hora = new Date().getHours();
  const lang = localStorage.getItem("amIdioma") || "es";
  const saludos = {
    es: ["Buenos días", "Buenas tardes", "Buenas noches"],
    en: ["Good Morning", "Good Afternoon", "Good Evening"],
  };
  const idx = hora < 12 ? 0 : hora < 18 ? 1 : 2;
  const saludo = saludos[lang] ? saludos[lang][idx] : saludos.en[idx];
  const guestLabel = lang === "es" ? "Invitado" : "Guest";
  if (esInvitado) {
    greetingEl.textContent = `${saludo}, ${guestLabel}!`;
  } else if (nombre) {
    greetingEl.textContent = `${saludo}, ${nombre}!`;
  }
}

async function cargarDashboard() {
  try {
    mostrarSaludo();
    const esInvitado = isGuest();
    const res = await fetch(API + (esInvitado ? "?limit=6" : ""));
    const listaTotal = await res.json();
    const filtro = dashboardSucursalFilter;
    const lista = filtro === "all" ? listaTotal : listaTotal.filter(v => String(v.sucursal_id) === String(filtro));
    actualizarEstadisticas(lista);
    actualizarGraficos(lista);
    renderRecentVehicles(listaTotal);
    const notice = document.getElementById("guest-notice-dashboard");
    if (notice) notice.style.display = esInvitado ? "flex" : "none";
  } catch (err) {
    showToast("Error al cargar el dashboard.", "error");
  }
}

function actualizarEstadisticas(lista) {
  const total = lista.reduce((a, v) => a + (v.cantidad || 0), 0);
  const nuevos = lista.filter(v => v.condicion === 'Nuevo').reduce((a, v) => a + (v.cantidad || 0), 0);
  const usados = lista.filter(v => v.condicion === 'Usado').reduce((a, v) => a + (v.cantidad || 0), 0);
  const marcas = new Set(lista.map((v) => v.marca.toLowerCase())).size;
  const valor = lista.reduce((acc, v) => acc + v.precio * v.cantidad, 0);

  const elTotal = document.getElementById("stat-total");
  const elNuevos = document.getElementById("stat-nuevos");
  const elUsados = document.getElementById("stat-usados");
  const elMarcas = document.getElementById("stat-marcas");
  const elValor = document.getElementById("stat-valor");
  if (elTotal) elTotal.textContent = total;
  if (elNuevos) elNuevos.textContent = nuevos;
  if (elUsados) elUsados.textContent = usados;
  if (elMarcas) elMarcas.textContent = marcas;
  if (elValor) elValor.textContent = "$" + formatNum(valor);
}

function renderRecentVehicles(lista) {
  const tbody = document.getElementById('recent-vehicles-body');
  const elTotalLabel = document.getElementById("stat-total-label");
  if (!tbody) return;
  const recientes = [...lista].slice(-6).reverse();
  if (elTotalLabel) {
    elTotalLabel.textContent = `${recientes.length} registrados`;
  }
  if (recientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.2);padding:24px;font-size:12px;">Sin vehículos registrados aún.</td></tr>';
    return;
  }
  tbody.innerHTML = recientes.map(v => {
    const imgHtml = v.imagen
      ? `<img class="recent-vehicle-img" src="http://localhost:3000${v.imagen}" alt="${esc(v.marca)}" />`
      : `<div class="recent-placeholder"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>`;
    return `<tr>
      <td>${imgHtml}</td>
      <td><span class="recent-brand">${esc(v.marca)} ${esc(v.modelo)}</span><br><span style="font-size:11px;color:rgba(255,255,255,0.3);font-family:var(--font-mono)">${esc(v.codigo)}</span></td>
      <td style="font-family:var(--font-mono);font-size:12px;color:rgba(255,255,255,0.5)">${esc(String(v.anio))}</td>
      <td class="recent-price">$${formatNum(v.precio)}</td>
    </tr>`;
  }).join('');
}

function actualizarGraficos(lista) {
  if (charts.fuel) { charts.fuel.destroy(); charts.fuel = null; }
  if (charts.brands) { charts.brands.destroy(); charts.brands = null; }
  if (charts.years) { charts.years.destroy(); charts.years = null; }

  const labelColor = "#777777";
  const tickColor  = "#555555";
  const gridColor  = "rgba(255, 255, 255, 0.05)";
  const doughnutBorderColor = "#0D0D0D";

  // Helper to adjust hex opacity
  function adjustOpacity(hex, opacity) {
    let r = 255, g = 255, b = 255;
    if (hex && hex.startsWith('#')) {
      const raw = hex.slice(1);
      if (raw.length === 6) {
        r = parseInt(raw.slice(0, 2), 16);
        g = parseInt(raw.slice(2, 4), 16);
        b = parseInt(raw.slice(4, 6), 16);
      }
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  let primaryColor = "#FFFFFF";
  let fuelColors = ["#FFFFFF", "#AAAAAA", "#666666", "#444444", "#222222"];
  let fillBgColor = "rgba(255,255,255,0.06)";

  const selectedSucursalId = dashboardSucursalFilter;
  if (selectedSucursalId !== "all") {
    const clr = getSucursalColor(selectedSucursalId);
    if (clr) {
      primaryColor = clr;
      fuelColors = [
        clr,
        adjustOpacity(clr, 0.8),
        adjustOpacity(clr, 0.6),
        adjustOpacity(clr, 0.4),
        adjustOpacity(clr, 0.2)
      ];
      fillBgColor = adjustOpacity(clr, 0.1);
    }
  }

  // Fuel
  const fuelData = {};
  lista.forEach((v) => {
    fuelData[v.combustible] = (fuelData[v.combustible] || 0) + v.cantidad;
  });
  const fuelLabels = Object.keys(fuelData);
  const fuelValues = Object.values(fuelData);

  if (charts.fuel) {
    charts.fuel.data.labels = fuelLabels;
    charts.fuel.data.datasets[0].data = fuelValues;
    charts.fuel.data.datasets[0].backgroundColor = fuelColors.slice(0, fuelLabels.length);
    charts.fuel.data.datasets[0].borderColor = doughnutBorderColor;
    charts.fuel.options.plugins.legend.labels.color = labelColor;
    charts.fuel.update();
  } else {
    const ctx = document.getElementById("chart-fuel").getContext("2d");
    charts.fuel = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: fuelLabels,
        datasets: [
          {
            data: fuelValues,
            backgroundColor: fuelColors.slice(0, fuelLabels.length),
            borderColor: doughnutBorderColor,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: labelColor, font: { size: 11 } } } },
      },
    });
  }

  // Brands
  const brandData = {};
  lista.forEach((v) => {
    brandData[v.marca] = (brandData[v.marca] || 0) + v.cantidad;
  });
  const sortedBrands = Object.entries(brandData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const brandLabels = sortedBrands.map(([name]) => name);
  const brandValues = sortedBrands.map(([, count]) => count);

  if (charts.brands) {
    charts.brands.data.labels = brandLabels;
    charts.brands.data.datasets[0].data = brandValues;
    charts.brands.data.datasets[0].backgroundColor = primaryColor;
    charts.brands.options.scales.y.ticks.color = tickColor;
    charts.brands.options.scales.y.grid.color = gridColor;
    charts.brands.options.scales.x.ticks.color = tickColor;
    charts.brands.options.scales.x.grid.color = gridColor;
    charts.brands.update();
  } else {
    const ctx = document.getElementById("chart-brands").getContext("2d");
    charts.brands = new Chart(ctx, {
      type: "bar",
      data: {
        labels: brandLabels,
        datasets: [
          {
            label: "Unidades",
            data: brandValues,
            backgroundColor: primaryColor,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: tickColor, stepSize: 1 }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor }, grid: { color: gridColor } },
        },
      },
    });
  }

  // Years
  const yearData = {};
  lista.forEach((v) => {
    const year = v.anio;
    yearData[year] = (yearData[year] || 0) + v.precio * v.cantidad;
  });
  const sortedYears = Object.keys(yearData).sort();
  const yearLabels = sortedYears;
  const yearValues = sortedYears.map((y) => yearData[y]);

  if (charts.years) {
    charts.years.data.labels = yearLabels;
    charts.years.data.datasets[0].data = yearValues;
    charts.years.data.datasets[0].borderColor = primaryColor;
    charts.years.data.datasets[0].backgroundColor = fillBgColor;
    charts.years.data.datasets[0].pointBackgroundColor = primaryColor;
    charts.years.options.plugins.legend.labels.color = labelColor;
    charts.years.options.scales.y.ticks.color = tickColor;
    charts.years.options.scales.y.grid.color = gridColor;
    charts.years.options.scales.x.ticks.color = tickColor;
    charts.years.options.scales.x.grid.color = gridColor;
    charts.years.update();
  } else {
    const ctx = document.getElementById("chart-years").getContext("2d");
    charts.years = new Chart(ctx, {
      type: "line",
      data: {
        labels: yearLabels,
        datasets: [
          {
            label: "Valor ($)",
            data: yearValues,
            borderColor: primaryColor,
            backgroundColor: fillBgColor,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: primaryColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: labelColor, font: { size: 11 } } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor }, grid: { color: gridColor } },
        },
      },
    });
  }
}

function resizeCharts() {
  Object.values(charts).forEach((chart) => {
    if (chart) chart.resize();
  });
}

// ─── DASHBOARD SUCURSAL FILTER ──────────────────
function initDashboardSucursalFilter() {
  const hiddenSelect = document.getElementById('dashboard-sucursal-select');
  const dropdown = document.getElementById('dashboard-sucursal-dropdown');
  if (!dropdown || !hiddenSelect) return;

  // Build options list from cache
  const optionsList = dropdown.querySelector('.custom-select-options');
  if (optionsList) {
    optionsList.innerHTML = '<li class="custom-select-option" data-value="all" role="option"><span>Todas las sucursales</span></li>';
    sucursalesCache.forEach(s => {
      const clr = getSucursalColor(s.id);
      const li = document.createElement('li');
      li.className = 'custom-select-option';
      li.dataset.value = String(s.id);
      li.dataset.color = clr;
      li.setAttribute('role', 'option');
      li.innerHTML = `<span class="branch-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${clr};flex-shrink:0;margin-right:8px"></span><span>${esc(s.nombre)}</span>`;
      optionsList.appendChild(li);
    });
  }

  // Build hidden select options
  hiddenSelect.innerHTML = '<option value="all">Todas las sucursales</option>';
  sucursalesCache.forEach(s => {
    hiddenSelect.innerHTML += `<option value="${s.id}">${esc(s.nombre)}</option>`;
  });

  // Init the custom dropdown component
  dropdowns.dashboardSucursal = initCustomSelect(dropdown, hiddenSelect);

  // Listen for changes
  hiddenSelect.addEventListener('change', () => {
    dashboardSucursalFilter = hiddenSelect.value || 'all';
    cargarDashboard();
  });
}



// ─── VISTA Y FILTROS ────────────────────────────
function setView(view) {
  currentView = view;
  document
    .getElementById("view-table")
    ?.classList.toggle("active", view === "table");
  document
    .getElementById("view-cards")
    ?.classList.toggle("active", view === "cards");
  aplicarFiltrosYVista();
}

function filterByFuel(fuel) {
  currentFilter = fuel;
  document.querySelectorAll("#filter-group-combustible .filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === fuel);
  });
  aplicarFiltrosYVista();
}

function filterByTransmision(trans) {
  currentTransmisionFilter = trans;
  document.querySelectorAll("#filter-group-transmision .filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === trans);
  });
  aplicarFiltrosYVista();
}

function filterByYear() {
  yearFrom = document.getElementById("year-from-select")?.value || "";
  yearTo = document.getElementById("year-to-select")?.value || "";
  aplicarFiltrosYVista();
}

async function aplicarFiltrosYVista() {
  const searchInput = document.getElementById("search-input");
  const q = searchInput ? searchInput.value.trim().toLowerCase() : "";
  try {
    if (vehiculosCache.length === 0) {
      const res = await fetch(API + (isGuest() ? "?limit=6" : ""));
      vehiculosCache = await res.json();
    }
    let lista = vehiculosCache;

    if (q) {
      lista = lista.filter(
        (v) =>
          (v.codigo || "").toLowerCase().includes(q) ||
          (v.marca || "").toLowerCase().includes(q) ||
          (v.modelo || "").toLowerCase().includes(q) ||
          (v.color || "").toLowerCase().includes(q) ||
          (v.combustible || "").toLowerCase().includes(q) ||
          String(v.anio || "").includes(q),
      );
    }

    if (currentFilter !== "all") {
      lista = lista.filter((v) => v.combustible === currentFilter);
    }

    if (currentTransmisionFilter !== "all") {
      lista = lista.filter((v) => v.transmision === currentTransmisionFilter);
    }

    if (yearFrom) {
      lista = lista.filter((v) => String(v.anio) >= yearFrom);
    }
    if (yearTo) {
      lista = lista.filter((v) => String(v.anio) <= yearTo);
    }

    if (condicionFilter && condicionFilter !== "all") {
      lista = lista.filter((v) => v.condicion === condicionFilter);
    }

    if (sucursalFilter && sucursalFilter !== "all") {
      lista = lista.filter(
        (v) => String(v.sucursal_id) === String(sucursalFilter),
      );
    }

    if (currentView === "table") {
      renderTabla(lista);
    } else {
      renderCards(lista);
    }
    updateStats(lista);
  } catch (err) {
    showToast("Error al filtrar.", "error");
  }
}

async function filtrarVehiculos() {
  await aplicarFiltrosYVista();
}

// ─── FILTER PANEL TOGGLE ─────────────────────────
function toggleFilterPanel() {
  const drawer = document.getElementById("filter-drawer");
  const btn = document.getElementById("btn-toggle-filters");
  if (!drawer) return;
  drawer.classList.toggle("is-open");
  if (btn) btn.classList.toggle("is-active");
}

// ─── CRUD ────────────────────────────────────────
async function cargarVehiculos() {
  try {
    const esInvitado = isGuest();
    const res = await fetch(API + (esInvitado ? "?limit=6" : ""));
    vehiculosCache = await res.json();
    renderTabla(vehiculosCache);
    const notice = document.getElementById("guest-notice-inventario");
    if (notice) notice.style.display = esInvitado ? "flex" : "none";
    const dashboard = document.getElementById("dashboard");
    if (dashboard && dashboard.classList.contains("active-section")) cargarDashboard();
  } catch (err) {
    showToast("Error al cargar vehículos.", "error");
  }
}

async function guardarDatos() {
  if (isGuest()) {
    showToast("Inicia sesión para modificar el inventario.", "error");
    return;
  }

  clearErrors();

  const codigo = document.getElementById("codigo").value.trim().toUpperCase();
  const marca = document.getElementById("marca").value.trim();
  const modelo = document.getElementById("modelo").value.trim();
  const anio = document.getElementById("anio").value.trim();
  const color = document.getElementById("color").value.trim();
  const combustible = document.getElementById("combustible").value;
  const transmision = document.getElementById("transmision").value;
  const condicion = document.getElementById("condicion").value;
  const sucursal_id = document.getElementById("sucursal_id").value;
  const imagenInput = document.getElementById("imagen");
  const imagenFile = imagenInput && imagenInput.files && imagenInput.files[0];
  const precio = document.getElementById("precio").value.trim();
  const cantidad = document.getElementById("cantidad").value.trim();
  const descripcion = document.getElementById("descripcion").value.trim();
  const lang = getLang();

  let valid = true;

  if (!codigo) {
    setError("codigo", errDict[lang].req);
    valid = false;
  }
  if (!marca) {
    setError("marca", errDict[lang].req);
    valid = false;
  }
  if (!modelo) {
    setError("modelo", errDict[lang].req);
    valid = false;
  }
  if (!anio) {
    setError("anio", errDict[lang].req);
    valid = false;
  } else {
    const y = parseInt(anio, 10);
    if (isNaN(y) || y < 1990 || y > 2026) {
      setError("anio", errDict[lang].anio);
      valid = false;
    }
  }
  if (!color) {
    setError("color", errDict[lang].req);
    valid = false;
  }
  if (!combustible) {
    setError("combustible", "Selecciona un tipo");
    valid = false;
  }
  if (!transmision) {
    setError("transmision", "Selecciona un tipo");
    valid = false;
  }
  if (!condicion) {
    setError("condicion", "Selecciona una opción");
    valid = false;
  }
  if (!precio) {
    setError("precio", errDict[lang].req);
    valid = false;
  } else {
    const p = parseFloat(precio);
    if (isNaN(p) || p <= 0) {
      setError("precio", errDict[lang].precio);
      valid = false;
    }
  }
  if (!cantidad) {
    setError("cantidad", errDict[lang].req);
    valid = false;
  } else {
    const c = parseInt(cantidad, 10);
    if (isNaN(c) || c < 1) {
      setError("cantidad", errDict[lang].cant);
      valid = false;
    }
  }
  if (!descripcion) {
    setError("descripcion", errDict[lang].req);
    valid = false;
  }

  if (!valid) {
    if (!validarPaso1()) {
      goToStep(1);
    }
    return;
  }

  const formData = new FormData();
  formData.append("codigo", codigo);
  formData.append("marca", marca);
  formData.append("modelo", modelo);
  formData.append("anio", anio);
  formData.append("color", color);
  formData.append("combustible", combustible);
  formData.append("transmision", transmision);
  formData.append("condicion", condicion);
  formData.append("precio", precio);
  formData.append("cantidad", cantidad);
  formData.append("descripcion", descripcion);
  if (sucursal_id) formData.append("sucursal_id", sucursal_id);
  if (imagenFile) formData.append("imagen", imagenFile);

  try {
    if (editingId === null) {
      const resCheck = await fetch(API);
      const todos = await resCheck.json();
      const duplicado = todos.some((v) => v.codigo === codigo);
      if (duplicado) {
        setError("codigo", errDict[lang].codigo);
        return;
      }

      await fetch(API, {
        method: "POST",
        headers: authHeadersMultipart(),
        body: formData,
      });

      resetForm();
      showToast("Vehículo registrado correctamente.", "success");
      await cargarVehiculos();
    } else {
      const resCheck = await fetch(API);
      const todos = await resCheck.json();
      const duplicado = todos.some(
        (v) => v.codigo === codigo && v.id !== editingId,
      );
      if (duplicado) {
        setError("codigo", errDict[lang].codigo);
        return;
      }

      await fetch(`${API}/${editingId}`, {
        method: "PUT",
        headers: authHeadersMultipart(),
        body: formData,
      });

      cancelarEdicion();
      showToast("Vehículo actualizado.", "success");
      navigateTo("inventario");
    }
  } catch (err) {
    showToast("Error al conectar con el servidor.", "error");
  }
}

async function eliminarDatos(id) {
  if (isGuest()) {
    showToast("Inicia sesión para modificar el inventario.", "error");
    return;
  }

  try {
    const res = await fetch(API);
    const todos = await res.json();
    const v = todos.find((x) => x.id === id);

    await fetch(`${API}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    showToast(
      `${v ? v.marca + " " + v.modelo : "Vehículo"} eliminado.`,
      "delete",
    );
    if (editingId === id) cancelarEdicion();
    await cargarVehiculos();
    const dashboardEl = document.getElementById("dashboard");
    if (dashboardEl && dashboardEl.classList.contains("active-section")) cargarDashboard();
  } catch (err) {
    showToast("Error al eliminar el vehículo.", "error");
  }
}

async function editarDatos(id) {
  if (isGuest()) {
    showToast("Inicia sesión para modificar el inventario.", "error");
    return;
  }

  try {
    const res = await fetch(API);
    const todos = await res.json();
    const v = todos.find((x) => x.id === id);
    if (!v) return;

    sessionStorage.setItem("editVehicle", JSON.stringify(v));
    navigateTo("registro");
  } catch (err) {
    showToast("Error al conectar con el servidor.", "error");
  }
}

function cancelarEdicion() {
  editingId = null;
  resetForm();
  const btnSubmitText = document.querySelector("#btn-submit .btn-text");
  if (btnSubmitText) btnSubmitText.textContent = "Registrar Vehículo";
  const btnCancel = document.getElementById("btn-cancel");
  if (btnCancel) btnCancel.style.display = "none";
}

function resetForm() {
  [
    "marca",
    "modelo",
    "anio",
    "color",
    "precio",
    "cantidad",
    "descripcion",
  ].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("combustible").value = "";
  document.getElementById("transmision").value = "";
  document.getElementById("condicion").value = "";
  document.getElementById("sucursal_id").value = "";
  const imagenInput = document.getElementById("imagen");
  if (imagenInput) imagenInput.value = "";
  clearImagePreview();
  const priceHelper = document.getElementById("price-helper");
  if (priceHelper) priceHelper.textContent = "";
  syncColorSwatches();
  syncFuelDisplay();
  if (dropdowns.transmision) dropdowns.transmision.syncDisplay();
  if (dropdowns.condicion) dropdowns.condicion.syncDisplay();
  if (dropdowns.sucursalRegistro) dropdowns.sucursalRegistro.syncDisplay();
  document.getElementById("descripcion").style.height = "auto";
  clearErrors();
  if (editingId === null) autoGenerarCodigo();
  goToStep(1);
}

async function autoGenerarCodigo() {
  try {
    const res = await fetch(API);
    const vehiculos = await res.json();
    let maxNum = 0;
    let prefix = "AM";
    vehiculos.forEach((v) => {
      const m = v.codigo.match(/^([A-Za-z]+)(\d+)$/);
      if (m) {
        prefix = m[1].toUpperCase();
        const n = parseInt(m[2], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const next = maxNum + 1;
    const padded = String(next).padStart(Math.max(2, String(next).length), "0");
    document.getElementById("codigo").value = prefix + padded;
  } catch {
    document.getElementById("codigo").value = "";
  }
}

// ─── SUCURSAL COLORS ──────────────────────────
const sucursalColors = {};

function getSucursalColor(sucursalId) {
  if (sucursalId) {
    const suc = sucursalesCache.find(s => String(s.id) === String(sucursalId));
    if (suc && suc.color) {
      sucursalColors[sucursalId] = suc.color;
      return suc.color;
    }
  }
  if (!sucursalColors[sucursalId]) {
    const colors = ["#4A90E2", "#FF9F0A", "#4CAF50", "#FF3B30", "#9B59B6", "#1ABC9C", "#E74C3C", "#3498DB"];
    const idx = Object.keys(sucursalColors).length % colors.length;
    sucursalColors[sucursalId] = colors[idx];
  }
  return sucursalColors[sucursalId];
}

function getSucursalColorClass(sucursalId) {
  const colorMap = {};
  sucursalesCache.forEach((s, i) => {
    const classes = ["suc-clr-1", "suc-clr-2", "suc-clr-3", "suc-clr-4"];
    colorMap[s.id] = classes[i % classes.length];
  });
  return colorMap[sucursalId] || "";
}

// ─── ICONOS POR TIPO (combustible / transmisión / condición) ──
const iconCombustible = {
  Gasolina: "fuel",
  Diésel: "droplet",
  Eléctrico: "zap",
  Híbrido: "refresh-cw",
  GLP: "flame",
};
const iconTransmision = { Automática: "cog", Manual: "hand", CVT: "infinity" };
function iconoCondicion(cond) {
  return cond === "Nuevo" ? "sparkles" : "recycle";
}

// ─── RENDER TABLE ──────────────────────────────
function renderTabla(lista) {
  const tbody = document.getElementById("tabla-body");
  const emptyState = document.getElementById("empty-state");
  const tableWrapper = document.getElementById("table-wrapper");
  const cardsWrapper = document.getElementById("cards-wrapper");
  const countEl = document.getElementById("vehiculos-count");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (lista.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    if (tableWrapper) tableWrapper.style.display = "none";
    if (cardsWrapper) cardsWrapper.style.display = "none";
    if (countEl) countEl.textContent = "0 vehículos";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (tableWrapper) tableWrapper.style.display = "block";
  if (cardsWrapper) cardsWrapper.style.display = "none";
  if (countEl) countEl.textContent = lista.length + " vehículos";

  lista.forEach((v) => {
    const tr = document.createElement("tr");
    const sucClr = v.sucursal_id ? getSucursalColor(v.sucursal_id) : null;
    if (sucClr) tr.style.borderLeft = `3px solid ${sucClr}`;
    const acciones = `<div class="actions-cell">
                 <button class="btn-icon" title="Generar PDF" onclick="generarPDFVehiculo(${v.id})"><i data-lucide="file-down"></i></button>
                 ${
                   isGuest()
                     ? ""
                     : `<button class="btn-icon" title="Editar" onclick="editarDatos(${v.id})"><i data-lucide="pencil"></i></button>
                 <button class="btn-icon btn-icon--delete" title="Eliminar" onclick="confirmarEliminar(${v.id})"><i data-lucide="trash-2"></i></button>`
                 }
               </div>`;

    const imgHtml = v.imagen
      ? `<img src="http://localhost:3000${v.imagen}" alt="${esc(v.marca)} ${esc(v.modelo)}" class="tbl-thumb" />`
      : `<span class="tbl-thumb tbl-thumb--empty"><i data-lucide="image-off"></i></span>`;
    const condBadge = v.condicion
      ? `<span class="badge-condicion badge-condicion--${v.condicion === "Nuevo" ? "nuevo" : "usado"}"><i data-lucide="${iconoCondicion(v.condicion)}"></i>${esc(v.condicion)}</span>`
      : "";

    tr.innerHTML = `
            <td>${imgHtml}</td>
            <td class="tbl-code">${esc(v.codigo)}</td>
            <td class="tbl-marca">${esc(v.marca)}</td>
            <td>${esc(v.modelo)}</td>
            <td class="tbl-muted">${esc(String(v.anio))}</td>
            <td class="tbl-muted">${esc(v.color)}</td>
            <td class="tbl-muted">${esc(v.combustible)}</td>
            <td class="tbl-muted">${esc(v.transmision || "—")}</td>
            <td>${condBadge}</td>
            <td class="tbl-muted"><span class="suc-name-with-dot"${sucClr ? ` style="--suc-dot:${sucClr}"` : ""}>${esc(v.sucursal_nombre || "—")}</span></td>
            <td class="tbl-price">$${formatNum(v.precio)}</td>
            <td><span class="tbl-cantidad">${esc(String(v.cantidad))}</span></td>
            <td>${acciones}</td>
        `;
    tbody.appendChild(tr);
  });
  if (window.lucide) lucide.createIcons();
}

// ─── RENDER CARDS ──────────────────────────────
function renderCards(lista) {
  const wrapper = document.getElementById("cards-wrapper");
  const emptyState = document.getElementById("empty-state");
  const tableWrapper = document.getElementById("table-wrapper");
  const countEl = document.getElementById("vehiculos-count");

  if (!wrapper || !emptyState || !tableWrapper) return;

  wrapper.innerHTML = "";
  if (lista.length === 0) {
    emptyState.style.display = "block";
    tableWrapper.style.display = "none";
    wrapper.style.display = "none";
    if (countEl) countEl.textContent = "0 vehículos";
    return;
  }

  emptyState.style.display = "none";
  tableWrapper.style.display = "none";
  wrapper.style.display = "grid";
  if (countEl) countEl.textContent = lista.length + " vehículos";

  lista.forEach((v) => {
    const card = document.createElement("div");
    card.className = "vehicle-card";
    const sucClr = v.sucursal_id ? getSucursalColor(v.sucursal_id) : null;
    if (sucClr) card.style.borderTop = `3px solid ${sucClr}`;
    const imageContent = v.imagen
      ? `<img src="http://localhost:3000${v.imagen}" alt="${esc(v.marca)} ${esc(v.modelo)}" />`
      : `<div class="card-image-placeholder"><i data-lucide="image-off"></i></div>`;
    const condBadge = v.condicion
      ? `<span class="badge-condicion badge-condicion--${v.condicion === "Nuevo" ? "nuevo" : "usado"}"><i data-lucide="${iconoCondicion(v.condicion)}"></i>${esc(v.condicion)}</span>`
      : "<span></span>";

    const brandInitials = (v.marca || "XX").slice(0, 2).toUpperCase();

    card.innerHTML = `
            <div class="card-image">
                ${imageContent}
                <div class="card-image-overlay">
                    ${condBadge}
                    <span class="card-code-chip">${esc(v.codigo)}</span>
                </div>
            </div>
            <div class="card-body">
                <div class="card-title-row">
                    <div class="card-brand-badge">${esc(brandInitials)}</div>
                    <h3 class="card-title">${esc(v.marca)} ${esc(v.modelo)}</h3>
                </div>
                <div class="card-meta">
                    <span>${esc(String(v.anio))}</span>
                    <span class="meta-dot">•</span>
                    <span>${esc(v.combustible)}</span>
                    <span class="meta-dot">•</span>
                    <span>${esc(v.transmision || "—")}</span>
                </div>
                <p class="card-sub"><span class="suc-name-with-dot"${sucClr ? ` style="--suc-dot:${sucClr}"` : ""}>${esc(v.sucursal_nombre || "Sin sucursal")}</span></p>
                <div class="card-footer">
                    <p class="card-price">$${formatNum(v.precio)}</p>
                    <span class="tbl-cantidad">${esc(String(v.cantidad))} und.</span>
                </div>
                <div class="card-actions">
                    <button class="btn-icon" title="Generar PDF" onclick="generarPDFVehiculo(${v.id})"><i data-lucide="file-down"></i></button>
                    ${
                      isGuest()
                        ? `<span class="badge-guest">Solo lectura</span>`
                        : `<button class="btn-icon" title="Editar" onclick="editarDatos(${v.id})"><i data-lucide="pencil"></i></button>
                     <button class="btn-icon btn-icon--delete" title="Eliminar" onclick="confirmarEliminar(${v.id})"><i data-lucide="trash-2"></i></button>`
                    }
                </div>
            </div>
        `;
    wrapper.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

// ─── CONFIRM DELETE ─────────────────────────────
async function confirmarEliminar(id) {
  try {
    const res = await fetch(API);
    const todos = await res.json();
    const v = todos.find((x) => x.id === id);
    if (!v) return;
    showConfirmToast(`¿Eliminar ${v.marca} ${v.modelo}?`, () =>
      eliminarDatos(id),
    );
  } catch (err) {
    showToast("Error al conectar con el servidor.", "error");
  }
}

// ─── STATS ──────────────────────────────────────
function updateStats(lista) {
  const total = lista.length;
  const marcas = new Set(lista.map((v) => (v.marca || "").toLowerCase())).size;
  const valor = lista.reduce((acc, v) => acc + (v.precio || 0) * (v.cantidad || 0), 0);
  const combustibles = new Set(lista.map((v) => v.combustible || "")).size;

  const elTotal = document.getElementById("stat-total");
  const elMarcas = document.getElementById("stat-marcas");
  const elValor = document.getElementById("stat-valor");
  const elComb = document.getElementById("stat-combustibles");
  if (elTotal) elTotal.textContent = total;
  if (elMarcas) elMarcas.textContent = marcas;
  if (elValor) elValor.textContent = "$" + formatNum(valor);
  if (elComb) elComb.textContent = combustibles;
}

// ─── COLOR SWATCHES ────────────────────────────
let colorSwatchesInitialized = false;

function initColorSwatches() {
  const trigger = document.getElementById("color-trigger");
  const colorInput = document.getElementById("color");
  if (!trigger || !colorInput) return;
  const swatches = document.querySelectorAll("#color-swatches .swatch-btn");
  const field = trigger.closest(".color-field-wrapper");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".custom-select.is-open").forEach((w) => {
      w.classList.remove("is-open");
      w.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", "false");
    });
    field.classList.toggle("is-open");
  });

  if (!colorSwatchesInitialized) {
    colorSwatchesInitialized = true;
    document.addEventListener("click", (e) => {
      const f = document.getElementById("color-trigger")?.closest(".color-field-wrapper");
      if (f && !f.contains(e.target)) f.classList.remove("is-open");
    });
  }

  function updateColorPreview(val) {
    const preview = document.getElementById("color-preview");
    const icon = trigger ? trigger.querySelector("i, svg") : null;
    if (!preview) return;
    if (val) {
      const colorMap = { "Negro": "#0a0a0a", "Blanco": "#f5f5f5", "Gris": "#8a8a8a", "Plata": "#c0c0c0", "Rojo": "#c0392b", "Azul": "#2e5fa3", "Verde": "#2e7d4f", "Amarillo": "#e0c12e", "Naranja": "#d9772f", "Café": "#6b4423", "Dorado": "#c9a13b" };
      const hex = colorMap[val] || val;
      preview.style.background = hex;
      preview.style.borderColor = hex;
      preview.style.display = "inline-block";
      if (icon) icon.style.display = "none";
    } else {
      preview.style.background = "transparent";
      preview.style.borderColor = "rgba(255,255,255,0.2)";
      preview.style.display = "none";
      if (icon) icon.style.display = "inline-block";
    }
  }

  swatches.forEach((btn) => {
    btn.addEventListener("click", () => {
      const isActive = btn.classList.contains("is-active");
      swatches.forEach((b) => b.classList.remove("is-active"));
      if (isActive) {
        colorInput.value = "";
        updateColorPreview("");
      } else {
        btn.classList.add("is-active");
        colorInput.value = btn.dataset.color;
        updateColorPreview(btn.dataset.color);
      }
      field.classList.remove("is-open");
    });
  });

  colorInput.addEventListener("input", () => {
    const val = colorInput.value.trim();
    swatches.forEach((b) =>
      b.classList.toggle("is-active", b.dataset.color === val),
    );
    updateColorPreview(val);
  });
}

function syncColorSwatches() {
  const val = document.getElementById("color").value.trim();
  document.querySelectorAll("#color-swatches .swatch-btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.color === val);
  });
  const preview = document.getElementById("color-preview");
  const trigger = document.getElementById("color-trigger");
  const icon = trigger ? trigger.querySelector("i, svg") : null;
  if (preview) {
    if (val) {
      const colorMap = { "Negro": "#0a0a0a", "Blanco": "#f5f5f5", "Gris": "#8a8a8a", "Plata": "#c0c0c0", "Rojo": "#c0392b", "Azul": "#2e5fa3", "Verde": "#2e7d4f", "Amarillo": "#e0c12e", "Naranja": "#d9772f", "Café": "#6b4423", "Dorado": "#c9a13b" };
      const hex = colorMap[val] || val;
      preview.style.background = hex;
      preview.style.borderColor = hex;
      preview.style.display = "inline-block";
      if (icon) icon.style.display = "none";
    } else {
      preview.style.background = "transparent";
      preview.style.borderColor = "rgba(255,255,255,0.2)";
      preview.style.display = "none";
      if (icon) icon.style.display = "inline-block";
    }
  }
}

// ─── DROPDOWNS CUSTOM (genérico: combustible, transmisión, condición, sucursal) ──
const dropdowns = {};

function initCustomSelect(wrapper, hiddenSelect) {
  if (!wrapper || !hiddenSelect) return null;
  const trigger = wrapper.querySelector(".custom-select-trigger");
  const valueEl = wrapper.querySelector(".custom-select-value");
  const iconEl = wrapper.querySelector(".custom-select-icon");
  const optionsList = wrapper.querySelector(".custom-select-options");
  if (!valueEl.dataset.i18nDefault)
    valueEl.dataset.i18nDefault = valueEl.textContent;

  function selectOption(li, silent) {
    const value = li ? li.dataset.value : "";
    hiddenSelect.value = value;
    optionsList
      .querySelectorAll(".custom-select-option")
      .forEach((o) => o.classList.remove("is-active"));
    if (li) li.classList.add("is-active");
    if (iconEl) {
      iconEl.className = "custom-select-icon";
      iconEl.innerHTML = "";
    }
    if (value && li) {
      wrapper.classList.add("has-value");
      const spans = li.querySelectorAll("span");
      const labelSpan = spans.length > 1 ? spans[spans.length - 1] : spans[0];
      valueEl.textContent = labelSpan
        ? labelSpan.textContent.trim()
        : li.textContent.trim();
      if (iconEl && li.dataset.color) {
        iconEl.classList.add("has-icon");
        const dot = document.createElement("span");
        dot.className = "branch-dot";
        dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${li.dataset.color};flex-shrink:0;`;
        iconEl.appendChild(dot);
      } else if (iconEl && li.dataset.icon) {
        iconEl.classList.add("has-icon");
        const i = document.createElement("i");
        i.setAttribute("data-lucide", li.dataset.icon);
        iconEl.appendChild(i);
        if (window.lucide) window.lucide.createIcons();
      }
    } else {
      wrapper.classList.remove("has-value");
      valueEl.textContent = valueEl.dataset.i18nDefault;
    }
    if (!silent) {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      hiddenSelect.dispatchEvent(new Event("change"));
    }
  }

  function wireOptions() {
    optionsList.querySelectorAll(".custom-select-option").forEach((li) => {
      li.onclick = () => selectOption(li, false);
    });
  }
  wireOptions();

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".color-field-wrapper.is-open").forEach((f) => {
      f.classList.remove("is-open");
    });
    document.querySelectorAll(".custom-select.is-open").forEach((w) => {
      if (w !== wrapper) w.classList.remove("is-open");
    });
    const willOpen = !wrapper.classList.contains("is-open");
    wrapper.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  const api = {
    wrapper,
    syncDisplay() {
      const val = hiddenSelect.value;
      if (!val) {
        selectOption(null, true);
        return;
      }
      const li = optionsList.querySelector(
        `.custom-select-option[data-value="${val.replace(/"/g, "")}"]`,
      );
      selectOption(li, true);
    },
    // Reconstruye las opciones dinámicamente (usado para sucursales, que vienen del backend)
    setItems(items, placeholderText) {
      optionsList.innerHTML = "";
      hiddenSelect.innerHTML = "";
      const placeholderOpt = document.createElement("option");
      placeholderOpt.value = "";
      placeholderOpt.textContent =
        placeholderText || valueEl.dataset.i18nDefault;
      hiddenSelect.appendChild(placeholderOpt);

      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "custom-select-option";
        li.setAttribute("role", "option");
        li.dataset.value = item.value;
        if (item.icon) li.dataset.icon = item.icon;
        if (item.color) li.dataset.color = item.color;
        let iconHtml = "";
        if (item.color) {
          iconHtml = `<span class="branch-dot" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${item.color};flex-shrink:0;"></span>`;
        } else if (item.icon) {
          iconHtml = `<i data-lucide="${item.icon}"></i>`;
        }
        li.innerHTML = `${iconHtml}<span>${esc(item.label)}</span>`;
        optionsList.appendChild(li);

        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.label;
        hiddenSelect.appendChild(opt);
      });
      wireOptions();
      if (window.lucide) lucide.createIcons();
    },
  };
  wrapper._dropdownApi = api;
  return api;
}

function initAllDropdowns() {
  dropdowns.combustible = initCustomSelect(
    document.getElementById("fuel-select"),
    document.getElementById("combustible"),
  );
  dropdowns.transmision = initCustomSelect(
    document.getElementById("transmision-dropdown"),
    document.getElementById("transmision"),
  );
  dropdowns.condicion = initCustomSelect(
    document.getElementById("condicion-dropdown"),
    document.getElementById("condicion"),
  );
  dropdowns.sucursalRegistro = initCustomSelect(
    document.getElementById("sucursal-dropdown"),
    document.getElementById("sucursal_id"),
  );
  dropdowns.sucursalFiltro = initCustomSelect(
    document.getElementById("sucursal-filter-dropdown"),
    document.getElementById("sucursal-filter-select"),
  );
  dropdowns.sucursalPerfil = initCustomSelect(
    document.getElementById("perfil-sucursal-dropdown"),
    document.getElementById("perfil-sucursal"),
  );
  dropdowns.encargadoRegistro = initCustomSelect(
    document.getElementById("encargado-dropdown"),
    document.getElementById("suc-encargado"),
  );
}

function syncFuelDisplay() {
  if (dropdowns.combustible) dropdowns.combustible.syncDisplay();
}

// ─── STEPPERS ──────────────────────────────────
function initQtyStepper() {
  const input = document.getElementById("cantidad");
  const minus = document.getElementById("qty-minus");
  const plus = document.getElementById("qty-plus");
  if (!input || !minus || !plus) return;
  const min = parseInt(input.min, 10) || 1;
  const max = parseInt(input.max, 10);

  minus.addEventListener("click", () => {
    let val = parseInt(input.value, 10);
    let next;
    if (isNaN(val)) {
      next = parseInt(input.placeholder, 10) || 1;
    } else {
      next = val - 1;
    }
    next = Math.max(min, next);
    if (!isNaN(max)) next = Math.min(max, next);
    input.value = next;
    input.dispatchEvent(new Event("change"));
  });

  plus.addEventListener("click", () => {
    let val = parseInt(input.value, 10);
    let next;
    if (isNaN(val)) {
      next = parseInt(input.placeholder, 10) || 1;
    } else {
      next = val + 1;
    }
    next = Math.max(min, next);
    if (!isNaN(max)) next = Math.min(max, next);
    input.value = next;
    input.dispatchEvent(new Event("change"));
  });
}

function initAnioStepper() {
  const input = document.getElementById("anio");
  const minus = document.getElementById("anio-minus");
  const plus = document.getElementById("anio-plus");
  if (!input || !minus || !plus) return;
  const min = parseInt(input.min, 10);
  const max = parseInt(input.max, 10);
  const currentYear = new Date().getFullYear();

  minus.addEventListener("click", () => {
    let val = parseInt(input.value, 10);
    let next;
    if (isNaN(val)) {
      next = parseInt(input.placeholder, 10) || currentYear;
    } else {
      next = val - 1;
    }
    if (!isNaN(min)) next = Math.max(min, next);
    if (!isNaN(max)) next = Math.min(max, next);
    input.value = next;
    input.dispatchEvent(new Event("change"));
  });

  plus.addEventListener("click", () => {
    let val = parseInt(input.value, 10);
    let next;
    if (isNaN(val)) {
      next = parseInt(input.placeholder, 10) || currentYear;
    } else {
      next = val + 1;
    }
    if (!isNaN(min)) next = Math.max(min, next);
    if (!isNaN(max)) next = Math.min(max, next);
    input.value = next;
    input.dispatchEvent(new Event("change"));
  });
}

function initAutoGrowTextarea() {
  const textarea = document.getElementById("descripcion");
  if (!textarea) return;
  function resize() {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }
  textarea.addEventListener("input", resize);
  resize();
}

// ─── ERROR HELPERS ─────────────────────────────
function setError(fieldId, msg) {
  const fg = document.getElementById("fg-" + fieldId);
  const err = document.getElementById("err-" + fieldId);
  if (fg) fg.classList.add("has-error");
  if (err) err.textContent = msg;
}

function clearErrors() {
  document
    .querySelectorAll(".has-error")
    .forEach((el) => el.classList.remove("has-error"));
  document
    .querySelectorAll(".field-error")
    .forEach((el) => (el.textContent = ""));
}

// ─── TOAST SYSTEM ──────────────────────────────
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  const icons = {
    success: "check-circle",
    error: "alert-circle",
    warning: "alert-triangle",
    info: "info",
    delete: "trash-2",
  };
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast-icon"><i data-lucide="${icons[type] || "info"}"></i></span><span>${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => toast.classList.add("show")),
  );
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function showConfirmToast(message, onConfirm) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast toast--confirm";
  toast.innerHTML = `
    <div class="toast-confirm-body">
      <span class="toast-icon"><i data-lucide="alert-triangle"></i></span>
      <span>${message}</span>
    </div>
    <div class="toast-confirm-actions">
      <button onclick="this.closest('.toast').dataset.confirmed='yes'" class="toast-confirm-btn toast-confirm-btn--yes">Confirmar</button>
      <button onclick="this.closest('.toast').dataset.confirmed='no'" class="toast-confirm-btn toast-confirm-btn--no">Cancelar</button>
    </div>
  `;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => toast.classList.add("show")),
  );

  const check = setInterval(() => {
    if (toast.dataset.confirmed === "yes") {
      clearInterval(check);
      dismiss();
      onConfirm();
    } else if (toast.dataset.confirmed === "no") {
      clearInterval(check);
      dismiss();
    }
  }, 100);

  function dismiss() {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }
}

// ─── UTILITIES ──────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNum(n) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem("amUsuario"));
  } catch {
    return null;
  }
}

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

// No fijamos Content-Type: el navegador debe generar el boundary de multipart/form-data
function authHeadersMultipart() {
  const token = getToken();
  return {
    Authorization: token ? `Bearer ${token}` : "",
  };
}

// ─── SUCURSAL ACTUAL (toolbar Inventario) ─────
// Empleado: se preselecciona su sucursal asignada. Invitado: recuerda su elección en localStorage.
function initSucursalToolbarFilter() {
  const dropdown = dropdowns.sucursalFiltro;
  const hidden = document.getElementById("sucursal-filter-select");
  if (!dropdown || !hidden) return;

  const items = [
    { value: "all", label: "Todas las sucursales", icon: "layout-grid" },
  ].concat(
    sucursalesCache.map((s) => ({
      value: String(s.id),
      label: `${s.nombre} (${s.ciudad})`,
      color: getSucursalColor(s.id),
    })),
  );
  dropdown.setItems(items, "Todas las sucursales");

  const usuario = getUsuario();
  if (!isGuest() && usuario && usuario.sucursal_id) {
    // Only employees get auto-selected branch; admins/managers see all
    if (usuario.rol === "empleado") {
      sucursalFilter = String(usuario.sucursal_id);
    } else {
      sucursalFilter = "all";
    }
  } else if (isGuest()) {
    sucursalFilter = localStorage.getItem("amSucursalActual") || "all";
  } else {
    sucursalFilter = "all";
  }
  hidden.value = sucursalFilter;
  dropdown.syncDisplay();
}

function initDashboardSucursalFilter() {
  const dropdown = document.getElementById("dashboard-sucursal-dropdown");
  const hidden = document.getElementById("dashboard-sucursal-select");
  if (!dropdown || !hidden) return;

  const ds = initCustomSelect(dropdown, hidden);
  ds.setItems(
    [{ value: "all", label: "Todas las sucursales", icon: "layout-grid" },
    ...sucursalesCache.map(s => ({
      value: String(s.id),
      label: `${s.nombre} (${s.ciudad})`,
      color: getSucursalColor(s.id),
    }))],
    "Todas las sucursales"
  );

  const usuario = getUsuario();
  if (!isGuest() && usuario && usuario.rol === "empleado" && usuario.sucursal_id) {
    dashboardSucursalFilter = String(usuario.sucursal_id);
    hidden.value = String(usuario.sucursal_id);
  } else {
    dashboardSucursalFilter = "all";
    hidden.value = "all";
  }
  ds.syncDisplay();

  hidden.addEventListener("change", () => {
    dashboardSucursalFilter = hidden.value;
    cargarDashboard();
  });
}

function onCambiarSucursalFiltro() {
  const select = document.getElementById("sucursal-filter-select");
  if (!select) return;
  sucursalFilter = select.value;
  if (isGuest()) {
    localStorage.setItem("amSucursalActual", sucursalFilter);
  }
  aplicarFiltrosYVista();
}

// ─── SUCURSALES ─────────────────────────────────
async function cargarSucursales() {
  try {
    const res = await fetch(API_SUC);
    sucursalesCache = await res.json();
    renderSucursales(sucursalesCache);
  } catch (err) {
    showToast("Error al cargar sucursales.", "error");
  }
}

function setSucursalesView(view) {
  sucursalesView = view;
  document.getElementById("view-table-suc")?.classList.toggle("active", view === "table");
  document.getElementById("view-cards-suc")?.classList.toggle("active", view === "cards");
  renderSucursales(
    sucursalesCache.filter(s => {
      const term = (document.getElementById("search-sucursales")?.value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!term) return true;
      const haystack = (s.nombre + " " + s.ciudad + " " + s.direccion + " " + s.telefono + " " + s.encargado).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return haystack.includes(term);
    })
  );
}

function filtrarSucursales() {
  const term = (document.getElementById("search-sucursales")?.value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = sucursalesCache.filter(s => {
    if (!term) return true;
    const haystack = (s.nombre + " " + s.ciudad + " " + s.direccion + " " + s.telefono + " " + s.encargado).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return haystack.includes(term);
  });
  renderSucursales(filtered);
}

function renderSucursales(lista) {
  const tableWrapper = document.getElementById("sucursales-table-wrapper");
  const grid = document.getElementById("sucursales-grid");
  const empty = document.getElementById("sucursales-empty");
  if (!grid) return;

  if (lista.length === 0) {
    empty.style.display = "block";
    if (tableWrapper) tableWrapper.style.display = "none";
    grid.style.display = "none";
    return;
  }
  empty.style.display = "none";

  if (sucursalesView === "table") {
    grid.style.display = "none";
    if (tableWrapper) {
      tableWrapper.style.display = "block";
      renderSucursalesTabla(lista);
    }
  } else {
    if (tableWrapper) tableWrapper.style.display = "none";
    grid.style.display = "";
    renderSucursalesCards(lista);
  }
}

function renderSucursalesCards(lista) {
  const grid = document.getElementById("sucursales-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const usuario = getUsuario();
  const puedeGestionar =
    !isGuest() && usuario && ["gerente", "admin"].includes(usuario.rol);

  lista.forEach((s) => {
    const card = document.createElement("div");
    const sucClr = getSucursalColor(s.id);
    card.className = "vehicle-card sucursal-card";
    card.style.borderTop = `3px solid ${sucClr}`;
    card.innerHTML = `
            <div class="card-image" style="background:${sucClr}22;color:${sucClr};"><i data-lucide="map-pin"></i></div>
            <div class="card-body">
                <h3 class="card-title">${esc(s.nombre)}</h3>
                <p class="card-sub">${esc(s.ciudad)}</p>
                <p class="card-sub">${esc(s.direccion)}</p>
                <p class="card-sub">${esc(s.telefono)} · ${esc(s.encargado)}</p>
                <div class="card-actions">
                    <button class="btn-icon" title="Generar PDF" onclick="generarPDFSucursal(${s.id})"><i data-lucide="file-down"></i></button>
                    ${
                      puedeGestionar
                        ? `<button class="btn-icon" title="Editar" onclick="editarSucursal(${s.id})"><i data-lucide="pencil"></i></button>
                     <button class="btn-icon btn-icon--delete" title="Eliminar" onclick="confirmarEliminarSucursal(${s.id})"><i data-lucide="trash-2"></i></button>`
                        : ""
                    }
                </div>
            </div>
        `;
    grid.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

function renderSucursalesTabla(lista) {
  const tbody = document.getElementById("sucursales-tabla-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const usuario = getUsuario();
  const puedeGestionar =
    !isGuest() && usuario && ["gerente", "admin"].includes(usuario.rol);

  lista.forEach((s) => {
    const tr = document.createElement("tr");
    const sucClr = getSucursalColor(s.id);
    if (sucClr) tr.style.borderLeft = `3px solid ${sucClr}`;
    const acciones = `<div class="actions-cell">
                  <button class="btn-icon" title="Generar PDF" onclick="generarPDFSucursal(${s.id})"><i data-lucide="file-down"></i></button>
                  ${
                    puedeGestionar
                      ? `<button class="btn-icon" title="Editar" onclick="editarSucursal(${s.id})"><i data-lucide="pencil"></i></button>
                  <button class="btn-icon btn-icon--delete" title="Eliminar" onclick="confirmarEliminarSucursal(${s.id})"><i data-lucide="trash-2"></i></button>`
                      : ""
                  }
                </div>`;
    tr.innerHTML = `
            <td class="tbl-marca">${esc(s.nombre)}</td>
            <td class="tbl-muted">${esc(s.ciudad)}</td>
            <td class="tbl-muted">${esc(s.direccion)}</td>
            <td class="tbl-muted">${esc(s.telefono)}</td>
            <td class="tbl-muted">${esc(s.encargado)}</td>
            <td>${acciones}</td>
        `;
    tbody.appendChild(tr);
  });
  if (window.lucide) lucide.createIcons();
}

function puedeGestionarSucursales() {
  const usuario = getUsuario();
  return !isGuest() && usuario && ["gerente", "admin"].includes(usuario.rol);
}

async function guardarSucursal() {
  if (!puedeGestionarSucursales()) {
    showToast("Solo gerentes y administradores pueden gestionar sucursales.", "error");
    return;
  }
  clearErrorsSucursal();

  const nombre = document.getElementById("suc-nombre").value.trim();
  const ciudad = document.getElementById("suc-ciudad").value.trim();
  const direccion = document.getElementById("suc-direccion").value.trim();
  const telefono = document.getElementById("suc-telefono").value.trim();
  const encargado = document.getElementById("suc-encargado").value.trim();
  let valid = true;
  if (!nombre) {
    setErrorSucursal("nombre", "Campo obligatorio");
    valid = false;
  }
  if (!ciudad) {
    setErrorSucursal("ciudad", "Campo obligatorio");
    valid = false;
  }
  if (!direccion) {
    setErrorSucursal("direccion", "Campo obligatorio");
    valid = false;
  }
  if (!telefono) {
    setErrorSucursal("telefono", "Campo obligatorio");
    valid = false;
  }
  if (!encargado) {
    setErrorSucursal("encargado", "Campo obligatorio");
    valid = false;
  }
  if (!valid) return;

  const sucursal = { nombre, ciudad, direccion, telefono, encargado };

  try {
    if (editingSucursalId === null) {
      await fetch(API_SUC, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(sucursal),
      });
      showToast("Sucursal registrada correctamente.", "success");
    } else {
      await fetch(`${API_SUC}/${editingSucursalId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(sucursal),
      });
      showToast("Sucursal actualizada.", "success");
    }
    const eraEdicion = editingSucursalId !== null;
    cancelarEdicionSucursal();
    await cargarSucursalesSelect();
    refrescarColoresSucursal();
    navigateTo("sucursales");
  } catch (err) {
    showToast("Error al guardar la sucursal.", "error");
  }
}

async function editarSucursal(id) {
  if (!puedeGestionarSucursales()) return;
  const s = sucursalesCache.find((x) => x.id === id);
  if (!s) return;

  sessionStorage.setItem("editSucursal", JSON.stringify(s));
  navigateTo("registro");
}

function cancelarEdicionSucursal() {
  editingSucursalId = null;
  [
    "suc-nombre",
    "suc-ciudad",
    "suc-direccion",
    "suc-telefono",
    "suc-encargado",
  ].forEach((id) => (document.getElementById(id).value = ""));
  if (dropdowns.encargadoRegistro) dropdowns.encargadoRegistro.syncDisplay();
  document.getElementById("suc-btn-text").textContent = "Registrar Sucursal";
  document.getElementById("btn-suc-cancel").style.display = "none";
  clearErrorsSucursal();
}

function refrescarColoresSucursal() {
  const items = [
    { value: "all", label: "Todas las sucursales", icon: "layout-grid" },
  ].concat(
    sucursalesCache.map(s => ({
      value: String(s.id),
      label: `${s.nombre} (${s.ciudad})`,
      color: getSucursalColor(s.id),
    }))
  );
  // Update inventory toolbar filter
  if (dropdowns.sucursalFiltro) {
    const sel = document.getElementById("sucursal-filter-select");
    const val = sel?.value || "all";
    dropdowns.sucursalFiltro.setItems(items, "Todas las sucursales");
    if (sel) { sel.value = val; dropdowns.sucursalFiltro.syncDisplay(); }
  }
  // Update dashboard filter
  const dd = document.getElementById("dashboard-sucursal-dropdown");
  const ds = document.getElementById("dashboard-sucursal-select");
  if (dd && dd._dropdownApi && ds) {
    const val = ds.value;
    dd._dropdownApi.setItems(items, "Todas las sucursales");
    ds.value = val;
    dd._dropdownApi.syncDisplay();
  }
  // Update profile dropdown (via cargarSucursalesSelect on next profile open)
  // Update vehicle registration dropdown
  if (dropdowns.sucursalRegistro) {
    const regItems = sucursalesCache.map(s => ({
      value: String(s.id),
      label: `${s.nombre} (${s.ciudad})`,
      color: getSucursalColor(s.id),
    }));
    dropdowns.sucursalRegistro.setItems(regItems, "— Sin asignar —");
  }
  // Re-render dashboard icon if viewing a specific branch
  if (dashboardSucursalFilter !== "all") {
    cargarDashboard();
  }
}

async function confirmarEliminarSucursal(id) {
  const s = sucursalesCache.find((x) => x.id === id);
  if (!s) return;
  showConfirmToast(`¿Eliminar la sucursal ${s.nombre}?`, () =>
    eliminarSucursal(id),
  );
}

async function eliminarSucursal(id) {
  if (!puedeGestionarSucursales()) return;
  try {
    await fetch(`${API_SUC}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    showToast("Sucursal eliminada.", "delete");
    if (editingSucursalId === id) cancelarEdicionSucursal();
    await cargarSucursales();
    await cargarSucursalesSelect();
    refrescarColoresSucursal();
  } catch (err) {
    showToast("Error al eliminar la sucursal.", "error");
  }
}

function setErrorSucursal(fieldId, msg) {
  const fg = document.getElementById("fg-suc-" + fieldId);
  const err = document.getElementById("err-suc-" + fieldId);
  if (fg) fg.classList.add("has-error");
  if (err) err.textContent = msg;
}

function clearErrorsSucursal() {
  document
    .querySelectorAll("#reg-tab-sucursal .has-error")
    .forEach((el) => el.classList.remove("has-error"));
  document
    .querySelectorAll("#reg-tab-sucursal .field-error")
    .forEach((el) => (el.textContent = ""));
}

// Llena el dropdown de sucursales en el formulario de Registro de Vehículo
async function cargarSucursalesSelect() {
  const dropdown = dropdowns.sucursalRegistro;
  const select = document.getElementById("sucursal_id");
  if (!dropdown || !select) return;
  try {
    if (sucursalesCache.length === 0) {
      const res = await fetch(API_SUC);
      sucursalesCache = await res.json();
    }
    const valorActual = select.value;
    const items = sucursalesCache.map((s) => ({
      value: String(s.id),
      label: `${s.nombre} (${s.ciudad})`,
      color: getSucursalColor(s.id),
    }));
    dropdown.setItems(items, "— Sin asignar —");
    select.value = valorActual || "";
    dropdown.syncDisplay();
  } catch (err) {
    // Silencioso: el dropdown simplemente queda con la opción por defecto
  }
}

async function cargarEncargadosSelect() {
  const dropdown = dropdowns.encargadoRegistro;
  const select = document.getElementById("suc-encargado");
  if (!dropdown || !select) return;
  try {
    const res = await fetch(API_USUARIOS, { headers: authHeaders() });
    const usuarios = await res.json();
    const valorActual = select.value;
    const items = usuarios.map((u) => ({
      value: u.nombre,
      label: `${u.nombre} (${u.rol})`,
    }));
    dropdown.setItems(items, "— Seleccionar encargado —");
    select.value = valorActual || "";
    dropdown.syncDisplay();
  } catch (err) {
    // Silencioso
  }
}

// ─── COLLAPSIBLE (perfil, smartphone-style) ─────
function toggleCollapse(trigger) {
  const body = trigger.nextElementSibling;
  const isOpen = trigger.getAttribute("aria-expanded") === "true";
  trigger.setAttribute("aria-expanded", String(!isOpen));
  body.classList.toggle("is-open", !isOpen);
}

// ─── PERFIL: toggle edit mode ─────────────
function toggleEditarPerfil() {
  document.getElementById("perfil-edit-fields").style.display = "block";
  document.getElementById("perfil-btn-edit").style.display = "none";
  document.getElementById("perfil-btn-save").style.display = "";
  document.getElementById("perfil-btn-cancel").style.display = "";
  // Copy readonly values into edit fields
  const usuario = getUsuario();
  if (usuario) {
    document.getElementById("perfil-nombre").value = usuario.nombre || "";
    document.getElementById("perfil-correo").value = usuario.correo || "";
  }
}

function cancelarEditarPerfil() {
  document.getElementById("perfil-edit-fields").style.display = "none";
  document.getElementById("perfil-btn-edit").style.display = "";
  document.getElementById("perfil-btn-save").style.display = "none";
  document.getElementById("perfil-btn-cancel").style.display = "none";
  clearErrorsPerfil("perfil", ["nombre", "correo"]);
}

function toggleEditarSucursal() {
  document.getElementById("perfil-suc-edit-fields").style.display = "block";
  document.getElementById("perfil-btn-suc-edit").style.display = "none";
  document.getElementById("perfil-btn-suc-save").style.display = "";
  document.getElementById("perfil-btn-suc-cancel").style.display = "";
}

function cancelarEditarSucursal() {
  document.getElementById("perfil-suc-edit-fields").style.display = "none";
  document.getElementById("perfil-btn-suc-edit").style.display = "";
  document.getElementById("perfil-btn-suc-save").style.display = "none";
  document.getElementById("perfil-btn-suc-cancel").style.display = "none";
}

function togglePasswordPerfil(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  const icon = btn.querySelector("[data-lucide]");
  if (icon) icon.setAttribute("data-lucide", isPassword ? "eye" : "eye-off");
  if (window.lucide) lucide.createIcons();
}

// ─── PERFIL — PANEL TOGGLES & PREFERENCES ────────
function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const wasOpen = panel.classList.contains('is-open');
  panel.classList.toggle('is-open', !wasOpen);
  if (!wasOpen && charts.perfil) {
    setTimeout(() => charts.perfil.resize(), 100);
  }
}

function setPrefIdioma(lang) {
  localStorage.setItem('amIdioma', lang);
  cambiarIdioma(lang);
  document.getElementById('pref-lang-es')?.classList.toggle('is-active', lang === 'es');
  document.getElementById('pref-lang-en')?.classList.toggle('is-active', lang === 'en');
  showToast(lang === 'es' ? 'Idioma: Español' : 'Language: English', 'success');
}

function setPrefVista(vista) {
  localStorage.setItem('amDefaultView', vista);
  document.getElementById('pref-view-table')?.classList.toggle('is-active', vista === 'table');
  document.getElementById('pref-view-cards')?.classList.toggle('is-active', vista === 'cards');
  showToast(vista === 'table' ? 'Vista por defecto: Tabla' : 'Vista por defecto: Tarjetas', 'success');
}

function applyPreferences() {
  const lang = localStorage.getItem('amIdioma') || 'es';
  const vista = localStorage.getItem('amDefaultView') || 'table';
  document.getElementById('pref-lang-es')?.classList.toggle('is-active', lang === 'es');
  document.getElementById('pref-lang-en')?.classList.toggle('is-active', lang === 'en');
  document.getElementById('pref-view-table')?.classList.toggle('is-active', vista === 'table');
  document.getElementById('pref-view-cards')?.classList.toggle('is-active', vista === 'cards');
}

async function uploadAvatarPerfil(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);
  try {
    const res = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: 'POST',
      headers: authHeadersMultipart(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Error al subir foto.', 'error'); return; }
    if (data.usuario) {
      localStorage.setItem('amUsuario', JSON.stringify(data.usuario));
      if (data.token) localStorage.setItem('amToken', data.token);
    }
    await cargarPerfil();
    renderUserInfo();
    showToast('Foto de perfil actualizada.', 'success');
  } catch (err) {
    showToast('No se pudo subir la foto.', 'error');
  }
  input.value = '';
}

async function eliminarAvatarPerfil() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Error al eliminar foto.', 'error'); return; }
    if (data.usuario) {
      localStorage.setItem('amUsuario', JSON.stringify(data.usuario));
      if (data.token) localStorage.setItem('amToken', data.token);
    }
    await cargarPerfil();
    renderUserInfo();
    showToast('Foto de perfil eliminada.', 'success');
  } catch (err) {
    showToast('No se pudo conectar con el servidor.', 'error');
  }
}

// ─── PERFIL ──────────────────────────────────────
async function cargarPerfil() {
  const guestBanner = document.getElementById("perfil-guest-banner");
  const uploadLabel = document.getElementById("perfil-avatar-upload-label");
  const infoActions = document.getElementById("perfil-info-actions");
  const sucActions = document.getElementById("perfil-suc-actions");
  const passFields = document.getElementById("perfil-pass-fields");
  const passNotice = document.getElementById("perfil-pass-guest-notice");

  const esInvitado = isGuest();
  const usuario = getUsuario();

  if (esInvitado) {
    if (guestBanner) guestBanner.style.display = "flex";
    if (uploadLabel) uploadLabel.style.display = "none";
    const clearBtn = document.getElementById("perfil-avatar-clear-btn");
    if (clearBtn) clearBtn.style.display = "none";
    if (infoActions) infoActions.style.display = "none";
    if (sucActions) sucActions.style.display = "none";
    if (passFields) passFields.style.display = "none";
    if (passNotice) passNotice.style.display = "block";

    document.getElementById("perfil-val-nombre").textContent = "Invitado / Guest";
    document.getElementById("perfil-val-correo").textContent = "invitado@automax.com";
    document.getElementById("perfil-val-rol-label").textContent = "Invitado (Solo Lectura)";
    document.getElementById("perfil-val-sucursal").textContent = "Todas las sucursales";
    
    document.getElementById("perfil-hero-nombre").textContent = "Invitado / Guest";
    const rolBadge = document.getElementById("perfil-hero-rol");
    if (rolBadge) {
      rolBadge.textContent = "Invitado";
      rolBadge.className = "role-badge role-badge--empleado";
    }

    const avatarEl = document.getElementById("perfil-avatar");
    if (avatarEl) {
      avatarEl.style.backgroundImage = "";
      avatarEl.textContent = "?";
    }
    const fechaEl = document.getElementById("perfil-hero-fecha");
    if (fechaEl) fechaEl.textContent = "Modo de Vista Previa";

    // Hide or adapt sucursal edit trigger block
    const cardSucursal = document.getElementById("perfil-card-sucursal");
    if (cardSucursal) cardSucursal.style.display = "block";

  } else if (usuario) {
    if (guestBanner) guestBanner.style.display = "none";
    if (uploadLabel) uploadLabel.style.display = "flex";
    if (infoActions) infoActions.style.display = "";
    if (sucActions) sucActions.style.display = "";
    if (passFields) passFields.style.display = "";
    if (passNotice) passNotice.style.display = "none";

    // Readonly display values
    document.getElementById("perfil-val-nombre").textContent = usuario.nombre || "—";
    document.getElementById("perfil-val-correo").textContent = usuario.correo || "—";
    document.getElementById("perfil-val-rol-label").textContent = usuario.rol || "empleado";
    
    // Edit fields
    document.getElementById("perfil-nombre").value = usuario.nombre || "";
    document.getElementById("perfil-correo").value = usuario.correo || "";
    
    // Ensure edit fields hidden
    document.getElementById("perfil-edit-fields").style.display = "none";
    document.getElementById("perfil-btn-edit").style.display = "";
    document.getElementById("perfil-btn-save").style.display = "none";
    document.getElementById("perfil-btn-cancel").style.display = "none";
    
    document.getElementById("perfil-hero-nombre").textContent = usuario.nombre || "—";
    const rolBadge = document.getElementById("perfil-hero-rol");
    if (rolBadge) {
      rolBadge.textContent = usuario.rol || "empleado";
      rolBadge.className = "role-badge role-badge--" + (usuario.rol || "empleado");
    }

    const avatarEl = document.getElementById("perfil-avatar");
    const iniciales = (usuario.nombre || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const clearBtn = document.getElementById("perfil-avatar-clear-btn");
    if (usuario.avatar_url) {
      avatarEl.style.backgroundImage = `url(http://localhost:3000${usuario.avatar_url})`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.backgroundPosition = "center";
      avatarEl.textContent = "";
      if (clearBtn) clearBtn.style.display = "inline-flex";
    } else {
      avatarEl.style.backgroundImage = "";
      avatarEl.textContent = iniciales;
      if (clearBtn) clearBtn.style.display = "none";
    }

    const fechaEl = document.getElementById("perfil-hero-fecha");
    if (fechaEl) {
      fechaEl.textContent = usuario.fecha_registro
        ? "Miembro desde " +
          new Date(usuario.fecha_registro).toLocaleDateString("es-DO", {
            year: "numeric",
            month: "long",
          })
        : "";
    }

    const cardSucursal = document.getElementById("perfil-card-sucursal");
    if (usuario.rol === "admin") {
      if (cardSucursal) cardSucursal.style.display = "none";
    } else {
      if (cardSucursal) cardSucursal.style.display = "block";
      if (sucursalesCache.length === 0) {
        try {
          const res = await fetch(API_SUC);
          sucursalesCache = await res.json();
        } catch (err) {
          /* silencioso */
        }
      }
      const items = sucursalesCache.map((s) => ({
        value: String(s.id),
        label: `${s.nombre} (${s.ciudad})`,
        color: getSucursalColor(s.id),
      }));
      dropdowns.sucursalPerfil?.setItems(items, "— Sin asignar —");
      document.getElementById("perfil-sucursal").value = usuario.sucursal_id
        ? String(usuario.sucursal_id)
        : "";
      dropdowns.sucursalPerfil?.syncDisplay();
      
      // Readonly display with branch color
      const sucActual = sucursalesCache.find(s => String(s.id) === String(usuario.sucursal_id));
      const sucValEl = document.getElementById("perfil-val-sucursal");
      if (sucValEl) {
        if (sucActual) {
          const clr = getSucursalColor(sucActual.id);
          sucValEl.innerHTML = `<span class="suc-name-with-dot" style="--suc-dot:${clr}">${esc(sucActual.nombre)} (${esc(sucActual.ciudad)})</span>`;
        } else {
          sucValEl.textContent = "— Sin asignar —";
        }
      }
      // Branch color on the dropdown icon
      if (sucActual) {
        const clr = getSucursalColor(sucActual.id);
        const triggerIcon = document.querySelector("#perfil-sucursal-dropdown .custom-select-icon");
        if (triggerIcon) {
          triggerIcon.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${clr};margin:0 4px;"></span>`;
        }
      }
      // Also populate the sucursal panel value for the new layout
      const sucValEl2 = document.getElementById("perfil-val-sucursal2");
      if (sucValEl2) {
        if (sucActual) {
          sucValEl2.textContent = `${sucActual.nombre} (${sucActual.ciudad})`;
        } else {
          sucValEl2.textContent = "— Sin asignar —";
        }
      }
      // Reset edit mode
      document.getElementById("perfil-suc-edit-fields").style.display = "none";
      document.getElementById("perfil-btn-suc-edit").style.display = "";
      document.getElementById("perfil-btn-suc-save").style.display = "none";
      document.getElementById("perfil-btn-suc-cancel").style.display = "none";
    }
  }

  await cargarEstadisticasPerfil();
  applyPreferences();
}

function setErrorPerfil(prefix, field, msg) {
  const fg = document.getElementById(`fg-${prefix}-${field}`);
  const err = document.getElementById(`err-${prefix}-${field}`);
  if (fg) {
    fg.classList.add("has-error");
    fg.classList.remove("has-success");
  }
  if (err) err.textContent = msg;
}

function clearErrorsPerfil(prefix, fields) {
  fields.forEach((f) => {
    const fg = document.getElementById(`fg-${prefix}-${f}`);
    const err = document.getElementById(`err-${prefix}-${f}`);
    if (fg) fg.classList.remove("has-error");
    if (err) err.textContent = "";
  });
}

async function guardarPerfil() {
  clearErrorsPerfil("perfil", ["nombre", "correo"]);
  const nombre = document.getElementById("perfil-nombre").value.trim();
  const correo = document.getElementById("perfil-correo").value.trim();

  let valid = true;
  if (!nombre) {
    setErrorPerfil("perfil", "nombre", "Campo obligatorio");
    valid = false;
  }
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    setErrorPerfil("perfil", "correo", "Correo inválido");
    valid = false;
  }
  if (!valid) return;

  try {
    const res = await fetch(`${API_BASE}/api/auth/perfil`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ nombre, correo }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al actualizar perfil.", "error");
      return;
    }
    localStorage.setItem("amToken", data.token);
    localStorage.setItem("amUsuario", JSON.stringify(data.usuario));
    renderUserInfo();
    aplicarPermisosRol();
    // Back to read-only
    document.getElementById("perfil-val-nombre").textContent = data.usuario.nombre || "—";
    document.getElementById("perfil-val-correo").textContent = data.usuario.correo || "—";
    document.getElementById("perfil-edit-fields").style.display = "none";
    document.getElementById("perfil-btn-edit").style.display = "";
    document.getElementById("perfil-btn-save").style.display = "none";
    document.getElementById("perfil-btn-cancel").style.display = "none";
    showToast("Perfil actualizado correctamente.", "success");
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

function setupPerfilPasswordValidation() {
  const input = document.getElementById("perfil-pass-nueva");
  if (!input) return;
  input.addEventListener("input", function () {
    const val = this.value;
    const reqList = document.getElementById("perfil-password-requirements");
    const hasMinLength = val.length >= 6;
    const hasUpperCase = /[A-Z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(val);
    if (reqList) {
      const conditions = [hasMinLength, hasUpperCase, hasNumber, hasSpecial];
      reqList.querySelectorAll("li").forEach((li, idx) => {
        li.className = conditions[idx] ? "met" : "unmet";
        const icon = li.querySelector(".req-icon");
        if (icon)
          icon.setAttribute(
            "data-lucide",
            conditions[idx] ? "check-circle" : "x-circle",
          );
      });
      if (window.lucide) lucide.createIcons();
    }
    // Strength bar
    const strengthEl = document.getElementById("perfil-password-strength");
    if (strengthEl) {
      const met = [hasMinLength, hasUpperCase, hasNumber, hasSpecial].filter(Boolean).length;
      const pct = met * 25;
      strengthEl.style.width = pct + "%";
      strengthEl.style.background =
        pct <= 25 ? "#FF3B30" : pct <= 50 ? "#FF9F0A" : pct <= 75 ? "#FFD60A" : "#4CAF50";
    }
  });
}

async function cambiarPasswordPerfil() {
  clearErrorsPerfil("perfil", ["actual", "nueva"]);
  const actual = document.getElementById("perfil-pass-actual").value;
  const nueva = document.getElementById("perfil-pass-nueva").value;

  let valid = true;
  if (!actual) {
    setErrorPerfil("perfil", "actual", "Campo obligatorio");
    valid = false;
  }
  const hasMinLength = nueva.length >= 6;
  const hasUpperCase = /[A-Z]/.test(nueva);
  const hasNumber = /[0-9]/.test(nueva);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(nueva);
  if (!nueva || !(hasMinLength && hasUpperCase && hasNumber && hasSpecial)) {
    setErrorPerfil("perfil", "nueva", "No cumple todos los requisitos");
    valid = false;
  }
  if (!valid) return;

  try {
    const res = await fetch(`${API_BASE}/api/auth/password`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ actual, nueva }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al cambiar contraseña.", "error");
      return;
    }
    document.getElementById("perfil-pass-actual").value = "";
    document.getElementById("perfil-pass-nueva").value = "";
    document
      .querySelectorAll("#perfil-password-requirements li")
      .forEach((li) => (li.className = "unmet"));
    showToast("Contraseña actualizada correctamente.", "success");
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

async function cambiarSucursalPerfil() {
  const sucursal_id = document.getElementById("perfil-sucursal").value;
  if (!sucursal_id) {
    showToast("Selecciona una sucursal.", "error");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/auth/sucursal`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ sucursal_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al actualizar sucursal.", "error");
      return;
    }
    localStorage.setItem("amToken", data.token);
    localStorage.setItem("amUsuario", JSON.stringify(data.usuario));
    renderUserInfo();
    await cargarPerfil();
    // Back to read-only
    document.getElementById("perfil-suc-edit-fields").style.display = "none";
    document.getElementById("perfil-btn-suc-edit").style.display = "";
    document.getElementById("perfil-btn-suc-save").style.display = "none";
    document.getElementById("perfil-btn-suc-cancel").style.display = "none";
    showToast("Sucursal actualizada.", "success");
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

async function cargarEstadisticasPerfil() {
  const emptyEl = document.getElementById("perfil-stats-empty");
  const contentEl = document.getElementById("perfil-stats-content");
  const totalEl = document.getElementById("perfil-stat-total");
  const extraValEl = document.getElementById("perfil-stat-extra-val");
  const extraLblEl = document.getElementById("perfil-stat-extra-label");
  const totalLblEl = document.getElementById("perfil-stat-total-label");
  const ctx = document.getElementById("chart-perfil-actividad");
  if (!ctx || typeof Chart === "undefined") return;

  if (isGuest()) {
    if (emptyEl) emptyEl.style.display = "none";
    if (contentEl) contentEl.style.display = "";
    if (totalEl) totalEl.textContent = "2";
    if (totalLblEl) totalLblEl.textContent = "Vehículos vistos (Demo)";
    if (extraValEl) extraValEl.textContent = "Activo";
    if (extraLblEl) extraLblEl.textContent = "Estado de sesión (Demo)";

    if (charts.perfil) charts.perfil.destroy();
    charts.perfil = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Enero", "Febrero"],
        datasets: [
          { label: "Vistos", data: [1, 2], backgroundColor: "#888888" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888", precision: 0 } },
          x: { grid: { display: false }, ticks: { color: "#888" } },
        },
      },
    });
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/estadisticas`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return;

    if (!data.total || data.total === 0) {
      if (emptyEl) emptyEl.style.display = "flex";
      if (contentEl) contentEl.style.display = "none";
      if (window.lucide) lucide.createIcons();
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    if (contentEl) contentEl.style.display = "";
    if (totalEl) totalEl.textContent = data.total;
    if (totalLblEl) totalLblEl.textContent = "Vehículos registrados";
    if (extraValEl) extraValEl.textContent = "Hoy";
    if (extraLblEl) extraLblEl.textContent = "Última actividad";

    if (charts.perfil) charts.perfil.destroy();

    const labels = data.actividadMensual.map((a) => a.mes);
    const valores = data.actividadMensual.map((a) => a.cantidad);

    charts.perfil = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Vehículos", data: valores, backgroundColor: "#C0C0C0" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888", precision: 0 } },
          x: { grid: { display: false }, ticks: { color: "#888" } },
        },
      },
    });
  } catch (err) {
    /* silencioso */
  }
}

// ─── ADMIN: GESTIÓN DE USUARIOS ─────────────────
let adminUsuariosCache = [];

async function cargarUsuariosAdmin() {
  try {
    if (sucursalesCache.length === 0) {
      const resSuc = await fetch(API_SUC);
      sucursalesCache = await resSuc.json();
    }
    const res = await fetch(API_USUARIOS, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al cargar usuarios.", "error");
      return;
    }
    adminUsuariosCache = data;
    filtrarUsuariosAdmin();
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

function filtrarUsuariosAdmin() {
  const searchInput = document.getElementById("admin-search-input");
  const q = searchInput ? searchInput.value.trim().toLowerCase() : "";
  let filtered = adminUsuariosCache;
  if (q) {
    filtered = filtered.filter(u => 
      (u.nombre || "").toLowerCase().includes(q) ||
      (u.correo || "").toLowerCase().includes(q) ||
      (u.rol || "").toLowerCase().includes(q) ||
      (u.sucursal_nombre || "").toLowerCase().includes(q)
    );
  }
  renderUsuariosAdmin(filtered);
}

function renderUsuariosAdmin(lista) {
  const tbody = document.getElementById("admin-usuarios-body");
  const cardsBody = document.getElementById("admin-usuarios-cards-body");
  if (!tbody) return;

  const miId = getUsuario()?.id;
  const roleIcons = { empleado: "user", gerente: "user-cog", admin: "shield" };
  const roleLabels = { empleado: "Empleado", gerente: "Gerente", admin: "Admin" };

  tbody.innerHTML = "";
  if (cardsBody) cardsBody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.2);padding:24px;font-size:12px;">No se encontraron usuarios.</td></tr>';
    if (cardsBody) {
      cardsBody.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.2);padding:24px;font-size:12px;">No se encontraron usuarios.</div>';
    }
    return;
  }

  lista.forEach((u) => {
    const esYo = u.id === miId;
    const puedeTenerSucursal = u.rol === "empleado";

    // ─── DESKTOP TABLE ROW ───
    const tr = document.createElement("tr");

    // Role cell
    let roleHtml;
    if (esYo) {
      roleHtml = `<span class="role-badge-${u.rol}">${roleLabels[u.rol] || u.rol}</span>`;
    } else {
      const roleOpts = ["empleado", "gerente", "admin"].map(r =>
        `<li class="custom-select-option${u.rol === r ? " is-active" : ""}" data-value="${r}" data-icon="${roleIcons[r]}" role="option"><i data-lucide="${roleIcons[r]}"></i><span>${roleLabels[r]}</span></li>`
      ).join("");
      roleHtml = `
        <select class="admin-hidden-select" data-admin-role style="display:none">
          ${["empleado","gerente","admin"].map(r =>
            `<option value="${r}"${u.rol === r ? " selected" : ""}>${roleLabels[r]}</option>`
          ).join("")}
        </select>
        <div class="custom-select admin-custom-select" data-admin-role-dd>
          <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
            <span class="custom-select-icon"></span>
            <span class="custom-select-value">${roleLabels[u.rol] || u.rol}</span>
            <i class="custom-select-arrow" data-lucide="chevron-down"></i>
          </button>
          <ul class="custom-select-options" role="listbox">${roleOpts}</ul>
        </div>`;
    }

    // Branch cell
    let branchHtml;
    if (esYo) {
      branchHtml = `<span class="admin-rol-txt">${esc(u.sucursal_nombre || "—")}</span>`;
    } else if (puedeTenerSucursal) {
      const branchOpts = sucursalesCache.map(s =>
        `<option value="${s.id}">${esc(s.nombre)} (${esc(s.ciudad)})</option>`
      ).join("");
      branchHtml = `
        <select class="admin-hidden-select" data-admin-branch style="display:none">
          <option value="">— Sin sucursal —</option>
          ${branchOpts}
        </select>
        <div class="custom-select admin-custom-select" data-admin-branch-dd>
          <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
            <span class="custom-select-icon"></span>
            <span class="custom-select-value">— Sin sucursal —</span>
            <i class="custom-select-arrow" data-lucide="chevron-down"></i>
          </button>
          <ul class="custom-select-options" role="listbox"></ul>
        </div>`;
    } else {
      branchHtml = `<span class="tbl-muted" style="font-style:italic;opacity:.6;">—</span>`;
    }

    tr.innerHTML = `
      <td>${esc(u.nombre)} ${esYo ? '<span style="font-size:10px;opacity:0.4;font-family:var(--font-mono);margin-left:4px">(Tú)</span>' : ''}</td>
      <td class="tbl-muted">${esc(u.correo)}</td>
      <td class="admin-cell-select">${roleHtml}</td>
      <td class="admin-cell-select">${branchHtml}</td>
      <td class="tbl-muted">${u.vehiculos_registrados}</td>
      <td>
        <div class="admin-status">
          <span class="admin-status-dot ${u.activo ? "activo" : "inactivo"}"></span>
          <button class="admin-switch-btn ${u.activo ? "active" : "inactive"}"
            ${esYo ? "disabled" : `onclick="toggleEstadoAdmin(${u.id}, ${u.activo})"`}>
            ${u.activo ? "Activo" : "Inactivo"}
          </button>
        </div>
      </td>
      <td class="admin-cell-actions">
        ${esYo ? "" : `<button class="btn-icon btn-icon--delete" title="Eliminar" onclick="confirmarEliminarUsuarioAdmin(${u.id}, '${esc(u.nombre).replace(/'/g, "")}')"><i data-lucide="trash-2"></i></button>`}
      </td>
    `;

    tbody.appendChild(tr);

    // Init desktop custom dropdown selects
    const roleHidden = tr.querySelector("select[data-admin-role]");
    const roleDD = tr.querySelector("[data-admin-role-dd]");
    if (roleHidden && roleDD) {
      const api = initCustomSelect(roleDD, roleHidden);
      api.syncDisplay();
      roleHidden.addEventListener("change", () => {
        cambiarRolAdmin(u.id, roleHidden.value);
      });
    }

    const branchHidden = tr.querySelector("select[data-admin-branch]");
    const branchDD = tr.querySelector("[data-admin-branch-dd]");
    if (branchHidden && branchDD) {
      const api = initCustomSelect(branchDD, branchHidden);
      const items = sucursalesCache.map(s => ({
        value: String(s.id),
        label: `${s.nombre} (${s.ciudad})`,
        color: getSucursalColor(s.id),
      }));
      api.setItems(items, "— Sin sucursal —");
      if (u.sucursal_id) {
        branchHidden.value = u.sucursal_id;
        api.syncDisplay();
      }
      branchHidden.addEventListener("change", () => {
        cambiarSucursalAdmin(u.id, branchHidden.value);
      });
    }

    // ─── MOBILE CARD ROW ───
    if (cardsBody) {
      const card = document.createElement("div");
      card.className = "admin-user-card";

      const selectRolHtml = esYo ? `<span class="role-badge-${u.rol}">${roleLabels[u.rol]}</span>` : `
        <select class="native-select" onchange="cambiarRolAdmin(${u.id}, this.value)">
          <option value="empleado" ${u.rol === 'empleado' ? 'selected' : ''}>Empleado</option>
          <option value="gerente"  ${u.rol === 'gerente'  ? 'selected' : ''}>Gerente</option>
          <option value="admin"    ${u.rol === 'admin'    ? 'selected' : ''}>Admin</option>
        </select>
      `;

      let selectSucHtml = "";
      if (puedeTenerSucursal) {
        selectSucHtml = esYo ? `<span>${esc(u.sucursal_nombre || "—")}</span>` : `
          <select class="native-select" onchange="cambiarSucursalAdmin(${u.id}, this.value)">
            <option value="">— Sin sucursal —</option>
            ${sucursalesCache.map(s => `<option value="${s.id}" ${u.sucursal_id == s.id ? 'selected' : ''}>${esc(s.nombre)}</option>`).join("")}
          </select>
        `;
      } else {
        selectSucHtml = `<span style="opacity:.5">—</span>`;
      }

      card.innerHTML = `
        <div class="user-card-header">
          <div>
            <span class="user-card-name">${esc(u.nombre)} ${esYo ? '<span class="you-tag">(Tú)</span>' : ''}</span>
            <span class="user-card-email">${esc(u.correo)}</span>
          </div>
          ${esYo ? '' : `<button class="btn-delete-card" onclick="confirmarEliminarUsuarioAdmin(${u.id}, '${esc(u.nombre).replace(/'/g, "")}')"><i data-lucide="trash-2"></i></button>`}
        </div>
        <div class="user-card-body">
          <div class="card-row">
            <span class="card-row-lbl">Rol</span>
            <div class="card-row-value">${selectRolHtml}</div>
          </div>
          ${puedeTenerSucursal ? `
          <div class="card-row">
            <span class="card-row-lbl">Sucursal</span>
            <div class="card-row-value">${selectSucHtml}</div>
          </div>
          ` : ''}
          <div class="card-row">
            <span class="card-row-lbl">Vehículos</span>
            <span class="card-row-value" style="font-family:var(--font-mono)">${u.vehiculos_registrados}</span>
          </div>
          <div class="card-row">
            <span class="card-row-lbl">Estado</span>
            <div class="card-row-value">
              <div class="admin-status">
                <span class="admin-status-dot ${u.activo ? "activo" : "inactivo"}"></span>
                <button class="admin-switch-btn ${u.activo ? "active" : "inactive"}"
                  ${esYo ? "disabled" : `onclick="toggleEstadoAdmin(${u.id}, ${u.activo})"`}>
                  ${u.activo ? "Activo" : "Inactivo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      cardsBody.appendChild(card);
    }
  });

  if (window.lucide) lucide.createIcons();
}

async function cambiarRolAdmin(id, rol) {
  try {
    const res = await fetch(`${API_USUARIOS}/${id}/rol`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ rol }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al cambiar rol.", "error");
      await cargarUsuariosAdmin();
      return;
    }
    showToast("Rol actualizado.", "success");
    await cargarUsuariosAdmin();
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

async function cambiarSucursalAdmin(id, sucursal_id) {
  try {
    const res = await fetch(`${API_USUARIOS}/${id}/sucursal`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ sucursal_id: sucursal_id || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al cambiar sucursal.", "error");
      await cargarUsuariosAdmin();
      return;
    }
    showToast("Sucursal actualizada.", "success");
    await cargarUsuariosAdmin();
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

async function toggleEstadoAdmin(id, activoActual) {
  try {
    const res = await fetch(`${API_USUARIOS}/${id}/estado`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ activo: !activoActual }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al cambiar estado.", "error");
      return;
    }
    showToast(!activoActual ? "Cuenta activada." : "Cuenta desactivada.", "success");
    await cargarUsuariosAdmin();
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

function confirmarEliminarUsuarioAdmin(id, nombre) {
  showConfirmToast(`¿Eliminar la cuenta de ${nombre}?`, () =>
    eliminarUsuarioAdmin(id),
  );
}

async function eliminarUsuarioAdmin(id) {
  try {
    const res = await fetch(`${API_USUARIOS}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Error al eliminar usuario.", "error");
      return;
    }
    showToast("Usuario eliminado.", "delete");
    await cargarUsuariosAdmin();
  } catch (err) {
    showToast("No se pudo conectar con el servidor.", "error");
  }
}

// ─── GENERACIÓN DE PDF ──────────────────────────
function pdfEncabezado(doc, titulo) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AUTOMAX", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(titulo, 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleString("es-DO")}`, 14, 32);
  doc.setTextColor(0);
}

function descargarPDF(doc, nombreArchivo) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function jsPDFDisponible() {
  if (typeof window.jspdf === "undefined") {
    showToast("No se pudo cargar el generador de PDF.", "error");
    return false;
  }
  return true;
}

async function generarPDFInventario() {
  if (!jsPDFDisponible()) return;
  try {
    const res = await fetch(API);
    const lista = await res.json();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    pdfEncabezado(doc, "Inventario completo de vehículos");

    const filas = lista.map((v) => [
      v.codigo,
      v.marca,
      v.modelo,
      String(v.anio),
      v.color,
      v.combustible,
      v.transmision || "—",
      v.condicion,
      v.sucursal_nombre || "—",
      "$" + formatNum(v.precio),
      String(v.cantidad),
    ]);

    doc.autoTable({
      startY: 38,
      head: [["Código", "Marca", "Modelo", "Año", "Color", "Combustible", "Transmisión", "Condición", "Sucursal", "Precio", "Cant."]],
      body: filas,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 20, 20] },
    });

    descargarPDF(doc, `automax-inventario-${Date.now()}.pdf`);
  } catch (err) {
    showToast("Error al generar el PDF.", "error");
  }
}

async function generarPDFVehiculo(id) {
  if (!jsPDFDisponible()) return;
  try {
    const res = await fetch(API);
    const lista = await res.json();
    const v = lista.find((x) => x.id === id);
    if (!v) {
      showToast("Vehículo no encontrado.", "error");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfEncabezado(doc, `Ficha de vehículo — ${v.codigo}`);

    doc.autoTable({
      startY: 38,
      body: [
        ["Código", v.codigo],
        ["Marca", v.marca],
        ["Modelo", v.modelo],
        ["Año", String(v.anio)],
        ["Color", v.color],
        ["Combustible", v.combustible],
        ["Transmisión", v.transmision || "—"],
        ["Condición", v.condicion],
        ["Sucursal", v.sucursal_nombre || "—"],
        ["Precio", "$" + formatNum(v.precio)],
        ["Cantidad disponible", String(v.cantidad)],
        ["Descripción", v.descripcion || "—"],
        ["Registrado por", v.registrado_por || "—"],
      ],
      styles: { fontSize: 10 },
      theme: "plain",
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    });

    descargarPDF(doc, `automax-${v.codigo}.pdf`);
  } catch (err) {
    showToast("Error al generar el PDF.", "error");
  }
}

function generarPDFSucursales() {
  if (!jsPDFDisponible()) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfEncabezado(doc, "Reporte de sucursales");

  const filas = sucursalesCache.map((s) => [
    s.nombre,
    s.ciudad,
    s.direccion,
    s.telefono,
    s.encargado,
  ]);

  doc.autoTable({
    startY: 38,
    head: [["Nombre", "Ciudad", "Dirección", "Teléfono", "Encargado"]],
    body: filas,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 20, 20] },
  });

  descargarPDF(doc, `automax-sucursales-${Date.now()}.pdf`);
}

function generarPDFSucursal(id) {
  const s = sucursalesCache.find((x) => x.id === id);
  if (!s) return;
  if (!jsPDFDisponible()) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfEncabezado(doc, `Ficha de sucursal — ${s.nombre}`);
  doc.autoTable({
    startY: 38,
    body: [
      ["Nombre", s.nombre],
      ["Ciudad", s.ciudad],
      ["Dirección", s.direccion],
      ["Teléfono", s.telefono],
      ["Encargado", s.encargado],
    ],
    styles: { fontSize: 10 },
    theme: "plain",
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
  });
  descargarPDF(doc, `automax-sucursal-${s.id}.pdf`);
}

// ─── TRADUCCIONES (completas) ──────────────────
const traducciones = {
  es: {
    nav_dashboard: "Inicio",
    nav_nuevos: "Vehículos Nuevos",
    nav_usados: "Vehículos Usados",
    nav_nosotros: "Nosotros",
    nav_asistente: "Asistente Virtual",
    nav_sucursales: "Sucursales",
    nav_reg: "Registro",
    nav_inv: "Inventario",
    sec_dashboard: "Dashboard",
    sec_reg: "Registro",
    sec_inv: "Inventario",
    sec_nuevos: "Vehículos Nuevos",
    sec_usados: "Vehículos Usados",
    sec_suc: "Sucursales",
    sec_nosotros: "Nosotros",
    sec_asistente: "Asistente Virtual",
    lbl_trans: "Transmisión",
    lbl_cond: "Condición",
    lbl_suc: "Sucursal",
    lbl_img: "Imagen del vehículo",
    lbl_filtrar: "Filtrar",
    lbl_pdf: "PDF",
    lbl_desde: "Desde",
    lbl_hasta: "Hasta",
    opt_auto: "Automática",
    opt_manual: "Manual",
    opt_nuevo: "Nuevo",
    opt_usado: "Usado",
    opt_sin_suc: "— Sin asignar —",
    th_img: "Img.",
    th_trans: "Transm.",
    th_cond: "Cond.",
    th_suc: "Sucursal",
    lbl_suc_nombre: "Nombre",
    lbl_suc_ciudad: "Ciudad",
    lbl_suc_direccion: "Dirección",
    lbl_suc_telefono: "Teléfono",
    lbl_suc_encargado: "Encargado",
    btn_suc_reg: "Registrar Sucursal",
    empty_suc_title: "No hay sucursales registradas.",
    empty_suc_sub: "Agrega una sucursal para comenzar.",
    ph_buscar_suc: "Buscar sucursal...",
    lbl_suc_actual: "Sucursal actual",
    opt_todas_suc: "Todas las sucursales",
    stat_veh: "Vehículos en inventario",
    stat_marcas: "Marcas",
    stat_valor: "Valor total",
    stat_nuevos: "Nuevos",
    stat_usados: "Usados",
    stat_combustibles: "Combustibles",
    nav_perfil: "Mi Perfil",
    nav_admin: "Administrar Usuarios",
    tab_reg_vehiculo: "Vehículo",
    tab_reg_sucursal: "Sucursal",
    fs_general: "Información general",
    fs_specs: "Especificaciones",
    fs_ubicacion: "Ubicación e imagen",
    fs_precio: "Precio y existencias",
    fs_suc_nueva: "Nueva sucursal",
    btn_suc_ir_registro: "Nueva sucursal",
    btn_pdf_suc: "Generar PDF",
    sec_perfil: "Mi Perfil",
    sec_admin: "Administrar Usuarios",
    perfil_guest_title: "Estás navegando como invitado",
    perfil_guest_sub: "Crea una cuenta o inicia sesión para acceder a tu perfil, estadísticas y preferencias.",
    perfil_guest_btn: "Iniciar sesión / Registrarme",
    fs_datos_cuenta: "Datos de la cuenta",
    lbl_nombre: "Nombre completo",
    lbl_correo: "Correo electrónico",
    btn_editar: "Editar",
    btn_cancelar: "Cancelar",
    nav_sec_vehiculos: "Vehículos",
    nav_sec_gestion: "Gestión",
    nav_sec_cuenta: "Cuenta",
    nav_sec_info: "Información",
    perfil_stats_empty: "Aún no has registrado vehículos. Tu historial aparecerá aquí cuando comiences a inventariar.",
    btn_guardar_cambios: "Guardar cambios",
    fs_password: "Cambiar contraseña",
    lbl_pass_actual: "Contraseña actual",
    lbl_pass_nueva: "Nueva contraseña",
    btn_cambiar_pass: "Actualizar contraseña",
    fs_sucursal_asignada: "Sucursal asignada",
    btn_guardar_sucursal: "Actualizar sucursal",
    fs_estadisticas: "Estadísticas de actividad",
    perfil_stat_label: "vehículos registrados por ti",
    fs_preferencias: "Preferencias",
    lbl_idioma: "Idioma",
    btn_cerrar_sesion: "Cerrar sesión",
    chat_btn_inventario: "Ver inventario",
    chat_btn_marca: "Buscar por marca",
    chat_btn_precio: "Rango de precio",
    chat_btn_nuevos: "Ver nuevos",
    chat_btn_usados: "Ver usados",
    chat_input_ph: "Escribe tu mensaje...",
    th_nombre: "Nombre",
    th_correo: "Correo",
    th_rol: "Rol",
    th_veh_reg: "Veh. registrados",
    th_estado: "Estado",
    th_acciones: "Acciones",
    th_trans: "Transmisión",
    chart_fuel: "Combustible",
    chart_fuel_sub: "Distribución por tipo",
    chart_brands: "Marcas",
    chart_brands_sub: "Top 8 por unidades",
    chart_years: "Valor por Año",
    chart_years_sub: "Valor total según año del vehículo",
    lbl_ultimos_reg: "Últimos registrados",
    lbl_vehiculo: "Vehículo",
    lbl_cargando: "Cargando...",
    lbl_cod: "Código",
    ph_cod: "Ej. AM01",
    ph_correo: "ejemplo@automax.com",
    ph_password: "••••••••",
    ph_nombre: "Juan Pérez",
    lbl_marca: "Marca",
    ph_marca: "Ej. Toyota",
    lbl_mod: "Modelo",
    ph_mod: "Ej. Hilux",
    lbl_anio: "Año",
    ph_anio: "Ej. 2024",
    lbl_color: "Color",
    ph_color: "Ej. Negro Mate",
    lbl_comb: "Combustible",
    opt_sel: "— Seleccionar —",
    opt_gas: "Gasolina",
    opt_die: "Diésel",
    opt_elec: "Eléctrico",
    opt_hib: "Híbrido",
    opt_glp: "GLP",
    lbl_precio: "Precio (USD)",
    ph_precio: "Ej. 25000.00",
    lbl_cant: "Cantidad",
    ph_cant: "Ej. 5",
    lbl_desc: "Descripción",
    ph_desc: "Ej. Vehículo de transmisión automática...",
    btn_reg: "Registrar Vehículo",
    btn_cancel: "Cancelar",
    btn_anterior: "Anterior",
    btn_siguiente: "Siguiente",
    ph_buscar: "Buscar vehículo...",
    empty_title: "Sin vehículos registrados",
    empty_sub: "Usa el formulario para comenzar tu inventario.",
    empty_title_aux: "No se encontraron vehículos nuevos",
    empty_sub_aux: "Intenta ajustar los filtros.",
    empty_title_used: "No se encontraron vehículos usados",
    empty_sub_used: "Intenta ajustar los filtros.",
    th_cod: "Código",
    th_marca: "Marca",
    th_mod: "Modelo",
    th_anio: "Año",
    th_color: "Color",
    th_comb: "Comb.",
    th_precio: "Precio",
    th_cant: "Cant.",
    sw_negro: "Negro",
    sw_blanco: "Blanco",
    sw_gris: "Gris",
    sw_plata: "Plata",
    sw_rojo: "Rojo",
    sw_azul: "Azul",
    sw_verde: "Verde",
    sw_amarillo: "Amarillo",
    sw_naranja: "Naranja",
    sw_cafe: "Café",
    sw_dorado: "Dorado",
    btn_table: "Tabla",
    btn_cards: "Tarjetas",
    filter_all: "Todos",
    filter_gas: "Gasolina",
    filter_diesel: "Diésel",
    filter_electric: "Eléctrico",
    filter_hybrid: "Híbrido",
    filter_glp: "GLP",
    nosotros_intro: "AUTOMAX es una red dominicana de concesionarios de vehículos con ubicaciones en Santiago, Santo Domingo, Puerto Plata y La Romana. Desde nuestros inicios nos hemos dedicado a ofrecer vehículos nuevos y usados de calidad, con un proceso de compra transparente y un equipo comprometido.",
    nosotros_mision_tit: "Misión",
    nosotros_mision_txt: "Proporcionar una plataforma robusta y fácil de usar que facilite el control de inventario y seguimiento de vehículos en tiempo real, optimizando la operación diaria.",
    nosotros_vision_tit: "Visión",
    nosotros_vision_txt: "Convertirnos en la herramienta líder de gestión vehicular, reconocida por su eficiencia, confiabilidad y soporte, impulsando la digitalización automotriz.",
    nosotros_historia_tit: "Nuestra Historia",
    nosotros_historia_txt: "AUTOMAX nació con una visión clara: transformar la gestión de concesionarios automotrices en República Dominicana. Fundada por un equipo de apasionados del sector automotor, la plataforma surgió de la necesidad de centralizar inventarios, sucursales y ventas en una sola herramienta moderna y accesible. Hoy es el sistema operativo de confianza elegido para optimizar el rendimiento y la fiabilidad diaria.",
    nosotros_normas_tit: "Normas de Uso y Lineamientos",
    nosotros_norma_1_tit: "Seguridad de Acceso",
    nosotros_norma_1_desc: "Mantén tus credenciales seguras y no compartas cuentas de acceso.",
    nosotros_norma_2_tit: "Integridad de los Datos",
    nosotros_norma_2_desc: "Ingresa datos verídicos, códigos válidos y fotos reales en cada registro.",
    nosotros_norma_3_tit: "Niveles de Autorización",
    nosotros_norma_3_desc: "Respeta los roles operativos; solo gerentes y administradores configuran sucursales.",
    nosotros_norma_4_tit: "Uso Profesional",
    nosotros_norma_4_desc: "El uso del sistema se limita exclusivamente a fines operativos del concesionario.",
    nosotros_features_tit: "Qué Ofrece el Sistema",
    nosotros_features_placeholder: "Selecciona una funcionalidad para ver más detalles",
    nosotros_carousel_loading: "Cargando imágenes...",
    carousel_prev: "Anterior",
    carousel_next: "Siguiente",
    perfil_panel_info: "Información Personal",
    perfil_panel_seguridad: "Seguridad",
    perfil_guest_pass_notice: "El cambio de contraseña no está disponible en el modo de demostración.",
    perfil_pass_req_min: "Mínimo 6 caracteres",
    perfil_pass_req_upper: "Al menos una mayúscula",
    perfil_pass_req_number: "Al menos un número",
    perfil_pass_req_special: "Al menos un carácter especial",
    perfil_btn_cambiar_suc: "Cambiar",
    btn_guardar: "Guardar",
    lbl_rol: "Rol",
    lbl_contrasena: "Contraseña",
    lbl_suc_trabajas: "Sucursal donde trabajas",
    ph_suc_select: "— Selecciona tu sucursal —",
    page_title_login: "AUTOMAX — Acceso",
    login_tab_login: "Iniciar sesión",
    login_tab_register: "Registrarse",
    login_title: "Bienvenido",
    login_subtitle: "Accede a tu cuenta",
    login_forgot: "¿Olvidaste tu contraseña?",
    login_remember: "Recordarme",
    login_btn_login: "Iniciar sesión",
    login_btn_register: "Registrarse",
    login_btn_guest: "Entrar como invitado",
    guest_limit_notice: "Mostrando los primeros vehículos. Inicia sesión para ver el inventario completo.",
    login_divider: "o",
    register_title: "Crear cuenta",
    register_subtitle: "Regístrate para gestionar tu flota",
    visual_tagline: "Gestión de Flota · 2026",
    visual_badge: "Sistema seguro",
    recovery_title: "Recuperar contraseña",
    recovery_sub: "Ingresa tu correo y recupera tu clave.",
    recovery_label: "Tu clave es:",
    recovery_btn: "Ver mi clave",
    lbl_cambiar_sucursal: "Cambiar sucursal",
    ph_suc_nombre: "Ej. Sucursal Centro",
    ph_suc_ciudad: "Ej. Santo Domingo",
    ph_suc_direccion: "Ej. Av. Reforma 123",
    ph_suc_telefono: "Ej. 809 555 1234",
    ph_suc_encargado: "Ej. Juan Pérez",
    form_ubicacion: "Ubicación",
    form_contacto: "Contacto",
    ft_copy: "© 2026 AUTOMAX. TODOS LOS DERECHOS RESERVADOS.",
  },
  en: {
    nav_sec_vehiculos: "Vehicles",
    nav_sec_gestion: "Management",
    nav_sec_cuenta: "Account",
    nav_sec_info: "Info",
    nav_dashboard: "Home",
    nav_nuevos: "New vehicles",
    nav_usados: "Used vehicles",
    nav_nosotros: "About us",
    nav_asistente: "Virtual Assistant",
    nav_sucursales: "Branches",
    nav_reg: "Registration",
    nav_inv: "Inventory",
    nav_perfil: "My Profile",
    nav_admin: "Manage Users",
    sec_dashboard: "Dashboard",
    sec_reg: "Registration",
    sec_inv: "Inventory",
    sec_nuevos: "New Vehicles",
    sec_usados: "Used Vehicles",
    sec_suc: "Branches",
    sec_nosotros: "About us",
    sec_asistente: "Virtual Assistant",
    lbl_trans: "Transmission",
    lbl_cond: "Condition",
    lbl_suc: "Branch",
    lbl_img: "Vehicle image",
    lbl_filtrar: "Filter",
    lbl_pdf: "PDF",
    lbl_desde: "From",
    lbl_hasta: "To",
    opt_auto: "Automatic",
    opt_manual: "Manual",
    opt_nuevo: "New",
    opt_usado: "Used",
    opt_sin_suc: "— Unassigned —",
    th_img: "Img.",
    th_trans: "Transm.",
    th_cond: "Cond.",
    th_suc: "Branch",
    lbl_suc_nombre: "Name",
    lbl_suc_ciudad: "City",
    lbl_suc_direccion: "Address",
    lbl_suc_telefono: "Phone",
    lbl_suc_encargado: "Manager",
    btn_suc_reg: "Register Branch",
    empty_suc_title: "No branches registered",
    empty_suc_sub: "Add a branch to start.",
    ph_buscar_suc: "Search branch...",
    lbl_suc_actual: "Current branch",
    opt_todas_suc: "All branches",
    stat_veh: "Vehicles in inventory",
    stat_marcas: "Brands",
    stat_valor: "Total value",
    stat_nuevos: "New",
    stat_usados: "Used",
    stat_combustibles: "Fuels",
    chart_fuel: "Fuel",
    chart_fuel_sub: "Distribution by type",
    chart_brands: "Brands",
    chart_brands_sub: "Top 8 by units",
    chart_years: "Value by Year",
    chart_years_sub: "Total value by vehicle year",
    lbl_ultimos_reg: "Recently added",
    lbl_vehiculo: "Vehicle",
    lbl_cargando: "Loading...",
    lbl_cod: "Code",
    ph_cod: "Ex. AM01",
    ph_correo: "example@automax.com",
    ph_password: "••••••••",
    ph_nombre: "John Doe",
    lbl_marca: "Brand",
    ph_marca: "Ex. Toyota",
    lbl_mod: "Model",
    ph_mod: "Ex. Hilux",
    lbl_anio: "Year",
    ph_anio: "Ex. 2024",
    lbl_color: "Color",
    ph_color: "Ex. Matte Black",
    lbl_comb: "Fuel Type",
    opt_sel: "— Select —",
    opt_gas: "Gasoline",
    opt_die: "Diesel",
    opt_elec: "Electric",
    opt_hib: "Hybrid",
    opt_glp: "LPG",
    lbl_precio: "Price (USD)",
    ph_precio: "Ex. 25000.00",
    lbl_cant: "Quantity",
    ph_cant: "Ex. 5",
    lbl_desc: "Description",
    ph_desc: "Ex. Automatic transmission...",
    btn_editar: "Edit",
    btn_cancelar: "Cancel",
    perfil_stats_empty: "You haven't registered any vehicles yet. Your history will appear here when you start inventorying.",
    btn_reg: "Register Vehicle",
    btn_cancel: "Cancel",
    btn_anterior: "Previous",
    btn_siguiente: "Next",
    ph_buscar: "Search vehicle...",
    empty_title: "No vehicles registered",
    empty_sub: "Use the form to start your inventory.",
    empty_title_aux: "No new vehicles found",
    empty_sub_aux: "Try adjusting the filters.",
    empty_title_used: "No used vehicles found",
    empty_sub_used: "Try adjusting the filters.",
    th_cod: "Code",
    th_marca: "Brand",
    th_mod: "Model",
    th_anio: "Year",
    th_color: "Color",
    th_comb: "Fuel",
    th_precio: "Price",
    th_cant: "Qty",
    sw_negro: "Black",
    sw_blanco: "White",
    sw_gris: "Gray",
    sw_plata: "Silver",
    sw_rojo: "Red",
    sw_azul: "Blue",
    sw_verde: "Green",
    sw_amarillo: "Yellow",
    sw_naranja: "Orange",
    sw_cafe: "Brown",
    sw_dorado: "Gold",
    btn_table: "Table",
    btn_cards: "Cards",
    filter_all: "All",
    filter_gas: "Gasoline",
    filter_diesel: "Diesel",
    filter_electric: "Electric",
    filter_hybrid: "Hybrid",
    filter_glp: "LPG",
    tab_reg_vehiculo: "Vehicle",
    tab_reg_sucursal: "Branch",
    fs_general: "General Info",
    fs_specs: "Specifications",
    fs_ubicacion: "Location & Image",
    fs_precio: "Pricing & Stock",
    fs_suc_nueva: "New Branch",
    btn_suc_ir_registro: "New Branch",
    btn_pdf_suc: "Generate PDF",
    sec_perfil: "My Profile",
    sec_admin: "Manage Users",
    perfil_guest_title: "You are browsing as a guest",
    perfil_guest_sub: "Create an account or log in to access your profile, statistics and preferences.",
    perfil_guest_btn: "Log in / Sign up",
    fs_datos_cuenta: "Account Details",
    lbl_nombre: "Full name",
    lbl_correo: "Email",
    btn_guardar_cambios: "Save changes",
    fs_password: "Change Password",
    lbl_pass_actual: "Current password",
    lbl_pass_nueva: "New password",
    btn_cambiar_pass: "Update password",
    fs_sucursal_asignada: "Assigned Branch",
    btn_guardar_sucursal: "Update branch",
    fs_estadisticas: "Activity Statistics",
    perfil_stat_label: "vehicles registered by you",
    fs_preferencias: "Preferences",
    lbl_idioma: "Language",
    btn_cerrar_sesion: "Log out",
    chat_btn_inventario: "View inventory",
    chat_btn_marca: "Search by brand",
    chat_btn_precio: "Price range",
    chat_btn_nuevos: "View new",
    chat_btn_usados: "View used",
    chat_input_ph: "Type your message...",
    th_nombre: "Name",
    th_correo: "Email",
    th_rol: "Role",
    th_veh_reg: "Vehicles",
    th_estado: "Status",
    th_acciones: "Actions",
    nosotros_intro: "AUTOMAX is a Dominican network of vehicle dealerships with locations in Santiago, Santo Domingo, Puerto Plata and La Romana. Since our beginnings we have been dedicated to offering quality new and used vehicles, with a transparent purchase process and a committed team.",
    nosotros_mision_tit: "Mission",
    nosotros_mision_txt: "To provide a robust and easy-to-use platform that facilitates real-time inventory control and vehicle tracking, optimizing daily operations.",
    nosotros_vision_tit: "Vision",
    nosotros_vision_txt: "To become the leading vehicle management tool, recognized for its efficiency, reliability and support, driving automotive digitalization.",
    nosotros_historia_tit: "Our History",
    nosotros_historia_txt: "AUTOMAX was born with a clear vision: to transform the management of automotive dealerships in the Dominican Republic. Founded by a team passionate about the automotive sector, the platform emerged from the need to centralize inventories, branches and sales in a single modern and accessible tool. Today it is the trusted operating system chosen to optimize performance and daily reliability.",
    nosotros_normas_tit: "Usage Rules & Guidelines",
    nosotros_norma_1_tit: "Access Security",
    nosotros_norma_1_desc: "Keep your credentials secure and do not share access accounts.",
    nosotros_norma_2_tit: "Data Integrity",
    nosotros_norma_2_desc: "Enter truthful data, valid codes, and real photos for each record.",
    nosotros_norma_3_tit: "Authorization Levels",
    nosotros_norma_3_desc: "Respect operational roles; only managers and admins configure branches.",
    nosotros_norma_4_tit: "Professional Use",
    nosotros_norma_4_desc: "System use is limited exclusively to dealership operational purposes.",
    nosotros_features_tit: "What the System Offers",
    nosotros_features_placeholder: "Select a feature to see more details",
    nosotros_carousel_loading: "Loading images...",
    carousel_prev: "Previous",
    carousel_next: "Next",
    perfil_panel_info: "Personal Info",
    perfil_panel_seguridad: "Security",
    perfil_guest_pass_notice: "Password change is not available in demo mode.",
    perfil_pass_req_min: "At least 6 characters",
    perfil_pass_req_upper: "At least one uppercase",
    perfil_pass_req_number: "At least one number",
    perfil_pass_req_special: "At least one special character",
    perfil_btn_cambiar_suc: "Change",
    btn_guardar: "Save",
    lbl_rol: "Role",
    lbl_contrasena: "Password",
    lbl_suc_trabajas: "Branch where you work",
    ph_suc_select: "— Select your branch —",
    page_title_login: "AUTOMAX — Login",
    login_tab_login: "Log in",
    login_tab_register: "Sign up",
    login_title: "Welcome",
    login_subtitle: "Access your account",
    login_forgot: "Forgot your password?",
    login_remember: "Remember me",
    login_btn_login: "Log in",
    login_btn_register: "Sign up",
    login_btn_guest: "Enter as guest",
    guest_limit_notice: "Showing the first vehicles. Log in to see the full inventory.",
    login_divider: "or",
    register_title: "Create account",
    register_subtitle: "Sign up to manage your fleet",
    visual_tagline: "Fleet Management · 2026",
    visual_badge: "Secure system",
    recovery_title: "Recover password",
    recovery_sub: "Enter your email to recover your password.",
    recovery_label: "Your password is:",
    recovery_btn: "View my password",
    lbl_cambiar_sucursal: "Change branch",
    ph_suc_nombre: "Ex. Downtown Branch",
    ph_suc_ciudad: "Ex. Santo Domingo",
    ph_suc_direccion: "Ex. 123 Main St",
    ph_suc_telefono: "Ex. 809 555 1234",
    ph_suc_encargado: "Ex. John Smith",
    form_ubicacion: "Location",
    form_contacto: "Contact",
    ft_copy: "© 2026 AUTOMAX. ALL RIGHTS RESERVED.",
  },
};

// Helper de traducción para contenido generado dinámicamente por JS
function __(key) {
  const lang = localStorage.getItem("amIdioma") || "es";
  return traducciones[lang]?.[key] || key;
}

function cambiarIdioma(idioma) {
  document.getElementById("lang-es")?.classList.remove("active");
  document.getElementById("lang-en")?.classList.remove("active");
  document.getElementById("lang-" + idioma)?.classList.add("active");
  document.getElementById("perfil-lang-es")?.classList.remove("active");
  document.getElementById("perfil-lang-en")?.classList.remove("active");
  document.getElementById("perfil-lang-" + idioma)?.classList.add("active");
  localStorage.setItem("amIdioma", idioma);

  document.querySelectorAll("[data-i18n]:not(.custom-select-value)").forEach((el) => {
    const traduccion = traducciones[idioma][el.getAttribute("data-i18n")];
    if (!traduccion) return;
    if (el.hasAttribute("aria-label")) {
      el.setAttribute("aria-label", traduccion);
    } else if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.placeholder = traduccion;
    } else {
      el.textContent = traduccion;
    }
  });

  // Update custom select default texts without overwriting live branch name
  document.querySelectorAll(".custom-select-value").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    const traduccion = traducciones[idioma][key];
    if (traduccion) el.dataset.i18nDefault = traduccion;
  });

  document.querySelectorAll("[data-i18n-color]").forEach((el) => {
    const traduccion = traducciones[idioma][el.getAttribute("data-i18n-color")];
    if (traduccion) {
      const nameEl = el.querySelector(".swatch-name");
      if (nameEl) nameEl.textContent = traduccion;
    }
  });
}

// ─── AVATAR UPLOAD ──────────────────────────────
function initAvatarUpload() {
  const uploadBtn = document.getElementById("avatar-upload-btn");
  const input = document.getElementById("avatar-input");
  if (!uploadBtn || !input) return;
  uploadBtn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch(`${API_BASE}/api/auth/avatar`, {
        method: "POST",
        headers: authHeadersMultipart(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Error al subir avatar.", "error");
        return;
      }
      localStorage.setItem("amToken", data.token);
      localStorage.setItem("amUsuario", JSON.stringify(data.usuario));
      renderUserInfo();
      cargarPerfil();
      showToast("Foto de perfil actualizada.", "success");
    } catch (err) {
      showToast("No se pudo conectar con el servidor.", "error");
    }
    input.value = "";
  });
}

// ─── INIT ────────────────────────────────────────
async function initShared() {
  if (sharedInitialized) return;
  sharedInitialized = true;

  if (window.lucide) lucide.createIcons();
  try {
    const resSuc = await fetch(API_SUC);
    if (resSuc.ok) {
      sucursalesCache = await resSuc.json();
    } else {
      sucursalesCache = [];
    }
  } catch (err) {
    sucursalesCache = [];
  }
  initSidebar();
  renderUserInfo();
  aplicarPermisosRol();
  cambiarIdioma(localStorage.getItem("amIdioma") || "es");

  // One-time UI setup for components that always exist in SPA
  initAllDropdowns();
  initColorSwatches();
  initQtyStepper();
  initAnioStepper();
  initAutoGrowTextarea();
  setupPerfilPasswordValidation();
  initAvatarUpload();
  document.getElementById("sucursal-filter-select")
    ?.addEventListener("change", onCambiarSucursalFiltro);
}

async function initDashboardPage() {
  await initShared();
  dashboardSucursalFilter = "all";
  if (!pageUI.dashboard) {
    pageUI.dashboard = true;
    initDashboardSucursalFilter();
  } else {
    // Reset dropdown trigger display to 'all'
    if (dropdowns.dashboardSucursal) {
      const selectEl = document.getElementById("dashboard-sucursal-select");
      if (selectEl) {
        selectEl.value = "all";
        dropdowns.dashboardSucursal.syncDisplay();
      }
    }
  }
  await cargarDashboard();
}

async function initInventarioPage(forcedFilter) {
  await initShared();
  condicionFilter = forcedFilter || "all";
  if (!forcedFilter) {
    const params = new URLSearchParams(window.location.search);
    const urlCond = params.get("condicion");
    const savedCond = urlCond || sessionStorage.getItem("invCondicion");
    if (savedCond) {
      condicionFilter = savedCond;
    }
  }
  currentFilter = "all";
  currentView = localStorage.getItem("amDefaultView") || "table";

  if (!pageUI.inventario) {
    pageUI.inventario = true;
    initSucursalToolbarFilter();
    document.getElementById("view-table")?.classList.toggle("active", currentView === "table");
    document.getElementById("view-cards")?.classList.toggle("active", currentView === "cards");
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === "all");
    });
  }
  await cargarSucursalesSelect();
  await aplicarFiltrosYVista();
  const invNotice = document.getElementById("guest-notice-inventario");
  if (invNotice) invNotice.style.display = isGuest() ? "flex" : "none";
}

async function initRegistroPage() {
  await initShared();
  if (!pageUI.registro) {
    pageUI.registro = true;
    await cargarSucursalesSelect();

    // Wire up image preview and price helper events
    const fileInput = document.getElementById("imagen");
    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          showImagePreview(event.target.result);
        };
        reader.readAsDataURL(file);
      }
    });

    const btnRemovePreview = document.getElementById("btn-remove-preview");
    btnRemovePreview?.addEventListener("click", () => {
      clearImagePreview();
    });

    const precioInput = document.getElementById("precio");
    precioInput?.addEventListener("input", formatPriceHelper);
  }
  await cargarEncargadosSelect();
  resetForm();
  // Check for tab preference (from "Nueva sucursal" button)
  const regTab = sessionStorage.getItem("regTab");
  if (regTab) {
    sessionStorage.removeItem("regTab");
    switchRegistroTab(regTab);
  }
  // Check for editing state from sessionStorage
  const editVehicle = sessionStorage.getItem("editVehicle");
  if (editVehicle) {
    sessionStorage.removeItem("editVehicle");
    const v = JSON.parse(editVehicle);
    editingId = v.id;
    document.getElementById("btn-submit").querySelector(".btn-text").textContent = "Actualizar Vehículo";
    document.getElementById("btn-cancel").style.display = "";
    document.getElementById("codigo").value = v.codigo || "";
    document.getElementById("marca").value = v.marca || "";
    document.getElementById("modelo").value = v.modelo || "";
    document.getElementById("anio").value = v.anio || "";
    document.getElementById("color").value = v.color || "";
    document.getElementById("precio").value = v.precio || "";
    document.getElementById("cantidad").value = v.cantidad || "";
    document.getElementById("descripcion").value = v.descripcion || "";
    if (v.combustible) { document.getElementById("combustible").value = v.combustible; dropdowns.combustible?.syncDisplay(); }
    if (v.transmision) { document.getElementById("transmision").value = v.transmision; dropdowns.transmision?.syncDisplay(); }
    if (v.condicion) { document.getElementById("condicion").value = v.condicion; dropdowns.condicion?.syncDisplay(); }
    if (v.sucursal_id) { document.getElementById("sucursal_id").value = v.sucursal_id; dropdowns.sucursalRegistro?.syncDisplay(); }
    if (v.imagen) {
      showImagePreview(`http://localhost:3000${v.imagen}`);
    }
    formatPriceHelper();
    syncColorSwatches();
  }
  const editSucursal = sessionStorage.getItem("editSucursal");
  if (editSucursal) {
    sessionStorage.removeItem("editSucursal");
    const s = JSON.parse(editSucursal);
    switchRegistroTab("sucursal");
    editingSucursalId = s.id;
    document.getElementById("suc-nombre").value = s.nombre || "";
    document.getElementById("suc-ciudad").value = s.ciudad || "";
    document.getElementById("suc-direccion").value = s.direccion || "";
    document.getElementById("suc-telefono").value = s.telefono || "";
    document.getElementById("suc-encargado").value = s.encargado || "";
    if (dropdowns.encargadoRegistro) dropdowns.encargadoRegistro.syncDisplay();
    document.getElementById("suc-btn-text").textContent = "Actualizar Sucursal";
    document.getElementById("btn-suc-cancel").style.display = "";
  }
}

async function initNuevosPage() {
  currentTransmisionFilter = "all";
  yearFrom = "";
  yearTo = "";
  await initInventarioPage("Nuevo");
  initYearDropdowns();
}

function initYearDropdowns() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 1990; y--) {
    years.push({ value: String(y), label: String(y) });
  }

  const yearFromDropdown = document.getElementById("year-from-dropdown");
  const yearFromSelect = document.getElementById("year-from-select");
  if (yearFromDropdown && yearFromSelect) {
    dropdowns.yearFrom = initCustomSelect(yearFromDropdown, yearFromSelect);
    dropdowns.yearFrom.setItems([{ value: "", label: "Desde" }].concat(years), "Desde");
    yearFromSelect.addEventListener("change", () => {
      yearFrom = yearFromSelect.value;
      filterByYear();
    });
  }

  const yearToDropdown = document.getElementById("year-to-dropdown");
  const yearToSelect = document.getElementById("year-to-select");
  if (yearToDropdown && yearToSelect) {
    dropdowns.yearTo = initCustomSelect(yearToDropdown, yearToSelect);
    dropdowns.yearTo.setItems([{ value: "", label: "Hasta" }].concat(years), "Hasta");
    yearToSelect.addEventListener("change", () => {
      yearTo = yearToSelect.value;
      filterByYear();
    });
  }
}

async function initUsadosPage() {
  await initInventarioPage("Usado");
}

async function initSucursalesPage() {
  await initShared();
  const savedView = localStorage.getItem("amDefaultView") || "table";
  sucursalesView = savedView;
  document.getElementById("view-table-suc")?.classList.toggle("active", savedView === "table");
  document.getElementById("view-cards-suc")?.classList.toggle("active", savedView === "cards");
  await cargarSucursales();
}

async function initNosotrosPage() {
  await initShared();
  initNosotrosCarousel();
  initNosotrosShowcase();
}

// ─── ASISTENTE VIRTUAL ──────────────────────
let chatHistory = [];

async function initAsistentePage() {
  await initShared();
  const chatEl = document.getElementById("chat-messages");
  if (!chatEl) return;

  chatHistory = [];
  chatEl.innerHTML = "";

  const welcome = document.createElement("div");
  welcome.className = "chat-msg chat-msg--bot";
  welcome.innerHTML = "<strong>¡Hola! 👋</strong> Soy el asistente virtual de AUTOMAX. Puedes preguntarme sobre vehículos o usar los botones de abajo.";
  chatEl.appendChild(welcome);

  document.getElementById("chat-send-btn")?.addEventListener("click", enviarMensajeChat);
  document.getElementById("chat-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarMensajeChat();
  });

  document.querySelectorAll(".chat-q-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const input = document.getElementById("chat-input");
      const msgs = {
        inventario: "muéstrame todos los vehículos",
        marca: "buscar por marca Toyota",
        precio: "rango de precio entre 10000 y 50000",
        nuevos: "muéstrame vehículos nuevos",
        usados: "muéstrame vehículos usados",
      };
      if (input && msgs[action]) {
        input.value = msgs[action];
        enviarMensajeChat();
      }
    });
  });
}

async function enviarMensajeChat() {
  const input = document.getElementById("chat-input");
  const chatEl = document.getElementById("chat-messages");
  const texto = input?.value?.trim();
  if (!texto || !chatEl) return;

  input.value = "";

  // Add user message
  const userMsg = document.createElement("div");
  userMsg.className = "chat-msg chat-msg--user";
  userMsg.textContent = texto;
  chatEl.appendChild(userMsg);
  chatEl.scrollTop = chatEl.scrollHeight;
  chatHistory.push({ role: "user", text: texto });

  // Show loading
  const loading = document.createElement("div");
  loading.className = "chat-msg chat-msg--bot";
  loading.id = "chat-loading";
  loading.textContent = "Pensando...";
  chatEl.appendChild(loading);
  chatEl.scrollTop = chatEl.scrollHeight;

  try {
    const res = await fetch(`${API_BASE}/api/chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: texto, isGuest: isGuest(), token: getToken() }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    loading.remove();

    const botMsg = document.createElement("div");
    botMsg.className = "chat-msg chat-msg--bot";
    botMsg.innerHTML = data.respuesta;

    if (data.vehiculos && data.vehiculos.length > 0) {
      const table = document.createElement("table");
      table.className = "chat-msg-table";
      const header = table.createTHead();
      const hRow = header.insertRow();
      ["Código", "Marca", "Modelo", "Año", "Precio"].forEach((h) => {
        const th = document.createElement("th");
        th.textContent = h;
        hRow.appendChild(th);
      });
      const body = table.createTBody();
      data.vehiculos.forEach((v) => {
        const row = body.insertRow();
        row.insertCell().textContent = v.codigo || "";
        row.insertCell().textContent = v.marca || "";
        row.insertCell().textContent = v.modelo || "";
        row.insertCell().textContent = v.anio || "";
        row.insertCell().textContent = v.precio ? `$${Number(v.precio).toLocaleString()}` : "";
      });
      botMsg.appendChild(table);
    }

    if (data.botones && data.botones.length > 0) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "chat-msg-actions";
      data.botones.forEach((b) => {
        const btn = document.createElement("button");
        btn.className = "chat-msg-action-btn";
        btn.textContent = b;
        btn.addEventListener("click", () => {
          const inp = document.getElementById("chat-input");
          if (inp) { inp.value = b; enviarMensajeChat(); }
        });
        actionsDiv.appendChild(btn);
      });
      botMsg.appendChild(actionsDiv);
    }

    chatEl.appendChild(botMsg);
    chatEl.scrollTop = chatEl.scrollHeight;
    chatHistory.push({ role: "bot", text: data.respuesta });
  } catch (err) {
    loading.remove();
    console.error("Chatbot error:", err);
    const errMsg = document.createElement("div");
    errMsg.className = "chat-msg chat-msg--bot";
    errMsg.textContent = "Error al conectar con el asistente. Intenta de nuevo.";
    chatEl.appendChild(errMsg);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
}

function initNosotrosCarousel() {
  const track = document.getElementById("carousel-track");
  const dots = document.getElementById("carousel-dots");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  const wrapper = document.querySelector(".carousel");
  if (!track) return;

  let currentIndex = 0;
  let slides = [];
  let interval = null;

  const colorMap = { Negro: "#0a0a0a", Blanco: "#f5f5f5", Gris: "#8a8a8a", Plata: "#c0c0c0", Rojo: "#c0392b", Azul: "#2e5fa3", Verde: "#2e7d4f", Amarillo: "#e0c12e", Naranja: "#d9772f", Café: "#6b4423", Dorado: "#c9a13b" };

  async function loadImages() {
    try {
      const res = await fetch("http://localhost:3000/vehiculos");
      const vehicles = await res.json();
      slides = vehicles.filter((v) => v.imagen);
      if (slides.length === 0) {
        track.innerHTML = '<div class="carousel-empty"><i data-lucide="image-off"></i><span>Aún no hay imágenes de vehículos</span><p>Las imágenes aparecerán aquí cuando se registren vehículos con fotos.</p></div>';
        if (window.lucide) lucide.createIcons();
        return;
      }
      renderSlides();
    } catch (_) {
      track.innerHTML = '<div class="carousel-empty"><i data-lucide="alert-circle"></i><span>Error al cargar imágenes</span></div>';
      if (window.lucide) lucide.createIcons();
    }
  }

  function renderSlides() {
    track.innerHTML = slides.map((v) => {
      const hex = colorMap[v.color] || "";
      const dotStyle = hex ? ` style="color:${hex}"` : "";
      return `<div class="carousel-slide"><img src="http://localhost:3000${v.imagen}" alt="${v.marca} ${v.modelo}" loading="lazy" /><div class="carousel-overlay"><span class="carousel-tag"${dotStyle}>${v.marca}</span><h3 class="carousel-title">${v.modelo}</h3><span class="carousel-year">${v.anio} · ${v.combustible || ""}</span></div></div>`;
    }).join("");

    dots.innerHTML = slides.map((_, i) => `<button class="carousel-dot${i === 0 ? " active" : ""}" data-index="${i}"></button>`).join("");

    if (slides.length > 1) {
      dots.querySelectorAll(".carousel-dot").forEach((btn) => { btn.addEventListener("click", () => { goTo(parseInt(btn.dataset.index)); restartAutoplay(); }); });
      if (prevBtn) prevBtn.style.display = "";
      if (nextBtn) nextBtn.style.display = "";
      startAutoplay();
    } else {
      if (prevBtn) prevBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
    }
    if (window.lucide) lucide.createIcons();
    if (slides.length > 1) goTo(0);
  }

  function goTo(index) {
    currentIndex = index;
    if (slides.length > 1) track.style.transform = `translateX(-${index * 100}%)`;
    dots.querySelectorAll(".carousel-dot").forEach((d, i) => d.classList.toggle("active", i === index));
  }

  function nextSlide() { if (slides.length > 1) goTo((currentIndex + 1) % slides.length); }
  function prevSlide() { if (slides.length > 1) goTo((currentIndex - 1 + slides.length) % slides.length); }
  function startAutoplay() { stopAutoplay(); interval = setInterval(nextSlide, 4000); }
  function stopAutoplay() { if (interval) { clearInterval(interval); interval = null; } }
  function restartAutoplay() { startAutoplay(); }

  if (prevBtn) prevBtn.addEventListener("click", () => { prevSlide(); restartAutoplay(); });
  if (nextBtn) nextBtn.addEventListener("click", () => { nextSlide(); restartAutoplay(); });
  if (wrapper) { wrapper.addEventListener("mouseenter", stopAutoplay); wrapper.addEventListener("mouseleave", startAutoplay); }
  loadImages();
}

function initNosotrosShowcase() {
  const tabsWrapper = document.getElementById("features-tabs");
  const descWrapper = document.getElementById("feature-description");
  if (!tabsWrapper || !descWrapper) return;

  const features = [
    {
      id: "inventario",
      icon: "car",
      title: "Control de Inventario",
      desc: "Gestión completa de vehículos. Registra unidades con código auto-generado o personalizado, define marca, modelo, año, transmisión, tipo de combustible, condición (Nuevo/Usado), cantidad disponible y precio en dólares. Incluye un previsualizador de imagen y un formateador de precio asistido.",
      items: ["Categorización por marcas", "Filtrado avanzado", "Edición en dos pasos", "Thumbnail de fotos"]
    },
    {
      id: "sucursales",
      icon: "building-2",
      title: "Gestión de Sucursales",
      desc: "Organiza tu red de concesionarios de forma centralizada. Cada sucursal cuenta con nombre, ciudad, dirección, teléfono y un color de etiqueta identificador único. El sistema asocia visualmente el inventario y calcula los totales por cada concesionario.",
      items: ["Ciudad y dirección", "Encargados reales", "Totales automáticos", "Identificador de color"]
    },
    {
      id: "usuarios",
      icon: "users",
      title: "Control de Usuarios",
      desc: "Autenticación robusta y seguridad basada en roles (Admin, Gerente, Empleado). Permite a los administradores cambiar roles de forma dinámica en la interfaz, asignar sucursales a empleados específicos y activar o suspender accesos al instante.",
      items: ["Roles jerárquicos", "Control de estado", "Asignación de sucursal", "Búsqueda de usuarios"]
    },
    {
      id: "pdf",
      icon: "file-down",
      title: "Reportes en PDF",
      desc: "Descarga reportes formales generados en el navegador al instante. Permite exportar la lista completa de inventario con todos sus datos y totales, reportes del personal administrativo o fichas técnicas detalladas por vehículo individual.",
      items: ["Generación local rápida", "Formato profesional", "Totales y balances", "Descargas directas"]
    },
    {
      id: "dashboard",
      icon: "pie-chart",
      title: "Métricas y Estadísticas",
      desc: "Mide el rendimiento de tu negocio. Un panel con tarjetas de estadísticas (Total de inventario, Nuevos, Usados, Marcas activas y Valor en USD) junto a gráficos interactivos de distribución de combustible, top de marcas y valor histórico por año.",
      items: ["Gráficos interactivos", "Distribución por marcas", "Progreso de valor anual", "Filtro por sucursal"]
    }
  ];

  // Render tabs
  tabsWrapper.innerHTML = features.map((f, i) => `
    <button class="feature-tab-btn" data-id="${f.id}">
      <i data-lucide="${f.icon}"></i>
      <span>${f.title}</span>
    </button>
  `).join("");

  function selectTab(id) {
    tabsWrapper.querySelectorAll(".feature-tab-btn").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.id === id);
    });

    const f = features.find(x => x.id === id);
    if (!f) return;

    descWrapper.innerHTML = `
      <div class="feature-desc-card">
        <div class="feature-desc-header">
          <i data-lucide="${f.icon}"></i>
          <h3>${esc(f.title)}</h3>
        </div>
        <p class="feature-desc-text">${esc(f.desc)}</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  tabsWrapper.querySelectorAll(".feature-tab-btn").forEach(btn => {
    btn.onclick = () => selectTab(btn.dataset.id);
  });

  // Select first tab by default
  if (features.length > 0) {
    selectTab(features[0].id);
  }
}


async function initPerfilPage() {
  await initShared();
  if (!pageUI.perfil) {
    pageUI.perfil = true;
  }
  await cargarPerfil();
}

async function initAdminPage() {
  const usuario = getUsuario();
  if (!usuario || usuario.rol !== "admin") {
    navigateTo("dashboard");
    return;
  }
  await initShared();
  if (!pageUI.admin) {
    pageUI.admin = true;
  }
  await cargarUsuariosAdmin();
}

// ─── APP SHELL ────────────────────────────────────
const PAGE_INIT = {
  dashboard: initDashboardPage,
  inventario: initInventarioPage,
  nuevos: initNuevosPage,
  usados: initUsadosPage,
  registro: initRegistroPage,
  sucursales: initSucursalesPage,
  nosotros: initNosotrosPage,
  asistente: initAsistentePage,
  perfil: initPerfilPage,
  admin: initAdminPage,
};

const PAGE_TITLE = {
  dashboard: "Inicio",
  inventario: "Inventario",
  nuevos: "Vehículos Nuevos",
  usados: "Vehículos Usados",
  registro: "Registro",
  sucursales: "Sucursales",
  nosotros: "Nosotros",
  asistente: "Asistente Virtual",
  perfil: "Mi Perfil",
  admin: "Administrar",
};

async function loadPage(page) {
  const [pageName, queryString] = page.split("?");

  // Extract query params from hash (e.g. ?condicion=Nuevo) into sessionStorage
  if (queryString) {
    const params = new URLSearchParams(queryString);
    const cond = params.get("condicion");
    if (cond) sessionStorage.setItem("invCondicion", cond);
  }

  pageUI = {};

  const contentEl = document.getElementById("app-content");
  const skeleton = document.getElementById("page-skeleton");

  // Determine direction (up = forward in menu, down = backward)
  const PAGE_ORDER = ["dashboard", "nuevos", "usados", "inventario", "sucursales", "registro", "perfil", "admin", "nosotros", "asistente"];
  let goingForward = true;
  if (lastActivePage && lastActivePage !== pageName) {
    const prevIdx = PAGE_ORDER.indexOf(lastActivePage);
    const newIdx = PAGE_ORDER.indexOf(pageName);
    if (prevIdx !== -1 && newIdx !== -1) {
      goingForward = newIdx > prevIdx;
    }
  }
  lastActivePage = pageName;

  // Exit animation: animate old content out
  const oldWrapper = contentEl.querySelector(".page-transition-wrapper");
  if (oldWrapper) {
    oldWrapper.classList.add(goingForward ? "page-exit-up" : "page-exit-down");
    await new Promise(r => setTimeout(r, 700));
  }

  // Clear old content and CSS
  contentEl.innerHTML = "";
  document.querySelectorAll('link[data-page-css]').forEach(el => el.remove());

  // Show skeleton during fetch
  if (skeleton) skeleton.classList.remove("skel-hidden");

  try {
    const res = await fetch(`${pageName}.html`);
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Load page-specific CSS dynamically
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.includes('base.css') && !href.includes('login.css')) {
        const newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = href;
        newLink.setAttribute('data-page-css', pageName);
        document.head.appendChild(newLink);
      }
    });

    const mainEl = doc.getElementById("main-content");
    let content = mainEl ? mainEl.innerHTML : "";

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const toast = tempDiv.querySelector("#toast-container");
    if (toast) toast.remove();
    content = tempDiv.innerHTML;

    // Update sidebar active immediately
    document.querySelectorAll(".sidebar-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === pageName);
    });

    // Inject content with enter animation
    const enterClass = goingForward ? "page-enter-up" : "page-enter-down";
    contentEl.innerHTML = `<div class="page-transition-wrapper ${enterClass}">${content}</div>`;
    if (skeleton) skeleton.classList.add("skel-hidden");

    document.title = `AUTOMAX — ${PAGE_TITLE[pageName] || pageName}`;

    // Re-initialize UI components for the newly injected DOM
    initAllDropdowns();
    initColorSwatches();
    initQtyStepper();
    initAnioStepper();
    initAutoGrowTextarea();
    initAvatarUpload();
    setupPerfilPasswordValidation();
    document.getElementById("sucursal-filter-select")
      ?.addEventListener("change", onCambiarSucursalFiltro);

    if (window.lucide) lucide.createIcons();

    // Start loading data immediately (runs in parallel with enter animation)
    const initFn = PAGE_INIT[pageName];
    if (initFn) await initFn();

    // Wait for enter animation to finish, then clean up
    await new Promise(r => setTimeout(r, 700));
    const newWrapper = contentEl.querySelector(".page-transition-wrapper");
    if (newWrapper) newWrapper.classList.remove("page-enter-up", "page-enter-down");
  } catch (err) {
    contentEl.innerHTML = "<p>Error al cargar la página.</p>";
    if (skeleton) skeleton.classList.add("skel-hidden");
  }
}

// ─── FORM WIZARD & IMAGE PREVIEW & PRICE HELPER ──────────
let currentStep = 1;

function goToStep(step) {
  if (step === 2) {
    if (!validarPaso1()) return;
  }

  currentStep = step;

  // Toggle active form step classes
  document.querySelectorAll(".form-step").forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.toggle("active", s === step);
  });

  // Toggle active wizard progress buttons
  document.querySelectorAll(".wizard-step").forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.toggle("active", s === step);
    el.classList.toggle("completed", s < step);
  });

  const stepLine = document.querySelector(".wizard-step-line");
  if (stepLine) {
    stepLine.classList.toggle("active", step > 1);
  }

  // Update actions buttons display
  const prevBtn = document.getElementById("btn-prev-step");
  const nextBtn = document.getElementById("btn-next-step");
  const submitBtn = document.getElementById("btn-submit");

  if (prevBtn) prevBtn.style.display = step === 1 ? "none" : "flex";
  if (nextBtn) nextBtn.style.display = step === 1 ? "flex" : "none";
  if (submitBtn) submitBtn.style.display = step === 2 ? "flex" : "none";
}

function validarPaso1() {
  clearErrors();
  const codigo = document.getElementById("codigo")?.value.trim().toUpperCase() || "";
  const marca = document.getElementById("marca")?.value.trim() || "";
  const modelo = document.getElementById("modelo")?.value.trim() || "";
  const anio = document.getElementById("anio")?.value.trim() || "";
  const color = document.getElementById("color")?.value.trim() || "";
  const combustible = document.getElementById("combustible")?.value || "";
  const transmision = document.getElementById("transmision")?.value || "";
  const condicion = document.getElementById("condicion")?.value || "";
  const lang = getLang();

  let valid = true;

  if (!codigo) {
    setError("codigo", errDict[lang].req);
    valid = false;
  }
  if (!marca) {
    setError("marca", errDict[lang].req);
    valid = false;
  }
  if (!modelo) {
    setError("modelo", errDict[lang].req);
    valid = false;
  }
  if (!anio) {
    setError("anio", errDict[lang].req);
    valid = false;
  } else {
    const y = parseInt(anio, 10);
    if (isNaN(y) || y < 1990 || y > 2026) {
      setError("anio", errDict[lang].anio);
      valid = false;
    }
  }
  if (!color) {
    setError("color", errDict[lang].req);
    valid = false;
  }
  if (!combustible) {
    setError("combustible", "Selecciona un tipo");
    valid = false;
  }
  if (!transmision) {
    setError("transmision", "Selecciona un tipo");
    valid = false;
  }
  if (!condicion) {
    setError("condicion", "Selecciona una opción");
    valid = false;
  }

  return valid;
}

function showImagePreview(src) {
  const container = document.getElementById("image-preview-container");
  const img = document.getElementById("image-preview-img");
  const uploadBox = document.getElementById("custom-upload-box");
  if (img && container) {
    img.src = src;
    container.style.display = "flex";
    if (uploadBox) uploadBox.style.display = "none";
  }
}

function clearImagePreview() {
  const container = document.getElementById("image-preview-container");
  const img = document.getElementById("image-preview-img");
  const uploadBox = document.getElementById("custom-upload-box");
  const fileInput = document.getElementById("imagen");
  if (img && container) {
    img.src = "";
    container.style.display = "none";
    if (uploadBox) uploadBox.style.display = "flex";
    if (fileInput) fileInput.value = "";
  }
}

function formatPriceHelper() {
  const input = document.getElementById("precio");
  const helper = document.getElementById("price-helper");
  if (!input || !helper) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || val <= 0) {
    helper.textContent = "";
  } else {
    helper.textContent = new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(val) + " USD";
  }
}

async function initApp() {
  isAppShell = true;
  await initShared();

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.slice(1) || "dashboard";
    loadPage(hash);
  });

  const initialPage = window.location.hash.slice(1) || "dashboard";
  await loadPage(initialPage);
}