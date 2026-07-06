const pool = require('../config/db');

const obtenerTodos = (limit) =>
    pool.query(
        `SELECT v.*, s.nombre AS sucursal_nombre, s.ciudad AS sucursal_ciudad,
                u.nombre AS registrado_por
         FROM vehiculos v
         LEFT JOIN sucursales s ON v.sucursal_id = s.id
         LEFT JOIN usuarios u ON v.usuario_id = u.id
         ORDER BY v.id${limit ? ' LIMIT $1' : ''}`,
        limit ? [limit] : []
    );

const crear = (v) =>
    pool.query(
        `INSERT INTO vehiculos
         (codigo, marca, modelo, anio, color, combustible, transmision,
          condicion, precio, cantidad, descripcion, imagen, sucursal_id, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [v.codigo, v.marca, v.modelo, v.anio, v.color, v.combustible, v.transmision,
            v.condicion, v.precio, v.cantidad, v.descripcion, v.imagen, v.sucursal_id, v.usuario_id]
    );

const actualizar = (id, v) =>
    pool.query(
        `UPDATE vehiculos
         SET codigo=$1, marca=$2, modelo=$3, anio=$4, color=$5, combustible=$6,
             transmision=$7, condicion=$8, precio=$9, cantidad=$10, descripcion=$11,
             imagen=COALESCE($12, imagen), sucursal_id=$13
         WHERE id=$14
         RETURNING *`,
        [v.codigo, v.marca, v.modelo, v.anio, v.color, v.combustible, v.transmision,
            v.condicion, v.precio, v.cantidad, v.descripcion, v.imagen, v.sucursal_id, id]
    );

const eliminar = (id) =>
    pool.query('DELETE FROM vehiculos WHERE id=$1 RETURNING *', [id]);

module.exports = { obtenerTodos, crear, actualizar, eliminar };