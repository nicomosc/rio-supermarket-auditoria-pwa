-- =============================================================================
-- RÍO SUPERMARKET • SISTEMA WEB (PWA) DE AUDITORÍA TECNOLÓGICA
-- Esquema Completo PostgreSQL + Supabase RLS + Storage + Vistas + RPC + Semillas
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: departamentos (Los 16 departamentos independientes)
CREATE TABLE IF NOT EXISTS public.departamentos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  tipo_area VARCHAR(40) NOT NULL CHECK (tipo_area IN ('OFICINA', 'OPERATIVIDAD_FRESCOS', 'CAJA_PISO', 'INFRAESTRUCTURA')),
  orden INT NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- 2. TABLA: checklist_items (Ítems individuales sin agrupar por departamento)
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id SERIAL PRIMARY KEY,
  departamento_id INT NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  descripcion VARCHAR(255) NOT NULL,
  orden INT NOT NULL DEFAULT 1,
  es_critico BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- Secuencia para código de caso auto-generado (CAS-0001)
CREATE SEQUENCE IF NOT EXISTS public.seq_codigo_caso START 1;

-- 3. TABLA: inspecciones
CREATE TABLE IF NOT EXISTS public.inspecciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_caso VARCHAR(20) UNIQUE NOT NULL DEFAULT ('CAS-' || LPAD(nextval('public.seq_codigo_caso')::TEXT, 4, '0')),
  analista_nombre VARCHAR(120) NOT NULL,
  turno VARCHAR(40) NOT NULL,
  fecha_operativa DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ,
  estado VARCHAR(20) NOT NULL DEFAULT 'EN_PROGRESO' CHECK (estado IN ('EN_PROGRESO', 'COMPLETADA')),
  observaciones_manuales TEXT
);

-- 4. TABLA: inspeccion_detalles
CREATE TABLE IF NOT EXISTS public.inspeccion_detalles (
  id SERIAL PRIMARY KEY,
  inspeccion_id UUID NOT NULL REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  item_id INT NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  estado VARCHAR(10) NOT NULL CHECK (estado IN ('OK', 'FALLA', 'NA')),
  observacion_item TEXT,
  evidencia_url TEXT,
  registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inspeccion_id, item_id)
);

-- =============================================================================
-- VISTAS SQL
-- =============================================================================

-- Vista 1: vw_reporte_inspeccion
CREATE OR REPLACE VIEW public.vw_reporte_inspeccion AS
SELECT
  i.id AS inspeccion_id,
  i.codigo_caso,
  i.analista_nombre,
  i.turno,
  i.fecha_operativa,
  i.estado AS estado_inspeccion,
  i.observaciones_manuales,
  d.id AS departamento_id,
  d.nombre AS departamento,
  d.tipo_area,
  d.orden AS departamento_orden,
  COUNT(ci.id)::INT AS total_items,
  COUNT(id_det.id)::INT AS total_evaluados,
  COUNT(CASE WHEN id_det.estado = 'OK' THEN 1 END)::INT AS total_ok,
  COUNT(CASE WHEN id_det.estado = 'FALLA' THEN 1 END)::INT AS total_fallas,
  COUNT(CASE WHEN id_det.estado = 'NA' THEN 1 END)::INT AS total_na,
  CASE
    WHEN COUNT(CASE WHEN id_det.estado IN ('OK', 'FALLA') THEN 1 END) = 0 THEN 100.0
    ELSE ROUND(
      (COUNT(CASE WHEN id_det.estado = 'OK' THEN 1 END)::NUMERIC /
       NULLIF(COUNT(CASE WHEN id_det.estado IN ('OK', 'FALLA') THEN 1 END), 0)::NUMERIC) * 100,
      1
    )
  END AS porcentaje_cumplimiento
FROM public.inspecciones i
CROSS JOIN public.departamentos d
LEFT JOIN public.checklist_items ci
  ON ci.departamento_id = d.id AND ci.activo = true
LEFT JOIN public.inspeccion_detalles id_det
  ON id_det.inspeccion_id = i.id AND id_det.item_id = ci.id
WHERE d.activo = true
GROUP BY
  i.id, i.codigo_caso, i.analista_nombre, i.turno, i.fecha_operativa,
  i.estado, i.observaciones_manuales, d.id, d.nombre, d.tipo_area, d.orden
ORDER BY d.orden ASC;

