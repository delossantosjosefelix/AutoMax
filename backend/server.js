'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const vehiculosRoutes = require('./routes/vehiculosRoutes');
const sucursalesRoutes = require('./routes/sucursalesRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const seedAdmin = require('./config/seedAdmin');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, '..', 'frontend', 'images')));

app.use('/api/auth', authRoutes);
app.use('/vehiculos', vehiculosRoutes);
app.use('/sucursales', sucursalesRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Servir frontend estático (same-origin para evitar bloqueo de Chrome)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'html')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 3000;

seedAdmin()
    .catch(err => console.error('Error al crear usuario admin inicial:', err))
    .finally(() => {
        app.listen(PORT, () => {
            console.log(`Servidor AutoMax corriendo en puerto ${PORT}`);
        });
    });