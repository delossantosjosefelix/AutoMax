'use strict';
const API = "http://localhost:3000/vehiculos";
let editingId = null;
let charts = { fuel: null, brands: null, years: null };
let currentView = 'table';
let currentFilter = 'all';

// ─── SEGURIDAD ──────────
function getToken() { return localStorage.getItem('amToken') || ''; }
function isGuest() { return localStorage.getItem('amGuest') === 'true'; }

if (!getToken() && !isGuest()) {
    window.location.replace('login.html');
}

// ─── DICCIONARIO ERRORES ───────────────────────
const errDict = {
    es: { req: "Campo obligatorio", anio: "Año: 1990–2026", precio: "Precio inválido", cant: "Mín. 1", codigo: "Código existe" },
    en: { req: "Required field", anio: "Year: 1990–2026", precio: "Invalid price", cant: "Min 1", codigo: "Code exists" }
};

function getLang() { return document.getElementById('lang-en')?.classList.contains('active') ? 'en' : 'es'; }

// ─── SIDEBAR ────────────────────────────────────
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

    if (isCollapsed) sidebar.classList.add('collapsed');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        setTimeout(() => resizeCharts(), 350);
    });

    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.dataset.section;
            navigateTo(sectionId);
        });
    });

    navigateTo('dashboard');
}

function navigateTo(sectionId) {
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
    if (activeLink) activeLink.classList.add('active');

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active-section'));
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active-section');

    if (sectionId === 'dashboard') cargarDashboard();

    if (window.innerWidth <= 480) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            localStorage.setItem('sidebarCollapsed', 'true');
        }
    }
}

// ─── RENDER USER INFO ──────────────────────────
function renderUserInfo() {
    const footer = document.getElementById('sidebar-footer');
    if (!footer) return;

    // Usamos variables para definir el contenido del usuario
    const isGuestUser = isGuest();
    const usuario = getUsuario();
    const nombre = usuario ? usuario.nombre : 'Usuario';
    const avatar = usuario && usuario.avatar_url;
    const iniciales = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const firstName = nombre.split(' ')[0];
    const rol = usuario ? usuario.rol : 'empleado';

    // Estructura fija: El avatar y el botón de logout siempre están
    // El .user-info es lo único que debe desaparecer
    footer.innerHTML = `
        <div class="avatar">
            ${isGuestUser ? '?' : (avatar ? `<img src="${avatar}" alt="${firstName}" />` : iniciales)}
        </div>
        <div class="user-info">
            <div class="name">${isGuestUser ? 'Invitado' : firstName}</div>
            <div class="role">${isGuestUser ? 'Solo lectura' : rol}</div>
        </div>
        <button class="logout-btn" onclick="cerrarSesion()" title="${isGuestUser ? 'Iniciar sesión' : 'Cerrar sesión'}">
            <i data-lucide="${isGuestUser ? 'log-in' : 'log-out'}"></i>
        </button>
    `;
    
    if (window.lucide) lucide.createIcons();
}

function cerrarSesion() {
    localStorage.clear();
    window.location.replace('login.html');
}

// ─── DASHBOARD ──────────────────────────────────
async function cargarDashboard() {
    try {
        const res = await fetch(API);
        const lista = await res.json();
        actualizarEstadisticas(lista);
        actualizarGraficos(lista);
    } catch (err) {
        showToast('Error al cargar el dashboard.', 'error');
    }
}

function actualizarEstadisticas(lista) {
    const total = lista.length;
    const marcas = new Set(lista.map(v => v.marca.toLowerCase())).size;
    const valor = lista.reduce((acc, v) => acc + (v.precio * v.cantidad), 0);
    const combustibles = new Set(lista.map(v => v.combustible)).size;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-marcas').textContent = marcas;
    document.getElementById('stat-valor').textContent = '$' + formatNum(valor);
    document.getElementById('stat-combustibles').textContent = combustibles;
}

