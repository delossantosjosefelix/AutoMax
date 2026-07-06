const pool = require('../config/db');

const obtenerTodas = () =>
    pool.query('SELECT * FROM sucursales ORDER BY id');

const PALETTE = ["#4a90e2","#ff9f0a","#4caf50","#9b59b6","#1abc9c","#e74c3c","#3498db","#ff3b30"];

const crear = async (s) => {
    if (!s.color) {
        const count = await pool.query('SELECT COUNT(*) FROM sucursales');
        const idx = parseInt(count.rows[0].count) % PALETTE.length;
        s.color = PALETTE[idx];
    }
    return pool.query(
        `INSERT INTO sucursales (nombre, ciudad, direccion, telefono, encargado, color)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [s.nombre, s.ciudad, s.direccion, s.telefono, s.encargado, s.color]
    );
};

const actualizar = (id, s) =>
    pool.query(
        `UPDATE sucursales
         SET nombre=$1, ciudad=$2, direccion=$3, telefono=$4, encargado=$5, color=$6
         WHERE id=$7 RETURNING *`,
        [s.nombre, s.ciudad, s.direccion, s.telefono, s.encargado, s.color || null, id]
    );

const eliminar = (id) =>
    pool.query('DELETE FROM sucursales WHERE id=$1 RETURNING *', [id]);

module.exports = { obtenerTodas, crear, actualizar, eliminar };
