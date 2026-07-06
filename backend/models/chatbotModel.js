const pool = require('../config/db');

const buscarPorMarca = (marca) =>
  pool.query(
    `SELECT v.*, s.nombre AS sucursal_nombre
     FROM vehiculos v
     LEFT JOIN sucursales s ON v.sucursal_id = s.id
     WHERE v.marca ILIKE $1
     ORDER BY v.precio
     LIMIT 10`,
    [`%${marca}%`]
  );

const buscarPorModelo = (modelo) =>
  pool.query(
    `SELECT v.*, s.nombre AS sucursal_nombre
     FROM vehiculos v
     LEFT JOIN sucursales s ON v.sucursal_id = s.id
     WHERE v.modelo ILIKE $1
     ORDER BY v.precio
     LIMIT 10`,
    [`%${modelo}%`]
  );

const buscarPorRangoPrecio = (min, max) =>
  pool.query(
    `SELECT v.*, s.nombre AS sucursal_nombre
     FROM vehiculos v
     LEFT JOIN sucursales s ON v.sucursal_id = s.id
     WHERE v.precio BETWEEN $1 AND $2
     ORDER BY v.precio
     LIMIT 10`,
    [min, max]
  );

const buscarPorCondicion = (condicion) =>
  pool.query(
    `SELECT v.*, s.nombre AS sucursal_nombre
     FROM vehiculos v
     LEFT JOIN sucursales s ON v.sucursal_id = s.id
     WHERE v.condicion ILIKE $1
     ORDER BY v.precio
     LIMIT 10`,
    [condicion]
  );

const buscarPorTexto = (texto) =>
  pool.query(
    `SELECT v.*, s.nombre AS sucursal_nombre
     FROM vehiculos v
     LEFT JOIN sucursales s ON v.sucursal_id = s.id
     WHERE v.marca ILIKE $1
        OR v.modelo ILIKE $1
        OR v.codigo ILIKE $1
        OR v.color ILIKE $1
        OR v.combustible ILIKE $1
     ORDER BY v.precio
     LIMIT 10`,
    [`%${texto}%`]
  );

const buscarPorPalabras = (palabras) => {
  if (palabras.length === 0) return Promise.resolve({ rows: [] });
  const conditions = palabras.map((_, i) =>
    `(v.marca ILIKE $${i + 1} OR v.modelo ILIKE $${i + 1} OR v.color ILIKE $${i + 1} OR v.combustible ILIKE $${i + 1})`
  );
  const params = palabras.map(p => `%${p}%`);
  return pool.query(
    `SELECT v.*, s.nombre AS sucursal_nombre
     FROM vehiculos v
     LEFT JOIN sucursales s ON v.sucursal_id = s.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY v.precio
     LIMIT 10`,
    params
  );
};

const obtenerTodos = () =>
  pool.query(
    `SELECT v.*, s.nombre AS sucursal_nombre
     FROM vehiculos v
     LEFT JOIN sucursales s ON v.sucursal_id = s.id
     ORDER BY v.fecha_registro DESC
     LIMIT 10`
  );

const contarVehiculos = () =>
  pool.query('SELECT COUNT(*)::int AS total FROM vehiculos');

module.exports = {
  buscarPorMarca,
  buscarPorModelo,
  buscarPorRangoPrecio,
  buscarPorCondicion,
  buscarPorTexto,
  buscarPorPalabras,
  obtenerTodos,
  contarVehiculos,
};