function actualizarGraficos(lista) {
    // Fuel
    const fuelData = {};
    lista.forEach(v => { fuelData[v.combustible] = (fuelData[v.combustible] || 0) + v.cantidad; });
    const fuelLabels = Object.keys(fuelData);
    const fuelValues = Object.values(fuelData);
    const fuelColors = ['#C0C0C0', '#4A90E2', '#FF9F0A', '#4CAF50', '#FF3B30'];

    if (charts.fuel) {
        charts.fuel.data.labels = fuelLabels;
        charts.fuel.data.datasets[0].data = fuelValues;
        charts.fuel.update();
    } else {
        const ctx = document.getElementById('chart-fuel').getContext('2d');
        charts.fuel = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: fuelLabels,
                datasets: [{
                    data: fuelValues,
                    backgroundColor: fuelColors.slice(0, fuelLabels.length),
                    borderColor: '#141414',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } }
            }
        });
    }

    // Brands
    const brandData = {};
    lista.forEach(v => { brandData[v.marca] = (brandData[v.marca] || 0) + v.cantidad; });
    const sortedBrands = Object.entries(brandData).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const brandLabels = sortedBrands.map(([name]) => name);
    const brandValues = sortedBrands.map(([, count]) => count);

    if (charts.brands) {
        charts.brands.data.labels = brandLabels;
        charts.brands.data.datasets[0].data = brandValues;
        charts.brands.update();
    } else {
        const ctx = document.getElementById('chart-brands').getContext('2d');
        charts.brands = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: brandLabels,
                datasets: [{
                    label: 'Unidades',
                    data: brandValues,
                    backgroundColor: '#C0C0C0',
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#666', stepSize: 1 } },
                    x: { ticks: { color: '#666' } }
                }
            }
        });
    }

    // Years
    const yearData = {};
    lista.forEach(v => {
        const year = v.anio;
        yearData[year] = (yearData[year] || 0) + (v.precio * v.cantidad);
    });
    const sortedYears = Object.keys(yearData).sort();
    const yearLabels = sortedYears;
    const yearValues = sortedYears.map(y => yearData[y]);

    if (charts.years) {
        charts.years.data.labels = yearLabels;
        charts.years.data.datasets[0].data = yearValues;
        charts.years.update();
    } else {
        const ctx = document.getElementById('chart-years').getContext('2d');
        charts.years = new Chart(ctx, {
            type: 'line',
            data: {
                labels: yearLabels,
                datasets: [{
                    label: 'Valor ($)',
                    data: yearValues,
                    borderColor: '#C0C0C0',
                    backgroundColor: 'rgba(192,192,192,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#C0C0C0',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#888', font: { size: 11 } } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#666' } },
                    x: { ticks: { color: '#666' } }
                }
            }
        });
    }
}

function resizeCharts() {
    Object.values(charts).forEach(chart => { if (chart) chart.resize(); });
}

// ─── VISTA Y FILTROS ────────────────────────────
function setView(view) {
    currentView = view;
    document.getElementById('view-table')?.classList.toggle('active', view === 'table');
    document.getElementById('view-cards')?.classList.toggle('active', view === 'cards');
    aplicarFiltrosYVista();
}

function filterByFuel(fuel) {
    currentFilter = fuel;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === fuel);
    });
    aplicarFiltrosYVista();
}

async function aplicarFiltrosYVista() {
    const q = document.getElementById('search-input').value.trim().toLowerCase();
    try {
        const res = await fetch(API);
        let lista = await res.json();

        if (q) {
            lista = lista.filter(v =>
                v.codigo.toLowerCase().includes(q) ||
                v.marca.toLowerCase().includes(q) ||
                v.modelo.toLowerCase().includes(q) ||
                v.color.toLowerCase().includes(q) ||
                v.combustible.toLowerCase().includes(q) ||
                String(v.anio).includes(q)
            );
        }

        if (currentFilter !== 'all') {
            lista = lista.filter(v => v.combustible === currentFilter);
        }

        if (currentView === 'table') {
            renderTabla(lista);
        } else {
            renderCards(lista);
        }
        updateStats(lista);
    } catch (err) {
        showToast('Error al filtrar.', 'error');
    }
}

