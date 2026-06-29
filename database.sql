-- Eliminar tablas si existen (con precaución)
DROP TABLE IF EXISTS vehiculos;
DROP TABLE IF EXISTS usuarios;

-- Crear tabla usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    password_plain VARCHAR(255) NOT NULL, -- Para simulación
    rol VARCHAR(20) DEFAULT 'empleado',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla vehiculos
CREATE TABLE vehiculos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    anio INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    combustible VARCHAR(30) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    cantidad INTEGER NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

