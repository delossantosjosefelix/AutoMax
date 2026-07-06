-- ============================================================
-- AUTOMAX — Base de datos: vehiculosdb
-- ============================================================

-- Eliminar tablas si existen (respetando dependencias por FK)
DROP TABLE IF EXISTS vehiculos;
DROP TABLE IF EXISTS sucursales;
DROP TABLE IF EXISTS usuarios;

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    password_plain VARCHAR(255) NOT NULL, -- Para simulación de recuperación de clave
    rol VARCHAR(20) DEFAULT 'empleado',
    sucursal_id INTEGER, -- Sucursal donde trabaja el empleado (se referencia tras crear "sucursales")
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: sucursales
-- ============================================================
CREATE TABLE sucursales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    encargado VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ahora que "sucursales" ya existe, agregamos la FK de usuarios.sucursal_id
ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_sucursal
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE SET NULL;

-- ============================================================
-- TABLA: vehiculos
-- ============================================================
CREATE TABLE vehiculos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    anio INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    combustible VARCHAR(30) NOT NULL,
    transmision VARCHAR(30) NOT NULL,
    condicion VARCHAR(10) NOT NULL DEFAULT 'Nuevo' CHECK (condicion IN ('Nuevo', 'Usado')),
    precio DECIMAL(10,2) NOT NULL,
    cantidad INTEGER NOT NULL,
    descripcion TEXT,
    imagen VARCHAR(255),
    sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DATOS FALSOS: Sucursales (República Dominicana)
-- ============================================================
INSERT INTO sucursales (nombre, ciudad, direccion, telefono, encargado, color) VALUES
('AUTOMAX Santiago', 'Santiago de los Caballeros', 'Av. 27 de Febrero #45, Santiago', '(809) 582-4471', 'Carlos Manuel Peña', '#4a90e2'),
('AUTOMAX Santo Domingo', 'Santo Domingo', 'Av. John F. Kennedy #128, Distrito Nacional', '(809) 566-3390', 'Yolanda Marte Reyes', '#ff9f0a'),
('AUTOMAX Puerto Plata', 'Puerto Plata', 'Malecón de Puerto Plata #22', '(809) 261-7745', 'Rafael Antonio Cruz', '#4caf50'),
('AUTOMAX La Romana', 'La Romana', 'Av. Libertad #67, La Romana', '(809) 556-2280', 'Miguelina Dotel Suárez', '#9b59b6');

-- ============================================================
-- DATOS FALSOS: Vehículos de ejemplo por sucursal
-- ============================================================
INSERT INTO vehiculos (codigo, marca, modelo, anio, color, combustible, transmision, condicion, precio, cantidad, descripcion, sucursal_id) VALUES
('AM01', 'Toyota', 'Corolla', 2025, 'Blanco', 'Gasolina', 'Automática', 'Nuevo', 24500.00, 3, 'Sedán compacto, ideal para ciudad, bajo consumo.', 1),
('AM02', 'Honda', 'CR-V', 2023, 'Gris', 'Híbrido', 'CVT', 'Usado', 28900.00, 1, 'SUV familiar con bajo kilometraje, un solo dueño.', 1),
('AM03', 'Hyundai', 'Tucson', 2026, 'Negro', 'Gasolina', 'Automática', 'Nuevo', 31200.00, 2, 'SUV mediana con paquete tecnológico completo.', 2),
('AM04', 'Kia', 'Sportage', 2022, 'Rojo', 'Diésel', 'Manual', 'Usado', 21800.00, 1, 'Excelente estado, mantenimiento al día.', 2),
('AM05', 'Nissan', 'Frontier', 2025, 'Plata', 'Diésel', 'Manual', 'Nuevo', 34500.00, 2, 'Pick-up doble cabina 4x4, ideal para trabajo pesado.', 3),
('AM06', 'Jeep', 'Wrangler', 2021, 'Verde', 'Gasolina', 'Manual', 'Usado', 26900.00, 1, 'Edición Sahara, capota rígida incluida.', 3),
('AM07', 'Tesla', 'Model 3', 2026, 'Blanco', 'Eléctrico', 'Automática', 'Nuevo', 42000.00, 1, 'Autonomía extendida, piloto automático incluido.', 4),
('AM08', 'Chevrolet', 'Spark', 2020, 'Amarillo', 'Gasolina', 'Manual', 'Usado', 9800.00, 1, 'Económico, perfecto para ciudad, bajo mantenimiento.', 4);

-- Ejecuta esto UNA VEZ en tu base "vehiculosdb" si ya la habías creado antes de este cambio.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sucursal_id INTEGER;

ALTER TABLE usuarios
    DROP CONSTRAINT IF EXISTS fk_usuarios_sucursal;

ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_sucursal
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE SET NULL;

-- Verifica que la columna quedó creada:
-- SELECT id, nombre, correo, sucursal_id FROM usuarios;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuarios_rol;
ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_rol CHECK (rol IN ('empleado', 'gerente', 'admin'));

ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);

ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS color VARCHAR(7);

UPDATE sucursales SET color =
  CASE id % 8
    WHEN 1 THEN '#4a90e2'
    WHEN 2 THEN '#ff9f0a'
    WHEN 3 THEN '#4caf50'
    WHEN 4 THEN '#9b59b6'
    WHEN 5 THEN '#1abc9c'
    WHEN 6 THEN '#e74c3c'
    WHEN 7 THEN '#3498db'
    ELSE '#ff3b30'
  END
WHERE color IS NULL;