async function filtrarVehiculos() {
    aplicarFiltrosYVista();
}

// ─── CRUD ────────────────────────────────────────
async function cargarVehiculos() {
    try {
        const res = await fetch(API);
        const lista = await res.json();
        renderTabla(lista);
        const dashboard = document.getElementById('dashboard');
        if (dashboard.classList.contains('active-section')) cargarDashboard();
    } catch (err) {
        showToast('Error al cargar vehículos.', 'error');
    }
}

async function guardarDatos() {
    if (isGuest()) {
        showToast('Inicia sesión para modificar el inventario.', 'error');
        return;
    }

    clearErrors();

    const codigo = document.getElementById('codigo').value.trim().toUpperCase();
    const marca = document.getElementById('marca').value.trim();
    const modelo = document.getElementById('modelo').value.trim();
    const anio = document.getElementById('anio').value.trim();
    const color = document.getElementById('color').value.trim();
    const combustible = document.getElementById('combustible').value;
    const precio = document.getElementById('precio').value.trim();
    const cantidad = document.getElementById('cantidad').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const lang = getLang();

    let valid = true;

    if (!codigo) { setError('codigo', errDict[lang].req); valid = false; }
    if (!marca) { setError('marca', errDict[lang].req); valid = false; }
    if (!modelo) { setError('modelo', errDict[lang].req); valid = false; }
    if (!anio) {
        setError('anio', errDict[lang].req); valid = false;
    } else {
        const y = parseInt(anio, 10);
        if (isNaN(y) || y < 1990 || y > 2026) { setError('anio', errDict[lang].anio); valid = false; }
    }
    if (!color) { setError('color', errDict[lang].req); valid = false; }
    if (!combustible) { setError('combustible', 'Selecciona un tipo'); valid = false; }
    if (!precio) {
        setError('precio', errDict[lang].req); valid = false;
    } else {
        const p = parseFloat(precio);
        if (isNaN(p) || p <= 0) { setError('precio', errDict[lang].precio); valid = false; }
    }
    if (!cantidad) {
        setError('cantidad', errDict[lang].req); valid = false;
    } else {
        const c = parseInt(cantidad, 10);
        if (isNaN(c) || c < 1) { setError('cantidad', errDict[lang].cant); valid = false; }
    }
    if (!descripcion) { setError('descripcion', errDict[lang].req); valid = false; }

    if (!valid) return;

    const vehiculo = {
        codigo, marca, modelo,
        anio: parseInt(anio, 10),
        color, combustible,
        precio: parseFloat(precio),
        cantidad: parseInt(cantidad, 10),
        descripcion
    };

    if (editingId === null) {
        const resCheck = await fetch(API);
        const todos = await resCheck.json();
        const duplicado = todos.some(v => v.codigo === codigo);
        if (duplicado) { setError('codigo', errDict[lang].codigo); return; }

        await fetch(API, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(vehiculo)
        });

        resetForm();
        showToast('Vehículo registrado correctamente.', 'success');
    } else {
        const resCheck = await fetch(API);
        const todos = await resCheck.json();
        const duplicado = todos.some(v => v.codigo === codigo && v.id !== editingId);
        if (duplicado) { setError('codigo', errDict[lang].codigo); return; }

        await fetch(`${API}/${editingId}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(vehiculo)
        });

        cancelarEdicion();
        showToast('Vehículo actualizado.', 'success');
    }

    await cargarVehiculos();
    const dashboard = document.getElementById('dashboard');
    if (dashboard.classList.contains('active-section')) cargarDashboard();
}

async function eliminarDatos(id) {
    if (isGuest()) {
        showToast('Inicia sesión para modificar el inventario.', 'error');
        return;
    }

    const res = await fetch(API);
    const todos = await res.json();
    const v = todos.find(x => x.id === id);

    await fetch(`${API}/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });

    showToast(`${v ? v.marca + ' ' + v.modelo : 'Vehículo'} eliminado.`, 'delete');
    if (editingId === id) cancelarEdicion();
    await cargarVehiculos();
    const dashboard = document.getElementById('dashboard');
    if (dashboard.classList.contains('active-section')) cargarDashboard();
}

