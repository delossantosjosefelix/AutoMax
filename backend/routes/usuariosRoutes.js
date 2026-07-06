const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const verificarToken = require('../middleware/verificarToken');
const verificarRol = require('../middleware/verificarRol');

router.get('/', verificarToken, verificarRol('admin'), usuariosController.listar);
router.patch('/:id/rol', verificarToken, verificarRol('admin'), usuariosController.cambiarRol);
router.patch('/:id/sucursal', verificarToken, verificarRol('admin'), usuariosController.cambiarSucursal);
router.patch('/:id/estado', verificarToken, verificarRol('admin'), usuariosController.cambiarEstado);
router.delete('/:id', verificarToken, verificarRol('admin'), usuariosController.eliminar);

module.exports = router;