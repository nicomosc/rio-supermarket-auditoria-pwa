'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  supabase,
  BusquedaAuditoriaRow,
  Departamento,
  Inspeccion,
} from '@/lib/supabase';
import {
  Search,
  Calendar as CalendarIcon,
  AlertTriangle,
  Camera,
  HelpCircle,
  CheckCircle2,
  FileText,
  ExternalLink,
  X,
  Filter,
  Clock,
  ShieldAlert,
  PlayCircle,
} from 'lucide-react';

interface ModuloBusquedaCalendarioProps {
  departamentos: Departamento[];
  onVerReporteCaso: (inspeccionId: string, codigoCaso: string) => void;
  onSeleccionarInspeccionActiva: (inspeccionId: string) => void;
}

// Normaliza cualquier variación de nombres de columna en vw_busqueda_auditorias
function normalizarFilaBusqueda(raw: any, deptos: Departamento[]): BusquedaAuditoriaRow {
  const deptoNombre =
    raw.departamento_nombre ||
    raw.departamento ||
    deptos.find((d) => d.id === raw.departamento_id)?.nombre ||
    'Departamento';
  const deptoObj =
    deptos.find(
      (d) =>
        d.id === raw.departamento_id ||
        d.nombre.toLowerCase() === String(deptoNombre).toLowerCase()
    ) || null;

  const evidenciaUrl = raw.evidencia_url || null;

  return {
    inspeccion_id: raw.inspeccion_id || raw.id_inspeccion || raw.id,
    codigo_caso: raw.codigo_caso || 'CAS-0000',
    analista_nombre: raw.analista_nombre || 'Analista Sistemas',
    turno: raw.turno || 'Diurno',
    fecha_operativa: raw.fecha_operativa || '',
    fecha_inicio: raw.fecha_inicio || '',
    fecha_fin: raw.fecha_fin || null,
    estado_inspeccion: raw.estado_inspeccion || raw.estado || 'EN_PROGRESO',
    observaciones_manuales: raw.observaciones_manuales || null,
    departamento_id: raw.departamento_id || deptoObj?.id || 0,
    departamento_nombre: deptoNombre,
    tipo_area: raw.tipo_area || deptoObj?.tipo_area || 'OFICINA',
    departamento_orden: raw.departamento_orden || deptoObj?.orden || 1,
    item_id: raw.item_id || raw.id_item || 0,
    item_descripcion: raw.item_descripcion || raw.descripcion || raw.item || '',
    item_orden: raw.item_orden || raw.orden || 1,
    es_critico: Boolean(raw.es_critico),
    estado_item: raw.estado_item || 'NO_MARCADO',
    observacion_item: raw.observacion_item || null,
    evidencia_url: evidenciaUrl,
    tiene_evidencia:
      raw.tiene_evidencia !== undefined
        ? Boolean(raw.tiene_evidencia)
        : Boolean(evidenciaUrl && String(evidenciaUrl).trim().length > 0),
    registrado_at: raw.registrado_at || null,
  };
}

