const usuarioModel = require('../models/usuarioModel');

async function listar(req, res) {
    try {
        const resultado = await usuarioModel.listarTodos();
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error en GET /usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios.' });
    }
}

async function cambiarRol(req, res) {
    const { id } = req.params;
    const { rol } = req.body;
    const rolesValidos = ['empleado', 'gerente', 'admin'];

    if (!rolesValidos.includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido.' });
    }
    if (parseInt(id, 10) === req.usuario.id) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
    }

    try {
        const resultado = await usuarioModel.cambiarRol(id, rol);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al cambiar rol:', error);
        res.status(500).json({ error: 'Error al cambiar rol.' });
    }
}

async function cambiarEstado(req, res) {
    const { id } = req.params;
    const { activo } = req.body;

    if (parseInt(id, 10) === req.usuario.id) {
        return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
    }

    try {
        const resultado = await usuarioModel.cambiarEstado(id, activo);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).json({ error: 'Error al cambiar estado.' });
    }
}

async function cambiarSucursal(req, res) {
    const { id } = req.params;
    const { sucursal_id } = req.body;

    if (parseInt(id, 10) === req.usuario.id) {
        return res.status(400).json({ error: 'Cambia tu sucursal desde Mi Perfil.' });
    }

    // Admins and managers should not have a branch; only employees
    if (sucursal_id) {
        const targetUser = await usuarioModel.buscarPorId(id);
        if (targetUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        const targetRol = targetUser.rows[0].rol;
        if (targetRol !== 'empleado') {
            return res.status(400).json({ error: 'Solo los empleados pueden tener sucursal asignada.' });
        }
    }

    try {
        const resultado = await usuarioModel.actualizarSucursalUsuario(id, sucursal_id || null);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al cambiar sucursal del usuario:', error);
        res.status(500).json({ error: 'Error al cambiar sucursal.' });
    }
}

async function eliminar(req, res) {
    const { id } = req.params;

    if (parseInt(id, 10) === req.usuario.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    }

    try {
        const resultado = await usuarioModel.eliminar(id);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json({ mensaje: 'Usuario eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
}

module.exports = { listar, cambiarRol, cambiarEstado, cambiarSucursal, eliminar };