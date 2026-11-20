import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DEPARTAMENTOS_SEED,
  CHECKLIST_ITEMS_SEED,
  Departamento,
  ChecklistItem,
  Inspeccion,
  InspeccionDetalle,
  ReporteInspeccionRow,
  BusquedaAuditoriaRow,
  AlertaReporteDiario,
  buildDemoPhotoSvg,
} from './seedData';
import {
  ZONA_HORARIA_RIO,
  getFechaOperativaCaracas,
  fechaCaracasDeInstante,
  sumarDiasAFecha,
} from './fechas';
import {
  calcularPermisoEdicion,
  PermisoEdicionEvaluacion,
} from './permisos';
import {
  TipoPersonal,
  COLUMNAS_CSV_PERSONAL,
  FilaPersonalCsv,
  ResultadoAnalisisCsv,
  parsearCsv,
  normalizarCedula,
  analizarCsvPersonal,
  generarCsvPersonal,
} from './importarPersonalCsv';

export {
  ZONA_HORARIA_RIO,
  getFechaOperativaCaracas,
  fechaCaracasDeInstante,
  sumarDiasAFecha,
  calcularPermisoEdicion,
  COLUMNAS_CSV_PERSONAL,
  parsearCsv,
  normalizarCedula,
  analizarCsvPersonal,
  generarCsvPersonal,
};
export type {
  PermisoEdicionEvaluacion,
  TipoPersonal,
  FilaPersonalCsv,
  ResultadoAnalisisCsv,
};

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseUrl = rawSupabaseUrl
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('tu-proyecto.supabase.co') &&
    supabaseUrl.startsWith('http')
);

export const realSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEYS = {
  SESSION: 'rio_auditoria_session_v1',
  DEPARTAMENTOS: 'rio_auditoria_departamentos_v2',
  ITEMS: 'rio_auditoria_items_v2',
  INSPECCIONES: 'rio_auditoria_inspecciones_v1',
  DETALLES: 'rio_auditoria_detalles_v1',
  BUCKET_FILES: 'rio_auditoria_bucket_evidencias_v1',
  CALENDARIO_CONFIG: 'rio_auditoria_calendario_config_v1',
  OBS_DEPTO: 'rio_auditoria_obs_depto_v1',
  SUCURSALES: 'rio_auditoria_sucursales_v3',
  SUCURSALES_OBJ: 'rio_auditoria_sucursales_obj_v3',
  ANALISTAS_SISTEMAS: 'rio_auditoria_analistas_sistemas_v4',
  JEFES_ENCARGADOS: 'rio_auditoria_jefes_encargados_v4',
  INSPECCION_META: 'rio_auditoria_inspeccion_meta_v4',
  PIN_JEFE: 'rio_auditoria_pin_jefe_v1',
  USUARIOS_ROLES: 'rio_auditoria_usuarios_roles_v4',
  ROL_ACTIVO: 'rio_auditoria_rol_activo_v1',
};

export type RolUsuarioSistema = 'COORDINADOR' | 'ANALISTA';

export interface UsuarioRolBD {
  id: number;
  email: string;
  nombre_completo: string;
  rol: RolUsuarioSistema;
  sucursal_id: number | null;
  cargo: string;
  activo: boolean;
}

export const USUARIOS_ROLES_SEED: UsuarioRolBD[] = [
  {
    id: 1,
    email: 'coordinador@riosupermarket.com',
    nombre_completo: 'Coordinador General de Sistemas',
    rol: 'COORDINADOR',
    sucursal_id: null,
    cargo: 'Coordinador / Jefe Encargado de Sistemas (Superadmin)',
    activo: true,
  },
];

export interface SucursalRio {
  id: number;
  codigo: string;
  nombre: string;
  ciudad: string;
  activo: boolean;
}

export interface AnalistaSistemas {
  id: number;
  sucursal_id: number;
  nombre_completo: string;
  cargo: string;
  turno_habitual: string;
  disponible: boolean;
  activo: boolean;
  cedula?: string | null;
  email?: string | null;
}

export interface JefeEncargado {
  id: number;
  sucursal_id: number;
  nombre_completo: string;
  cargo: string;
  disponible: boolean;
  activo: boolean;
  cedula?: string | null;
  email?: string | null;
}

// ============================================================================
// LAS 23 SUCURSALES REALES OFICIALES DE RÍO SUPERMARKET EN VENEZUELA
// Fuente oficial: https://www.riomarket.com/SeccionInformativaRio
// ============================================================================
export const SUCURSALES_RIO_SEED_OBJ: SucursalRio[] = [
  // NUEVA ESPARTA (ISLA DE MARGARITA) — 7 SEDES
  {
    id: 1,
    codigo: 'RIO-JBA',
    nombre: 'Río Supermarket • Juan Bautista Arismendi (Margarita)',
    ciudad: 'Porlamar, Nueva Esparta',
    activo: true,
  },
  {
    id: 2,
    codigo: 'RIO-TRK',
    nombre: 'Río Supermarket • Traki Porlamar (Margarita)',
    ciudad: 'Porlamar, Nueva Esparta',
    activo: true,
  },
  {
    id: 3,
    codigo: 'RIO-PLA',
    nombre: 'Río Supermarket • Playa El Ángel (Pampatar)',
    ciudad: 'Pampatar, Nueva Esparta',
    activo: true,
  },
  {
    id: 4,
    codigo: 'RIO-TER',
    nombre: 'Río Supermarket • Terranova (Porlamar)',
    ciudad: 'Porlamar, Nueva Esparta',
    activo: true,
  },
  {
    id: 5,
    codigo: 'RIO-31J',
    nombre: 'Río Supermarket • 31 de Julio (La Asunción)',
    ciudad: 'La Asunción, Nueva Esparta',
    activo: true,
  },
  {
    id: 6,
    codigo: 'RIO-JGR',
    nombre: 'Río Supermarket • Juan Griego (Margarita)',
    ciudad: 'Juan Griego, Nueva Esparta',
    activo: true,
  },
  {
    id: 7,
    codigo: 'RIO-SAM',
    nombre: 'Río Supermarket • Sambil Margarita (Pampatar)',
    ciudad: 'Pampatar, Nueva Esparta',
    activo: true,
  },
  // ORIENTE, GUÁRICO, LARA Y GUAYANA — 6 SEDES
  {
    id: 8,
    codigo: 'RIO-MAT',
    nombre: 'Río Supermarket • Maturín - Juanico (Monagas)',
    ciudad: 'Maturín, Monagas',
    activo: true,
  },
  {
    id: 9,
    codigo: 'RIO-PRE',
    nombre: 'Río Supermarket • Puente Real (Barcelona)',
    ciudad: 'Barcelona, Anzoátegui',
    activo: true,
  },
  {
    id: 10,
    codigo: 'RIO-PMY',
    nombre: 'Río Supermarket • Plaza Mayor (Lechería)',
    ciudad: 'Lechería, Anzoátegui',
    activo: true,
  },
  {
    id: 11,
    codigo: 'RIO-VLP',
    nombre: 'Río Supermarket • Valle de la Pascua (Guárico)',
    ciudad: 'Valle de la Pascua, Guárico',
    activo: true,
  },
  {
    id: 12,
    codigo: 'RIO-BQO',
    nombre: 'Río Supermarket • Barquisimeto (C.C. Arena Plaza)',
    ciudad: 'Barquisimeto, Lara',
    activo: true,
  },
  {
    id: 13,
    codigo: 'RIO-POZ',
    nombre: 'Río Supermarket • Puerto Ordaz (Av. Las Américas)',
    ciudad: 'Puerto Ordaz, Bolívar',
    activo: true,
  },
  // GRAN CARACAS, MIRANDA, GUATIRE Y GUARENAS — 10 SEDES
  {
    id: 14,
    codigo: 'RIO-CND',
    nombre: 'Río Supermarket • Sambil La Candelaria (Caracas)',
    ciudad: 'Caracas, Distrito Capital',
    activo: true,
  },
  {
    id: 15,
    codigo: 'RIO-PAR',
    nombre: 'Río Supermarket • El Paraíso (Caracas)',
    ciudad: 'Caracas, Distrito Capital',
    activo: true,
  },
  {
    id: 16,
    codigo: 'RIO-REC',
    nombre: 'Río Supermarket • C.C. El Recreo (Caracas)',
    ciudad: 'Caracas, Distrito Capital',
    activo: true,
  },
  {
    id: 17,
    codigo: 'RIO-CMP',
    nombre: 'Río Supermarket • Los Campitos / Mata de Coco (Chacao)',
    ciudad: 'Caracas, Miranda',
    activo: true,
  },
  {
    id: 18,
    codigo: 'RIO-PGR',
    nombre: 'Río Supermarket • Los Palos Grandes (Chacao)',
    ciudad: 'Caracas, Miranda',
    activo: true,
  },
  {
    id: 19,
    codigo: 'RIO-CIG',
    nombre: 'Río Supermarket • El Cigarral - El Hatillo (Caracas)',
    ciudad: 'Caracas, Miranda',
    activo: true,
  },
  {
    id: 20,
    codigo: 'RIO-LSO',
    nombre: 'Río Supermarket • Lomas del Sol / Los Naranjos (Caracas)',
    ciudad: 'Caracas, Miranda',
    activo: true,
  },
  {
    id: 21,
    codigo: 'RIO-MRQ',
    nombre: 'Río Supermarket • El Marqués (Unicentro El Marqués)',
    ciudad: 'Caracas, Miranda',
    activo: true,
  },
  {
    id: 22,
    codigo: 'RIO-GUA',
    nombre: 'Río Supermarket • Guatire (Hacienda El Marqués)',
    ciudad: 'Guatire, Miranda',
    activo: true,
  },
  {
    id: 23,
    codigo: 'RIO-GRN',
    nombre: 'Río Supermarket • Guarenas (Av. Intercomunal)',
    ciudad: 'Guarenas, Miranda',
    activo: true,
  },
];

export const SUCURSALES_RIO_SEED: string[] = SUCURSALES_RIO_SEED_OBJ.map(
  (s) => s.nombre
);

