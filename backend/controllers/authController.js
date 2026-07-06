const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioModel = require('../models/usuarioModel');

function passwordValida(password) {
    return password.length >= 6 &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[!@#$%^&*(),.?":{}|<>]/.test(password);
}

async function register(req, res) {
    const { nombre, correo, password, sucursal_id, rol } = req.body;

    if (!nombre || !correo || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    // Only employees need a branch; admins and managers don't belong to any branch
    const finalRol = rol || 'empleado';
    if (finalRol === 'empleado' && !sucursal_id) {
        return res.status(400).json({ error: 'Los empleados deben seleccionar una sucursal.' });
    }

    try {
        const existente = await usuarioModel.buscarPorCorreo(correo);
        if (existente.rows.length > 0) {
            return res.status(400).json({ error: 'El correo ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await usuarioModel.crearUsuario(nombre, correo, hashedPassword, password, finalRol === 'empleado' ? sucursal_id : null);
        const usuario = result.rows[0];

        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, sucursal_id: usuario.sucursal_id, avatar_url: usuario.avatar_url },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({ token, usuario });
    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({ error: 'Error al registrar usuario.' });
    }
}

async function login(req, res) {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }

    try {
        const result = await usuarioModel.buscarPorCorreo(correo);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const usuario = result.rows[0];

        if (!usuario.activo) {
            return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta a un administrador.' });
        }

        const validPassword = await bcrypt.compare(password, usuario.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, sucursal_id: usuario.sucursal_id, avatar_url: usuario.avatar_url },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, sucursal_id: usuario.sucursal_id, avatar_url: usuario.avatar_url }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
}

async function recuperar(req, res) {
    const { correo } = req.body;

    if (!correo) {
        return res.status(400).json({ error: 'Correo requerido.' });
    }

    try {
        // Block admin password recovery
        const adminResult = await usuarioModel.buscarAdminPorCorreo(correo);
        if (adminResult.rows.length > 0) {
            return res.status(403).json({ error: 'No se puede recuperar la contraseña del administrador.' });
        }

        const result = await usuarioModel.obtenerClavePlano(correo);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Correo no registrado.' });
        }

        res.json({ clave: result.rows[0].password_plain });
    } catch (error) {
        console.error('Error en recuperar contraseña:', error);
        res.status(500).json({ error: 'Error al recuperar contraseña.' });
    }
}

async function actualizarPerfil(req, res) {
    const { nombre, correo } = req.body;
    if (!nombre || !correo) {
        return res.status(400).json({ error: 'Nombre y correo son obligatorios.' });
    }

    try {
        const existente = await usuarioModel.buscarPorCorreo(correo);
        if (existente.rows.length > 0 && existente.rows[0].id !== req.usuario.id) {
            return res.status(400).json({ error: 'Ese correo ya está en uso.' });
        }

        const resultado = await usuarioModel.actualizarPerfil(req.usuario.id, nombre, correo);
        const usuario = resultado.rows[0];

        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, sucursal_id: usuario.sucursal_id, avatar_url: usuario.avatar_url },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, usuario });
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({ error: 'Error al actualizar perfil.' });
    }
}

async function cambiarPassword(req, res) {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) {
        return res.status(400).json({ error: 'Contraseña actual y nueva son obligatorias.' });
    }
    if (!passwordValida(nueva)) {
        return res.status(400).json({ error: 'La nueva contraseña no cumple los requisitos.' });
    }

    try {
        const result = await usuarioModel.buscarPorId(req.usuario.id);
        const usuario = result.rows[0];

        const validPassword = await bcrypt.compare(actual, usuario.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }

        const hashedPassword = await bcrypt.hash(nueva, 10);
        await usuarioModel.actualizarPassword(req.usuario.id, hashedPassword, nueva);

        res.json({ mensaje: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña.' });
    }
}

async function cambiarSucursal(req, res) {
    const { sucursal_id } = req.body;
    if (!sucursal_id) {
        return res.status(400).json({ error: 'Sucursal requerida.' });
    }

    try {
        const resultado = await usuarioModel.actualizarSucursal(req.usuario.id, parseInt(sucursal_id, 10));
        const usuario = resultado.rows[0];

        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, sucursal_id: usuario.sucursal_id, avatar_url: usuario.avatar_url },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, usuario });
    } catch (error) {
        console.error('Error al cambiar sucursal:', error);
        res.status(500).json({ error: 'Error al cambiar sucursal.' });
    }
}

async function actualizarAvatar(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Selecciona una imagen.' });
        }
        const avatar_url = `/images/uploads/avatars/${req.file.filename}`;
        const resultado = await usuarioModel.actualizarAvatar(req.usuario.id, avatar_url);
        const usuario = resultado.rows[0];

        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, sucursal_id: usuario.sucursal_id, avatar_url: usuario.avatar_url },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, usuario });
    } catch (error) {
        console.error('Error al actualizar avatar:', error);
        res.status(500).json({ error: 'Error al actualizar avatar.' });
    }
}

async function eliminarAvatar(req, res) {
    try {
        const resultado = await usuarioModel.eliminarAvatar(req.usuario.id);
        const usuario = resultado.rows[0];
        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, sucursal_id: usuario.sucursal_id, avatar_url: usuario.avatar_url },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ token, usuario });
    } catch (error) {
        console.error('Error al eliminar avatar:', error);
        res.status(500).json({ error: 'Error al eliminar avatar.' });
    }
}

async function estadisticas(req, res) {
    try {
        const total = await usuarioModel.contarVehiculosPorUsuario(req.usuario.id);
        const actividad = await usuarioModel.actividadMensual(req.usuario.id);
        res.json({ total: total.rows[0].total, actividadMensual: actividad.rows });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas.' });
    }
}

module.exports = {
    register, login, recuperar,
    actualizarPerfil, cambiarPassword, cambiarSucursal, actualizarAvatar, eliminarAvatar, estadisticas
};