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

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl
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

const realSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEYS = {
  SESSION: 'rio_auditoria_session_v1',
  INSPECCIONES: 'rio_auditoria_inspecciones_v1',
  DETALLES: 'rio_auditoria_detalles_v1',
  BUCKET_FILES: 'rio_auditoria_bucket_evidencias_v1',
};

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

function getTodayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initDemoStore() {
  if (typeof window === 'undefined') return;
  const existing = window.localStorage.getItem(STORAGE_KEYS.INSPECCIONES);
  if (existing) return;

  const hoy = getTodayStr(0);
  const ayer = getTodayStr(-1);
  const hace2Dias = getTodayStr(-2);
  const hace3Dias = getTodayStr(-3);

  const insp1Id = '11111111-1111-4111-8111-111111111101';
  const insp2Id = '22222222-2222-4222-8222-222222222202';
  const insp3Id = '33333333-3333-4333-8333-333333333303';
  const insp4Id = '44444444-4444-4444-8444-444444444404';

  const initialInspecciones: Inspeccion[] = [
    {
      id: insp1Id,
      codigo_caso: 'CAS-0001',
      analista_nombre: 'Ing. Carlos Mendoza',
      turno: 'Mañana (07:00 - 15:00)',
      fecha_operativa: hace3Dias,
      fecha_inicio: `${hace3Dias}T07:15:00.000Z`,
      fecha_fin: `${hace3Dias}T11:40:00.000Z`,
      estado: 'COMPLETADA',
      observaciones_manuales:
        'Operatividad general al 97%. Se reemplazó rollo térmico y se limpió cabezal en balanza auxiliar de Carnicería.',
    },
    {
      id: insp2Id,
      codigo_caso: 'CAS-0002',
      analista_nombre: 'Ing. María Fernanda Gómez',
      turno: 'Tarde (14:00 - 22:00)',
      fecha_operativa: hace2Dias,
      fecha_inicio: `${hace2Dias}T14:10:00.000Z`,
      fecha_fin: `${hace2Dias}T18:05:00.000Z`,
      estado: 'COMPLETADA',
      observaciones_manuales:
        'Se detectó intermitencia en terminal Cashea de Caja #4 y batería degradada en UPS de Gerencia. Se escaló ticket a soporte nivel 2.',
    },
    {
      id: insp3Id,
      codigo_caso: 'CAS-0003',
      analista_nombre: 'T.S.U. Roberto Alvarado',
      turno: 'Mañana (07:00 - 15:00)',
      fecha_operativa: ayer,
      fecha_inicio: `${ayer}T07:30:00.000Z`,
      fecha_fin: null,
      estado: 'EN_PROGRESO',
      observaciones_manuales:
        'Revisión parcial del turno anterior; quedó pendiente cierre formal tras contingencia eléctrica en muelle de Recepción.',
    },
    {
      id: insp4Id,
      codigo_caso: 'CAS-0004',
      analista_nombre: 'Ing. Carlos Mendoza',
      turno: 'Mañana (07:00 - 15:00)',
      fecha_operativa: hoy,
      fecha_inicio: `${hoy}T07:20:00.000Z`,
      fecha_fin: null,
      estado: 'EN_PROGRESO',
      observaciones_manuales:
        'Auditoría diaria en curso. Se verificó operatividad de Tablet y Cashea en Gerencia; incidencia reportada en Cabezal Térmico de Carnicería y Terminal Cashea en Línea de Caja.',
    },
  ];

  const detalles: InspeccionDetalle[] = [];
  const bucketFiles: Record<string, string> = {};
  let detId = 1;

  // Poblar CAS-0001 (Completada, casi todo OK con 2 fallas documentadas)
  for (const item of CHECKLIST_ITEMS_SEED) {
    const isFalla = item.id === 902 || item.id === 1401;
    const filePath = isFalla ? `${insp1Id}/${item.id}-1700000100.jpg` : null;
    if (isFalla && filePath) {
      const depto = DEPARTAMENTOS_SEED.find((d) => d.id === item.departamento_id)?.nombre || 'Área';
      bucketFiles[filePath] = buildDemoPhotoSvg(item.descripcion, depto, 'CAS-0001', hace3Dias);
    }
    detalles.push({
      id: detId++,
      inspeccion_id: insp1Id,
      item_id: item.id,
      estado: isFalla ? 'FALLA' : 'OK',
      observacion_item: isFalla
        ? 'Descalibración en cabezal térmico / Lector requiere reinicio de interfaz IP.'
        : null,
      evidencia_url: filePath,
      registrado_at: `${hace3Dias}T09:30:00.000Z`,
    });
  }

  // Poblar CAS-0002 (Completada, 3 fallas con evidencia fotográfica)
  for (const item of CHECKLIST_ITEMS_SEED) {
    const isFalla = item.id === 105 || item.id === 1301 || item.id === 1603;
    const isNa = item.id === 403;
    const filePath = isFalla ? `${insp2Id}/${item.id}-1700000200.jpg` : null;
    if (isFalla && filePath) {
      const depto = DEPARTAMENTOS_SEED.find((d) => d.id === item.departamento_id)?.nombre || 'Área';
      bucketFiles[filePath] = buildDemoPhotoSvg(item.descripcion, depto, 'CAS-0002', hace2Dias);
    }
    detalles.push({
      id: detId++,
      inspeccion_id: insp2Id,
      item_id: item.id,
      estado: isFalla ? 'FALLA' : isNa ? 'NA' : 'OK',
      observacion_item: isFalla
        ? 'Alarma audible en batería / Error de sincronización QR en caja rápida.'
        : null,
      evidencia_url: filePath,
      registrado_at: `${hace2Dias}T16:15:00.000Z`,
    });
  }

  // Poblar CAS-0003 (Ayer - En Progreso, con ítems NO_MARCADO para probar filtros y alerta de reporte omitido)
  for (const item of CHECKLIST_ITEMS_SEED.slice(0, 32)) {
    const isFalla = item.id === 801 || item.id === 602;
    const filePath = isFalla ? `${insp3Id}/${item.id}-1700000300.jpg` : null;
    if (isFalla && filePath) {
      const depto = DEPARTAMENTOS_SEED.find((d) => d.id === item.departamento_id)?.nombre || 'Área';
      bucketFiles[filePath] = buildDemoPhotoSvg(item.descripcion, depto, 'CAS-0003', ayer);
    }
    detalles.push({
      id: detId++,
      inspeccion_id: insp3Id,
      item_id: item.id,
      estado: isFalla ? 'FALLA' : 'OK',
      observacion_item: isFalla
        ? 'Variación de voltaje en módulo indicador RS-232 de romana electrónica.'
        : null,
      evidencia_url: filePath,
      registrado_at: `${ayer}T10:12:00.000Z`,
    });
  }

  // Poblar CAS-0004 (Hoy - En Progreso, primeros departamentos respondidos para mostrar progreso en tiempo real)
  const itemsPreRespondidosHoy = [
    { item_id: 101, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 102, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 103, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 104, estado: 'FALLA' as const, obs: 'Bandeja 2 atasca papel y nivel de tóner negro en 8%.', foto: true },
    { item_id: 105, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 201, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 202, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 901, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 903, estado: 'FALLA' as const, obs: 'Cabezal térmico presenta línea vertical sin impresión sobre el código EAN-13.', foto: true },
    { item_id: 1301, estado: 'FALLA' as const, obs: 'Terminal Cashea en Caja #07 pierde sesión Wi-Fi al generar QR dinámico.', foto: true },
    { item_id: 1302, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 1501, estado: 'OK' as const, obs: null, foto: false },
    { item_id: 1504, estado: 'OK' as const, obs: null, foto: false },
  ];

  for (const pre of itemsPreRespondidosHoy) {
    const itemObj = CHECKLIST_ITEMS_SEED.find((i) => i.id === pre.item_id)!;
    const depto = DEPARTAMENTOS_SEED.find((d) => d.id === itemObj.departamento_id)?.nombre || 'Área';
    const filePath = pre.foto ? `${insp4Id}/${pre.item_id}-1700000400.jpg` : null;
    if (pre.foto && filePath) {
      bucketFiles[filePath] = buildDemoPhotoSvg(itemObj.descripcion, depto, 'CAS-0004', hoy);
    }
    detalles.push({
      id: detId++,
      inspeccion_id: insp4Id,
      item_id: pre.item_id,
      estado: pre.estado,
      observacion_item: pre.obs,
      evidencia_url: filePath,
      registrado_at: `${hoy}T08:05:00.000Z`,
    });
  }

  window.localStorage.setItem(STORAGE_KEYS.INSPECCIONES, JSON.stringify(initialInspecciones));
  window.localStorage.setItem(STORAGE_KEYS.DETALLES, JSON.stringify(detalles));
  window.localStorage.setItem(STORAGE_KEYS.BUCKET_FILES, JSON.stringify(bucketFiles));
}