// Turnos Oficiales de Río Supermarket
export const TURNOS_OFICIALES_RIO = [
  'Apertura (08:00 AM a 17:00 PM)',
  'Intermedio (10:00 AM a 19:00 PM)',
  'Cierre (15:00 PM a 23:59 PM)',
  'Completo (08:00 AM a 23:59 PM)',
] as const;

export function normalizarTurnoOficial(turno?: string | null): string {
  if (!turno) return TURNOS_OFICIALES_RIO[0];
  const t = turno.trim();
  if ((TURNOS_OFICIALES_RIO as readonly string[]).includes(t)) return t;
  if (t.startsWith('Mañana') || t.startsWith('Apertura')) {
    return 'Apertura (08:00 AM a 17:00 PM)';
  }
  if (t.startsWith('Tarde') || t.startsWith('Intermedio')) {
    return 'Intermedio (10:00 AM a 19:00 PM)';
  }
  if (t.startsWith('Cierre') || t.includes('Nocturno')) {
    return 'Cierre (15:00 PM a 23:59 PM)';
  }
  if (t.startsWith('Completo')) {
    return 'Completo (08:00 AM a 23:59 PM)';
  }
  return TURNOS_OFICIALES_RIO[0];
}

// ============================================================================
// PERSONAL (ANALISTAS Y JEFES ENCARGADOS): SIN DATOS DE PRUEBA DESDE v3.7
// El personal real se registra desde "Gestionar Personal" (CRUD) o se importa
// por CSV. Supabase es la fuente principal; el navegador solo guarda caché offline.
// ============================================================================
export const ANALISTAS_SISTEMAS_SEED: AnalistaSistemas[] = [];

export const JEFES_ENCARGADOS_SEED: JefeEncargado[] = [];

export interface InspeccionExtraMeta {
  sucursalId: number;
  sucursal: string;
  analistaId: number | null;
  jefeEncargadoId: number | null;
  recibidoPor: string;
  firmaAnalistaDataUrl: string | null;
  firmaSupervisorDataUrl: string | null;
}

export function getSucursalesObj(): SucursalRio[] {
  if (typeof window === 'undefined') return [...SUCURSALES_RIO_SEED_OBJ];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.SUCURSALES_OBJ);
    if (!raw) {
      window.localStorage.setItem(
        STORAGE_KEYS.SUCURSALES_OBJ,
        JSON.stringify(SUCURSALES_RIO_SEED_OBJ)
      );
      return [...SUCURSALES_RIO_SEED_OBJ];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [...SUCURSALES_RIO_SEED_OBJ];
  } catch {
    return [...SUCURSALES_RIO_SEED_OBJ];
  }
}

export function saveSucursalesObj(list: SucursalRio[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.SUCURSALES_OBJ,
    JSON.stringify(list)
  );
  window.localStorage.setItem(
    STORAGE_KEYS.SUCURSALES,
    JSON.stringify(list.map((s) => s.nombre))
  );
}

export function getSucursales(): string[] {
  return getSucursalesObj().map((s) => s.nombre);
}

export function addSucursal(nuevaSucursal: string, ciudad = 'Venezuela'): string[] {
  const clean = nuevaSucursal.trim();
  const list = getSucursalesObj();
  if (!clean || list.some((s) => s.nombre.toLowerCase() === clean.toLowerCase())) {
    return list.map((s) => s.nombre);
  }
  const maxId = list.reduce((m, r) => Math.max(m, r.id), 0);
  const nuevaObj: SucursalRio = {
    id: maxId + 1,
    codigo: `RIO-S${String(maxId + 1).padStart(2, '0')}`,
    nombre: clean,
    ciudad,
    activo: true,
  };
  const next = [...list, nuevaObj];
  saveSucursalesObj(next);

  // v3.7: ya no se crean analistas ni jefes de ejemplo; el personal real se carga desde el CRUD o por CSV
  if (realSupabase) {
    realSupabase
      .from('sucursales')
      .upsert(nuevaObj, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) avisarErrorBD('guardar la sucursal', error);
      });
  }

  return next.map((s) => s.nombre);
}

// ============================================================================
// PERSONAL POR SUCURSAL — SUPABASE ES LA FUENTE PRINCIPAL (v3.7)
// El navegador solo guarda una caché para trabajar sin conexión. Una lista
// vacía es un estado válido: NUNCA se recargan nombres de prueba.
// ============================================================================
function avisarErrorBD(accion: string, error: { message?: string } | null) {
  const detalle = error?.message || 'Error desconocido';
  const mensaje =
    `No se pudo ${accion} en la base de datos (Supabase): ${detalle}.` +
    (/cedula|email|column/i.test(detalle)
      ? '\n\nEjecuta el script SQL v3.7 en Supabase → SQL Editor (botón "Verificar BD Supabase" → Copiar SQL).'
      : '');
  console.error(mensaje);
  if (typeof window !== 'undefined') window.alert(mensaje);
}

function leerListaLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function textoOpcional(v?: string | null): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

export function getTodosAnalistas(): AnalistaSistemas[] {
  return leerListaLocal<AnalistaSistemas>(STORAGE_KEYS.ANALISTAS_SISTEMAS).map(
    (a) => ({ ...a, turno_habitual: normalizarTurnoOficial(a.turno_habitual) })
  );
}

export function saveTodosAnalistas(list: AnalistaSistemas[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.ANALISTAS_SISTEMAS,
    JSON.stringify(list)
  );
}

// Devuelve ÚNICAMENTE los analistas pertenecientes a la sucursal indicada (Sin cruzar información)
export function getAnalistasPorSucursal(sucursalId: number): AnalistaSistemas[] {
  return getTodosAnalistas().filter(
    (a) => a.sucursal_id === sucursalId && a.activo
  );
}

export function getTodosJefes(): JefeEncargado[] {
  return leerListaLocal<JefeEncargado>(STORAGE_KEYS.JEFES_ENCARGADOS);
}

export function saveTodosJefes(list: JefeEncargado[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.JEFES_ENCARGADOS,
    JSON.stringify(list)
  );
}

// Devuelve ÚNICAMENTE los Coordinadores / Jefes Encargados de esa sucursal (Sin cruzar información)
export function getJefesPorSucursal(sucursalId: number): JefeEncargado[] {
  return getTodosJefes().filter(
    (j) => j.sucursal_id === sucursalId && j.activo
  );
}

/** Descarga sucursales, analistas y jefes desde Supabase y actualiza la caché local. */
export async function sincronizarPersonalDesdeCloud(): Promise<{
  ok: boolean;
  analistas: number;
  jefes: number;
  mensaje: string | null;
}> {
  if (!realSupabase) {
    return {
      ok: false,
      analistas: getTodosAnalistas().length,
      jefes: getTodosJefes().length,
      mensaje: 'Supabase no está configurado; se usa la caché local.',
    };
  }
  try {
    const [suc, ana, jef] = await Promise.all([
      realSupabase.from('sucursales').select('*').order('id', { ascending: true }),
      realSupabase.from('analistas_sistemas').select('*').order('id', { ascending: true }),
      realSupabase.from('jefes_encargados').select('*').order('id', { ascending: true }),
    ]);
    if (!suc.error && Array.isArray(suc.data) && suc.data.length > 0) {
      saveSucursalesObj(
        (suc.data as SucursalRio[]).map((s) => ({
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre,
          ciudad: s.ciudad,
          activo: s.activo,
        }))
      );
    }
    if (!ana.error && Array.isArray(ana.data)) {
      saveTodosAnalistas(
        (ana.data as AnalistaSistemas[]).map((a) => ({
          ...a,
          turno_habitual: normalizarTurnoOficial(a.turno_habitual),
        }))
      );
    }
    if (!jef.error && Array.isArray(jef.data)) {
      saveTodosJefes(jef.data as JefeEncargado[]);
    }
    const err = suc.error || ana.error || jef.error;
    return {
      ok: !err,
      analistas: getTodosAnalistas().length,
      jefes: getTodosJefes().length,
      mensaje: err ? err.message : null,
    };
  } catch (e: any) {
    return {
      ok: false,
      analistas: getTodosAnalistas().length,
      jefes: getTodosJefes().length,
      mensaje: e?.message || 'Sin conexión',
    };
  }
}

export interface DatosNuevoAnalista {
  sucursal_id: number;
  nombre_completo: string;
  cargo?: string;
  turno_habitual?: string;
  disponible?: boolean;
  cedula?: string | null;
  email?: string | null;
}

/** Crea el analista en Supabase (la BD asigna el id). Devuelve null si la BD rechaza el registro. */
export async function crearAnalistaSucursal(
  params: DatosNuevoAnalista
): Promise<AnalistaSistemas | null> {
  const fila = {
    sucursal_id: params.sucursal_id,
    nombre_completo: params.nombre_completo.trim(),
    cargo: params.cargo?.trim() || 'Analista de Sistemas',
    turno_habitual: normalizarTurnoOficial(params.turno_habitual),
    disponible: params.disponible ?? true,
    activo: true,
    cedula: textoOpcional(params.cedula),
    email: textoOpcional(params.email)?.toLowerCase() ?? null,
  };
  let creado: AnalistaSistemas;
  if (realSupabase) {
    const { data, error } = await realSupabase
      .from('analistas_sistemas')
      .insert(fila)
      .select('*')
      .single();
    if (error || !data) {
      avisarErrorBD(`registrar al analista "${fila.nombre_completo}"`, error);
      return null;
    }
    creado = {
      ...(data as AnalistaSistemas),
      turno_habitual: normalizarTurnoOficial((data as AnalistaSistemas).turno_habitual),
    };
  } else {
    const maxId = getTodosAnalistas().reduce((m, r) => Math.max(m, r.id), 0);
    creado = { id: maxId + 1, ...fila };
  }
  saveTodosAnalistas([
    ...getTodosAnalistas().filter((a) => a.id !== creado.id),
    creado,
  ]);
  return creado;
}