export default function ModuloBusquedaCalendario({
  departamentos,
  onVerReporteCaso,
  onSeleccionarInspeccionActiva,
}: ModuloBusquedaCalendarioProps) {
  const [registros, setRegistros] = useState<BusquedaAuditoriaRow[]>([]);
  const [inspeccionesList, setInspeccionesList] = useState<Inspeccion[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busquedaCaso, setBusquedaCaso] = useState('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [deptoFiltro, setDeptoFiltro] = useState<number | 'TODOS'>('TODOS');
  const [filtroSoloFallas, setFiltroSoloFallas] = useState(false);
  const [filtroConEvidencia, setFiltroConEvidencia] = useState(false);
  const [filtroNoMarcados, setFiltroNoMarcados] = useState(false);

  // Cache de Signed URLs generadas desde el bucket privado evidencias-auditoria
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [modalEvidencia, setModalEvidencia] = useState<{
    url: string;
    row: BusquedaAuditoriaRow;
  } | null>(null);

  useEffect(() => {
    async function cargarVistaBusqueda() {
      setLoading(true);
      const [{ data: vistaData }, { data: inspData }] = await Promise.all([
        supabase.from('vw_busqueda_auditorias').select('*'),
        supabase
          .from('inspecciones')
          .select('*')
          .order('fecha_operativa', { ascending: false }),
      ]);

      if (vistaData) {
        setRegistros(
          (vistaData as any[]).map((r) => normalizarFilaBusqueda(r, departamentos))
        );
      }
      if (inspData) {
        setInspeccionesList(inspData as Inspeccion[]);
      }
      setLoading(false);
    }
    cargarVistaBusqueda();
  }, [departamentos]);

  // Generar Signed URLs (3600s) para los ítems que tienen evidencia_url
  useEffect(() => {
    async function resolverUrlsFirmadas() {
      const conEvidencia = registros.filter(
        (r) => r.tiene_evidencia && r.evidencia_url && !signedUrls[r.evidencia_url]
      );
      if (conEvidencia.length === 0) return;

      const nuevasUrls: Record<string, string> = {};
      for (const item of conEvidencia) {
        if (!item.evidencia_url) continue;
        const { data } = await supabase.storage
          .from('evidencias-auditoria')
          .createSignedUrl(item.evidencia_url, 3600);
        if (data?.signedUrl) {
          nuevasUrls[item.evidencia_url] = data.signedUrl;
        }
      }
      if (Object.keys(nuevasUrls).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...nuevasUrls }));
      }
    }
    resolverUrlsFirmadas();
  }, [registros, signedUrls]);

  // Construir calendario de los últimos 7 días operativos con estado de reporte
  const diasCalendario = useMemo(() => {
    const days: Array<{
      fecha: string;
      etiquetaDia: string;
      numeroDia: string;
      estadoDia: 'COMPLETADO' | 'PENDIENTE' | 'OMITIDO';
      casos: Inspeccion[];
    }> = [];

    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let i = -6; i <= 0; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const fechaStr = `${yyyy}-${mm}-${dd}`;

      const casosDia = inspeccionesList.filter(
        (insp) => insp.fecha_operativa === fechaStr
      );
      const tieneCompletado = casosDia.some((c) => c.estado === 'COMPLETADA');
      const tieneEnProgreso = casosDia.some((c) => c.estado === 'EN_PROGRESO');

      let estadoDia: 'COMPLETADO' | 'PENDIENTE' | 'OMITIDO' = 'OMITIDO';
      if (tieneCompletado) {
        estadoDia = 'COMPLETADO';
      } else if (tieneEnProgreso || i === 0) {
        estadoDia = 'PENDIENTE';
      }

      days.push({
        fecha: fechaStr,
        etiquetaDia: i === 0 ? 'Hoy' : i === -1 ? 'Ayer' : nombresDias[d.getDay()],
        numeroDia: `${dd}/${mm}`,
        estadoDia,
        casos: casosDia,
      });
    }
    return days;
  }, [inspeccionesList]);

  // Filtrado reactivo sobre vw_busqueda_auditorias
  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (busquedaCaso.trim()) {
        const term = busquedaCaso.trim().toLowerCase();
        const coincideCaso = r.codigo_caso.toLowerCase().includes(term);
        const coincideItem = r.item_descripcion.toLowerCase().includes(term);
        const coincideAnalista = r.analista_nombre.toLowerCase().includes(term);
        const coincideObs = (r.observacion_item || '').toLowerCase().includes(term);
        if (!coincideCaso && !coincideItem && !coincideAnalista && !coincideObs) {
          return false;
        }
      }
      if (fechaSeleccionada && r.fecha_operativa !== fechaSeleccionada) {
        return false;
      }
      if (deptoFiltro !== 'TODOS' && r.departamento_id !== deptoFiltro) {
        return false;
      }
      if (filtroSoloFallas && r.estado_item !== 'FALLA') {
        return false;
      }
      if (filtroConEvidencia && !r.tiene_evidencia) {
        return false;
      }
      if (filtroNoMarcados && r.estado_item !== 'NO_MARCADO') {
        return false;
      }
      return true;
    });
  }, [
    registros,
    busquedaCaso,
    fechaSeleccionada,
    deptoFiltro,
    filtroSoloFallas,
    filtroConEvidencia,
    filtroNoMarcados,
  ]);

  const conteosRapidos = useMemo(() => {
    const base = registros.filter((r) => {
      if (fechaSeleccionada && r.fecha_operativa !== fechaSeleccionada) return false;
      if (
        busquedaCaso.trim() &&
        !r.codigo_caso.toLowerCase().includes(busquedaCaso.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
    return {
      fallas: base.filter((r) => r.estado_item === 'FALLA').length,
      evidencias: base.filter((r) => r.tiene_evidencia).length,
      noMarcados: base.filter((r) => r.estado_item === 'NO_MARCADO').length,
    };
  }, [registros, fechaSeleccionada, busquedaCaso]);

  function limpiarFiltros() {
    setBusquedaCaso('');
    setFechaSeleccionada('');
    setDeptoFiltro('TODOS');
    setFiltroSoloFallas(false);
    setFiltroConEvidencia(false);
    setFiltroNoMarcados(false);
  }

  return (
    <div className="space-y-5">
      {/* 1. Tarjeta de Calendario Operativo (Días Completados vs. Pendientes/Omitidos) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon size={18} className="text-amber-600" />
              Calendario Operativo y Control de Cierres
            </h2>
            <p className="text-xs text-slate-500">
              Selecciona una fecha operativa para filtrar auditorías o detectar
              días con reporte pendiente
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Completado
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Pendiente / En Curso
            </span>
            <span className="inline-flex items-center gap-1.5 text-red-700">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Reporte Omitido
            </span>
          </div>
        </div>

        {/* Tira de días interactiva + selector de fecha nativo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {diasCalendario.map((d) => {
            const activo = fechaSeleccionada === d.fecha;
            const badgeStyle =
              d.estadoDia === 'COMPLETADO'
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                : d.estadoDia === 'PENDIENTE'
                ? 'border-amber-300 bg-amber-50/80 text-amber-950'
                : 'border-red-200 bg-red-50/60 text-red-900';

            return (
              <button
                key={d.fecha}
                onClick={() => setFechaSeleccionada(activo ? '' : d.fecha)}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  activo
                    ? 'ring-2 ring-slate-900 border-slate-900 bg-slate-900 text-white'
                    : badgeStyle
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold uppercase">
                    {d.etiquetaDia}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      d.estadoDia === 'COMPLETADO'
                        ? 'bg-emerald-500'
                        : d.estadoDia === 'PENDIENTE'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                </div>
                <p className="font-mono font-bold text-sm mt-1">{d.numeroDia}</p>
                <p
                  className={`text-[10px] font-semibold mt-0.5 truncate ${
                    activo ? 'text-slate-300' : 'opacity-80'
                  }`}
                >
                  {d.casos.length > 0
                    ? d.casos.map((c) => c.codigo_caso).join(', ')
                    : 'Sin caso'}
                </p>
              </button>
            );
          })}

          {/* Selector de fecha exacta por input date */}
          <div className="p-2 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <label
              htmlFor="input-fecha-operativa"
              className="text-[10px] font-bold uppercase text-slate-500"
            >
              Otra Fecha
            </label>
            <input
              id="input-fecha-operativa"
              type="date"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
              className="text-xs font-mono bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Tarjetas rápidas de Casos Registrados */}
        {inspeccionesList.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Inspecciones Registradas (Acceso Rápido por Caso)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {inspeccionesList.map((insp) => (
                <div
                  key={insp.id}
                  className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/70 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setBusquedaCaso(
                          busquedaCaso === insp.codigo_caso ? '' : insp.codigo_caso
                        )
                      }
                      className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-900 text-white hover:bg-slate-700 transition cursor-pointer"
                    >
                      {insp.codigo_caso}
                    </button>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        insp.estado === 'COMPLETADA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {insp.estado}
                    </span>
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800 truncate">
                      {insp.analista_nombre}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {insp.fecha_operativa} • {insp.turno.split(' ')[0]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => onVerReporteCaso(insp.id, insp.codigo_caso)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 py-1.5 px-2 rounded-lg transition cursor-pointer"
                    >
                      <FileText size={12} /> Reporte PDF
                    </button>
                    <button
                      onClick={() => onSeleccionarInspeccionActiva(insp.id)}
                      className="inline-flex items-center justify-center gap-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 py-1.5 px-2.5 rounded-lg transition cursor-pointer"
                      title="Abrir en Checklist"
                    >
                      <PlayCircle size={12} /> Checklist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. Barra de Búsqueda por Caso (CAS-XXXX) y Filtros Rápidos (vw_busqueda_auditorias) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Buscador por código de caso CAS-XXXX */}
          <div className="md:col-span-6 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="input-busqueda-caso"
              type="text"
              value={busquedaCaso}
              onChange={(e) => setBusquedaCaso(e.target.value)}
              placeholder="Buscar por Número de Caso (ej. CAS-0001), equipo, Cashea, balanza..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition"
            />
            {busquedaCaso && (
              <button
                onClick={() => setBusquedaCaso('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Selector de los 16 Departamentos Independientes */}
          <div className="md:col-span-4 relative">
            <Filter
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              id="select-filtro-departamento"
              value={deptoFiltro}
              onChange={(e) =>
                setDeptoFiltro(
                  e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value)
                )
              }
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition"
            >
              <option value="TODOS">Todos los 16 Departamentos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.orden}. {d.nombre} ({d.tipo_area})
                </option>
              ))}
            </select>
          </div>

          {/* Botón limpiar filtros */}
          <div className="md:col-span-2">
            <button
              id="btn-limpiar-filtros"
              onClick={limpiarFiltros}
              className="w-full h-full py-2.5 px-3 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        {/* 3 Botones de Filtros Rápidos requeridos en la especificación */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            id="btn-filtro-solo-fallas"
            onClick={() => setFiltroSoloFallas((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filtroSoloFallas
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50/70 text-red-800 border-red-200 hover:bg-red-100/70'
            }`}
          >
            <AlertTriangle size={14} />
            Solo Fallas
            <span
              className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                filtroSoloFallas
                  ? 'bg-red-800 text-white'
                  : 'bg-red-200/70 text-red-900'
              }`}
            >
              {conteosRapidos.fallas}
            </span>
          </button>

          <button
            id="btn-filtro-con-evidencia"
            onClick={() => setFiltroConEvidencia((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filtroConEvidencia
                ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                : 'bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100/70'
            }`}
          >
            <Camera size={14} />
            Con Evidencia Fotográfica
            <span
              className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                filtroConEvidencia
                  ? 'bg-blue-950 text-white'
                  : 'bg-blue-200/70 text-blue-950'
              }`}
            >
              {conteosRapidos.evidencias}
            </span>
          </button>

          <button
            id="btn-filtro-no-marcados"
            onClick={() => setFiltroNoMarcados((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filtroNoMarcados
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100/70'
            }`}
          >
            <HelpCircle size={14} />
            Ítems No Marcados (NO_MARCADO)
            <span
              className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                filtroNoMarcados
                  ? 'bg-amber-800 text-white'
                  : 'bg-amber-200/70 text-amber-950'
              }`}
            >
              {conteosRapidos.noMarcados}
            </span>
          </button>
        </div>
      </section>

      {/* 3. Listado de Resultados de vw_busqueda_auditorias */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-slate-600">
            Mostrando{' '}
            <span className="font-mono font-bold text-slate-900">
              {registrosFiltrados.length}
            </span>{' '}
            registros de <code className="font-mono">vw_busqueda_auditorias</code>
          </p>
          {fechaSeleccionada && (
            <span className="text-xs font-mono bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg font-bold">
              Fecha filtrada: {fechaSeleccionada}
            </span>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            Consultando vista vw_busqueda_auditorias...
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
            <p className="text-sm font-bold text-slate-800">
              No se encontraron registros con los filtros actuales
            </p>
            <p className="text-xs text-slate-500">
              Prueba desactivando algún filtro rápido o seleccionando otra fecha en
              el calendario.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {registrosFiltrados.slice(0, 60).map((row) => {
              const signedUrl =
                row.evidencia_url ? signedUrls[row.evidencia_url] : undefined;

              return (
                <div
                  key={`${row.inspeccion_id}-${row.item_id}`}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                          {row.codigo_caso}
                        </span>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded">
                          {row.departamento_nombre}
                        </span>
                        {row.es_critico && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                            <ShieldAlert size={11} /> CRÍTICO
                          </span>
                        )}
                      </div>

                      {/* Estado del ítem: OK | FALLA | NA | NO_MARCADO */}
                      <span
                        className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                          row.estado_item === 'OK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.estado_item === 'FALLA'
                            ? 'bg-red-100 text-red-800'
                            : row.estado_item === 'NA'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {row.estado_item}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-slate-900">
                      {row.item_descripcion}
                    </p>

                    {row.observacion_item && (
                      <div className="p-2.5 rounded-xl bg-red-50/70 border border-red-100 text-xs text-red-950">
                        <span className="font-bold">Novedad reportada: </span>
                        {row.observacion_item}
                      </div>
                    )}

                    {/* Vista previa de Evidencia con createSignedUrl */}
                    {row.tiene_evidencia && row.evidencia_url && (
                      <div className="pt-1">
                        {signedUrl ? (
                          <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                            <img
                              src={signedUrl}
                              alt={`Evidencia ${row.codigo_caso} - ${row.item_descripcion}`}
                              className="w-full h-36 object-cover"
                            />
                            <div className="p-2 bg-slate-900/95 text-white flex items-center justify-between text-[11px]">
                              <span className="font-mono truncate max-w-[200px] text-slate-300">
                                {row.evidencia_url}
                              </span>
                              <button
                                onClick={() =>
                                  setModalEvidencia({ url: signedUrl, row })
                                }
                                className="inline-flex items-center gap-1 font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                              >
                                <ExternalLink size={12} /> Ampliar Evidencia
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-100 text-[11px] font-mono text-slate-500">
                            Generando URL firmada temporal (createSignedUrl 3600s)...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock size={12} /> {row.fecha_operativa} •{' '}
                      {row.analista_nombre}
                    </span>
                    <button
                      onClick={() =>
                        onVerReporteCaso(row.inspeccion_id, row.codigo_caso)
                      }
                      className="font-bold text-slate-800 hover:text-blue-900 underline cursor-pointer"
                    >
                      Ver Reporte Caso
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de visualización de Evidencia Fotográfica con Signed URL */}
      {modalEvidencia && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-amber-400">
                  {modalEvidencia.row.codigo_caso} •{' '}
                  {modalEvidencia.row.departamento_nombre}
                </p>
                <h3 className="text-sm font-bold">
                  {modalEvidencia.row.item_descripcion}
                </h3>
              </div>
              <button
                onClick={() => setModalEvidencia(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="bg-slate-950 p-2">
              <img
                src={modalEvidencia.url}
                alt="Evidencia de auditoría"
                className="w-full max-h-[65vh] object-contain mx-auto rounded-lg"
              />
            </div>
            <div className="p-4 space-y-2 text-xs">
              {modalEvidencia.row.observacion_item && (
                <p className="text-slate-800">
                  <strong>Observación registrada:</strong>{' '}
                  {modalEvidencia.row.observacion_item}
                </p>
              )}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                <span>
                  Bucket: evidencias-auditoria/{modalEvidencia.row.evidencia_url}
                </span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Signed URL Activa (3600s)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
