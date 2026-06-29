'use strict';

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
const pool     = require('./db');
const authRouter = require('./auth');

const app = express();

app.use(cors());
app.use(express.json());

// ─── RUTAS DE AUTENTICACIÓN ───────────────────────────
app.use('/api/auth', authRouter);

// ─── MIDDLEWARE: verificar JWT ────────────────────────
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Token requerido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
}

// ─── GET /vehiculos — público (invitados pueden ver) ──
app.get('/vehiculos', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM vehiculos ORDER BY id'
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error en GET /vehiculos:', error);
        res.status(500).json({ error: 'Error al obtener vehículos.' });
    }
});

// ─── POST /vehiculos — protegido ──────────────────────
app.post('/vehiculos', verificarToken, async (req, res) => {
    try {
        const {
            codigo, marca, modelo, anio,
            color, combustible, precio,
            cantidad, descripcion
        } = req.body;

        const nuevo = await pool.query(
            `INSERT INTO vehiculos
             (codigo, marca, modelo, anio, color,
              combustible, precio, cantidad, descripcion)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [codigo, marca, modelo, anio, color,
             combustible, precio, cantidad, descripcion]
        );

        res.status(201).json(nuevo.rows[0]);

    } catch (error) {
        console.error('Error en POST /vehiculos:', error);
        res.status(500).json({ error: 'Error al registrar vehículo.' });
    }
});

// ─── PUT /vehiculos/:id — protegido ───────────────────
app.put('/vehiculos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            codigo, marca, modelo, anio,
            color, combustible, precio,
            cantidad, descripcion
        } = req.body;

        const resultado = await pool.query(
            `UPDATE vehiculos
             SET codigo=$1, marca=$2, modelo=$3, anio=$4, color=$5,
                 combustible=$6, precio=$7, cantidad=$8, descripcion=$9
             WHERE id=$10
             RETURNING *`,
            [codigo, marca, modelo, anio, color,
             combustible, precio, cantidad, descripcion, id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Vehículo no encontrado.' });
        }

        res.json(resultado.rows[0]);

    } catch (error) {
        console.error('Error en PUT /vehiculos/:id:', error);
        res.status(500).json({ error: 'Error al actualizar vehículo.' });
    }
});

// ─── DELETE /vehiculos/:id — protegido ────────────────
app.delete('/vehiculos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const resultado = await pool.query(
            'DELETE FROM vehiculos WHERE id=$1 RETURNING *',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Vehículo no encontrado.' });
        }

        res.json({ mensaje: 'Vehículo eliminado correctamente.' });

    } catch (error) {
        console.error('Error en DELETE /vehiculos/:id:', error);
        res.status(500).json({ error: 'Error al eliminar vehículo.' });
    }
});

// ─── SERVIDOR ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor AutoMax corriendo en puerto ${PORT}`);
});