'use strict';

const API = "http://localhost:3000/vehiculos";
let editingId = null;

// ─── INIT ─────────────────────────────────────────────
window.onload = async function () {
  if (window.lucide) window.lucide.createIcons();
  updateFooterYear();
  initColorSwatches();
  initFuelSelect();
  initQtyStepper();
  initAnioStepper();
  initAutoGrowTextarea();
  await cargarVehiculos();
};

// ─── API HELPERS ──────────────────────────────────────
async function cargarVehiculos() {
  const res = await fetch(API);
  const lista = await res.json();
  renderTabla(lista);
  updateStats(lista);
}

// ─── SAVE / UPDATE ────────────────────────────────────
async function guardarDatos() {
  clearErrors();

  const codigo      = document.getElementById('codigo').value.trim().toUpperCase();
  const marca       = document.getElementById('marca').value.trim();
  const modelo      = document.getElementById('modelo').value.trim();
  const anio        = document.getElementById('anio').value.trim();
  const color       = document.getElementById('color').value.trim();
  const combustible = document.getElementById('combustible').value;
  const precio      = document.getElementById('precio').value.trim();
  const cantidad    = document.getElementById('cantidad').value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();

  let valid = true;

  if (!codigo)      { setError('codigo', 'Campo obligatorio');     valid = false; }
  if (!marca)       { setError('marca', 'Campo obligatorio');      valid = false; }
  if (!modelo)      { setError('modelo', 'Campo obligatorio');     valid = false; }
  if (!anio) {
    setError('anio', 'Campo obligatorio'); valid = false;
  } else {
    const y = parseInt(anio, 10);
    if (isNaN(y) || y < 1990 || y > 2026) { setError('anio', 'Año válido: 1990 – 2026'); valid = false; }
  }
  if (!color)       { setError('color', 'Campo obligatorio');      valid = false; }
  if (!combustible) { setError('combustible', 'Selecciona un tipo'); valid = false; }
  if (!precio) {
    setError('precio', 'Campo obligatorio'); valid = false;
  } else {
    const p = parseFloat(precio);
    if (isNaN(p) || p <= 0) { setError('precio', 'Debe ser mayor a 0'); valid = false; }
  }
  if (!cantidad) {
    setError('cantidad', 'Campo obligatorio'); valid = false;
  } else {
    const c = parseInt(cantidad, 10);
    if (isNaN(c) || c < 1) { setError('cantidad', 'Número entero ≥ 1'); valid = false; }
  }
  if (!descripcion) { setError('descripcion', 'Campo obligatorio'); valid = false; }

  if (!valid) return;

  const vehiculo = {
    codigo,
    marca,
    modelo,
    anio:      parseInt(anio, 10),
    color,
    combustible,
    precio:    parseFloat(precio),
    cantidad:  parseInt(cantidad, 10),
    descripcion
  };

  if (editingId === null) {
    // ── CREATE ──
    // Verificar código duplicado
    const resCheck = await fetch(API);
    const todos = await resCheck.json();
    const duplicado = todos.some(v => v.codigo === codigo);
    if (duplicado) { setError('codigo', 'Código ya existe'); return; }

    vehiculo.fechaRegistro = new Date().toISOString();

    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehiculo)
    });

    resetForm();
    showToast('Vehículo registrado correctamente.', 'success');

  } else {
    // ── UPDATE ──
    // Verificar código duplicado excluyendo el registro actual
    const resCheck = await fetch(API);
    const todos = await resCheck.json();
    const duplicado = todos.some(v => v.codigo === codigo && v.id !== editingId);
    if (duplicado) { setError('codigo', 'Código ya existe'); return; }

    await fetch(`${API}/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehiculo)
    });

    cancelarEdicion();
    showToast('Vehículo actualizado.', 'success');
  }

  await cargarVehiculos();
}

// ─── DELETE ───────────────────────────────────────────
async function eliminarDatos(id) {
  const res = await fetch(API);
  const todos = await res.json();
  const v = todos.find(x => x.id === id);

  await fetch(`${API}/${id}`, { method: "DELETE" });

  showToast(`${v ? v.marca + ' ' + v.modelo : 'Vehículo'} eliminado.`, 'delete');

  if (editingId === id) cancelarEdicion();

  await cargarVehiculos();
}

// ─── EDIT ─────────────────────────────────────────────
async function editarDatos(id) {
  const res = await fetch(API);
  const todos = await res.json();
  const v = todos.find(x => x.id === id);
  if (!v) return;

  editingId = id;

  document.getElementById('codigo').value      = v.codigo;
  document.getElementById('marca').value       = v.marca;
  document.getElementById('modelo').value      = v.modelo;
  document.getElementById('anio').value        = v.anio;
  document.getElementById('color').value       = v.color;
  document.getElementById('combustible').value = v.combustible;
  document.getElementById('precio').value      = v.precio;
  document.getElementById('cantidad').value    = v.cantidad;
  document.getElementById('descripcion').value = v.descripcion;

  syncColorSwatches();
  syncFuelDisplay();

  const descEl = document.getElementById('descripcion');
  descEl.style.height = 'auto';
  descEl.style.height = descEl.scrollHeight + 'px';

  document.querySelector('.btn-text').textContent = 'Actualizar Vehículo';
  document.getElementById('btn-cancel').style.display = 'inline-flex';

  document.getElementById('registro').scrollIntoView({ behavior: 'smooth' });
  clearErrors();
}

// ─── CANCEL EDIT ──────────────────────────────────────
function cancelarEdicion() {
  editingId = null;
  resetForm();
  document.querySelector('.btn-text').textContent = 'Registrar Vehículo';
  document.getElementById('btn-cancel').style.display = 'none';
}

// ─── RESET FORM ───────────────────────────────────────
function resetForm() {
  ['codigo','marca','modelo','anio','color','precio','cantidad','descripcion']
    .forEach(id => (document.getElementById(id).value = ''));
  document.getElementById('combustible').value = '';
  syncColorSwatches();
  syncFuelDisplay();
  document.getElementById('descripcion').style.height = 'auto';
  clearErrors();
}

// ─── RENDER TABLE ─────────────────────────────────────
function renderTabla(lista) {
  const tbody        = document.getElementById('tabla-body');
  const emptyState   = document.getElementById('empty-state');
  const tableWrapper = document.getElementById('table-wrapper');

  tbody.innerHTML = '';

  if (lista.length === 0) {
    emptyState.style.display   = 'block';
    tableWrapper.style.display = 'none';
    return;
  }

  emptyState.style.display   = 'none';
  tableWrapper.style.display = 'block';

  lista.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="tbl-code">${esc(v.codigo)}</td>
      <td class="tbl-marca">${esc(v.marca)}</td>
      <td>${esc(v.modelo)}</td>
      <td class="tbl-muted">${esc(String(v.anio))}</td>
      <td class="tbl-muted">${esc(v.color)}</td>
      <td class="tbl-muted">${esc(v.combustible)}</td>
      <td class="tbl-price">$${formatNum(v.precio)}</td>
      <td class="tbl-muted">${esc(String(v.cantidad))}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-tbl" onclick="editarDatos(${v.id})">Editar</button>
          <button class="btn-tbl btn-tbl--delete" onclick="confirmarEliminar(${v.id})">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── FILTER / SEARCH ──────────────────────────────────
async function filtrarVehiculos() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const res = await fetch(API);
  const lista = await res.json();

  if (!q) { renderTabla(lista); return; }

  const filtrada = lista.filter(v =>
    v.codigo.toLowerCase().includes(q) ||
    v.marca.toLowerCase().includes(q)  ||
    v.modelo.toLowerCase().includes(q) ||
    v.color.toLowerCase().includes(q)  ||
    v.combustible.toLowerCase().includes(q) ||
    String(v.anio).includes(q)
  );

  renderTabla(filtrada);
}

// ─── CONFIRM DELETE ───────────────────────────────────
async function confirmarEliminar(id) {
  const res = await fetch(API);
  const todos = await res.json();
  const v = todos.find(x => x.id === id);
  if (!v) return;
  showConfirmToast(`¿Eliminar ${v.marca} ${v.modelo}?`, () => eliminarDatos(id));
}

// ─── STATS ────────────────────────────────────────────
function updateStats(lista) {
  const total  = lista.length;
  const marcas = new Set(lista.map(v => v.marca.toLowerCase())).size;
  const valor  = lista.reduce((acc, v) => acc + (v.precio * v.cantidad), 0);

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-marcas').textContent = marcas;
  document.getElementById('stat-valor').textContent  = '$' + formatNum(valor);
}

// ─── COLOR SWATCHES ──────────────────────────────────
function initColorSwatches() {
  const swatches   = document.querySelectorAll('#color-swatches .swatch-btn');
  const colorInput = document.getElementById('color');
  const field      = document.getElementById('color-trigger').closest('.color-field');
  const trigger    = document.getElementById('color-trigger');

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

// ─── CUSTOM FUEL SELECT ──────────────────────────────
function initFuelSelect() {
  const wrap    = document.getElementById('fuel-select');
  const trigger = document.getElementById('fuel-trigger');
  const valueEl = document.getElementById('fuel-value');
  const iconEl  = document.getElementById('fuel-icon');
  const options = document.getElementById('fuel-options');
  const hidden  = document.getElementById('combustible');

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

// ─── STEPPERS ─────────────────────────────────────────
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

// ─── AUTO-GROW TEXTAREA ───────────────────────────────
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

// ─── ERROR HELPERS ────────────────────────────────────
function setError(fieldId, msg) {
  const fg  = document.getElementById('fg-' + fieldId);
  const err = document.getElementById('err-' + fieldId);
  if (fg)  fg.classList.add('has-error');
  if (err) err.textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
  document.querySelectorAll('.field-error').forEach(el => (el.textContent = ''));
}

// ─── TOAST SYSTEM ─────────────────────────────────────
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

// ─── UTILITIES ────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatNum(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateFooterYear() {
  const el = document.querySelector('.footer-copy');
  if (el) el.textContent = el.textContent.replace('{currentYear}', new Date().getFullYear());
}

// ─── SISTEMA DE TRADUCCIÓN ────────────────────────────
const traducciones = {
  es: {
    nav_reg: "Registro", nav_inv: "Inventario",
    hero_tag: "Portal de Gestión de Flota",
    stat_veh: "Vehículos", stat_marcas: "Marcas", stat_val: "Valor Inventario",
    sec_reg: "Registro de Vehículo",
    lbl_cod: "Código", ph_cod: "Ej. AM01",
    lbl_marca: "Marca", ph_marca: "Ej. Toyota",
    lbl_mod: "Modelo", ph_mod: "Ej. Hilux",
    lbl_anio: "Año", ph_anio: "Ej. 2024",
    lbl_color: "Color", ph_color: "Ej. Negro Mate",
    lbl_comb: "Combustible", opt_sel: "— Seleccionar —", opt_gas: "Gasolina", opt_die: "Diésel", opt_elec: "Eléctrico", opt_hib: "Híbrido", opt_glp: "GLP",
    lbl_precio: "Precio (USD)", ph_precio: "Ej. 25000.00",
    lbl_cant: "Cantidad", ph_cant: "Ej. 5",
    lbl_desc: "Descripción", ph_desc: "Ej. Vehículo de transmisión automática...",
    btn_reg: "Registrar Vehículo", btn_cancel: "Cancelar",
    sec_inv: "Inventario", ph_buscar: "Buscar…",
    empty_title: "Sin vehículos registrados", empty_sub: "Usa el formulario para comenzar tu inventario.",
    th_cod: "Código", th_marca: "Marca", th_mod: "Modelo", th_anio: "Año", th_color: "Color", th_comb: "Comb.", th_precio: "Precio", th_cant: "Cant.",
    sw_negro: "Negro", sw_blanco: "Blanco", sw_gris: "Gris", sw_plata: "Plata", sw_rojo: "Rojo", sw_azul: "Azul", sw_verde: "Verde", sw_amarillo: "Amarillo", sw_naranja: "Naranja", sw_cafe: "Café", sw_dorado: "Dorado",
    ft_copy: "© 2026 AUTOMAX. TODOS LOS DERECHOS RESERVADOS.", ft_term: "TÉRMINOS", ft_priv: "PRIVACIDAD"
  },
  en: {
    nav_reg: "Registration", nav_inv: "Inventory",
    hero_tag: "Fleet Management Portal",
    stat_veh: "Vehicles", stat_marcas: "Brands", stat_val: "Inventory Value",
    sec_reg: "Vehicle Registration",
    lbl_cod: "Code", ph_cod: "Ex. AM01",
    lbl_marca: "Brand", ph_marca: "Ex. Toyota",
    lbl_mod: "Model", ph_mod: "Ex. Hilux",
    lbl_anio: "Year", ph_anio: "Ex. 2024",
    lbl_color: "Color", ph_color: "Ex. Matte Black",
    lbl_comb: "Fuel Type", opt_sel: "— Select —", opt_gas: "Gasoline", opt_die: "Diesel", opt_elec: "Electric", opt_hib: "Hybrid", opt_glp: "LPG",
    lbl_precio: "Price (USD)", ph_precio: "Ex. 25000.00",
    lbl_cant: "Quantity", ph_cant: "Ex. 5",
    lbl_desc: "Description", ph_desc: "Ex. Automatic transmission...",
    btn_reg: "Register Vehicle", btn_cancel: "Cancel",
    sec_inv: "Inventory", ph_buscar: "Search…",
    empty_title: "No vehicles registered", empty_sub: "Use the form to start your inventory.",
    th_cod: "Code", th_marca: "Brand", th_mod: "Model", th_anio: "Year", th_color: "Color", th_comb: "Fuel", th_precio: "Price", th_cant: "Qty",
    sw_negro: "Black", sw_blanco: "White", sw_gris: "Gray", sw_plata: "Silver", sw_rojo: "Red", sw_azul: "Blue", sw_verde: "Green", sw_amarillo: "Yellow", sw_naranja: "Orange", sw_cafe: "Brown", sw_dorado: "Gold",
    ft_copy: "© 2026 AUTOMAX. ALL RIGHTS RESERVED.", ft_term: "TERMS", ft_priv: "PRIVACY"
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