function getDemoInspecciones(): Inspeccion[] {
  initDemoStore();
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.INSPECCIONES) || '[]');
  } catch {
    return [];
  }
}

function saveDemoInspecciones(list: Inspeccion[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.INSPECCIONES, JSON.stringify(list));
}

function getDemoDetalles(): InspeccionDetalle[] {
  initDemoStore();
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.DETALLES) || '[]');
  } catch {
    return [];
  }
}

function saveDemoDetalles(list: InspeccionDetalle[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.DETALLES, JSON.stringify(list));
}

function getDemoBucket(): Record<string, string> {
  initDemoStore();
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.BUCKET_FILES) || '{}');
  } catch {
    return {};
  }
}

function saveDemoBucket(map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.BUCKET_FILES, JSON.stringify(map));
}

function computeVwReporteInspeccion(): ReporteInspeccionRow[] {
  const inspecciones = getDemoInspecciones();
  const detalles = getDemoDetalles();
  const rows: ReporteInspeccionRow[] = [];

  for (const insp of inspecciones) {
    for (const depto of DEPARTAMENTOS_SEED.filter((d) => d.activo).sort((a, b) => a.orden - b.orden)) {
      const itemsDepto = CHECKLIST_ITEMS_SEED.filter(
        (ci) => ci.departamento_id === depto.id && ci.activo
      );
      const detsDepto = detalles.filter(
        (det) =>
          det.inspeccion_id === insp.id && itemsDepto.some((ci) => ci.id === det.item_id)
      );
      const total_items = itemsDepto.length;
      const total_evaluados = detsDepto.length;
      const total_ok = detsDepto.filter((d) => d.estado === 'OK').length;
      const total_fallas = detsDepto.filter((d) => d.estado === 'FALLA').length;
      const total_na = detsDepto.filter((d) => d.estado === 'NA').length;
      const evaluadosValidos = total_ok + total_fallas;
      const porcentaje_cumplimiento =
        evaluadosValidos === 0 ? 100 : Number(((total_ok / evaluadosValidos) * 100).toFixed(1));

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

function computeVwBusquedaAuditorias(): BusquedaAuditoriaRow[] {
  const inspecciones = getDemoInspecciones();
  const detalles = getDemoDetalles();
  const rows: BusquedaAuditoriaRow[] = [];

  for (const insp of inspecciones) {
    for (const depto of DEPARTAMENTOS_SEED.filter((d) => d.activo).sort((a, b) => a.orden - b.orden)) {
      const itemsDepto = CHECKLIST_ITEMS_SEED.filter(
        (ci) => ci.departamento_id === depto.id && ci.activo
      ).sort((a, b) => a.orden - b.orden);

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
          tiene_evidencia: Boolean(evidencia_url && evidencia_url.trim().length > 0),
          registrado_at: det?.registrado_at || null,
        });
      }
    }
  }
  return rows;
}

