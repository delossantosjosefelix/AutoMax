const express = require('express');
const router = express.Router();
const vehiculosController = require('../controllers/vehiculosController');
const verificarToken = require('../middleware/verificarToken');
const { uploadVehiculo } = require('../config/multer');

router.get('/', vehiculosController.listar);
router.post('/', verificarToken, uploadVehiculo.single('imagen'), vehiculosController.crear);
router.put('/:id', verificarToken, uploadVehiculo.single('imagen'), vehiculosController.actualizar);
router.delete('/:id', verificarToken, vehiculosController.eliminar);

module.exports = router;