async function editarDatos(id) {
    if (isGuest()) {
        showToast('Inicia sesión para modificar el inventario.', 'error');
        return;
    }

    const res = await fetch(API);
    const todos = await res.json();
    const v = todos.find(x => x.id === id);
    if (!v) return;

    editingId = id;

    document.getElementById('codigo').value = v.codigo;
    document.getElementById('marca').value = v.marca;
    document.getElementById('modelo').value = v.modelo;
    document.getElementById('anio').value = v.anio;
    document.getElementById('color').value = v.color;
    document.getElementById('combustible').value = v.combustible;
    document.getElementById('precio').value = v.precio;
    document.getElementById('cantidad').value = v.cantidad;
    document.getElementById('descripcion').value = v.descripcion;

    syncColorSwatches();
    syncFuelDisplay();

    const descEl = document.getElementById('descripcion');
    descEl.style.height = 'auto';
    descEl.style.height = descEl.scrollHeight + 'px';

    document.querySelector('.btn-text').textContent = 'Actualizar Vehículo';
    document.getElementById('btn-cancel').style.display = 'inline-flex';

    navigateTo('registro');
    clearErrors();
}

function cancelarEdicion() {
    editingId = null;
    resetForm();
    document.querySelector('.btn-text').textContent = 'Registrar Vehículo';
    document.getElementById('btn-cancel').style.display = 'none';
}

function resetForm() {
    ['codigo', 'marca', 'modelo', 'anio', 'color', 'precio', 'cantidad', 'descripcion']
        .forEach(id => (document.getElementById(id).value = ''));
    document.getElementById('combustible').value = '';
    syncColorSwatches();
    syncFuelDisplay();
    document.getElementById('descripcion').style.height = 'auto';
    clearErrors();
}