function computeVerificarReporteDiario(): AlertaReporteDiario {
  const inspecciones = getDemoInspecciones();
  const ayer = getTodayStr(-1);
  const hoy = getTodayStr(0);

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

  let mensaje = 'Reportes diarios al día.';
  if (completadasAyer === 0 && abiertasAyer > 0) {
    mensaje = `Alerta de Reporte Omitido: La inspección del día anterior (${ayer}) quedó EN PROGRESO sin cierre ejecutivo.`;
  } else if (completadasAyer === 0) {
    mensaje = `Alerta de Reporte Omitido: No se registró ningún reporte cerrado en la fecha operativa anterior (${ayer}).`;
  } else if (completadasHoy === 0 && casoEnProgreso) {
    mensaje = `Turno actual pendiente de cierre: La inspección ${casoEnProgreso} (${hoy}) sigue EN PROGRESO.`;
  } else if (completadasHoy === 0) {
    mensaje = `El reporte del turno actual (${hoy}) aún no ha sido iniciado ni cerrado.`;
  }

  return {
    fecha_ayer: ayer,
    fecha_hoy: hoy,
    ayer_omitido: completadasAyer === 0,
    ayer_en_progreso: abiertasAyer > 0,
    turno_actual_pendiente: completadasHoy === 0,
    caso_en_progreso: casoEnProgreso,
    alerta_activa: completadasAyer === 0 || completadasHoy === 0,
    mensaje,
  };
}