-- Vista 2: vw_busqueda_auditorias
CREATE OR REPLACE VIEW public.vw_busqueda_auditorias AS
SELECT
  i.id AS inspeccion_id,
  i.codigo_caso,
  i.analista_nombre,
  i.turno,
  i.fecha_operativa,
  i.fecha_inicio,
  i.fecha_fin,
  i.estado AS estado_inspeccion,
  i.observaciones_manuales,
  d.id AS departamento_id,
  d.nombre AS departamento_nombre,
  d.tipo_area,
  d.orden AS departamento_orden,
  ci.id AS item_id,
  ci.descripcion AS item_descripcion,
  ci.orden AS item_orden,
  ci.es_critico,
  COALESCE(det.estado, 'NO_MARCADO') AS estado_item,
  det.observacion_item,
  det.evidencia_url,
  (det.evidencia_url IS NOT NULL AND det.evidencia_url <> '') AS tiene_evidencia,
  det.registrado_at
FROM public.inspecciones i
CROSS JOIN public.departamentos d
JOIN public.checklist_items ci
  ON ci.departamento_id = d.id AND ci.activo = true
LEFT JOIN public.inspeccion_detalles det
  ON det.inspeccion_id = i.id AND det.item_id = ci.id
WHERE d.activo = true;

-- =============================================================================
-- FUNCIÓN RPC: verificar_reporte_diario()
-- Verifica si el reporte del día anterior o del turno actual no ha sido cerrado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.verificar_reporte_diario()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ayer DATE := CURRENT_DATE - INTERVAL '1 day';
  v_hoy DATE := CURRENT_DATE;
  v_completadas_ayer INT;
  v_abiertas_ayer INT;
  v_completadas_hoy INT;
  v_abiertas_hoy INT;
  v_codigo_abierto VARCHAR;
BEGIN
  SELECT COUNT(*) INTO v_completadas_ayer
  FROM public.inspecciones
  WHERE fecha_operativa = v_ayer AND estado = 'COMPLETADA';

  SELECT COUNT(*) INTO v_abiertas_ayer
  FROM public.inspecciones
  WHERE fecha_operativa = v_ayer AND estado = 'EN_PROGRESO';

  SELECT COUNT(*) INTO v_completadas_hoy
  FROM public.inspecciones
  WHERE fecha_operativa = v_hoy AND estado = 'COMPLETADA';

  SELECT COUNT(*), MAX(codigo_caso) INTO v_abiertas_hoy, v_codigo_abierto
  FROM public.inspecciones
  WHERE fecha_operativa = v_hoy AND estado = 'EN_PROGRESO';

  RETURN jsonb_build_object(
    'fecha_ayer', v_ayer,
    'fecha_hoy', v_hoy,
    'ayer_omitido', (v_completadas_ayer = 0),
    'ayer_en_progreso', (v_abiertas_ayer > 0),
    'turno_actual_pendiente', (v_completadas_hoy = 0),
    'caso_en_progreso', v_codigo_abierto,
    'alerta_activa', (v_completadas_ayer = 0 OR v_completadas_hoy = 0),
    'mensaje', CASE
      WHEN v_completadas_ayer = 0 AND v_abiertas_ayer > 0 THEN
        'Existe una inspección del día anterior (' || v_ayer || ') que quedó EN PROGRESO sin cerrar.'
      WHEN v_completadas_ayer = 0 THEN
        'Alerta de Auditoría Omitida: No se registró cierre de reporte ejecutivo el día anterior (' || v_ayer || ').'
      WHEN v_completadas_hoy = 0 AND v_abiertas_hoy > 0 THEN
        'El turno actual tiene la inspección ' || v_codigo_abierto || ' en progreso pendiente por finalizar.'
      WHEN v_completadas_hoy = 0 THEN
        'El reporte de auditoría del turno actual (' || v_hoy || ') aún no ha sido cerrado.'
      ELSE
        'Reportes diarios al día.'
    END
  );
END;
$$;

-- =============================================================================
-- SEGURIDAD: ROW LEVEL SECURITY (RLS) Y STORAGE BUCKET PRIVADO
-- =============================================================================
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspeccion_detalles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total autenticados en departamentos"
  ON public.departamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acceso total autenticados en checklist_items"
  ON public.checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acceso total autenticados en inspecciones"
  ON public.inspecciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acceso total autenticados en inspeccion_detalles"
  ON public.inspeccion_detalles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bucket privado evidencias-auditoria
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias-auditoria', 'evidencias-auditoria', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated select evidencias-auditoria"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidencias-auditoria');

CREATE POLICY "Authenticated insert evidencias-auditoria"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidencias-auditoria');

CREATE POLICY "Authenticated update evidencias-auditoria"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'evidencias-auditoria');

CREATE POLICY "Authenticated delete evidencias-auditoria"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidencias-auditoria');

