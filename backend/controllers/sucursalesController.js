const sucursalModel = require('../models/sucursalModel');

async function listar(req, res) {
    try {
        const resultado = await sucursalModel.obtenerTodas();
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error en GET /sucursales:', error);
        res.status(500).json({ error: 'Error al obtener sucursales.' });
    }
}

async function crear(req, res) {
    try {
        const { nombre, ciudad, direccion, telefono, encargado, color } = req.body;

        if (!nombre || !ciudad || !direccion || !telefono || !encargado) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        const nueva = await sucursalModel.crear({ nombre, ciudad, direccion, telefono, encargado, color });
        res.status(201).json(nueva.rows[0]);
    } catch (error) {
        console.error('Error en POST /sucursales:', error);
        res.status(500).json({ error: 'Error al registrar sucursal.' });
    }
}

async function actualizar(req, res) {
    try {
        const { id } = req.params;
        const { nombre, ciudad, direccion, telefono, encargado, color } = req.body;

        if (!nombre || !ciudad || !direccion || !telefono || !encargado) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        const resultado = await sucursalModel.actualizar(id, { nombre, ciudad, direccion, telefono, encargado, color });

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada.' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error en PUT /sucursales/:id:', error);
        res.status(500).json({ error: 'Error al actualizar sucursal.' });
    }
}

async function eliminar(req, res) {
    try {
        const { id } = req.params;
        const resultado = await sucursalModel.eliminar(id);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada.' });
        }

        res.json({ mensaje: 'Sucursal eliminada correctamente.' });
    } catch (error) {
        console.error('Error en DELETE /sucursales/:id:', error);
        res.status(500).json({ error: 'Error al eliminar sucursal.' });
    }
}

module.exports = { listar, crear, actualizar, eliminar };
