/* ===================================================
   AUTOMAX — script.js
   CRUD · LocalStorage · Validations · Toast
   =================================================== */

'use strict';

// ─── STATE ───────────────────────────────────────────
let editingCodigo = null; // null = create mode, string = edit mode

// ─── SPLASH ───────────────────────────────────────────
function skipSplash() {
  const splash = document.getElementById('splash');
  if (splash) splash.classList.add('hidden');
}

// Auto-dismiss splash after animation completes (~3.2s)
function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  // Car animation: starts 0.3s, drives 2.2s, brand reveals at 1.8s
  // Total hold: ~3.4s then fade out
  setTimeout(() => {
    splash.classList.add('hidden');
  }, 3600);
}

// ─── INIT ─────────────────────────────────────────────
window.onload = function () {
  initSplash();
  updateFooterYear();
  const listaVehiculos = getVehiculos();
  renderTabla(listaVehiculos);
  updateStats(listaVehiculos);
};

// ─── LOCALSTORAGE HELPERS ────────────────────────────
function getVehiculos() {
  return JSON.parse(localStorage.getItem('vehiculos')) || [];
}

function setVehiculos(lista) {
  localStorage.setItem('vehiculos', JSON.stringify(lista));
}

// ─── SAVE / UPDATE ────────────────────────────────────
function guardarDatos() {
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

  // Validations
  if (!codigo) {
    setError('codigo', 'Campo obligatorio');
    valid = false;
  }

  if (!marca) {
    setError('marca', 'Campo obligatorio');
    valid = false;
  }

  if (!modelo) {
    setError('modelo', 'Campo obligatorio');
    valid = false;
  }

  if (!anio) {
    setError('anio', 'Campo obligatorio');
    valid = false;
  } else {
    const y = parseInt(anio, 10);
    if (isNaN(y) || y < 1990 || y > 2026) {
      setError('anio', 'Año válido: 1990 – 2026');
      valid = false;
    }
  }

  if (!color) {
    setError('color', 'Campo obligatorio');
    valid = false;
  }

  if (!combustible) {
    setError('combustible', 'Selecciona un tipo');
    valid = false;
  }

  if (!precio) {
    setError('precio', 'Campo obligatorio');
    valid = false;
  } else {
    const p = parseFloat(precio);
    if (isNaN(p) || p <= 0) {
      setError('precio', 'Debe ser mayor a 0');
      valid = false;
    }
  }

  if (!cantidad) {
    setError('cantidad', 'Campo obligatorio');
    valid = false;
  } else {
    const c = parseInt(cantidad, 10);
    if (isNaN(c) || !Number.isInteger(c) || c < 1) {
      setError('cantidad', 'Número entero ≥ 1');
      valid = false;
    }
  }

  if (!descripcion) {
    setError('descripcion', 'Campo obligatorio');
    valid = false;
  }

  if (!valid) return;

  let listaVehiculos = getVehiculos();

  if (editingCodigo === null) {
    // CREATE — check duplicate code
    const duplicado = listaVehiculos.some(v => v.codigo === codigo);
    if (duplicado) {
      setError('codigo', 'Código ya existe');
      return;
    }

    const vehiculo = {
      codigo,
      marca,
      modelo,
      anio: parseInt(anio, 10),
      color,
      combustible,
      precio: parseFloat(precio),
      cantidad: parseInt(cantidad, 10),
      descripcion,
      fechaRegistro: new Date().toISOString()
    };

    listaVehiculos.push(vehiculo);
    setVehiculos(listaVehiculos);
    renderTabla(listaVehiculos);
    updateStats(listaVehiculos);
    resetForm();
    showToast('Vehículo registrado correctamente.', 'success');

  } else {
    // UPDATE — code might have changed; check duplicate excluding self
    const isDuplicate = listaVehiculos.some(
      v => v.codigo === codigo && v.codigo !== editingCodigo
    );
    if (isDuplicate) {
      setError('codigo', 'Código ya existe');
      return;
    }

    listaVehiculos = listaVehiculos.map(v => {
      if (v.codigo === editingCodigo) {
        return {
          ...v,
          codigo,
          marca,
          modelo,
          anio: parseInt(anio, 10),
          color,
          combustible,
          precio: parseFloat(precio),
          cantidad: parseInt(cantidad, 10),
          descripcion
        };
      }
      return v;
    });

    setVehiculos(listaVehiculos);
    renderTabla(listaVehiculos);
    updateStats(listaVehiculos);
    cancelarEdicion();
    showToast('Vehículo actualizado.', 'success');
  }
}

// ─── DELETE ───────────────────────────────────────────
function eliminarDatos(codigo) {
  let listaVehiculos = getVehiculos();
  const v = listaVehiculos.find(x => x.codigo === codigo);
  listaVehiculos = listaVehiculos.filter(v => v.codigo !== codigo);
  setVehiculos(listaVehiculos);
  renderTabla(listaVehiculos);
  updateStats(listaVehiculos);
  showToast(`${v ? v.marca + ' ' + v.modelo : 'Vehículo'} eliminado.`, 'delete');

  // If editing the deleted record, cancel
  if (editingCodigo === codigo) cancelarEdicion();
}

