const vehiculoModel = require('../models/vehiculoModel');

async function listar(req, res) {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
        const resultado = await vehiculoModel.obtenerTodos(limit);
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error en GET /vehiculos:', error);
        res.status(500).json({ error: 'Error al obtener vehículos.' });
    }
}

async function crear(req, res) {
    try {
        const {
            codigo, marca, modelo, anio, color, combustible,
            transmision, condicion, precio, cantidad, descripcion, sucursal_id
        } = req.body;

        const imagen = req.file ? `/images/uploads/vehiculos/${req.file.filename}` : null;

        const nuevo = await vehiculoModel.crear({
            codigo, marca, modelo,
            anio: parseInt(anio, 10),
            color, combustible, transmision, condicion,
            precio: parseFloat(precio),
            cantidad: parseInt(cantidad, 10),
            descripcion, imagen,
            sucursal_id: sucursal_id ? parseInt(sucursal_id, 10) : null,
            usuario_id: req.usuario.id
        });

        res.status(201).json(nuevo.rows[0]);
    } catch (error) {
        console.error('Error en POST /vehiculos:', error);
        res.status(500).json({ error: 'Error al registrar vehículo.' });
    }
}

async function actualizar(req, res) {
    try {
        const { id } = req.params;
        const {
            codigo, marca, modelo, anio, color, combustible,
            transmision, condicion, precio, cantidad, descripcion, sucursal_id
        } = req.body;

        const imagen = req.file ? `/images/uploads/vehiculos/${req.file.filename}` : null;

        const resultado = await vehiculoModel.actualizar(id, {
            codigo, marca, modelo,
            anio: parseInt(anio, 10),
            color, combustible, transmision, condicion,
            precio: parseFloat(precio),
            cantidad: parseInt(cantidad, 10),
            descripcion, imagen,
            sucursal_id: sucursal_id ? parseInt(sucursal_id, 10) : null
        });

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Vehículo no encontrado.' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error en PUT /vehiculos/:id:', error);
        res.status(500).json({ error: 'Error al actualizar vehículo.' });
    }
}

async function eliminar(req, res) {
    try {
        const { id } = req.params;
        const resultado = await vehiculoModel.eliminar(id);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Vehículo no encontrado.' });
        }

        res.json({ mensaje: 'Vehículo eliminado correctamente.' });
    } catch (error) {
        console.error('Error en DELETE /vehiculos/:id:', error);
        res.status(500).json({ error: 'Error al eliminar vehículo.' });
    }
}

module.exports = { listar, crear, actualizar, eliminar };