export async function actualizarAnalistaSucursal(
  analistaId: number,
  cambios: Partial<AnalistaSistemas>
): Promise<boolean> {
  const { id: _omit, ...limpio } = cambios;
  if (limpio.turno_habitual !== undefined) {
    limpio.turno_habitual = normalizarTurnoOficial(limpio.turno_habitual);
  }
  if (realSupabase) {
    const { error } = await realSupabase
      .from('analistas_sistemas')
      .update(limpio)
      .eq('id', analistaId);
    if (error) {
      avisarErrorBD('actualizar al analista', error);
      return false;
    }
  }
  saveTodosAnalistas(
    getTodosAnalistas().map((a) => (a.id === analistaId ? { ...a, ...limpio } : a))
  );
  return true;
}

export async function eliminarAnalistaSucursal(analistaId: number): Promise<boolean> {
  if (realSupabase) {
    const { error } = await realSupabase
      .from('analistas_sistemas')
      .delete()
      .eq('id', analistaId);
    if (error) {
      avisarErrorBD('eliminar al analista', error);
      return false;
    }
  }
  saveTodosAnalistas(getTodosAnalistas().filter((a) => a.id !== analistaId));
  return true;
}

export interface DatosNuevoJefe {
  sucursal_id: number;
  nombre_completo: string;
  cargo?: string;
  disponible?: boolean;
  cedula?: string | null;
  email?: string | null;
}

/** Crea el jefe encargado en Supabase (la BD asigna el id). Devuelve null si la BD rechaza el registro. */
export async function crearJefeSucursal(
  params: DatosNuevoJefe
): Promise<JefeEncargado | null> {
  const fila = {
    sucursal_id: params.sucursal_id,
    nombre_completo: params.nombre_completo.trim(),
    cargo: params.cargo?.trim() || 'Jefe Encargado de Tienda',
    disponible: params.disponible ?? true,
    activo: true,
    cedula: textoOpcional(params.cedula),
    email: textoOpcional(params.email)?.toLowerCase() ?? null,
  };
  let creado: JefeEncargado;
  if (realSupabase) {
    const { data, error } = await realSupabase
      .from('jefes_encargados')
      .insert(fila)
      .select('*')
      .single();
    if (error || !data) {
      avisarErrorBD(`registrar al jefe encargado "${fila.nombre_completo}"`, error);
      return null;
    }
    creado = data as JefeEncargado;
  } else {
    const maxId = getTodosJefes().reduce((m, r) => Math.max(m, r.id), 0);
    creado = { id: maxId + 1, ...fila };
  }
  saveTodosJefes([...getTodosJefes().filter((j) => j.id !== creado.id), creado]);
  return creado;
}

export async function actualizarJefeSucursal(
  jefeId: number,
  cambios: Partial<JefeEncargado>
): Promise<boolean> {
  const { id: _omit, ...limpio } = cambios;
  if (realSupabase) {
    const { error } = await realSupabase
      .from('jefes_encargados')
      .update(limpio)
      .eq('id', jefeId);
    if (error) {
      avisarErrorBD('actualizar al jefe encargado', error);
      return false;
    }
  }
  saveTodosJefes(
    getTodosJefes().map((j) => (j.id === jefeId ? { ...j, ...limpio } : j))
  );
  return true;
}

export async function eliminarJefeSucursal(jefeId: number): Promise<boolean> {
  if (realSupabase) {
    const { error } = await realSupabase
      .from('jefes_encargados')
      .delete()
      .eq('id', jefeId);
    if (error) {
      avisarErrorBD('eliminar al jefe encargado', error);
      return false;
    }
  }
  saveTodosJefes(getTodosJefes().filter((j) => j.id !== jefeId));
  return true;
}

/** Guarda en Supabase las filas válidas de un CSV ya analizado (crea o actualiza por cédula). */
export async function importarFilasPersonal(filas: FilaPersonalCsv[]): Promise<{
  creados: number;
  actualizados: number;
  fallidos: Array<{ numeroFila: number; mensaje: string }>;
}> {
  let creados = 0;
  let actualizados = 0;
  const fallidos: Array<{ numeroFila: number; mensaje: string }> = [];

  for (const f of filas) {
    if (f.accion === 'ERROR' || !f.tipo || !f.sucursal_id) continue;
    const datos = {
      sucursal_id: f.sucursal_id,
      nombre_completo: f.nombre_completo,
      cargo: f.cargo,
      cedula: f.cedula,
      email: f.email,
    };
    if (f.tipo === 'ANALISTA') {
      const turno_habitual = normalizarTurnoOficial(f.turno);
      if (f.accion === 'ACTUALIZAR' && f.idExistente) {
        const ok = await actualizarAnalistaSucursalSilencioso(f.idExistente, { ...datos, turno_habitual });
        if (ok.error) fallidos.push({ numeroFila: f.numeroFila, mensaje: ok.error });
        else actualizados++;
      } else {
        const res = await insertarPersonaSilencioso('analistas_sistemas', {
          ...datos,
          turno_habitual,
          disponible: true,
          activo: true,
        });
        if (res.error) fallidos.push({ numeroFila: f.numeroFila, mensaje: res.error });
        else creados++;
      }
    } else {
      if (f.accion === 'ACTUALIZAR' && f.idExistente) {
        const ok = await actualizarJefeSucursalSilencioso(f.idExistente, datos);
        if (ok.error) fallidos.push({ numeroFila: f.numeroFila, mensaje: ok.error });
        else actualizados++;
      } else {
        const res = await insertarPersonaSilencioso('jefes_encargados', {
          ...datos,
          disponible: true,
          activo: true,
        });
        if (res.error) fallidos.push({ numeroFila: f.numeroFila, mensaje: res.error });
        else creados++;
      }
    }
  }

  // Refrescar la caché con lo que quedó realmente guardado en la BD
  await sincronizarPersonalDesdeCloud();
  return { creados, actualizados, fallidos };
}

// Variantes sin alert() para la importación masiva (los errores se muestran por fila en la vista previa)
async function insertarPersonaSilencioso(
  tabla: 'analistas_sistemas' | 'jefes_encargados',
  fila: Record<string, any>
): Promise<{ error: string | null }> {
  if (!realSupabase) {
    if (tabla === 'analistas_sistemas') {
      const maxId = getTodosAnalistas().reduce((m, r) => Math.max(m, r.id), 0);
      saveTodosAnalistas([...getTodosAnalistas(), { id: maxId + 1, ...(fila as any) }]);
    } else {
      const maxId = getTodosJefes().reduce((m, r) => Math.max(m, r.id), 0);
      saveTodosJefes([...getTodosJefes(), { id: maxId + 1, ...(fila as any) }]);
    }
    return { error: null };
  }
  const { error } = await realSupabase.from(tabla).insert(fila);
  return { error: error ? error.message : null };
}

async function actualizarAnalistaSucursalSilencioso(
  id: number,
  cambios: Record<string, any>
): Promise<{ error: string | null }> {
  if (!realSupabase) {
    saveTodosAnalistas(getTodosAnalistas().map((a) => (a.id === id ? { ...a, ...cambios } : a)));
    return { error: null };
  }
  const { error } = await realSupabase.from('analistas_sistemas').update(cambios).eq('id', id);
  return { error: error ? error.message : null };
}

async function actualizarJefeSucursalSilencioso(
  id: number,
  cambios: Record<string, any>
): Promise<{ error: string | null }> {
  if (!realSupabase) {
    saveTodosJefes(getTodosJefes().map((j) => (j.id === id ? { ...j, ...cambios } : j)));
    return { error: null };
  }
  const { error } = await realSupabase.from('jefes_encargados').update(cambios).eq('id', id);
  return { error: error ? error.message : null };
}


// PIN de Acceso Exclusivo para Coordinadores / Jefes Encargados (Por defecto: '2026')
export function getPinJefe(): string {
  if (typeof window === 'undefined') return '2026';
  try {
    return window.localStorage.getItem(STORAGE_KEYS.PIN_JEFE) || '2026';
  } catch {
    return '2026';
  }
}

export function savePinJefe(nuevoPin: string): void {
  if (typeof window === 'undefined') return;
  const clean = nuevoPin.trim();
  if (clean.length >= 3) {
    window.localStorage.setItem(STORAGE_KEYS.PIN_JEFE, clean);
  }
}

// Carga rápida por lote (varias líneas) para que el Jefe llene varios Analistas o Jefes de una sede de una sola vez
export async function cargarLotePersonalSucursal(params: {
  sucursal_id: number;
  tipo: 'ANALISTAS' | 'JEFES';
  lineasTexto: string;
  turno_defecto?: string;
}): Promise<number> {
  const lineas = params.lineasTexto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  if (lineas.length === 0) return 0;

  let creados = 0;
  for (const linea of lineas) {
    // Permite formato "Nombre Completo | Cargo" o simplemente "Nombre Completo"
    const partes = linea.split('|').map((p) => p.trim());
    const nombre = partes[0];
    const cargo = partes[1];
    if (!nombre) continue;

    const cedula = partes[2] || null;
    const email = partes[3] || null;
    if (params.tipo === 'ANALISTAS') {
      const c = await crearAnalistaSucursal({
        sucursal_id: params.sucursal_id,
        nombre_completo: nombre,
        cargo: cargo || 'Analista de Sistemas',
        turno_habitual: normalizarTurnoOficial(params.turno_defecto),
        disponible: true,
        cedula,
        email,
      });
      if (c) creados++;
    } else {
      const c = await crearJefeSucursal({
        sucursal_id: params.sucursal_id,
        nombre_completo: nombre,
        cargo: cargo || 'Coordinador / Jefe Encargado de Tienda',
        disponible: true,
        cedula,
        email,
      });
      if (c) creados++;
    }
  }
  return creados;
}

// ============================================================================
// GESTIÓN DE ROLES EN BASE DE DATOS: COORDINADOR (SUPERADMIN) Y ANALISTA
// ============================================================================
export function getUsuariosRoles(): UsuarioRolBD[] {
  if (typeof window === 'undefined') return [...USUARIOS_ROLES_SEED];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.USUARIOS_ROLES);
    if (!raw) {
      window.localStorage.setItem(
        STORAGE_KEYS.USUARIOS_ROLES,
        JSON.stringify(USUARIOS_ROLES_SEED)
      );
      return [...USUARIOS_ROLES_SEED];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [...USUARIOS_ROLES_SEED];
  } catch {
    return [...USUARIOS_ROLES_SEED];
  }
}