// ─── EDIT ─────────────────────────────────────────────
function editarDatos(codigo) {
  const lista = getVehiculos();
  const v = lista.find(x => x.codigo === codigo);
  if (!v) return;

  editingCodigo = codigo;

  document.getElementById('codigo').value      = v.codigo;
  document.getElementById('marca').value       = v.marca;
  document.getElementById('modelo').value      = v.modelo;
  document.getElementById('anio').value        = v.anio;
  document.getElementById('color').value       = v.color;
  document.getElementById('combustible').value = v.combustible;
  document.getElementById('precio').value      = v.precio;
  document.getElementById('cantidad').value    = v.cantidad;
  document.getElementById('descripcion').value = v.descripcion;

  document.querySelector('.btn-text').textContent = 'Actualizar Vehículo';
  document.getElementById('btn-cancel').style.display = 'inline-flex';

  // Scroll to form
  document.getElementById('registro').scrollIntoView({ behavior: 'smooth' });
  clearErrors();
}

// ─── CANCEL EDIT ──────────────────────────────────────
function cancelarEdicion() {
  editingCodigo = null;
  resetForm();
  document.querySelector('.btn-text').textContent = 'Registrar Vehículo';
  document.getElementById('btn-cancel').style.display = 'none';
}

// ─── RESET FORM ───────────────────────────────────────
function resetForm() {
  const ids = ['codigo', 'marca', 'modelo', 'anio', 'color', 'precio', 'cantidad', 'descripcion'];
  ids.forEach(id => (document.getElementById(id).value = ''));
  document.getElementById('combustible').value = '';
  clearErrors();
}

// ─── RENDER TABLE ─────────────────────────────────────
function renderTabla(lista) {
  const tbody       = document.getElementById('tabla-body');
  const emptyState  = document.getElementById('empty-state');
  const tableWrapper = document.getElementById('table-wrapper');

  tbody.innerHTML = '';

  if (lista.length === 0) {
    emptyState.style.display  = 'block';
    tableWrapper.style.display = 'none';
    return;
  }

  emptyState.style.display  = 'none';
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
          <button class="btn-tbl" onclick="editarDatos('${esc(v.codigo)}')">Editar</button>
          <button class="btn-tbl btn-tbl--delete" onclick="confirmarEliminar('${esc(v.codigo)}')">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── FILTER / SEARCH ──────────────────────────────────
function filtrarVehiculos() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const lista = getVehiculos();

  if (!q) {
    renderTabla(lista);
    return;
  }

  const filtrada = lista.filter(v =>
    v.codigo.toLowerCase().includes(q) ||
    v.marca.toLowerCase().includes(q) ||
    v.modelo.toLowerCase().includes(q) ||
    v.color.toLowerCase().includes(q) ||
    v.combustible.toLowerCase().includes(q) ||
    String(v.anio).includes(q)
  );

  renderTabla(filtrada);
}

// ─── CONFIRM DELETE ───────────────────────────────────
function confirmarEliminar(codigo) {
  const v = getVehiculos().find(x => x.codigo === codigo);
  if (!v) return;
  // Use inline confirm — no alert()
  showConfirmToast(`¿Eliminar ${v.marca} ${v.modelo}?`, () => eliminarDatos(codigo));
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
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function showConfirmToast(message, onConfirm) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast--delete';
  toast.style.flexDirection = 'column';
  toast.style.gap = '12px';
  toast.style.alignItems = 'flex-start';

  toast.innerHTML = `
    <span style="font-size:13px;">${message}</span>
    <div style="display:flex;gap:8px;">
      <button onclick="this.closest('.toast').dataset.confirmed='yes'" class="btn-tbl" style="border-color:#fff;color:#fff;font-size:10px;padding:4px 10px;">Confirmar</button>
      <button onclick="this.closest('.toast').dataset.confirmed='no'" class="btn-tbl" style="border-color:#666;color:#999;font-size:10px;padding:4px 10px;">Cancelar</button>
    </div>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  // Poll for confirm/cancel action
  const check = setInterval(() => {
    if (toast.dataset.confirmed === 'yes') {
      clearInterval(check);
      dismiss();
      onConfirm();
    } else if (toast.dataset.confirmed === 'no') {
      clearInterval(check);
      dismiss();
    }
  }, 100);

  // Auto-dismiss after 8 seconds if no action
  const auto = setTimeout(() => {
    clearInterval(check);
    dismiss();
  }, 8000);

  function dismiss() {
    clearTimeout(auto);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }
}

// ─── UTILITIES ────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNum(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function updateFooterYear() {
  const el = document.querySelector('.footer-copy');
  if (el) el.textContent = el.textContent.replace('{currentYear}', new Date().getFullYear());
}


// --- SISTEMA DE TRADUCCIÓN ---
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
    ft_copy: "© 2026 AUTOMAX. ALL RIGHTS RESERVED.", ft_term: "TERMS", ft_priv: "PRIVACY"
  }
};

function cambiarIdioma(idioma) {
  // 1. Cambiar la clase visual del botón en el Footer
  document.getElementById('lang-es').classList.remove('active');
  document.getElementById('lang-en').classList.remove('active');
  document.getElementById('lang-' + idioma).classList.add('active');

  // 2. Iterar sobre todos los elementos con data-i18n
  const elementos = document.querySelectorAll('[data-i18n]');
  elementos.forEach(el => {
    const clave = el.getAttribute('data-i18n');
    const traduccion = traducciones[idioma][clave];
    
    if (traduccion) {
      // Si el elemento es un input o textarea, actualizamos el placeholder
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = traduccion;
      } else {
        // Para textos normales (labels, spans, th, option, a)
        el.textContent = traduccion;
      }
    }
  });
}