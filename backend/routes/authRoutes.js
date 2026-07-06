const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verificarToken = require('../middleware/verificarToken');
const { uploadAvatar } = require('../config/multer');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/recuperar', authController.recuperar);

router.put('/perfil', verificarToken, authController.actualizarPerfil);
router.put('/password', verificarToken, authController.cambiarPassword);
router.put('/sucursal', verificarToken, authController.cambiarSucursal);
router.post('/avatar', verificarToken, uploadAvatar.single('avatar'), authController.actualizarAvatar);
router.delete('/avatar', verificarToken, authController.eliminarAvatar);
router.get('/estadisticas', verificarToken, authController.estadisticas);

module.exports = router;