export function saveUsuariosRoles(list: UsuarioRolBD[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.USUARIOS_ROLES,
    JSON.stringify(list)
  );
}

export async function sincronizarUsuariosRolesDesdeCloud(): Promise<
  UsuarioRolBD[]
> {
  if (!realSupabase) return getUsuariosRoles();
  try {
    const { data, error } = await realSupabase
      .from('usuarios_roles')
      .select('*')
      .order('id', { ascending: true });
    if (!error && Array.isArray(data) && data.length > 0) {
      saveUsuariosRoles(data as UsuarioRolBD[]);
      return data as UsuarioRolBD[];
    }
  } catch {
    // fallback local
  }
  return getUsuariosRoles();
}

export function resolverRolPorEmail(email?: string | null): {
  rol: RolUsuarioSistema;
  perfil: UsuarioRolBD | null;
} {
  const todos = getUsuariosRoles();
  if (email) {
    const clean = email.trim().toLowerCase();
    const encontrado = todos.find(
      (u) => u.email.trim().toLowerCase() === clean && u.activo
    );
    if (encontrado) {
      return { rol: encontrado.rol, perfil: encontrado };
    }
    if (
      clean.includes('coordinador') ||
      clean.includes('jefe') ||
      clean.includes('gerente') ||
      clean.includes('admin')
    ) {
      return { rol: 'COORDINADOR', perfil: null };
    }
  }
  if (typeof window !== 'undefined') {
    const guardado = window.localStorage.getItem(STORAGE_KEYS.ROL_ACTIVO);
    if (guardado === 'COORDINADOR' || guardado === 'ANALISTA') {
      return { rol: guardado, perfil: null };
    }
  }
  return { rol: 'ANALISTA', perfil: null };
}

export function getRolActivoActual(email?: string | null): RolUsuarioSistema {
  if (typeof window !== 'undefined') {
    const override = window.localStorage.getItem(STORAGE_KEYS.ROL_ACTIVO);
    if (override === 'COORDINADOR' || override === 'ANALISTA') {
      return override;
    }
  }
  return resolverRolPorEmail(email).rol;
}

export async function cambiarRolActivoActual(
  nuevoRol: RolUsuarioSistema,
  emailSesion?: string | null,
  nombreUsuario?: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.ROL_ACTIVO, nuevoRol);
  }
  if (emailSesion && emailSesion.includes('@')) {
    await crearOActualizarUsuarioRol({
      email: emailSesion.trim().toLowerCase(),
      nombre_completo:
        nombreUsuario ||
        (nuevoRol === 'COORDINADOR'
          ? 'Coordinador de Sistemas (Superadmin)'
          : 'Analista de Sistemas'),
      rol: nuevoRol,
      sucursal_id: null,
      cargo:
        nuevoRol === 'COORDINADOR'
          ? 'Coordinador / Jefe de Sistemas (Superadmin)'
          : 'Analista de Sistemas',
    });
  }
}

export async function crearOActualizarUsuarioRol(params: {
  id?: number;
  email: string;
  nombre_completo: string;
  rol: RolUsuarioSistema;
  sucursal_id: number | null;
  cargo?: string;
}): Promise<UsuarioRolBD> {
  const todos = getUsuariosRoles();
  const cleanEmail = params.email.trim().toLowerCase();
  const existente = todos.find(
    (u) =>
      (params.id && u.id === params.id) ||
      u.email.trim().toLowerCase() === cleanEmail
  );
  const maxId = todos.reduce((m, r) => Math.max(m, r.id), 10);

  const registro: UsuarioRolBD = {
    id: existente ? existente.id : maxId + 1,
    email: cleanEmail,
    nombre_completo: params.nombre_completo.trim(),
    rol: params.rol,
    sucursal_id: params.sucursal_id,
    cargo:
      params.cargo?.trim() ||
      (params.rol === 'COORDINADOR'
        ? 'Coordinador / Jefe de Sistemas (Superadmin)'
        : 'Analista de Sistemas'),
    activo: true,
  };

  const next = existente
    ? todos.map((u) => (u.id === registro.id ? registro : u))
    : [...todos, registro];

  saveUsuariosRoles(next);

  if (realSupabase) {
    await realSupabase
      .from('usuarios_roles')
      .upsert(registro, { onConflict: 'email' });
  }
  return registro;
}

export async function eliminarUsuarioRol(id: number): Promise<void> {
  const todos = getUsuariosRoles().filter((u) => u.id !== id);
  saveUsuariosRoles(todos);
  if (realSupabase) {
    await realSupabase.from('usuarios_roles').delete().eq('id', id);
  }
}

export function getInspeccionExtraMeta(
  inspeccionId: string,
  inspRow?: (Partial<Inspeccion> & Record<string, any>) | null
): InspeccionExtraMeta {
  const todasSucursales = getSucursalesObj();
  const primeraSucursal = todasSucursales[0] || SUCURSALES_RIO_SEED_OBJ[0];

  let stored: Partial<InspeccionExtraMeta> = {};
  if (typeof window !== 'undefined' && inspeccionId) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.INSPECCION_META);
      const all = raw ? JSON.parse(raw) : {};
      stored = all[inspeccionId] || {};
    } catch {
      stored = {};
    }
  }

  // Resolver sucursal real: PRIORIDAD 1 = Columna de BD en public.inspecciones, PRIORIDAD 2 = caché local
  const sucursalIdCandidata =
    (inspRow && typeof inspRow.sucursal_id === 'number'
      ? inspRow.sucursal_id
      : null) ||
    stored.sucursalId ||
    primeraSucursal.id;

  const sucursalObj =
    todasSucursales.find((s) => s.id === sucursalIdCandidata) ||
    (inspRow?.sucursal_nombre
      ? todasSucursales.find((s) => s.nombre === inspRow.sucursal_nombre)
      : undefined) ||
    primeraSucursal;

  // Filtrar estrictamente los analistas y jefes que pertenecen a esa sucursal
  const analistasSede = getAnalistasPorSucursal(sucursalObj.id);
  const jefesSede = getJefesPorSucursal(sucursalObj.id);

  // Asegurar que el analista pertenezca a esta sucursal específica (BD primero, luego caché)
  const analistaIdCandidato =
    (inspRow && typeof inspRow.analista_id === 'number'
      ? inspRow.analista_id
      : null) ??
    stored.analistaId ??
    null;
  const analistaDeEstaSede =
    analistasSede.find((a) => a.id === analistaIdCandidato) ||
    analistasSede.find((a) => a.disponible) ||
    analistasSede[0] ||
    null;

  // Asegurar que el jefe encargado pertenezca a esta sucursal específica (BD primero, luego caché)
  const jefeIdCandidato =
    (inspRow && typeof inspRow.jefe_encargado_id === 'number'
      ? inspRow.jefe_encargado_id
      : null) ??
    stored.jefeEncargadoId ??
    null;
  const jefeDeEstaSede =
    jefesSede.find((j) => j.id === jefeIdCandidato) ||
    jefesSede.find((j) => j.disponible) ||
    jefesSede[0] ||
    null;

  return {
    sucursalId: sucursalObj.id,
    sucursal: sucursalObj.nombre,
    analistaId: analistaDeEstaSede?.id || null,
    jefeEncargadoId: jefeDeEstaSede?.id || null,
    recibidoPor:
      jefeDeEstaSede?.nombre_completo ||
      stored.recibidoPor ||
      (inspRow?.jefe_encargado_nombre as string) ||
      'Jefe Encargado de Sucursal',
    firmaAnalistaDataUrl:
      stored.firmaAnalistaDataUrl ??
      (inspRow?.firma_analista_url as string | null) ??
      null,
    firmaSupervisorDataUrl:
      stored.firmaSupervisorDataUrl ??
      (inspRow?.firma_encargado_url as string | null) ??
      null,
  };
}

export function saveInspeccionExtraMeta(
  inspeccionId: string,
  partial: Partial<InspeccionExtraMeta>
): InspeccionExtraMeta {
  const current = getInspeccionExtraMeta(inspeccionId);
  const updated: InspeccionExtraMeta = { ...current, ...partial };
  if (typeof window !== 'undefined' && inspeccionId) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.INSPECCION_META);
      const all = raw ? JSON.parse(raw) : {};
      all[inspeccionId] = updated;
      window.localStorage.setItem(
        STORAGE_KEYS.INSPECCION_META,
        JSON.stringify(all)
      );
    } catch {
      // ignore
    }
  }

  // Persistir automáticamente los nuevos campos en la tabla public.inspecciones de Supabase Cloud
  if (realSupabase && inspeccionId) {
    const updatePayload: Record<string, any> = {
      sucursal_id: updated.sucursalId,
      sucursal_nombre: updated.sucursal,
      analista_id: updated.analistaId,
      jefe_encargado_id: updated.jefeEncargadoId,
      jefe_encargado_nombre: updated.recibidoPor,
      firma_analista_url: updated.firmaAnalistaDataUrl,
      firma_encargado_url: updated.firmaSupervisorDataUrl,
    };
    realSupabase
      .from('inspecciones')
      .update(updatePayload)
      .eq('id', inspeccionId)
      .then(() => {});
  }

  return updated;
}

// Registro en vivo del último resultado de escritura en Supabase Cloud (PostgreSQL)
export interface CloudSyncStatus {
  modo: 'CLOUD_OK' | 'LOCAL_FALLBACK' | 'SINCRONIZANDO';
  tabla: string;
  operacion: string;
  hora: string;
  mensajeError: string | null;
}

let lastCloudSyncStatus: CloudSyncStatus = {
  modo: isSupabaseConfigured ? 'CLOUD_OK' : 'LOCAL_FALLBACK',
  tabla: 'init',
  operacion: 'init',
  hora: '',
  mensajeError: null,
};

const syncListeners = new Set<(status: CloudSyncStatus) => void>();

export function getLastCloudSyncStatus(): CloudSyncStatus {
  return lastCloudSyncStatus;
}