// ─── RENDER TABLE ──────────────────────────────
function renderTabla(lista) {
    const tbody = document.getElementById('tabla-body');
    const emptyState = document.getElementById('empty-state');
    const tableWrapper = document.getElementById('table-wrapper');
    const cardsWrapper = document.getElementById('cards-wrapper');
    const countEl = document.getElementById('vehiculos-count');

    tbody.innerHTML = '';

    if (lista.length === 0) {
        emptyState.style.display = 'block';
        tableWrapper.style.display = 'none';
        if (cardsWrapper) cardsWrapper.style.display = 'none';
        if (countEl) countEl.textContent = '0 vehículos';
        return;
    }

    emptyState.style.display = 'none';
    tableWrapper.style.display = 'block';
    if (cardsWrapper) cardsWrapper.style.display = 'none';
    if (countEl) countEl.textContent = lista.length + ' vehículos';

    lista.forEach(v => {
        const tr = document.createElement('tr');
        const acciones = isGuest()
            ? `<span style="font-size:10px;color:var(--muted);font-family:var(--font-mono);">Solo lectura</span>`
            : `<div class="actions-cell">
                 <button class="btn-tbl" onclick="editarDatos(${v.id})">Editar</button>
                 <button class="btn-tbl btn-tbl--delete" onclick="confirmarEliminar(${v.id})">Eliminar</button>
               </div>`;

        tr.innerHTML = `
            <td class="tbl-code">${esc(v.codigo)}</td>
            <td class="tbl-marca">${esc(v.marca)}</td>
            <td>${esc(v.modelo)}</td>
            <td class="tbl-muted">${esc(String(v.anio))}</td>
            <td class="tbl-muted">${esc(v.color)}</td>
            <td class="tbl-muted">${esc(v.combustible)}</td>
            <td class="tbl-price">$${formatNum(v.precio)}</td>
            <td><span class="tbl-cantidad">${esc(String(v.cantidad))}</span></td>
            <td>${acciones}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ─── RENDER CARDS ──────────────────────────────
function renderCards(lista) {
    const wrapper = document.getElementById('cards-wrapper');
    const emptyState = document.getElementById('empty-state');
    const tableWrapper = document.getElementById('table-wrapper');
    const countEl = document.getElementById('vehiculos-count');

    if (!wrapper) return;

    wrapper.innerHTML = '';
    if (lista.length === 0) {
        emptyState.style.display = 'block';
        tableWrapper.style.display = 'none';
        wrapper.style.display = 'none';
        if (countEl) countEl.textContent = '0 vehículos';
        return;
    }

    emptyState.style.display = 'none';
    tableWrapper.style.display = 'none';
    wrapper.style.display = 'grid';
    if (countEl) countEl.textContent = lista.length + ' vehículos';

    lista.forEach(v => {
        const card = document.createElement('div');
        card.className = 'vehicle-card';
        card.innerHTML = `
            <div class="card-image">${esc(v.marca)} ${esc(v.modelo)}</div>
            <div class="card-body">
                <h3 class="card-title">${esc(v.marca)} ${esc(v.modelo)}</h3>
                <p class="card-sub">${esc(String(v.anio))} · ${esc(v.combustible)}</p>
                <p class="card-price">$${formatNum(v.precio)}</p>
                <div class="card-actions">
                    ${isGuest() ? `<span class="badge-guest">Solo lectura</span>` :
                    `<button class="btn-tbl" onclick="editarDatos(${v.id})">Editar</button>
                     <button class="btn-tbl btn-tbl--delete" onclick="confirmarEliminar(${v.id})">Eliminar</button>`}
                </div>
            </div>
        `;
        wrapper.appendChild(card);
    });
}

// ─── CONFIRM DELETE ─────────────────────────────
async function confirmarEliminar(id) {
    const res = await fetch(API);
    const todos = await res.json();
    const v = todos.find(x => x.id === id);
    if (!v) return;
    showConfirmToast(`¿Eliminar ${v.marca} ${v.modelo}?`, () => eliminarDatos(id));
}

// ─── STATS ──────────────────────────────────────
function updateStats(lista) {
    const total = lista.length;
    const marcas = new Set(lista.map(v => v.marca.toLowerCase())).size;
    const valor = lista.reduce((acc, v) => acc + (v.precio * v.cantidad), 0);
    const combustibles = new Set(lista.map(v => v.combustible)).size;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-marcas').textContent = marcas;
    document.getElementById('stat-valor').textContent = '$' + formatNum(valor);
    document.getElementById('stat-combustibles').textContent = combustibles;
}

// ─── COLOR SWATCHES ────────────────────────────
function initColorSwatches() {
    const swatches = document.querySelectorAll('#color-swatches .swatch-btn');
    const colorInput = document.getElementById('color');
    const field = document.getElementById('color-trigger').closest('.color-field');
    const trigger = document.getElementById('color-trigger');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        field.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
        if (!field.contains(e.target)) field.classList.remove('is-open');
    });

    swatches.forEach(btn => {
        btn.addEventListener('click', () => {
            const isActive = btn.classList.contains('is-active');
            swatches.forEach(b => b.classList.remove('is-active'));
            if (isActive) {
                colorInput.value = '';
            } else {
                btn.classList.add('is-active');
                colorInput.value = btn.dataset.color;
            }
            field.classList.remove('is-open');
        });
    });

    colorInput.addEventListener('input', () => {
        const val = colorInput.value.trim();
        swatches.forEach(b => b.classList.toggle('is-active', b.dataset.color === val));
    });
}

function syncColorSwatches() {
    const val = document.getElementById('color').value.trim();
    document.querySelectorAll('#color-swatches .swatch-btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.color === val);
    });
}

// ─── FUEL SELECT ──────────────────────────────
function initFuelSelect() {
    const wrap = document.getElementById('fuel-select');
    const trigger = document.getElementById('fuel-trigger');
    const valueEl = document.getElementById('fuel-value');
    const iconEl = document.getElementById('fuel-icon');
    const options = document.getElementById('fuel-options');
    const hidden = document.getElementById('combustible');

    function selectOption(li, silent) {
        const value = li ? li.dataset.value : '';
        hidden.value = value;
        options.querySelectorAll('.fuel-option').forEach(o => o.classList.remove('is-active'));
        if (li) li.classList.add('is-active');
        iconEl.className = 'fuel-icon';
        iconEl.innerHTML = '';
        if (value) {
            const span = li.querySelector('span');
            valueEl.textContent = span ? span.textContent.trim() : li.textContent.trim();
            iconEl.classList.add('has-icon');
            if (li.dataset.icon) {
                const i = document.createElement('i');
                i.setAttribute('data-lucide', li.dataset.icon);
                iconEl.appendChild(i);
                if (window.lucide) window.lucide.createIcons();
            }
        } else {
            valueEl.textContent = valueEl.dataset.i18nDefault || valueEl.textContent;
        }
        if (!silent) {
            wrap.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    }

    valueEl.dataset.i18nDefault = valueEl.textContent;

    trigger.addEventListener('click', () => {
        const willOpen = !wrap.classList.contains('is-open');
        wrap.classList.toggle('is-open', willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
    });

    options.querySelectorAll('.fuel-option').forEach(li => {
        li.addEventListener('click', () => selectOption(li, false));
    });

    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
            wrap.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    wrap._syncFuelDisplay = function () {
        const val = hidden.value;
        if (!val) { selectOption(null, true); return; }
        const li = options.querySelector(`.fuel-option[data-value="${val}"]`);
        selectOption(li, true);
    };
}

function syncFuelDisplay() {
    const wrap = document.getElementById('fuel-select');
    if (wrap && wrap._syncFuelDisplay) wrap._syncFuelDisplay();
}

// ─── STEPPERS ──────────────────────────────────
function initQtyStepper() {
    const input = document.getElementById('cantidad');
    document.getElementById('qty-minus').addEventListener('click', () => {
        input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
        input.value = (parseInt(input.value, 10) || 0) + 1;
    });
}

function initAnioStepper() {
    const input = document.getElementById('anio');
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);
    const currentYear = new Date().getFullYear();

    document.getElementById('anio-minus').addEventListener('click', () => {
        let next = (parseInt(input.value, 10) || currentYear) - 1;
        if (!isNaN(min)) next = Math.max(min, next);
        input.value = next;
    });
    document.getElementById('anio-plus').addEventListener('click', () => {
        let next = (parseInt(input.value, 10) || currentYear) + 1;
        if (!isNaN(max)) next = Math.min(max, next);
        input.value = next;
    });
}

function initAutoGrowTextarea() {
    const textarea = document.getElementById('descripcion');
    if (!textarea) return;
    function resize() {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
    textarea.addEventListener('input', resize);
    resize();
}

// ─── ERROR HELPERS ─────────────────────────────
function setError(fieldId, msg) {
    const fg = document.getElementById('fg-' + fieldId);
    const err = document.getElementById('err-' + fieldId);
    if (fg) fg.classList.add('has-error');
    if (err) err.textContent = msg;
}

function clearErrors() {
    document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
    document.querySelectorAll('.field-error').forEach(el => (el.textContent = ''));
}

// ─── TOAST SYSTEM ──────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icons = { success: '✓', error: '✕', delete: '◆' };
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || '●'}</span><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function showConfirmToast(message, onConfirm) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast--delete';
    toast.style.cssText = 'flex-direction:column;gap:12px;align-items:flex-start;';
    toast.innerHTML = `
        <span style="font-size:13px;">${message}</span>
        <div style="display:flex;gap:8px;">
            <button onclick="this.closest('.toast').dataset.confirmed='yes'" class="btn-tbl" style="border-color:#fff;color:#fff;font-size:10px;padding:4px 10px;">Confirmar</button>
            <button onclick="this.closest('.toast').dataset.confirmed='no'"  class="btn-tbl" style="border-color:#666;color:#999;font-size:10px;padding:4px 10px;">Cancelar</button>
        </div>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

    const check = setInterval(() => {
        if (toast.dataset.confirmed === 'yes') { clearInterval(check); dismiss(); onConfirm(); }
        else if (toast.dataset.confirmed === 'no') { clearInterval(check); dismiss(); }
    }, 100);

    const auto = setTimeout(() => { clearInterval(check); dismiss(); }, 8000);

    function dismiss() {
        clearTimeout(auto);
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }
}

// ─── UTILITIES ──────────────────────────────────
function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatNum(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getUsuario() {
    try { return JSON.parse(localStorage.getItem('amUsuario')); } catch { return null; }
}

function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// ─── TRADUCCIONES (completas) ──────────────────
const traducciones = {
    es: {
        nav_dashboard: "Dashboard",
        nav_reg: "Registro",
        nav_inv: "Inventario",
        sec_dashboard: "Dashboard",
        sec_reg: "Registro de Vehículo",
        sec_inv: "Inventario",
        stat_veh: "Vehículos",
        stat_marcas: "Marcas",
        stat_valor: "Valor",
        stat_combustibles: "Combustibles",
        chart_fuel: "Combustible",
        chart_brands: "Marcas",
        chart_years: "Valor por Año",
        lbl_cod: "Código",
        ph_cod: "Ej. AM01",
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
        ph_buscar: "Buscar vehículo...",
        empty_title: "Sin vehículos registrados",
        empty_sub: "Usa el formulario para comenzar tu inventario.",
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
        ft_copy: "© 2026 AUTOMAX. TODOS LOS DERECHOS RESERVADOS."
    },
    en: {
        nav_dashboard: "Dashboard",
        nav_reg: "Registration",
        nav_inv: "Inventory",
        sec_dashboard: "Dashboard",
        sec_reg: "Vehicle Registration",
        sec_inv: "Inventory",
        stat_veh: "Vehicles",
        stat_marcas: "Brands",
        stat_valor: "Value",
        stat_combustibles: "Fuels",
        chart_fuel: "Fuel",
        chart_brands: "Brands",
        chart_years: "Value by Year",
        lbl_cod: "Code",
        ph_cod: "Ex. AM01",
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
        btn_reg: "Register Vehicle",
        btn_cancel: "Cancel",
        ph_buscar: "Search vehicle...",
        empty_title: "No vehicles registered",
        empty_sub: "Use the form to start your inventory.",
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
        ft_copy: "© 2026 AUTOMAX. ALL RIGHTS RESERVED."
    }
};

function cambiarIdioma(idioma) {
    document.getElementById('lang-es').classList.remove('active');
    document.getElementById('lang-en').classList.remove('active');
    document.getElementById('lang-' + idioma).classList.add('active');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const traduccion = traducciones[idioma][el.getAttribute('data-i18n')];
        if (!traduccion) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = traduccion;
        } else {
            el.textContent = traduccion;
        }
    });

    document.querySelectorAll('[data-i18n-color]').forEach(el => {
        const traduccion = traducciones[idioma][el.getAttribute('data-i18n-color')];
        if (traduccion) {
            const nameEl = el.querySelector('.swatch-name');
            if (nameEl) nameEl.textContent = traduccion;
        }
    });
}

// ─── INIT ────────────────────────────────────────
window.onload = async function () {
    if (window.lucide) lucide.createIcons();
    initSidebar();
    renderUserInfo();
    initColorSwatches();
    initFuelSelect();
    initQtyStepper();
    initAnioStepper();
    initAutoGrowTextarea();
    // Cargar datos con vista tabla por defecto
    await cargarVehiculos();
    cargarDashboard();
    // Aplicar vista y filtros iniciales
    setView('table');
    filterByFuel('all');
};