-- =============================================================================
-- SEMILLA DE LOS 16 DEPARTAMENTOS SEPARADOS E ÍTEMS INDIVIDUALES
-- =============================================================================
INSERT INTO public.departamentos (id, nombre, tipo_area, orden, activo) VALUES
  (1,  'Gerencia',        'OFICINA',              1,  true),
  (2,  'Control',         'OFICINA',              2,  true),
  (3,  'Recaudación',     'OFICINA',              3,  true),
  (4,  'Insumo',          'OFICINA',              4,  true),
  (5,  'Auditoria',       'OFICINA',              5,  true),
  (6,  'Producción',      'OPERATIVIDAD_FRESCOS', 6,  true),
  (7,  'Inventario',      'OFICINA',              7,  true),
  (8,  'Recepción',       'INFRAESTRUCTURA',      8,  true),
  (9,  'Carniceria',      'OPERATIVIDAD_FRESCOS', 9,  true),
  (10, 'Charcuteria',     'OPERATIVIDAD_FRESCOS', 10, true),
  (11, 'Panaderia',       'OPERATIVIDAD_FRESCOS', 11, true),
  (12, 'Frulevel',        'OPERATIVIDAD_FRESCOS', 12, true),
  (13, 'Linea de Caja',   'CAJA_PISO',            13, true),
  (14, 'Piso de Venta',   'CAJA_PISO',            14, true),
  (15, 'Sistemas',        'INFRAESTRUCTURA',      15, true),
  (16, 'Seguridad CECOM', 'INFRAESTRUCTURA',      16, true)
ON CONFLICT (id) DO NOTHING;

