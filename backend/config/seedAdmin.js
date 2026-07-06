const bcrypt = require('bcrypt');
const pool = require('./db');

async function seedAdmin() {
    const correo = process.env.ADMIN_EMAIL || 'admin@automax.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin2026!';

    const existente = await pool.query('SELECT id FROM usuarios WHERE rol=$1 LIMIT 1', ['admin']);
    if (existente.rows.length > 0) return;

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
        `INSERT INTO usuarios (nombre, correo, password, password_plain, rol, activo)
         VALUES ($1,$2,$3,$4,'admin',true)`,
        ['Administrador AUTOMAX', correo, hash, password]
    );

    console.log('Usuario admin creado automáticamente');
    console.log('  Correo: ' + correo);
    console.log('  Contraseña: ' + password);
}

module.exports = seedAdmin;