export function onCloudSyncStatusChange(
  cb: (status: CloudSyncStatus) => void
): () => void {
  syncListeners.add(cb);
  return () => {
    syncListeners.delete(cb);
  };
}

function notifySyncStatus(status: CloudSyncStatus) {
  lastCloudSyncStatus = status;
  syncListeners.forEach((cb) => cb(status));
}

export interface CalendarioOperativoConfig {
  operativoOn: boolean;
  fechaInicializacion: string;
}

export interface DemoUserSession {
  user: {
    id: string;
    email: string;
    role: 'authenticated';
    user_metadata: {
      nombre: string;
      cargo: string;
    };
  };
  access_token: string;
}

export function getTodayStr(offsetDays = 0): string {
  return getFechaOperativaCaracas(offsetDays);
}

// ============================================================================
// REGLA DE CONTROL DE EDICIÓN POR DÍA OPERATIVO Y ROL (v3.7 - America/Caracas)
// - Si la evaluación es de HOY (fecha_operativa === hoy en Venezuela): Modificable.
// - Si es de OTRO DÍA (fecha_operativa !== hoy): Se cierra a las 12:00 AM VET en
//   Modo Solo Vista, a menos que sea Jefe Encargado / Coordinador.
// ============================================================================
export function esInspeccionEditablePorFechaYRol(
  inspeccion: Pick<Inspeccion, 'fecha_operativa' | 'estado'>,
  rol: RolUsuarioSistema
): PermisoEdicionEvaluacion {
  return calcularPermisoEdicion(inspeccion.fecha_operativa, rol, getTodayStr(0));
}

export async function cerrarAutomaticamenteInspeccionesDiasAnteriores(
  listaInspecciones: Inspeccion[]
): Promise<Inspeccion[]> {
  const hoy = getTodayStr(0);
  let huboCambiosLocales = false;
  const ahoraIso = new Date().toISOString();

  const normalizadas = listaInspecciones.map((insp) => {
    if (insp.fecha_operativa && insp.fecha_operativa < hoy && insp.estado !== 'COMPLETADA') {
      huboCambiosLocales = true;
      const cerrada: Inspeccion = {
        ...insp,
        estado: 'COMPLETADA',
        fecha_fin: insp.fecha_fin || ahoraIso,
      };
      if (realSupabase) {
        realSupabase
          .from('inspecciones')
          .update({ estado: 'COMPLETADA', fecha_fin: cerrada.fecha_fin })
          .eq('id', insp.id)
          .then(() => {});
      }
      return cerrada;
    }
    return insp;
  });

  if (huboCambiosLocales) {
    saveDemoInspecciones(normalizadas);
  }

  return normalizadas;
}

export function getCalendarioConfig(): CalendarioOperativoConfig {
  const hoy = getTodayStr(0);
  if (typeof window === 'undefined') {
    return { operativoOn: false, fechaInicializacion: hoy };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.CALENDARIO_CONFIG);
    if (!raw) {
      const initial: CalendarioOperativoConfig = {
        operativoOn: false,
        fechaInicializacion: hoy,
      };
      window.localStorage.setItem(
        STORAGE_KEYS.CALENDARIO_CONFIG,
        JSON.stringify(initial)
      );
      return initial;
    }
    return JSON.parse(raw) as CalendarioOperativoConfig;
  } catch {
    return { operativoOn: false, fechaInicializacion: hoy };
  }
}

export function saveCalendarioConfig(
  config: CalendarioOperativoConfig
): CalendarioOperativoConfig {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      STORAGE_KEYS.CALENDARIO_CONFIG,
      JSON.stringify(config)
    );
  }
  return config;
}

export function getObservacionesPorDepto(
  inspeccionId: string
): Record<number, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.OBS_DEPTO);
    const all = raw ? JSON.parse(raw) : {};
    return all[inspeccionId] || {};
  } catch {
    return {};
  }
}

export function saveObservacionDepto(
  inspeccionId: string,
  departamentoId: number,
  texto: string
) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.OBS_DEPTO);
    const all = raw ? JSON.parse(raw) : {};
    if (!all[inspeccionId]) all[inspeccionId] = {};
    all[inspeccionId][departamentoId] = texto;
    window.localStorage.setItem(STORAGE_KEYS.OBS_DEPTO, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function getLocalDepartamentos(): Departamento[] {
  if (typeof window === 'undefined') return [...DEPARTAMENTOS_SEED];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DEPARTAMENTOS);
    if (!raw) {
      window.localStorage.setItem(
        STORAGE_KEYS.DEPARTAMENTOS,
        JSON.stringify(DEPARTAMENTOS_SEED)
      );
      return [...DEPARTAMENTOS_SEED];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [...DEPARTAMENTOS_SEED];
  } catch {
    return [...DEPARTAMENTOS_SEED];
  }
}

export function saveLocalDepartamentos(list: Departamento[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.DEPARTAMENTOS, JSON.stringify(list));
}

export function getLocalItems(): ChecklistItem[] {
  if (typeof window === 'undefined') return [...CHECKLIST_ITEMS_SEED];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (!raw) {
      window.localStorage.setItem(
        STORAGE_KEYS.ITEMS,
        JSON.stringify(CHECKLIST_ITEMS_SEED)
      );
      return [...CHECKLIST_ITEMS_SEED];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [...CHECKLIST_ITEMS_SEED];
  } catch {
    return [...CHECKLIST_ITEMS_SEED];
  }
}

export function saveLocalItems(list: ChecklistItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(list));
}

export function getDemoInspecciones(): Inspeccion[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.INSPECCIONES) || '[]'
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.map((insp: Inspeccion) => ({
      ...insp,
      turno: normalizarTurnoOficial(insp.turno),
    }));
  } catch {
    return [];
  }
}

export function saveDemoInspecciones(list: Inspeccion[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.INSPECCIONES, JSON.stringify(list));
}

export function getDemoDetalles(): InspeccionDetalle[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.DETALLES) || '[]'
    );
  } catch {
    return [];
  }
}

export function saveDemoDetalles(list: InspeccionDetalle[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.DETALLES, JSON.stringify(list));
}

function getDemoBucket(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.BUCKET_FILES) || '{}'
    );
  } catch {
    return {};
  }
}

function saveDemoBucket(map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.BUCKET_FILES, JSON.stringify(map));
}

export function computeVwReporteInspeccion(
  customInspecciones?: Inspeccion[],
  customDetalles?: InspeccionDetalle[],
  customDepartamentos?: Departamento[],
  customItems?: ChecklistItem[]
): ReporteInspeccionRow[] {
  const inspecciones = customInspecciones || getDemoInspecciones();
  const detalles = customDetalles || getDemoDetalles();
  const deptos = (customDepartamentos || getLocalDepartamentos())
    .filter((d) => d.activo)
    .sort((a, b) => a.orden - b.orden);
  const itemsAll = (customItems || getLocalItems()).filter((ci) => ci.activo);

  const rows: ReporteInspeccionRow[] = [];

  for (const insp of inspecciones) {
    for (const depto of deptos) {
      const itemsDepto = itemsAll.filter((ci) => ci.departamento_id === depto.id);
      const detsDepto = detalles.filter(
        (det) =>
          det.inspeccion_id === insp.id &&
          itemsDepto.some((ci) => ci.id === det.item_id)
      );
      const total_items = itemsDepto.length;
      const total_evaluados = detsDepto.length;
      const total_ok = detsDepto.filter((d) => d.estado === 'OK').length;
      const total_fallas = detsDepto.filter((d) => d.estado === 'FALLA').length;
      const total_na = detsDepto.filter((d) => d.estado === 'NA').length;
      const evaluadosValidos = total_ok + total_fallas;
      const baseCalculo = Math.max(total_items - total_na, 0);
      const porcentaje_cumplimiento =
        baseCalculo === 0
          ? 100
          : evaluadosValidos === 0
          ? 0
          : Number(((total_ok / baseCalculo) * 100).toFixed(1));

      rows.push({
        inspeccion_id: insp.id,
        codigo_caso: insp.codigo_caso,
        analista_nombre: insp.analista_nombre,
        turno: insp.turno,
        fecha_operativa: insp.fecha_operativa,
        estado_inspeccion: insp.estado,
        observaciones_manuales: insp.observaciones_manuales,
        departamento_id: depto.id,
        departamento: depto.nombre,
        tipo_area: depto.tipo_area,
        departamento_orden: depto.orden,
        total_items,
        total_evaluados,
        total_ok,
        total_fallas,
        total_na,
        porcentaje_cumplimiento,
      });
    }
  }
  return rows;
}

export function computeVwBusquedaAuditorias(
  customInspecciones?: Inspeccion[],
  customDetalles?: InspeccionDetalle[],
  customDepartamentos?: Departamento[],
  customItems?: ChecklistItem[]
): BusquedaAuditoriaRow[] {
  const inspecciones = customInspecciones || getDemoInspecciones();
  const detalles = customDetalles || getDemoDetalles();
  const deptos = (customDepartamentos || getLocalDepartamentos())
    .filter((d) => d.activo)
    .sort((a, b) => a.orden - b.orden);
  const itemsAll = (customItems || getLocalItems()).filter((ci) => ci.activo);

  const rows: BusquedaAuditoriaRow[] = [];

  for (const insp of inspecciones) {
    for (const depto of deptos) {
      const itemsDepto = itemsAll
        .filter((ci) => ci.departamento_id === depto.id)
        .sort((a, b) => a.orden - b.orden);

      for (const item of itemsDepto) {
        const det = detalles.find(
          (d) => d.inspeccion_id === insp.id && d.item_id === item.id
        );
        const evidencia_url = det?.evidencia_url || null;
        rows.push({
          inspeccion_id: insp.id,
          codigo_caso: insp.codigo_caso,
          analista_nombre: insp.analista_nombre,
          turno: insp.turno,
          fecha_operativa: insp.fecha_operativa,
          fecha_inicio: insp.fecha_inicio,
          fecha_fin: insp.fecha_fin,
          estado_inspeccion: insp.estado,
          observaciones_manuales: insp.observaciones_manuales,
          departamento_id: depto.id,
          departamento_nombre: depto.nombre,
          tipo_area: depto.tipo_area,
          departamento_orden: depto.orden,
          item_id: item.id,
          item_descripcion: item.descripcion,
          item_orden: item.orden,
          es_critico: item.es_critico,
          estado_item: det ? det.estado : 'NO_MARCADO',
          observacion_item: det?.observacion_item || null,
          evidencia_url,
          tiene_evidencia: Boolean(
            evidencia_url && evidencia_url.trim().length > 0
          ),
          registrado_at: det?.registrado_at || null,
        });
      }
    }
  }
  return rows;
}

