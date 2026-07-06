# Rediseño de Vehículos Nuevos

## 1. HTML (`frontend/html/nuevos.html`)

Reemplazar TODO el contenido DENTRO de `<main id="main-content">` con:

```html
<main id="main-content">
  <div class="page-bar">
    <span class="page-bar-tag">— 04</span>
    <h2 class="page-bar-title">Vehículos Nuevos</h2>
    <div class="page-bar-actions">
      <div class="btn-group">
        <button class="btn btn--ghost btn-sm" onclick="generarPDFInventario()"><i data-lucide="file-down"></i> PDF</button>
      </div>
    </div>
  </div>
  <section class="section section--dark">
    <div class="toolbar">
      <div class="search-wrapper"><i data-lucide="search" class="search-icon"></i><input type="text" id="search-input" class="search-input" placeholder="Buscar vehículo..." oninput="filtrarVehiculos()" /></div>
      <div id="sucursal-filter-dropdown" class="custom-select custom-select--toolbar">
        <button class="custom-select-trigger" type="button" aria-expanded="false"><span class="custom-select-value">Todas las sucursales</span><span class="custom-select-icon"></span></button>
        <ul class="custom-select-options" role="listbox"></ul>
      </div>
      <select id="sucursal-filter-select" style="display:none"></select>
      <div class="view-toggle">
        <button id="view-table" class="view-btn active" onclick="setView('table')"><i data-lucide="table"></i></button>
        <button id="view-cards" class="view-btn" onclick="setView('cards')"><i data-lucide="grid"></i></button>
      </div>
    </div>
    <div class="toolbar-row">
      <div class="filter-group">
        <button class="filter-btn active" data-filter="all" onclick="filterByFuel('all')">Todos</button>
        <button class="filter-btn" data-filter="Gasolina" onclick="filterByFuel('Gasolina')">Gasolina</button>
        <button class="filter-btn" data-filter="Diésel" onclick="filterByFuel('Diésel')">Diésel</button>
        <button class="filter-btn" data-filter="Eléctrico" onclick="filterByFuel('Eléctrico')">Eléctrico</button>
        <button class="filter-btn" data-filter="Híbrido" onclick="filterByFuel('Híbrido')">Híbrido</button>
      </div>
    </div>
    <div class="table-wrapper" id="table-wrapper">
      <table class="vehicle-table">
        <thead><tr><th>Imagen</th><th>Código</th><th>Marca</th><th>Modelo</th><th>Año</th><th>Color</th><th>Combustible</th><th>Transmisión</th><th>Condición</th><th>Sucursal</th><th>Precio</th><th>Cantidad</th><th>Acciones</th></tr></thead>
        <tbody id="tabla-body"></tbody>
      </table>
    </div>
    <div id="cards-wrapper" class="vehicle-grid" style="display:none"></div>
    <div id="empty-state" class="empty-state" style="display:none">
      <span class="empty-number">0</span>
      <p class="empty-title">No se encontraron vehículos nuevos</p>
      <p class="empty-sub">Intenta ajustar los filtros.</p>
    </div>
  </section>
</main>
```

### Cambios específicos:
- Se ELIMINA `section-header--between` con tag + title + botón primary
- Se ELIMINA `#vehiculos-count`
- Se AGREGA `page-bar` con tag + title + botón ghost en `page-bar-actions`
- Se UNIFICAN las 2 toolbar en 1: search + branch filter + view toggle en una fila
- Se CREA `toolbar-row` separada solo para fuel filters
- Se quita `search-wrapper--wide` (redundante)
- Se cambia placeholder de "Buscar..." a "Buscar vehículo..."
- Botón PDF cambia de `btn--primary` a `btn--ghost`

---

## 2. CSS (`frontend/css/inventario.css`)

### 2a. Agregar al INICIO del archivo (después del comentario):

```css
/* ─── PAGE BAR ─────────────────────────── */
.page-bar {
    display: flex;
    align-items: center;
    height: 64px;
    padding: 0 32px;
    background: #000;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky;
    top: 0;
    z-index: 50;
    gap: 16px;
}
.page-bar-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #888;
    flex-shrink: 0;
}
.page-bar-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.05em;
    color: #fff;
    margin: 0;
}
.page-bar-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
}
```

### 2b. Reemplazar la regla `.toolbar` completa (líneas 2-11) con:

```css
.toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}
.toolbar .search-wrapper {
    flex: 1;
    min-width: 200px;
}
```

### 2c. Agregar `.toolbar-row` después de `.toolbar`:

```css
.toolbar-row {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
}
```

### 2d. Agregar después de `.page-bar` styles:

```css
.page-bar + .section {
    padding-top: 20px;
}
```

### 2e. ELIMINAR estas reglas:

```css
/* Eliminar completamente */
.toolbar:last-of-type { margin-bottom: 24px; }       /* línea 9-11 */
.toolbar .filter-group { margin-right: auto; }         /* línea 16-18 */
#vehiculos-count { ... }                               /* líneas 97-103 */

/* Cambiar */
.search-wrapper--wide { max-width: 380px; }            /* línea 25 - eliminar */

/* Modificar */
.toolbar .search-wrapper {                             /* líneas 12-15 */
    flex: 1;
    min-width: 240px;  →  min-width: 200px;           /* reducir */
}
```

---

## Resultado visual esperado

```
┌──────────┬────────────────────────────────────────────────────┐
│   AM     │  — 04    VEHÍCULOS NUEVOS                [ PDF ]  │ ← page-bar (sticky)
│  (64px)  ├────────────────────────────────────────────────────┤
│          │  🔍 Buscar vehículo...       [Todas ▼]   [⊞] [⊟] │ ← toolbar
│  Inicio  │  [⚡ Todos] [⛽ Gasolina] [💧 Diésel]            │ ← toolbar-row
│  Nuevos  │  [🔌 Eléctrico] [🔋 Híbrido]                     │
│  Usados  │  ┌─────────────────────────────────────────┐     │
│          │  │ Imagen │ Código │ Marca │ Modelo │ ... │     │ ← tabla
│          │  └─────────────────────────────────────────┘     │
└──────────┴────────────────────────────────────────────────────┘
```
