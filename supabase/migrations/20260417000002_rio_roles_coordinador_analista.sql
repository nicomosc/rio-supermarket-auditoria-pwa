-- ============================================================================
-- MIGRACIÓN SQL v3.7 — RÍO SUPERMARKET • AUDITORÍA TECNOLÓGICA
-- 1. Conserva las 23 SUCURSALES REALES OFICIALES DE RÍO SUPERMARKET (id 1..23)
-- 2. LIMPIA de la BD todos los Analistas y Jefes Encargados de prueba
-- 3. Deja únicamente el usuario de acceso Coordinador (coordinador@riosupermarket.com)
-- 4. Agrega columnas cedula y email para el CRUD y la Importación CSV de personal real
-- 5. Cierre automático a las 12:00 AM hora oficial de Venezuela (America/Caracas)
-- ============================================================================

-- 1. Tabla de las 23 Sucursales Oficiales de Río Supermarket
CREATE TABLE IF NOT EXISTS public.sucursales (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(140) UNIQUE NOT NULL,
    ciudad VARCHAR(80) NOT NULL DEFAULT 'Porlamar, Nueva Esparta',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Liberar posibles choques de codigo/nombre de versiones anteriores (ej. RIO-JGR en id 5 vs id 6)
UPDATE public.sucursales
SET
    codigo = 'TMP-' || id::text,
    nombre = 'TMP-SUCURSAL-' || id::text
WHERE id BETWEEN 1 AND 23;

DELETE FROM public.sucursales WHERE id > 23;

INSERT INTO public.sucursales (id, codigo, nombre, ciudad, activo)
VALUES
    -- Nueva Esparta (Isla de Margarita — 7 sedes)
    (1,  'RIO-JBA', 'Río Supermarket • Juan Bautista Arismendi (Margarita)', 'Porlamar, Nueva Esparta', true),
    (2,  'RIO-TRK', 'Río Supermarket • Traki Porlamar (Margarita)', 'Porlamar, Nueva Esparta', true),
    (3,  'RIO-PLA', 'Río Supermarket • Playa El Ángel (Pampatar)', 'Pampatar, Nueva Esparta', true),
    (4,  'RIO-TER', 'Río Supermarket • Terranova (Porlamar)', 'Porlamar, Nueva Esparta', true),
    (5,  'RIO-31J', 'Río Supermarket • 31 de Julio (La Asunción)', 'La Asunción, Nueva Esparta', true),
    (6,  'RIO-JGR', 'Río Supermarket • Juan Griego (Margarita)', 'Juan Griego, Nueva Esparta', true),
    (7,  'RIO-SAM', 'Río Supermarket • Sambil Margarita (Pampatar)', 'Pampatar, Nueva Esparta', true),
    -- Oriente, Guárico, Lara y Guayana (6 sedes)
    (8,  'RIO-MAT', 'Río Supermarket • Maturín - Juanico (Monagas)', 'Maturín, Monagas', true),
    (9,  'RIO-PRE', 'Río Supermarket • Puente Real (Barcelona)', 'Barcelona, Anzoátegui', true),
    (10, 'RIO-PMY', 'Río Supermarket • Plaza Mayor (Lechería)', 'Lechería, Anzoátegui', true),
    (11, 'RIO-VLP', 'Río Supermarket • Valle de la Pascua (Guárico)', 'Valle de la Pascua, Guárico', true),
    (12, 'RIO-BQO', 'Río Supermarket • Barquisimeto (C.C. Arena Plaza)', 'Barquisimeto, Lara', true),
    (13, 'RIO-POZ', 'Río Supermarket • Puerto Ordaz (Av. Las Américas)', 'Puerto Ordaz, Bolívar', true),
    -- Gran Caracas, Miranda, Guatire y Guarenas (10 sedes)
    (14, 'RIO-CND', 'Río Supermarket • Sambil La Candelaria (Caracas)', 'Caracas, Distrito Capital', true),
    (15, 'RIO-PAR', 'Río Supermarket • El Paraíso (Caracas)', 'Caracas, Distrito Capital', true),
    (16, 'RIO-REC', 'Río Supermarket • C.C. El Recreo (Caracas)', 'Caracas, Distrito Capital', true),
    (17, 'RIO-CMP', 'Río Supermarket • Los Campitos / Mata de Coco (Chacao)', 'Caracas, Miranda', true),
    (18, 'RIO-PGR', 'Río Supermarket • Los Palos Grandes (Chacao)', 'Caracas, Miranda', true),
    (19, 'RIO-CIG', 'Río Supermarket • El Cigarral - El Hatillo (Caracas)', 'Caracas, Miranda', true),
    (20, 'RIO-LSO', 'Río Supermarket • Lomas del Sol / Los Naranjos (Caracas)', 'Caracas, Miranda', true),
    (21, 'RIO-MRQ', 'Río Supermarket • El Marqués (Unicentro El Marqués)', 'Caracas, Miranda', true),
    (22, 'RIO-GUA', 'Río Supermarket • Guatire (Hacienda El Marqués)', 'Guatire, Miranda', true),
    (23, 'RIO-GRN', 'Río Supermarket • Guarenas (Av. Intercomunal)', 'Guarenas, Miranda', true)
ON CONFLICT (id) DO UPDATE SET
    codigo = EXCLUDED.codigo,
    nombre = EXCLUDED.nombre,
    ciudad = EXCLUDED.ciudad,
    activo = EXCLUDED.activo;

SELECT setval(pg_get_serial_sequence('public.sucursales', 'id'), COALESCE((SELECT MAX(id) FROM public.sucursales), 23));

-- 2. Tabla de Analistas de Sistemas por Sucursal (con cédula y email para CRUD / CSV)
CREATE TABLE IF NOT EXISTS public.analistas_sistemas (
    id SERIAL PRIMARY KEY,
    sucursal_id INT NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(140) NOT NULL,
    cedula VARCHAR(20),
    email VARCHAR(160),
    rol VARCHAR(30) NOT NULL DEFAULT 'ANALISTA',
    cargo VARCHAR(100) NOT NULL DEFAULT 'Analista de Sistemas',
    turno_habitual VARCHAR(80) NOT NULL DEFAULT 'Apertura (08:00 AM a 17:00 PM)',
    disponible BOOLEAN NOT NULL DEFAULT true,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.analistas_sistemas ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);
ALTER TABLE public.analistas_sistemas ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE public.analistas_sistemas ADD COLUMN IF NOT EXISTS rol VARCHAR(30) NOT NULL DEFAULT 'ANALISTA';
CREATE UNIQUE INDEX IF NOT EXISTS ux_analistas_cedula ON public.analistas_sistemas (cedula) WHERE cedula IS NOT NULL;

-- 3. Tabla de Jefes Encargados / Coordinadores por Sucursal (con cédula y email para CRUD / CSV)
CREATE TABLE IF NOT EXISTS public.jefes_encargados (
    id SERIAL PRIMARY KEY,
    sucursal_id INT NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(140) NOT NULL,
    cedula VARCHAR(20),
    email VARCHAR(160),
    rol VARCHAR(30) NOT NULL DEFAULT 'COORDINADOR',
    cargo VARCHAR(100) NOT NULL DEFAULT 'Coordinador / Jefe Encargado de Tienda',
    disponible BOOLEAN NOT NULL DEFAULT true,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jefes_encargados ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);
ALTER TABLE public.jefes_encargados ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE public.jefes_encargados ADD COLUMN IF NOT EXISTS rol VARCHAR(30) NOT NULL DEFAULT 'COORDINADOR';
CREATE UNIQUE INDEX IF NOT EXISTS ux_jefes_cedula ON public.jefes_encargados (cedula) WHERE cedula IS NOT NULL;

-- 4. Columnas reales en public.inspecciones para guardar Sucursal, Analista, Jefe y Firmas en BD
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS sucursal_id INT REFERENCES public.sucursales(id) ON DELETE SET NULL;
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS sucursal_nombre VARCHAR(140);
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS analista_id INT REFERENCES public.analistas_sistemas(id) ON DELETE SET NULL;
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS jefe_encargado_id INT REFERENCES public.jefes_encargados(id) ON DELETE SET NULL;
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS jefe_encargado_nombre VARCHAR(140);
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS firma_analista_url TEXT;
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS firma_encargado_url TEXT;
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS observaciones_por_depto JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS creado_por_rol VARCHAR(30) DEFAULT 'ANALISTA';
ALTER TABLE public.inspecciones ADD COLUMN IF NOT EXISTS creado_por_email VARCHAR(160);

-- 5. LIMPIEZA TOTAL DEL PERSONAL DE PRUEBA (Analistas y Jefes Encargados)
-- Las 23 sucursales se mantienen intactas; las inspecciones históricas conservan analista_nombre y jefe_encargado_nombre.
DELETE FROM public.analistas_sistemas;
DELETE FROM public.jefes_encargados;

SELECT setval(pg_get_serial_sequence('public.analistas_sistemas', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.jefes_encargados', 'id'), 1, false);

-- 6. Tabla de Usuarios de Acceso (solo se conserva coordinador@riosupermarket.com)
CREATE TABLE IF NOT EXISTS public.usuarios_roles (
    id SERIAL PRIMARY KEY,
    email VARCHAR(160) UNIQUE NOT NULL,
    nombre_completo VARCHAR(140) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'ANALISTA' CHECK (rol IN ('COORDINADOR', 'ANALISTA')),
    sucursal_id INT REFERENCES public.sucursales(id) ON DELETE SET NULL,
    cargo VARCHAR(100) NOT NULL DEFAULT 'Analista de Sistemas',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DELETE FROM public.usuarios_roles WHERE email <> 'coordinador@riosupermarket.com';

INSERT INTO public.usuarios_roles (email, nombre_completo, rol, sucursal_id, cargo, activo)
VALUES
    ('coordinador@riosupermarket.com', 'Coordinador General de Sistemas', 'COORDINADOR', NULL, 'Coordinador / Jefe Encargado de Sistemas (Superadmin)', true)
ON CONFLICT (email) DO UPDATE SET
    rol = EXCLUDED.rol,
    nombre_completo = EXCLUDED.nombre_completo,
    cargo = EXCLUDED.cargo,
    activo = true;

-- 7. Función oficial de Fecha Operativa en Hora de Venezuela (America/Caracas, cierre exacto 12:00 AM)
CREATE OR REPLACE FUNCTION public.fecha_operativa_caracas()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (NOW() AT TIME ZONE 'America/Caracas')::date
$$;

UPDATE public.inspecciones
SET
    estado = 'COMPLETADA',
    fecha_fin = COALESCE(fecha_fin, NOW())
WHERE fecha_operativa < public.fecha_operativa_caracas()
  AND estado <> 'COMPLETADA';

-- 8. Políticas RLS Idempotentes
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analistas_sistemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jefes_encargados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total app en sucursales" ON public.sucursales;
CREATE POLICY "Acceso total app en sucursales" ON public.sucursales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app en analistas_sistemas" ON public.analistas_sistemas;
CREATE POLICY "Acceso total app en analistas_sistemas" ON public.analistas_sistemas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app en jefes_encargados" ON public.jefes_encargados;
CREATE POLICY "Acceso total app en jefes_encargados" ON public.jefes_encargados FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app en usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Acceso total app en usuarios_roles" ON public.usuarios_roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app en departamentos" ON public.departamentos;
CREATE POLICY "Acceso total app en departamentos" ON public.departamentos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app en checklist_items" ON public.checklist_items;
CREATE POLICY "Acceso total app en checklist_items" ON public.checklist_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app en inspecciones" ON public.inspecciones;
CREATE POLICY "Acceso total app en inspecciones" ON public.inspecciones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total app en inspeccion_detalles" ON public.inspeccion_detalles;
CREATE POLICY "Acceso total app en inspeccion_detalles" ON public.inspeccion_detalles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