// Query Builder compatible con la API de @supabase/supabase-js para modo Demo
class DemoQueryBuilder {
  private table: string;
  private filters: Array<(row: Record<string, any>) => boolean> = [];
  private orderByField: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private singleMode = false;
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any = null;

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

  upsert(values: any, _options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const clean = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push((row) =>
      String(row[column] ?? '')
        .toLowerCase()
        .includes(clean)
    );
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
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

  private execute(): { data: any; error: any } {
    try {
      if (this.operation === 'insert' && this.table === 'inspecciones') {
        const list = getDemoInspecciones();
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created: Inspeccion[] = items.map((item) => {
          const nextNum = list.length + 1;
          const codigo =
            item.codigo_caso || `CAS-${String(nextNum).padStart(4, '0')}`;
          const newInsp: Inspeccion = {
            id:
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `demo-${Date.now()}`,
            codigo_caso: codigo,
            analista_nombre: item.analista_nombre || 'Analista de Sistemas',
            turno: item.turno || 'Mañana (07:00 - 15:00)',
            fecha_operativa: item.fecha_operativa || getTodayStr(0),
            fecha_inicio: item.fecha_inicio || new Date().toISOString(),
            fecha_fin: item.fecha_fin || null,
            estado: item.estado || 'EN_PROGRESO',
            observaciones_manuales: item.observaciones_manuales || null,
          };
          list.push(newInsp);
          return newInsp;
        });
        saveDemoInspecciones(list);
        return { data: this.singleMode ? created[0] : created, error: null };
      }

      if (this.operation === 'update' && this.table === 'inspecciones') {
        const list = getDemoInspecciones();
        const updated: Inspeccion[] = [];
        const nextList = list.map((row) => {
          const match = this.filters.every((fn) => fn(row));
          if (match) {
            const merged = { ...row, ...this.payload };
            updated.push(merged);
            return merged;
          }
          return row;
        });
        saveDemoInspecciones(nextList);
        return { data: this.singleMode ? updated[0] || null : updated, error: null };
      }

      if (
        (this.operation === 'upsert' || this.operation === 'insert') &&
        this.table === 'inspeccion_detalles'
      ) {
        const list = getDemoDetalles();
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const results: InspeccionDetalle[] = [];

        for (const item of items) {
          const idx = list.findIndex(
            (d) =>
              d.inspeccion_id === item.inspeccion_id && d.item_id === item.item_id
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
        return { data: this.singleMode ? results[0] || null : results, error: null };
      }

      // SELECT operations
      let rows: Record<string, any>[] = [];
      if (this.table === 'departamentos') {
        rows = [...DEPARTAMENTOS_SEED];
      } else if (this.table === 'checklist_items') {
        rows = [...CHECKLIST_ITEMS_SEED];
      } else if (this.table === 'inspecciones') {
        rows = [...getDemoInspecciones()];
      } else if (this.table === 'inspeccion_detalles') {
        rows = [...getDemoDetalles()];
      } else if (this.table === 'vw_reporte_inspeccion') {
        rows = [...computeVwReporteInspeccion()];
      } else if (this.table === 'vw_busqueda_auditorias') {
        rows = [...computeVwBusquedaAuditorias()];
      }

      let filtered = rows.filter((r) => this.filters.every((fn) => fn(r)));

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
      return { data: null, error: { message: err?.message || 'Error en consulta' } };
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
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

const authListeners = new Set<(event: string, session: DemoUserSession | null) => void>();

const demoSupabaseClient = {
  from(table: string) {
    if (realSupabase) {
      return realSupabase.from(table);
    }
    return new DemoQueryBuilder(table);
  },

  rpc(fnName: string, params?: Record<string, any>) {
    if (realSupabase) {
      return realSupabase.rpc(fnName, params);
    }
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
      if (realSupabase) {
        return realSupabase.storage.from(bucketName);
      }
      return {
        async upload(
          filePath: string,
          file: File | Blob,
          _options?: { upsert?: boolean; contentType?: string }
        ) {
          try {
            const dataUrl = await fileToDataUrl(file);
            const bucket = getDemoBucket();
            bucket[filePath] = dataUrl;
            saveDemoBucket(bucket);
            return { data: { path: filePath }, error: null };
          } catch (e: any) {
            return {
              data: null,
              error: { message: e?.message || 'No se pudo almacenar la imagen' },
            };
          }
        },
        async createSignedUrl(filePath: string, _expiresIn = 3600) {
          const bucket = getDemoBucket();
          const stored = bucket[filePath];
          if (stored) {
            return {
              data: { signedUrl: stored },
              error: null,
            };
          }
          // Fallback visual en caso de ruta externa
          const fallbackSvg = buildDemoPhotoSvg(
            `Evidencia registrada (${filePath})`,
            'Auditoría Tecnológica',
            'CAS-DEMO',
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
        return realSupabase.auth.signInWithPassword({ email, password });
      }
      if (!email || !password || password.length < 4) {
        return {
          data: { user: null, session: null },
          error: { message: 'Credenciales inválidas. Verifica correo y contraseña.' },
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
        window.localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      }
      authListeners.forEach((cb) => cb('SIGNED_IN', session));
      return { data: { user: session.user, session }, error: null };
    },

    async signOut() {
      if (realSupabase) {
        return realSupabase.auth.signOut();
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
      authListeners.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null };
    },

    async getSession() {
      if (realSupabase) {
        return realSupabase.auth.getSession();
      }
      if (typeof window === 'undefined') {
        return { data: { session: null }, error: null };
      }
      const raw = window.localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!raw) return { data: { session: null }, error: null };
      try {
        const session = JSON.parse(raw) as DemoUserSession;
        return { data: { session }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
    },

    onAuthStateChange(
      callback: (event: string, session: DemoUserSession | any | null) => void
    ) {
      if (realSupabase) {
        return realSupabase.auth.onAuthStateChange(callback);
      }
      authListeners.add(callback);
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

export const supabase = demoSupabaseClient;
export type {
  Departamento,
  ChecklistItem,
  Inspeccion,
  InspeccionDetalle,
  ReporteInspeccionRow,
  BusquedaAuditoriaRow,
  AlertaReporteDiario,
};
