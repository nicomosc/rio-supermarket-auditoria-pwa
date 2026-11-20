'use client';

import { useState, useEffect } from 'react';
import {
  verificarEstadoRealSupabase,
  sincronizarTodoASupabaseCloud,
  DiagnosticoSupabaseReal,
} from '@/lib/supabase';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CloudUpload,
  ExternalLink,
  Copy,
  X,
  ShieldCheck,
} from 'lucide-react';

interface ModalVerificadorBDProps {
  abierto: boolean;
  onCerrar: () => void;
}

const SQL_PERMISOS_COMPLETOS = `-- ============================================================================
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
CREATE POLICY "Acceso total app en inspeccion_detalles" ON public.inspeccion_detalles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`;

export default function ModalVerificadorBD({
  abierto,
  onCerrar,
}: ModalVerificadorBDProps) {
  const [diag, setDiag] = useState<DiagnosticoSupabaseReal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);
  const [sqlCopiado, setSqlCopiado] = useState(false);

  async function consultarBDReal() {
    setCargando(true);
    const res = await verificarEstadoRealSupabase();
    setDiag(res);
    setCargando(false);
  }

  useEffect(() => {
    if (abierto) {
      consultarBDReal();
      setMensajeSync(null);
    }
  }, [abierto]);

  async function handleForzarSincronizacion() {
    setSincronizando(true);
    setMensajeSync(null);
    const res = await sincronizarTodoASupabaseCloud();
    setMensajeSync({ ok: res.ok, texto: res.mensaje });
    await consultarBDReal();
    setSincronizando(false);
  }

  async function copiarSql() {
    try {
      await navigator.clipboard.writeText(SQL_PERMISOS_COMPLETOS);
      setSqlCopiado(true);
      setTimeout(() => setSqlCopiado(false), 3500);
    } catch {
      // ignore
    }
  }

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[#042f16]/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-[#B2D034]">
        {/* Cabecera del Verificador de Base de Datos */}
        <div className="bg-[#087334] text-white px-5 py-4 border-b-4 border-[#B2D034] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <Database size={20} className="text-[#B2D034]" />
            <div>
              <h2 className="text-sm sm:text-base font-extrabold">
                Monitor en Vivo de Base de Datos PostgreSQL (Supabase)
              </h2>
              <p className="text-[11px] text-[#B2D034] font-mono">
                8 Tablas: Sucursales, Analistas, Jefes, Roles (Coordinador/Analista), Deptos, Ítems y Auditorías
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="text-white/80 hover:text-white p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Estado de conexión y sesión */}
          {cargando && !diag ? (
            <div className="p-6 text-center text-slate-500 font-mono">
              Consultando las 8 tablas reales en Supabase Cloud...
            </div>
          ) : diag ? (
            <>
              <div
                className={`p-4 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  diag.conectado &&
                  diag.conteosCloud.departamentos > 0 &&
                  diag.conteosCloud.sucursales > 0 &&
                  diag.conteosCloud.usuarios_roles > 0
                    ? 'bg-[#087334]/10 border-[#087334]/40 text-[#042f16]'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    {diag.conectado &&
                    diag.conteosCloud.departamentos > 0 &&
                    diag.conteosCloud.sucursales > 0 &&
                    diag.conteosCloud.usuarios_roles > 0 ? (
                      <>
                        <CheckCircle2 size={18} className="text-[#087334]" />
                        <span>
                          Conectado y Guardando en las 8 Tablas de PostgreSQL
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={18} className="text-amber-600" />
                        <span>
                          Atención: Falta ejecutar el SQL v3.7 o sincronizar la tabla usuarios_roles
                        </span>
                      </>
                    )}
                  </div>
                  <p className="font-mono text-[11px] opacity-85">
                    Servidor: {diag.url} • Sesión:{' '}
                    <strong>{diag.usuarioEmail || 'Modo Local (anon)'}</strong>{' '}
                    ({diag.rolSesion})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={consultarBDReal}
                  disabled={cargando}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold px-3 py-2 rounded-xl border border-slate-300 transition cursor-pointer shrink-0"
                >
                  <RefreshCw
                    size={14}
                    className={cargando ? 'animate-spin' : ''}
                  />
                  Refrescar Conteo Real
                </button>
              </div>

              {/* Conteo real de filas en las 8 tablas de PostgreSQL */}
              <div>
                <h3 className="font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                  Filas Guardadas Actualmente en tu Servidor Supabase (8 Tablas):
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#087334]/5 border border-[#087334]/25 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#087334] font-bold block">
                      sucursales
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.sucursales}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      sedes en BD
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#087334]/5 border border-[#087334]/25 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#087334] font-bold block">
                      analistas_sistemas
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.analistas_sistemas}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      analistas en BD
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#087334]/5 border border-[#087334]/25 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#087334] font-bold block">
                      jefes_encargados
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.jefes_encargados}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      jefes/coord en BD
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#B2D034]/20 border border-[#087334]/40 text-center">
                    <span className="text-[10px] font-mono uppercase text-[#087334] font-extrabold block">
                      usuarios_roles
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.usuarios_roles}
                    </strong>
                    <span className="text-[10px] text-slate-600 font-semibold block">
                      roles Coord/Analista
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      departamentos
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.departamentos}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      deptos en BD
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      checklist_items
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.checklist_items}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      ítems en BD
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      inspecciones
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.inspecciones}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      casos + firmas
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      inspeccion_detalles
                    </span>
                    <strong className="text-lg font-black font-mono text-[#087334]">
                      {diag.conteosCloud.inspeccion_detalles}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      respuestas OK/FALLA
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón para Sincronizar / Subir todos los datos a PostgreSQL en 1 clic */}
              <div className="p-4 rounded-xl bg-[#087334]/5 border border-[#087334]/25 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-[#087334]">
                      Sincronización Automática de las 8 Tablas en PostgreSQL
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Llena automáticamente en tu BD las sucursales, analistas, coordinadores/jefes encargados, roles de usuario (Coordinador/Analista), departamentos, ítems, casos y firmas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleForzarSincronizacion}
                    disabled={sincronizando}
                    className="inline-flex items-center justify-center gap-2 bg-[#087334] hover:bg-[#054d22] text-white font-extrabold px-4 py-2.5 rounded-xl border border-[#B2D034] transition cursor-pointer shrink-0"
                  >
                    <CloudUpload size={15} className="text-[#B2D034]" />
                    {sincronizando
                      ? 'Subiendo a PostgreSQL...'
                      : 'Subir y Verificar Todo en BD Ahora'}
                  </button>
                </div>

                {mensajeSync && (
                  <div
                    className={`p-3 rounded-lg font-mono text-[11px] ${
                      mensajeSync.ok
                        ? 'bg-[#087334] text-white'
                        : 'bg-[#DB0617]/10 text-[#DB0617] border border-[#DB0617]/30'
                    }`}
                  >
                    {mensajeSync.texto}
                  </div>
                )}
              </div>

              {/* Bloque SQL v3.7 siempre disponible para crear la tabla usuarios_roles y actualizar permisos */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-extrabold text-amber-950 flex items-center gap-1.5">
                    <ShieldCheck size={15} /> SQL v3.7 para Roles (COORDINADOR Superadmin / ANALISTA), Sucursales y Personal
                  </h4>
                  <button
                    type="button"
                    onClick={copiarSql}
                    className="inline-flex items-center gap-1.5 bg-amber-900 hover:bg-amber-800 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] cursor-pointer"
                  >
                    <Copy size={12} />
                    {sqlCopiado
                      ? '¡SQL v3.7 Copiado!'
                      : 'Copiar SQL v3.7 Completo'}
                  </button>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Para registrar la nueva tabla <code>usuarios_roles</code> (Roles{' '}
                  <code>COORDINADOR</code> Superadmin y <code>ANALISTA</code>) y las columnas de rol en PostgreSQL, haz clic en{' '}
                  <strong>&ldquo;Copiar SQL v3.7 Completo&rdquo;</strong>, pégalo en el{' '}
                  <strong>SQL Editor</strong> de Supabase (botón <em>Run</em>) y luego presiona{' '}
                  <strong>&ldquo;Subir y Verificar Todo en BD Ahora&rdquo;</strong>:
                </p>
                <pre className="bg-slate-950 text-[#B2D034] p-3 rounded-lg font-mono text-[10px] max-h-44 overflow-y-auto overflow-x-auto">
                  {SQL_PERMISOS_COMPLETOS}
                </pre>
              </div>

              {/* Últimas Inspecciones Reales en PostgreSQL */}
              {diag.ultimasInspeccionesCloud.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-extrabold uppercase tracking-wider text-slate-600">
                    Últimos Casos Leídos Directamente de PostgreSQL:
                  </h4>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {diag.ultimasInspeccionesCloud.slice(0, 4).map((insp) => (
                      <div
                        key={insp.id}
                        className="p-2.5 flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#087334]">
                            {insp.codigo_caso}
                          </span>{' '}
                          • <strong>{insp.analista_nombre}</strong> ({insp.turno}
                          )
                        </div>
                        <span className="font-mono text-slate-500">
                          {insp.fecha_operativa} • {insp.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Enlace directo al Table Editor de Supabase del usuario */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <a
                  href="https://supabase.com/dashboard/project/exaybbujkfaqteanmisp/editor"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#087334] hover:underline"
                >
                  Abrir Table Editor en tu Panel de Supabase
                  <ExternalLink size={13} />
                </a>
                <button
                  type="button"
                  onClick={onCerrar}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cerrar Monitor
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
