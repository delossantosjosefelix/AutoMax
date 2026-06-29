const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db'); // ← Asegura que db.js está en backend/

// ─── REGISTER ──────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { nombre, correo, password } = req.body;

    if (!nombre || !correo || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    try {
        const existente = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        if (existente.rows.length > 0) {
            return res.status(400).json({ error: 'El correo ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // 🔐 Guardamos hash y texto plano
        const result = await pool.query(
            `INSERT INTO usuarios (nombre, correo, password, password_plain)
             VALUES ($1, $2, $3, $4) RETURNING id, nombre, correo`,
            [nombre, correo, hashedPassword, password]
        );

        const usuario = result.rows[0];
        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo
            }
        });

    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({ error: 'Error al registrar usuario.' });
    }
});

// ─── LOGIN ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const usuario = result.rows[0];
        const validPassword = await bcrypt.compare(password, usuario.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
});

// ─── RECUPERAR CONTRASEÑA (SOLO SIMULACIÓN) ──────────
router.post('/recuperar', async (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        return res.status(400).json({ error: 'Correo requerido.' });
    }

    try {
        const result = await pool.query(
            'SELECT password_plain FROM usuarios WHERE correo = $1',
            [correo]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Correo no registrado.' });
        }

        const clave = result.rows[0].password_plain;
        res.json({ clave });

    } catch (error) {
        console.error('Error en recuperar contraseña:', error);
        res.status(500).json({ error: 'Error al recuperar contraseña.' });
    }
});

module.exports = router;