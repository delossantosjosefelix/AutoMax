const multer = require('multer');
const path = require('path');
const fs = require('fs');

const baseDir = path.join(__dirname, '..', '..', 'frontend', 'images', 'uploads');

const tiposPermitidos = /jpeg|jpg|png|webp/;

function fileFilter(req, file, cb) {
    const extValida = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());
    const mimeValido = tiposPermitidos.test(file.mimetype);
    if (extValida && mimeValido) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (jpg, jpeg, png, webp).'));
    }
}

function crearUpload(subDir, prefix) {
    const destino = path.join(baseDir, subDir);
    if (!fs.existsSync(destino)) {
        fs.mkdirSync(destino, { recursive: true });
    }
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, destino),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
        }
    });
    return multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
}

const uploadVehiculo = crearUpload('vehiculos', 'veh');
const uploadAvatar = crearUpload('avatars', 'avatar');

module.exports = { uploadVehiculo, uploadAvatar };