-- Ítems individuales (Sin agrupar; incluye Tablet y Cashea en Gerencia, y Cashea en Línea de Caja)
INSERT INTO public.checklist_items (id, departamento_id, descripcion, orden, es_critico, activo) VALUES
  -- 1. Gerencia
  (101, 1, 'Tablet de Gerencia (Carga, conectividad Wi-Fi y acceso a dashboard)', 1, true, true),
  (102, 1, 'Dispositivo / Portal Cashea en Gerencia (Conciliación y estado en línea)', 2, true, true),
  (103, 1, 'Estación de Trabajo PC Gerencia y Sistema ERP', 3, false, true),
  (104, 1, 'Impresora Multifuncional de Gerencia (Tóner y red)', 4, false, true),
  (105, 1, 'UPS de Respaldo Eléctrico en Oficina de Gerencia', 5, true, true),

  -- 2. Control
  (201, 2, 'Estación PC de Control y Monitoreo de Procesos', 1, true, true),
  (202, 2, 'Reloj Biométrico de Control de Asistencia de Personal', 2, true, true),
  (203, 2, 'Impresora de Reportes de Control Interno', 3, false, true),
  (204, 2, 'Punto de Red LAN y UPS de Estación Control', 4, false, true),

  -- 3. Recaudación
  (301, 3, 'PC Principal de Bóveda y Sistema de Tesorería/Recaudación', 1, true, true),
  (302, 3, 'Máquinas Contadoras y Validadoras de Efectivo', 2, true, true),
  (303, 3, 'Impresora Térmica/Láser de Actas de Cierre de Caja', 3, true, true),
  (304, 3, 'UPS de Respaldo en Cuarto de Recaudación', 4, true, true),

  -- 4. Insumo
  (401, 4, 'Computador de Control de Suministros e Insumos Internos', 1, false, true),
  (402, 4, 'Impresora de Notas de Entrega y Etiquetas de Insumos', 2, false, true),
  (403, 4, 'Escáner Lector de Código de Barras de Almacén Insumos', 3, false, true),
  (404, 4, 'Conectividad LAN y Respaldo UPS de Insumo', 4, false, true),

  -- 5. Auditoria
  (501, 5, 'Estación de Trabajo de Auditoría y Consultas SQL/ERP', 1, true, true),
  (502, 5, 'Enlace de Red Seguro y Acceso a Servidor de Históricos', 2, true, true),
  (503, 5, 'Impresora Láser de Actas de Auditoría', 3, false, true),
  (504, 5, 'UPS de Protección Eléctrica de Auditoría', 4, false, true),

  -- 6. Producción
  (601, 6, 'Balanza Industrial de Producción y Formulación', 1, true, true),
  (602, 6, 'Impresora Térmica de Etiquetas de Lote y Vencimiento', 2, true, true),
  (603, 6, 'Terminal PC de Registro de Órdenes de Producción y Mermas', 3, true, true),
  (604, 6, 'Cobertura Wi-Fi Industrial en Área de Producción', 4, false, true),

  -- 7. Inventario
  (701, 7, 'Colectores de Datos Portátiles (PDT / Handhelds Zebra)', 1, true, true),
  (702, 7, 'Estación PC de Sincronización de Inventario y Costos', 2, true, true),
  (703, 7, 'Impresora Térmica de Habladores y Etiquetas de Anaquel', 3, true, true),
  (704, 7, 'Cobertura de Antenas Access Point en Depósito', 4, false, true),

  -- 8. Recepción
  (801, 8, 'Báscula / Romana Electrónica de Recepción de Proveedores', 1, true, true),
  (802, 8, 'Terminal PC de Entrada de Mercancía y Cruce de Facturas', 2, true, true),
  (803, 8, 'Dispositivos Handheld de Verificación en Muelle de Carga', 3, true, true),
  (804, 8, 'Impresora de Notas de Recepción y Retenciones', 4, false, true),

  -- 9. Carniceria
  (901, 9, 'Balanza Etiquetadora Principal de Carnicería (Red y PLU)', 1, true, true),
  (902, 9, 'Balanza Etiquetadora Auxiliar de Carnicería', 2, true, true),
  (903, 9, 'Cabezal Térmico y Nitidez de Código de Barras en Etiquetas', 3, true, true),
  (904, 9, 'Sincronización de Precios por Red LAN/Wi-Fi en Carnicería', 4, false, true),

  -- 10. Charcuteria
  (1001, 10, 'Balanza Etiquetadora Mostrador Charcutería #1', 1, true, true),
  (1002, 10, 'Balanza Etiquetadora Autoservicio Charcutería #2', 2, true, true),
  (1003, 10, 'Cabezal Térmico y Lectura de Etiquetas de Peso Variable', 3, true, true),
  (1004, 10, 'Sincronización de Catálogo PLU en Charcutería', 4, false, true),

  -- 11. Panaderia
  (1101, 11, 'Balanza Etiquetadora de Panadería y Pastelería', 1, true, true),
  (1102, 11, 'Terminal de Punto de Comanda / Despacho de Barra', 2, true, true),
  (1103, 11, 'Impresora Térmica de Tickets y Etiquetas de Panadería', 3, true, true),
  (1104, 11, 'Conectividad de Red y Actualización de Precios PLU', 4, false, true),

  -- 12. Frulevel
  (1201, 12, 'Balanza Etiquetadora Frulevel #1 (Frutas y Hortalizas)', 1, true, true),
  (1202, 12, 'Balanza Etiquetadora Frulevel #2', 2, true, true),
  (1203, 12, 'Impresión Térmica de Códigos de Barra y Calibración de Peso', 3, true, true),
  (1204, 12, 'Pantalla / Visor Digital y Red de Precios Frulevel', 4, false, true),

  -- 13. Linea de Caja
  (1301, 13, 'Sistema y Terminales Cashea en Línea de Caja (Operatividad y QR)', 1, true, true),
  (1302, 13, 'Puntos de Venta Bancarios (POS Inalámbricos e Integrados)', 2, true, true),
  (1303, 13, 'Impresoras Fiscales de Línea de Caja (Cinta, puerto fiscal y Z)', 3, true, true),
  (1304, 13, 'Terminales de Facturación POS, Teclados y Pantallas de Cajeros', 4, true, true),
  (1305, 13, 'Escáneres Biópticos de Mesa y de Mano en Cajas', 5, true, true),
  (1306, 13, 'UPS de Respaldo Eléctrico Individuales en Línea de Caja', 6, true, true),

  -- 14. Piso de Venta
  (1401, 14, 'Lectores Verificadores de Precios en Pasillos de Venta', 1, true, true),
  (1402, 14, 'Antenas Wi-Fi Corporativas y de Clientes en Piso de Venta', 2, true, true),
  (1403, 14, 'Pantallas Publicitarias Digital Signage y Precios', 3, false, true),
  (1404, 14, 'Sistema de Audio Ambiental y Voceo IP en Piso de Venta', 4, false, true),

  -- 15. Sistemas
  (1501, 15, 'Servidores Principales, Base de Datos y Virtualización', 1, true, true),
  (1502, 15, 'Rack Principal, Switches Core y Distribución Fibra/UTP', 2, true, true),
  (1503, 15, 'Enlaces de Internet Dedicados (Principal + Failover Automático)', 3, true, true),
  (1504, 15, 'Climatización de Cuarto de Servidores (Temperatura y Humedad)', 4, true, true),
  (1505, 15, 'UPS Online Central de Cuarto de Datos y Banco de Baterías', 5, true, true),
  (1506, 15, 'Ejecución de Backups Automáticos Locales y en Nube', 6, true, true),

  -- 16. Seguridad CECOM
  (1601, 16, 'Videowall y Estaciones de Monitoreo de Cámaras CCTV', 1, true, true),
  (1602, 16, 'Grabadores NVR/DVR y Estado de Discos Duros de Grabación', 2, true, true),
  (1603, 16, 'Repetidora y Radios de Comunicación (Walkie-Talkies CECOM)', 3, true, true),
  (1604, 16, 'Central de Alarmas de Intrusión, Incendio y Control de Acceso', 4, true, true),
  (1605, 16, 'UPS de Respaldo Eléctrico Dedicado para Seguridad CECOM', 5, true, true)
ON CONFLICT (id) DO NOTHING;