export function computeVerificarReporteDiario(): AlertaReporteDiario {
  const inspecciones = getDemoInspecciones();
  const calConfig = getCalendarioConfig();
  const ayer = getTodayStr(-1);
  const hoy = getTodayStr(0);

  const contarAyer =
    calConfig.operativoOn && ayer >= calConfig.fechaInicializacion;

  const completadasAyer = inspecciones.filter(
    (i) => i.fecha_operativa === ayer && i.estado === 'COMPLETADA'
  ).length;
  const abiertasAyer = inspecciones.filter(
    (i) => i.fecha_operativa === ayer && i.estado === 'EN_PROGRESO'
  ).length;
  const completadasHoy = inspecciones.filter(
    (i) => i.fecha_operativa === hoy && i.estado === 'COMPLETADA'
  ).length;
  const abiertasHoyList = inspecciones.filter(
    (i) => i.fecha_operativa === hoy && i.estado === 'EN_PROGRESO'
  );

  const casoEnProgreso =
    abiertasHoyList.length > 0
      ? abiertasHoyList[abiertasHoyList.length - 1].codigo_caso
      : null;

  const ayerOmitidoReal = contarAyer && completadasAyer === 0;

  let mensaje = 'Reportes diarios al día.';
  if (!calConfig.operativoOn) {
    mensaje = `Modo Pre-Operativo (OFF): Los días pasados no registrados se muestran en gris y no penalizan hasta activar el inicio oficial.`;
  } else if (ayerOmitidoReal && abiertasAyer > 0) {
    mensaje = `Alerta de Reporte Omitido: La inspección del día anterior (${ayer}) quedó EN PROGRESO sin cierre ejecutivo.`;
  } else if (ayerOmitidoReal) {
    mensaje = `Alerta de Reporte Omitido: No se registró ningún reporte cerrado en la fecha operativa anterior (${ayer}).`;
  } else if (completadasHoy === 0 && casoEnProgreso) {
    mensaje = `Turno actual en curso: Evaluando inspección ${casoEnProgreso} (${hoy}).`;
  } else if (completadasHoy === 0) {
    mensaje = `El reporte del turno actual (${hoy}) está listo para iniciar.`;
  }

  return {
    fecha_ayer: ayer,
    fecha_hoy: hoy,
    ayer_omitido: ayerOmitidoReal,
    ayer_en_progreso: contarAyer && abiertasAyer > 0,
    turno_actual_pendiente: calConfig.operativoOn && completadasHoy === 0,
    caso_en_progreso: casoEnProgreso,
    alerta_activa: ayerOmitidoReal,
    mensaje,
  };
}

// ============================================================================
// DIAGNÓSTICO Y SINCRONIZACIÓN DIRECTA CON SUPABASE CLOUD (POSTGRESQL)
// ============================================================================
export interface DiagnosticoSupabaseReal {
  conectado: boolean;
  url: string;
  usuarioEmail: string | null;
  rolSesion: 'authenticated' | 'anon (Modo Local)' | 'sin_sesion';
  conteosCloud: {
    sucursales: number;
    analistas_sistemas: number;
    jefes_encargados: number;
    usuarios_roles: number;
    departamentos: number;
    checklist_items: number;
    inspecciones: number;
    inspeccion_detalles: number;
  };
  ultimasInspeccionesCloud: Inspeccion[];
  ultimosDetallesCloud: InspeccionDetalle[];
  errorRLS: string | null;
}

export async function verificarEstadoRealSupabase(): Promise<DiagnosticoSupabaseReal> {
  if (!realSupabase) {
    return {
      conectado: false,
      url: supabaseUrl || 'No configurada',
      usuarioEmail: null,
      rolSesion: 'sin_sesion',
      conteosCloud: {
        sucursales: 0,
        analistas_sistemas: 0,
        jefes_encargados: 0,
        usuarios_roles: 0,
        departamentos: 0,
        checklist_items: 0,
        inspecciones: 0,
        inspeccion_detalles: 0,
      },
      ultimasInspeccionesCloud: [],
      ultimosDetallesCloud: [],
      errorRLS: 'Variables NEXT_PUBLIC_SUPABASE_URL no configuradas.',
    };
  }

  const { data: sessionData } = await realSupabase.auth.getSession();
  const realUser = sessionData?.session?.user || null;

  const [
    sucRes,
    anaRes,
    jefRes,
    rolesRes,
    deptosRes,
    itemsRes,
    inspRes,
    detRes,
  ] = await Promise.all([
    realSupabase.from('sucursales').select('*'),
    realSupabase.from('analistas_sistemas').select('*'),
    realSupabase.from('jefes_encargados').select('*'),
    realSupabase.from('usuarios_roles').select('*'),
    realSupabase.from('departamentos').select('*'),
    realSupabase.from('checklist_items').select('*'),
    realSupabase
      .from('inspecciones')
      .select('*')
      .order('fecha_operativa', { ascending: false })
      .limit(10),
    realSupabase
      .from('inspeccion_detalles')
      .select('*')
      .order('registrado_at', { ascending: false })
      .limit(20),
  ]);

  let errorDetectado: string | null =
    sucRes.error?.message ||
    anaRes.error?.message ||
    jefRes.error?.message ||
    rolesRes.error?.message ||
    deptosRes.error?.message ||
    itemsRes.error?.message ||
    inspRes.error?.message ||
    detRes.error?.message ||
    null;

  if (!realUser && !errorDetectado) {
    const totalFilas =
      (deptosRes.data?.length || 0) +
      (itemsRes.data?.length || 0) +
      (inspRes.data?.length || 0);
    if (totalFilas === 0) {
      errorDetectado =
        'No has iniciado sesión con un usuario de Supabase Auth (o las políticas RLS exigen usuario autenticado).';
    }
  }

  return {
    conectado: !errorDetectado,
    url: supabaseUrl,
    usuarioEmail: realUser?.email || null,
    rolSesion: realUser ? 'authenticated' : 'anon (Modo Local)',
    conteosCloud: {
      sucursales: sucRes.data?.length || 0,
      analistas_sistemas: anaRes.data?.length || 0,
      jefes_encargados: jefRes.data?.length || 0,
      usuarios_roles: rolesRes.data?.length || 0,
      departamentos: deptosRes.data?.length || 0,
      checklist_items: itemsRes.data?.length || 0,
      inspecciones: inspRes.data?.length || 0,
      inspeccion_detalles: detRes.data?.length || 0,
    },
    ultimasInspeccionesCloud: (inspRes.data as Inspeccion[]) || [],
    ultimosDetallesCloud: (detRes.data as InspeccionDetalle[]) || [],
    errorRLS: errorDetectado,
  };
}

// Sube y sincroniza sucursales, analistas, jefes encargados, usuarios_roles, departamentos, ítems, inspecciones y detalles hacia PostgreSQL en Supabase
export async function sincronizarTodoASupabaseCloud(): Promise<{
  ok: boolean;
  mensaje: string;
}> {
  if (!realSupabase) {
    return { ok: false, mensaje: 'Cliente Supabase no configurado.' };
  }

  try {
    const sucursales = getSucursalesObj();
    const analistas = getTodosAnalistas();
    const jefes = getTodosJefes();
    const roles = getUsuariosRoles();
    const deptos = getLocalDepartamentos();
    const items = getLocalItems();
    const inspecciones = getDemoInspecciones();
    const detalles = getDemoDetalles();

    // 1. Sincronizar Sucursales, Analistas de Sistemas, Jefes Encargados y Roles de Usuario
    const rSuc = await realSupabase
      .from('sucursales')
      .upsert(sucursales, { onConflict: 'id' });
    if (!rSuc.error) {
      if (analistas.length > 0) {
        await realSupabase
          .from('analistas_sistemas')
          .upsert(analistas, { onConflict: 'id' });
      }
      if (jefes.length > 0) {
        await realSupabase
          .from('jefes_encargados')
          .upsert(jefes, { onConflict: 'id' });
      }
    }
    const rRoles = await realSupabase
      .from('usuarios_roles')
      .upsert(roles, { onConflict: 'email' });

    // 2. Sincronizar Departamentos y Checklist Items
    const r1 = await realSupabase
      .from('departamentos')
      .upsert(deptos, { onConflict: 'id' });
    if (r1.error) {
      return {
        ok: false,
        mensaje: `Error RLS en departamentos: ${r1.error.message}`,
      };
    }

    const r2 = await realSupabase
      .from('checklist_items')
      .upsert(items, { onConflict: 'id' });
    if (r2.error) {
      return {
        ok: false,
        mensaje: `Error RLS en checklist_items: ${r2.error.message}`,
      };
    }

    // 3. Sincronizar Inspecciones (incluyendo sucursal, analista_id, jefe_encargado y firmas digitales)
    if (inspecciones.length > 0) {
      const inspeccionesEnriquecidas = inspecciones.map((insp) => {
        const meta = getInspeccionExtraMeta(insp.id);
        const obsDepto = getObservacionesPorDepto(insp.id);
        return {
          ...insp,
          sucursal_id: meta.sucursalId,
          sucursal_nombre: meta.sucursal,
          analista_id: meta.analistaId,
          jefe_encargado_id: meta.jefeEncargadoId,
          jefe_encargado_nombre: meta.recibidoPor,
          firma_analista_url: meta.firmaAnalistaDataUrl,
          firma_encargado_url: meta.firmaSupervisorDataUrl,
          observaciones_por_depto: obsDepto,
        };
      });

      const r3 = await realSupabase
        .from('inspecciones')
        .upsert(inspeccionesEnriquecidas, { onConflict: 'id' });

      if (r3.error) {
        // Fallback si el usuario aún no corrió el ALTER TABLE en inspecciones
        const r3Basic = await realSupabase
          .from('inspecciones')
          .upsert(inspecciones, { onConflict: 'id' });
        if (r3Basic.error) {
          return {
            ok: false,
            mensaje: `Error en inspecciones: ${r3Basic.error.message}`,
          };
        }
      }
    }

    // 4. Sincronizar Detalles de Inspección
    if (detalles.length > 0) {
      const cleanDetalles = detalles.map((d) => ({
        inspeccion_id: d.inspeccion_id,
        item_id: d.item_id,
        estado: d.estado,
        observacion_item: d.observacion_item,
        evidencia_url: d.evidencia_url,
        registrado_at: d.registrado_at,
      }));
      const r4 = await realSupabase
        .from('inspeccion_detalles')
        .upsert(cleanDetalles, { onConflict: 'inspeccion_id,item_id' });
      if (r4.error) {
        return {
          ok: false,
          mensaje: `Error en inspeccion_detalles: ${r4.error.message}`,
        };
      }
    }

    const nowStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    notifySyncStatus({
      modo: 'CLOUD_OK',
      tabla: 'TODAS',
      operacion: 'SYNC',
      hora: nowStr,
      mensajeError: null,
    });

    if (rSuc.error || rRoles.error) {
      return {
        ok: false,
        mensaje: `Departamentos, ítems e inspecciones subidos, pero falta ejecutar el SQL de Roles (usuarios_roles) en Supabase (${rRoles.error?.message || rSuc.error?.message}). Copia el SQL de abajo y dale a Run.`,
      };
    }

    return {
      ok: true,
      mensaje: `¡Sincronización completa en las 8 Tablas de PostgreSQL! (${sucursales.length} sucursales, ${analistas.length} analistas, ${jefes.length} jefes encargados, ${roles.length} roles de usuario, ${deptos.length} deptos, ${items.length} ítems y ${inspecciones.length} casos en la nube).`,
    };
  } catch (e: any) {
    return {
      ok: false,
      mensaje: e?.message || 'Error inesperado al sincronizar con Supabase.',
    };
  }
}

