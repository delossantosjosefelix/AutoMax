const pool = require('../config/db');

const buscarPorCorreo = (correo) =>
    pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);

const buscarPorId = (id) =>
    pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);

const crearUsuario = (nombre, correo, hashedPassword, password, sucursal_id) =>
    pool.query(
        `INSERT INTO usuarios (nombre, correo, password, password_plain, sucursal_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, correo, rol, sucursal_id, activo, avatar_url`,
        [nombre, correo, hashedPassword, password, sucursal_id || null]
    );

const obtenerClavePlano = (correo) =>
    pool.query('SELECT password_plain FROM usuarios WHERE correo = $1', [correo]);

const actualizarPerfil = (id, nombre, correo) =>
    pool.query(
        `UPDATE usuarios SET nombre=$1, correo=$2 WHERE id=$3
         RETURNING id, nombre, correo, rol, sucursal_id, activo, fecha_registro, avatar_url`,
        [nombre, correo, id]
    );

const actualizarPassword = (id, hashedPassword, password) =>
    pool.query(
        'UPDATE usuarios SET password=$1, password_plain=$2 WHERE id=$3 RETURNING id',
        [hashedPassword, password, id]
    );

const actualizarSucursal = (id, sucursal_id) =>
    pool.query(
        `UPDATE usuarios SET sucursal_id=$1 WHERE id=$2
         RETURNING id, nombre, correo, rol, sucursal_id, activo`,
        [sucursal_id || null, id]
    );

const actualizarAvatar = (id, avatar_url) =>
    pool.query(
        `UPDATE usuarios SET avatar_url=$1 WHERE id=$2
         RETURNING id, nombre, correo, rol, sucursal_id, activo, avatar_url`,
        [avatar_url, id]
    );

const eliminarAvatar = (id) =>
    pool.query(
        `UPDATE usuarios SET avatar_url=NULL WHERE id=$1
         RETURNING id, nombre, correo, rol, sucursal_id, activo, avatar_url`,
        [id]
    );

const actualizarSucursalUsuario = (id, sucursal_id) =>
    pool.query(
        `UPDATE usuarios SET sucursal_id=$1 WHERE id=$2
         RETURNING id, nombre, correo, rol, sucursal_id, activo`,
        [sucursal_id || null, id]
    );

const buscarAdminPorCorreo = (correo) =>
    pool.query('SELECT * FROM usuarios WHERE correo = $1 AND rol = $2', [correo, 'admin']);

const listarTodos = () =>
    pool.query(
        `SELECT u.id, u.nombre, u.correo, u.rol, u.activo, u.sucursal_id, u.fecha_registro,
                s.nombre AS sucursal_nombre,
                COUNT(v.id)::int AS vehiculos_registrados
         FROM usuarios u
         LEFT JOIN sucursales s ON u.sucursal_id = s.id
         LEFT JOIN vehiculos v ON v.usuario_id = u.id
         GROUP BY u.id, s.nombre
         ORDER BY u.id`
    );

const cambiarRol = (id, rol) =>
    pool.query(
        'UPDATE usuarios SET rol=$1 WHERE id=$2 RETURNING id, nombre, correo, rol',
        [rol, id]
    );

const cambiarEstado = (id, activo) =>
    pool.query(
        'UPDATE usuarios SET activo=$1 WHERE id=$2 RETURNING id, nombre, correo, activo',
        [activo, id]
    );

const eliminar = (id) =>
    pool.query('DELETE FROM usuarios WHERE id=$1 RETURNING id', [id]);

const contarVehiculosPorUsuario = (id) =>
    pool.query('SELECT COUNT(*)::int AS total FROM vehiculos WHERE usuario_id=$1', [id]);

const actividadMensual = (id) =>
    pool.query(
        `SELECT TO_CHAR(fecha_registro, 'YYYY-MM') AS mes, COUNT(*)::int AS cantidad
         FROM vehiculos WHERE usuario_id=$1
         GROUP BY mes ORDER BY mes`,
        [id]
    );

module.exports = {
    buscarPorCorreo, buscarPorId, crearUsuario, obtenerClavePlano,
    actualizarPerfil, actualizarPassword, actualizarSucursal, listarTodos,
    cambiarRol, cambiarEstado, eliminar, contarVehiculosPorUsuario, actividadMensual,
    actualizarAvatar, eliminarAvatar, actualizarSucursalUsuario, buscarAdminPorCorreo
};