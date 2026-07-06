const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursalesController');
const verificarToken = require('../middleware/verificarToken');
const verificarRol = require('../middleware/verificarRol');

router.get('/', sucursalesController.listar);
router.post('/', verificarToken, verificarRol('gerente', 'admin'), sucursalesController.crear);
router.put('/:id', verificarToken, verificarRol('gerente', 'admin'), sucursalesController.actualizar);
router.delete('/:id', verificarToken, verificarRol('gerente', 'admin'), sucursalesController.eliminar);

module.exports = router;