class HybridQueryBuilder {
  private table: string;
  private filters: Array<{
    col: string;
    op: 'eq' | 'neq' | 'ilike' | 'in';
    val: any;
    fn: (row: Record<string, any>) => boolean;
  }> = [];
  private orderByField: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private singleMode = false;
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' =
    'select';
  private payload: any = null;
  private upsertConflict?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = '*') {
    if (this.operation === 'select') {
      this.operation = 'select';
    }
    return this;
  }

  insert(values: any) {
    this.operation = 'insert';
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.operation = 'update';
    this.payload = values;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.payload = values;
    this.upsertConflict = options?.onConflict;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({
      col: column,
      op: 'eq',
      val: value,
      fn: (row) => row[column] === value,
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({
      col: column,
      op: 'neq',
      val: value,
      fn: (row) => row[column] !== value,
    });
    return this;
  }

  ilike(column: string, pattern: string) {
    const clean = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push({
      col: column,
      op: 'ilike',
      val: pattern,
      fn: (row) =>
        String(row[column] ?? '')
          .toLowerCase()
          .includes(clean),
    });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({
      col: column,
      op: 'in',
      val: values,
      fn: (row) => values.includes(row[column]),
    });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderByField = column;
    this.orderAsc = opts?.ascending !== undefined ? opts.ascending : true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  maybeSingle() {
    this.singleMode = true;
    return this;
  }

  private executeLocal(): { data: any; error: any } {
    try {
      if (this.table === 'departamentos') {
        const list = getLocalDepartamentos();
        if (this.operation === 'insert') {
          const items = Array.isArray(this.payload)
            ? this.payload
            : [this.payload];
          const created: Departamento[] = items.map((item) => {
            const maxId = list.reduce((m, r) => Math.max(m, r.id), 0);
            const maxOrden = list.reduce((m, r) => Math.max(m, r.orden), 0);
            const nuevo: Departamento = {
              id: item.id || maxId + 1,
              nombre: item.nombre || 'Nuevo Departamento',
              tipo_area: item.tipo_area || 'OFICINA',
              orden: item.orden || maxOrden + 1,
              activo: item.activo !== undefined ? item.activo : true,
            };
            item.id = nuevo.id;
            item.orden = nuevo.orden;
            list.push(nuevo);
            return nuevo;
          });
          saveLocalDepartamentos(list);
          return { data: this.singleMode ? created[0] : created, error: null };
        }
        if (this.operation === 'update') {
          const updated: Departamento[] = [];
          const next = list.map((row) => {
            if (this.filters.every((f) => f.fn(row))) {
              const merged = { ...row, ...this.payload };
              updated.push(merged);
              return merged;
            }
            return row;
          });
          saveLocalDepartamentos(next);
          return {
            data: this.singleMode ? updated[0] || null : updated,
            error: null,
          };
        }
        if (this.operation === 'delete') {
          const remaining = list.filter(
            (row) => !this.filters.every((f) => f.fn(row))
          );
          saveLocalDepartamentos(remaining);
          return { data: [], error: null };
        }
      }

      if (this.table === 'checklist_items') {
        const list = getLocalItems();
        if (this.operation === 'insert') {
          const items = Array.isArray(this.payload)
            ? this.payload
            : [this.payload];
          const created: ChecklistItem[] = items.map((item) => {
            const maxId = list.reduce((m, r) => Math.max(m, r.id), 1700);
            const deptoItems = list.filter(
              (i) => i.departamento_id === item.departamento_id
            );
            const maxOrden = deptoItems.reduce(
              (m, r) => Math.max(m, r.orden),
              0
            );
            const nuevo: ChecklistItem = {
              id: item.id || maxId + 1,
              departamento_id: Number(item.departamento_id),
              descripcion: item.descripcion || 'Nuevo ítem de verificación',
              orden: item.orden || maxOrden + 1,
              es_critico: Boolean(item.es_critico),
              activo: item.activo !== undefined ? item.activo : true,
            };
            item.id = nuevo.id;
            item.orden = nuevo.orden;
            list.push(nuevo);
            return nuevo;
          });
          saveLocalItems(list);
          return { data: this.singleMode ? created[0] : created, error: null };
        }
        if (this.operation === 'update') {
          const updated: ChecklistItem[] = [];
          const next = list.map((row) => {
            if (this.filters.every((f) => f.fn(row))) {
              const merged = { ...row, ...this.payload };
              updated.push(merged);
              return merged;
            }
            return row;
          });
          saveLocalItems(next);
          return {
            data: this.singleMode ? updated[0] || null : updated,
            error: null,
          };
        }
        if (this.operation === 'delete') {
          const remaining = list.filter(
            (row) => !this.filters.every((f) => f.fn(row))
          );
          saveLocalItems(remaining);
          return { data: [], error: null };
        }
      }

      if (this.operation === 'insert' && this.table === 'inspecciones') {
        const list = getDemoInspecciones();
        const items = Array.isArray(this.payload)
          ? this.payload
          : [this.payload];
        const created: Inspeccion[] = items.map((item) => {
          const nextNum = list.length + 1;
          const codigo =
            item.codigo_caso || `CAS-${String(nextNum).padStart(4, '0')}`;
          const generatedUuid =
            item.id ||
            (typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : '11111111-1111-4111-8111-' +
                String(Date.now()).padStart(12, '0'));
          item.id = generatedUuid;
          item.codigo_caso = codigo;
          const newInsp: Inspeccion = {
            id: generatedUuid,
            codigo_caso: codigo,
            analista_nombre: item.analista_nombre || 'Analista de Sistemas',
            turno: normalizarTurnoOficial(item.turno),
            fecha_operativa: item.fecha_operativa || getTodayStr(0),
            fecha_inicio: item.fecha_inicio || new Date().toISOString(),
            fecha_fin: item.fecha_fin || null,
            estado: item.estado || 'EN_PROGRESO',
            observaciones_manuales: item.observaciones_manuales || null,
          };
          list.unshift(newInsp);
          return newInsp;
        });
        saveDemoInspecciones(list);
        return { data: this.singleMode ? created[0] : created, error: null };
      }

      if (this.operation === 'update' && this.table === 'inspecciones') {
        const list = getDemoInspecciones();
        const updated: Inspeccion[] = [];
        const nextList = list.map((row) => {
          const match = this.filters.every((f) => f.fn(row));
          if (match) {
            const merged = { ...row, ...this.payload };
            updated.push(merged);
            return merged;
          }
          return row;
        });
        saveDemoInspecciones(nextList);
        return {
          data: this.singleMode ? updated[0] || null : updated,
          error: null,
        };
      }

      if (
        (this.operation === 'upsert' || this.operation === 'insert') &&
        this.table === 'inspeccion_detalles'
      ) {
        const list = getDemoDetalles();
        const items = Array.isArray(this.payload)
          ? this.payload
          : [this.payload];
        const results: InspeccionDetalle[] = [];

        for (const item of items) {
          const idx = list.findIndex(
            (d) =>
              d.inspeccion_id === item.inspeccion_id &&
              d.item_id === item.item_id
          );
          if (idx >= 0) {
            const updated: InspeccionDetalle = {
              ...list[idx],
              estado: item.estado ?? list[idx].estado,
              observacion_item:
                item.observacion_item !== undefined
                  ? item.observacion_item
                  : list[idx].observacion_item,
              evidencia_url:
                item.evidencia_url !== undefined
                  ? item.evidencia_url
                  : list[idx].evidencia_url,
              registrado_at: item.registrado_at || new Date().toISOString(),
            };
            list[idx] = updated;
            results.push(updated);
          } else {
            const maxId = list.reduce((m, r) => Math.max(m, r.id), 0);
            const created: InspeccionDetalle = {
              id: maxId + 1,
              inspeccion_id: item.inspeccion_id,
              item_id: item.item_id,
              estado: item.estado,
              observacion_item: item.observacion_item ?? null,
              evidencia_url: item.evidencia_url ?? null,
              registrado_at: item.registrado_at || new Date().toISOString(),
            };
            list.push(created);
            results.push(created);
          }
        }
        saveDemoDetalles(list);
        return {
          data: this.singleMode ? results[0] || null : results,
          error: null,
        };
      }

      let rows: Record<string, any>[] = [];
      if (this.table === 'departamentos') {
        rows = [...getLocalDepartamentos()];
      } else if (this.table === 'checklist_items') {
        rows = [...getLocalItems()];
      } else if (this.table === 'inspecciones') {
        rows = [...getDemoInspecciones()];
      } else if (this.table === 'inspeccion_detalles') {
        rows = [...getDemoDetalles()];
      } else if (this.table === 'vw_reporte_inspeccion') {
        rows = [...computeVwReporteInspeccion()];
      } else if (this.table === 'vw_busqueda_auditorias') {
        rows = [...computeVwBusquedaAuditorias()];
      }

      let filtered = rows.filter((r) => this.filters.every((f) => f.fn(r)));

      if (this.orderByField) {
        const field = this.orderByField;
        const asc = this.orderAsc;
        filtered.sort((a, b) => {
          if (a[field] < b[field]) return asc ? -1 : 1;
          if (a[field] > b[field]) return asc ? 1 : -1;
          return 0;
        });
      }

      if (this.limitCount !== null) {
        filtered = filtered.slice(0, this.limitCount);
      }

      if (this.singleMode) {
        return { data: filtered[0] ?? null, error: null };
      }

      return { data: filtered, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Error en consulta' },
      };
    }
  }

  private async executeHybrid(): Promise<{ data: any; error: any }> {
    const localResult = this.executeLocal();

    if (!realSupabase) {
      return localResult;
    }

    if (
      this.table === 'vw_reporte_inspeccion' ||
      this.table === 'vw_busqueda_auditorias'
    ) {
      return localResult;
    }

    try {
      // Si vamos a insertar/upsert en inspeccion_detalles, nos aseguramos de que la inspección y el ítem existan en Supabase Cloud
      if (
        (this.operation === 'upsert' || this.operation === 'insert') &&
        this.table === 'inspeccion_detalles' &&
        this.payload
      ) {
        const itemObj = Array.isArray(this.payload)
          ? this.payload[0]
          : this.payload;
        const inspLocal = getDemoInspecciones().find(
          (i) => i.id === itemObj.inspeccion_id
        );
        if (inspLocal) {
          await realSupabase
            .from('inspecciones')
            .upsert(inspLocal, { onConflict: 'id' });
        }
        const catItem = getLocalItems().find((i) => i.id === itemObj.item_id);
        if (catItem) {
          const catDepto = getLocalDepartamentos().find(
            (d) => d.id === catItem.departamento_id
          );
          if (catDepto) {
            await realSupabase
              .from('departamentos')
              .upsert(catDepto, { onConflict: 'id' });
          }
          await realSupabase
            .from('checklist_items')
            .upsert(catItem, { onConflict: 'id' });
        }
      }

      let query: any = realSupabase.from(this.table);

      if (this.operation === 'select') {
        query = query.select('*');
      } else if (this.operation === 'insert') {
        query = query.insert(this.payload).select('*');
      } else if (this.operation === 'update') {
        query = query.update(this.payload).select('*');
      } else if (this.operation === 'upsert') {
        query = query
          .upsert(
            this.payload,
            this.upsertConflict ? { onConflict: this.upsertConflict } : undefined
          )
          .select('*');
      } else if (this.operation === 'delete') {
        query = query.delete();
      }

      for (const f of this.filters) {
        if (f.op === 'eq') query = query.eq(f.col, f.val);
        else if (f.op === 'neq') query = query.neq(f.col, f.val);
        else if (f.op === 'ilike') query = query.ilike(f.col, f.val);
        else if (f.op === 'in') query = query.in(f.col, f.val);
      }

      if (this.orderByField && this.operation === 'select') {
        query = query.order(this.orderByField, { ascending: this.orderAsc });
      }
      if (this.limitCount !== null && this.operation === 'select') {
        query = query.limit(this.limitCount);
      }
      if (this.singleMode && this.operation !== 'delete') {
        query = query.maybeSingle();
      }

      const cloudRes = await query;
      const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (this.operation !== 'select') {
        if (!cloudRes.error) {
          notifySyncStatus({
            modo: 'CLOUD_OK',
            tabla: this.table,
            operacion: this.operation.toUpperCase(),
            hora: nowStr,
            mensajeError: null,
          });
        } else {
          notifySyncStatus({
            modo: 'LOCAL_FALLBACK',
            tabla: this.table,
            operacion: this.operation.toUpperCase(),
            hora: nowStr,
            mensajeError: cloudRes.error.message,
          });
        }
      }

      if (!cloudRes.error && cloudRes.data !== null) {
        if (this.operation === 'select' && Array.isArray(cloudRes.data)) {
          if (cloudRes.data.length > 0) {
            // Actualizar caché local con lo que viene de PostgreSQL
            if (this.table === 'departamentos' && this.filters.length === 0) {
              saveLocalDepartamentos(cloudRes.data as Departamento[]);
            } else if (
              this.table === 'checklist_items' &&
              this.filters.length === 0
            ) {
              saveLocalItems(cloudRes.data as ChecklistItem[]);
            } else if (
              this.table === 'inspecciones' &&
              this.filters.length === 0
            ) {
              saveDemoInspecciones(cloudRes.data as Inspeccion[]);
            } else if (this.table === 'inspeccion_detalles') {
              const current = getDemoDetalles();
              const incoming = cloudRes.data as InspeccionDetalle[];
              const merged = [...current];
              for (const inc of incoming) {
                const idx = merged.findIndex(
                  (m) =>
                    m.inspeccion_id === inc.inspeccion_id &&
                    m.item_id === inc.item_id
                );
                if (idx >= 0) merged[idx] = inc;
                else merged.push(inc);
              }
              saveDemoDetalles(merged);
            }
            return cloudRes;
          } else {
            // Si la tabla en PostgreSQL está vacía, para catálogos devolvemos la semilla local
            return localResult;
          }
        }
        return cloudRes;
      }

      return localResult;
    } catch (err: any) {
      return localResult;
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.executeHybrid().then(onfulfilled, onrejected);
  }
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

const authListeners = new Set<
  (event: string, session: DemoUserSession | null) => void
>();

const hybridSupabaseClient = {
  from(table: string) {
    return new HybridQueryBuilder(table);
  },

  rpc(fnName: string, _params?: Record<string, any>) {
    if (fnName === 'verificar_reporte_diario') {
      return Promise.resolve({
        data: computeVerificarReporteDiario(),
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  },

  storage: {
    from(bucketName: string) {
      return {
        async upload(
          filePath: string,
          file: File | Blob,
          options?: { upsert?: boolean; contentType?: string }
        ) {
          try {
            const dataUrl = await fileToDataUrl(file);
            const bucket = getDemoBucket();
            bucket[filePath] = dataUrl;
            saveDemoBucket(bucket);
            if (realSupabase) {
              await realSupabase.storage
                .from(bucketName)
                .upload(filePath, file, options)
                .catch(() => null);
            }
            return { data: { path: filePath }, error: null };
          } catch (e: any) {
            return {
              data: null,
              error: {
                message: e?.message || 'No se pudo almacenar la imagen',
              },
            };
          }
        },
        async createSignedUrl(filePath: string, expiresIn = 3600) {
          const bucket = getDemoBucket();
          const stored = bucket[filePath];
          if (stored) {
            return {
              data: { signedUrl: stored },
              error: null,
            };
          }
          if (realSupabase) {
            const cloudSigned = await realSupabase.storage
              .from(bucketName)
              .createSignedUrl(filePath, expiresIn)
              .catch(() => null);
            if (cloudSigned?.data?.signedUrl) {
              return cloudSigned;
            }
          }
          const fallbackSvg = buildDemoPhotoSvg(
            `Evidencia registrada (${filePath})`,
            'Auditoría Tecnológica',
            'CAS-RIO',
            getTodayStr(0)
          );
          return {
            data: { signedUrl: fallbackSvg },
            error: null,
          };
        },
      };
    },
  },

  auth: {
    async signInWithPassword({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) {
      if (realSupabase) {
        const res = await realSupabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!res.error && res.data.session) {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(STORAGE_KEYS.SESSION);
          }
          return res;
        }
      }
      if (!email || !password || password.length < 4) {
        return {
          data: { user: null, session: null },
          error: {
            message: 'Credenciales inválidas. Verifica correo y contraseña.',
          },
        };
      }
      const nombreAnalista = email
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      const session: DemoUserSession = {
        user: {
          id: 'usr-rio-auditor-01',
          email,
          role: 'authenticated',
          user_metadata: {
            nombre: `Ing. ${nombreAnalista}`,
            cargo: 'Especialista de Auditoría Tecnológica',
          },
        },
        access_token: `demo-jwt-${Date.now()}`,
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_KEYS.SESSION,
          JSON.stringify(session)
        );
      }
      authListeners.forEach((cb) => cb('SIGNED_IN', session));
      return { data: { user: session.user, session }, error: null };
    },

    async signOut() {
      if (realSupabase) {
        await realSupabase.auth.signOut().catch(() => null);
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
      authListeners.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null };
    },

    async getSession() {
      // Primero verificamos la sesión real de Supabase Auth (JWT autenticado)
      if (realSupabase) {
        const realRes = await realSupabase.auth.getSession();
        if (realRes.data?.session) {
          return realRes;
        }
      }
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(STORAGE_KEYS.SESSION);
        if (raw) {
          try {
            const session = JSON.parse(raw) as DemoUserSession;
            return { data: { session }, error: null };
          } catch {
            // continue
          }
        }
      }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange(
      callback: (event: string, session: DemoUserSession | any | null) => void
    ) {
      authListeners.add(callback);
      if (realSupabase) {
        realSupabase.auth.onAuthStateChange(callback);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },
};

export const supabase = hybridSupabaseClient;
export type {
  Departamento,
  ChecklistItem,
  Inspeccion,
  InspeccionDetalle,
  ReporteInspeccionRow,
  BusquedaAuditoriaRow,
  AlertaReporteDiario,
};
