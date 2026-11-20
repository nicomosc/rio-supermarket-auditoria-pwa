'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  supabase,
  BusquedaAuditoriaRow,
  Departamento,
  Inspeccion,
  getCalendarioConfig,
  saveCalendarioConfig,
  CalendarioOperativoConfig,
  getTodayStr,
  getSucursales,
  getInspeccionExtraMeta,
  esInspeccionEditablePorFechaYRol,
  getRolActivoActual,
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
  Power,
  Store,
  Lock,
  Eye,
  Edit3,
} from 'lucide-react';

interface ModuloBusquedaCalendarioProps {
  departamentos: Departamento[];
  onVerReporteCaso: (inspeccionId: string, codigoCaso: string) => void;
  onSeleccionarInspeccionActiva: (inspeccionId: string) => void;
  onConfigChange?: () => void;
}

function normalizarFilaBusqueda(
  raw: any,
  deptos: Departamento[]
): BusquedaAuditoriaRow {
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
    item_descripcion:
      raw.item_descripcion || raw.descripcion || raw.item || '',
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
  onConfigChange,
}: ModuloBusquedaCalendarioProps) {
  const [registros, setRegistros] = useState<BusquedaAuditoriaRow[]>([]);
  const [inspeccionesList, setInspeccionesList] = useState<Inspeccion[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado del Interruptor ON/OFF y Fecha de Inicialización del Calendario
  const [calConfig, setCalConfig] = useState<CalendarioOperativoConfig>(() =>
    getCalendarioConfig()
  );

  // Filtros
  const [busquedaCaso, setBusquedaCaso] = useState('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [deptoFiltro, setDeptoFiltro] = useState<number | 'TODOS'>('TODOS');
  const [sucursalFiltro, setSucursalFiltro] = useState<string>('TODAS');
  const [sucursalesList] = useState<string[]>(() => getSucursales());
  const [filtroSoloFallas, setFiltroSoloFallas] = useState(false);
  const [filtroConEvidencia, setFiltroConEvidencia] = useState(false);
  const [filtroNoMarcados, setFiltroNoMarcados] = useState(false);

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
          (vistaData as any[]).map((r) =>
            normalizarFilaBusqueda(r, departamentos)
          )
        );
      }
      if (inspData) {
        setInspeccionesList(inspData as Inspeccion[]);
      }
      setLoading(false);
    }
    cargarVistaBusqueda();
  }, [departamentos]);

  useEffect(() => {
    async function resolverUrlsFirmadas() {
      const conEvidencia = registros.filter(
        (r) =>
          r.tiene_evidencia && r.evidencia_url && !signedUrls[r.evidencia_url]
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

  // Cambiar el switch ON/OFF en la esquina del calendario
  function handleToggleOperativo() {
    const nuevoEstado = !calConfig.operativoOn;
    const hoy = getTodayStr(0);
    const updated: CalendarioOperativoConfig = {
      operativoOn: nuevoEstado,
      // Al encender ON, cuenta a partir del día de inicialización (por defecto hoy)
      fechaInicializacion: nuevoEstado
        ? calConfig.fechaInicializacion || hoy
        : calConfig.fechaInicializacion,
    };
    setCalConfig(saveCalendarioConfig(updated));
    if (onConfigChange) onConfigChange();
  }

  function handleCambiarFechaInicializacion(nuevaFecha: string) {
    const updated: CalendarioOperativoConfig = {
      ...calConfig,
      fechaInicializacion: nuevaFecha,
    };
    setCalConfig(saveCalendarioConfig(updated));
    if (onConfigChange) onConfigChange();
  }

  // Construir calendario de los últimos 7 días operativos
  // Los días pasados no registrados o anteriores a la inicialización quedan en GRIS (NO_OPERATIVO)
  const diasCalendario = useMemo(() => {
    const days: Array<{
      fecha: string;
      etiquetaDia: string;
      numeroDia: string;
      estadoDia: 'COMPLETADO' | 'PENDIENTE' | 'NO_OPERATIVO_GRIS' | 'OMITIDO';
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

      // Regla pedida por el usuario:
      // Si el proyecto aún está en OFF (no operativo) o la fecha es anterior a fechaInicializacion
      // y no tiene reporte cerrado, el día queda en GRIS porque no se toma en cuenta.
      const antesDeInicializar =
        !calConfig.operativoOn || fechaStr < calConfig.fechaInicializacion;

      let estadoDia:
        | 'COMPLETADO'
        | 'PENDIENTE'
        | 'NO_OPERATIVO_GRIS'
        | 'OMITIDO' = 'NO_OPERATIVO_GRIS';

      if (tieneCompletado) {
        estadoDia = 'COMPLETADO';
      } else if (tieneEnProgreso) {
        estadoDia = 'PENDIENTE';
      } else if (antesDeInicializar) {
        estadoDia = 'NO_OPERATIVO_GRIS';
      } else if (i === 0) {
        estadoDia = 'PENDIENTE';
      } else {
        estadoDia = 'OMITIDO';
      }

      days.push({
        fecha: fechaStr,
        etiquetaDia:
          i === 0 ? 'Hoy' : i === -1 ? 'Ayer' : nombresDias[d.getDay()],
        numeroDia: `${dd}/${mm}`,
        estadoDia,
        casos: casosDia,
      });
    }
    return days;
  }, [inspeccionesList, calConfig]);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (sucursalFiltro !== 'TODAS') {
        const sedeCaso = getInspeccionExtraMeta(r.inspeccion_id).sucursal;
        if (sedeCaso !== sucursalFiltro) return false;
      }
      if (busquedaCaso.trim()) {
        const term = busquedaCaso.trim().toLowerCase();
        const coincideCaso = r.codigo_caso.toLowerCase().includes(term);
        const coincideItem = r.item_descripcion.toLowerCase().includes(term);
        const coincideAnalista = r.analista_nombre.toLowerCase().includes(term);
        const coincideObs = (r.observacion_item || '')
          .toLowerCase()
          .includes(term);
        if (
          !coincideCaso &&
          !coincideItem &&
          !coincideAnalista &&
          !coincideObs
        ) {
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
    sucursalFiltro,
    busquedaCaso,
    fechaSeleccionada,
    deptoFiltro,
    filtroSoloFallas,
    filtroConEvidencia,
    filtroNoMarcados,
  ]);

  const conteosRapidos = useMemo(() => {
    const base = registros.filter((r) => {
      if (fechaSeleccionada && r.fecha_operativa !== fechaSeleccionada)
        return false;
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
    setSucursalFiltro('TODAS');
    setFiltroSoloFallas(false);
    setFiltroConEvidencia(false);
    setFiltroNoMarcados(false);
  }

  return (
    <div className="space-y-5">
      {/* 1. Tarjeta de Calendario Operativo con Interruptor ON/OFF en la esquina */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/20 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarIcon size={18} className="text-[#087334]" />
              Calendario Operativo y Control de Inicialización
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Los días pasados o previos a la activación del proyecto quedan en{' '}
              <strong>gris</strong> porque no se contabilizan como omitidos
            </p>
          </div>

          {/* INTERRUPTOR ON/OFF EN LA ESQUINA DEL CALENDARIO */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <button
                id="btn-toggle-operativo-on-off"
                type="button"
                onClick={handleToggleOperativo}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-xs ${
                  calConfig.operativoOn
                    ? 'bg-[#087334] text-white border-2 border-[#B2D034]'
                    : 'bg-slate-200 text-slate-700 border-2 border-slate-300 hover:bg-slate-300'
                }`}
              >
                <Power
                  size={14}
                  className={
                    calConfig.operativoOn ? 'text-[#B2D034]' : 'text-slate-500'
                  }
                />
                <span>
                  Proyecto Operativo: {calConfig.operativoOn ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-600">
                Contar desde:
              </span>
              <input
                type="date"
                value={calConfig.fechaInicializacion}
                onChange={(e) =>
                  handleCambiarFechaInicializacion(e.target.value)
                }
                className="text-xs font-mono bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-[#087334]"
              />
            </div>
          </div>
        </div>

        {/* Leyenda de Estados del Calendario */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[#087334]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#087334]" />
              Completado
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              En Curso
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              No Operativo / Sin Registro (Gris)
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#DB0617]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DB0617]" />
              Omitido (Post-Activación)
            </span>
          </div>
          <span className="text-slate-500 font-mono">
            {calConfig.operativoOn
              ? `Contabilizando desde ${calConfig.fechaInicializacion}`
              : 'Modo Pre-Operativo (OFF): Días sin registro en gris'}
          </span>
        </div>

        {/* Tira de días interactiva + selector de fecha nativo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {diasCalendario.map((d) => {
            const activo = fechaSeleccionada === d.fecha;
            const badgeStyle =
              d.estadoDia === 'COMPLETADO'
                ? 'border-[#087334]/40 bg-[#087334]/10 text-[#042f16]'
                : d.estadoDia === 'PENDIENTE'
                ? 'border-[#B2D034] bg-[#B2D034]/25 text-[#042f16]'
                : d.estadoDia === 'NO_OPERATIVO_GRIS'
                ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-80'
                : 'border-[#DB0617]/40 bg-[#DB0617]/10 text-[#DB0617]';

            return (
              <button
                key={d.fecha}
                type="button"
                onClick={() => setFechaSeleccionada(activo ? '' : d.fecha)}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  activo
                    ? 'ring-2 ring-[#087334] border-[#087334] bg-[#087334] text-white'
                    : badgeStyle
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold uppercase">
                    {d.etiquetaDia}
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      d.estadoDia === 'COMPLETADO'
                        ? 'bg-[#087334]'
                        : d.estadoDia === 'PENDIENTE'
                        ? 'bg-amber-500'
                        : d.estadoDia === 'NO_OPERATIVO_GRIS'
                        ? 'bg-slate-400'
                        : 'bg-[#DB0617]'
                    }`}
                  />
                </div>
                <p className="font-mono font-bold text-sm mt-1">
                  {d.numeroDia}
                </p>
                <p
                  className={`text-[10px] font-semibold mt-0.5 truncate ${
                    activo ? 'text-[#B2D034]' : ''
                  }`}
                >
                  {d.casos.length > 0
                    ? d.casos.map((c) => c.codigo_caso).join(', ')
                    : d.estadoDia === 'NO_OPERATIVO_GRIS'
                    ? 'No operativo'
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
              className="text-xs font-mono bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-[#087334]"
            />
          </div>
        </div>

        {/* Tarjetas rápidas de Casos Registrados */}
        {inspeccionesList.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Inspecciones Registradas (Acceso Rápido por Caso y Sucursal)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {inspeccionesList.map((insp) => {
                const metaCaso = getInspeccionExtraMeta(insp.id, insp);
                const rolActual = getRolActivoActual(null);
                const permiso = esInspeccionEditablePorFechaYRol(
                  insp,
                  rolActual
                );
                return (
                  <div
                    key={insp.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                      permiso.esMismoDia
                        ? 'border-[#087334]/35 bg-[#087334]/5'
                        : 'border-slate-200/90 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setBusquedaCaso(
                            busquedaCaso === insp.codigo_caso
                              ? ''
                              : insp.codigo_caso
                          )
                        }
                        className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#087334] text-white hover:bg-[#054d22] transition cursor-pointer"
                      >
                        {insp.codigo_caso}
                      </button>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          permiso.esMismoDia
                            ? 'bg-emerald-100 text-[#087334]'
                            : permiso.desbloqueadaPorJefe
                            ? 'bg-[#B2D034]/40 text-[#042f16]'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {permiso.esMismoDia ? (
                          '🟢 En el Día'
                        ) : permiso.desbloqueadaPorJefe ? (
                          '🔓 Jefe Encargado'
                        ) : (
                          <>
                            <Lock size={10} /> Día Cerrado
                          </>
                        )}
                      </span>
                    </div>
                    <div className="text-xs space-y-0.5">
                      <p className="text-[10px] font-bold text-[#087334] truncate">
                        📍 {metaCaso.sucursal}
                      </p>
                      <p className="font-semibold text-slate-800 truncate">
                        {insp.analista_nombre}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {insp.fecha_operativa} • {insp.turno.split(' ')[0]}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onVerReporteCaso(insp.id, insp.codigo_caso)
                        }
                        className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 py-1.5 px-2 rounded-lg transition cursor-pointer"
                      >
                        <FileText size={12} /> Impresión
                      </button>
                      <button
                        type="button"
                        onClick={() => onSeleccionarInspeccionActiva(insp.id)}
                        className={`inline-flex items-center justify-center gap-1 text-[11px] font-extrabold py-1.5 px-2.5 rounded-lg transition cursor-pointer ${
                          permiso.editable
                            ? 'bg-[#B2D034] hover:bg-[#9fbb29] text-[#042f16]'
                            : 'bg-slate-700 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {permiso.editable ? (
                          <>
                            <Edit3 size={12} /> Modificar
                          </>
                        ) : (
                          <>
                            <Eye size={12} /> Solo Ver
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 2. Barra de Búsqueda por Caso (CAS-XXXX), Sucursal y Filtros Rápidos */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/20 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="input-busqueda-caso"
              type="text"
              value={busquedaCaso}
              onChange={(e) => setBusquedaCaso(e.target.value)}
              placeholder="Buscar Caso (CAS-0001), Cashea, balanza..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#087334] focus:bg-white transition"
            />
            {busquedaCaso && (
              <button
                type="button"
                onClick={() => setBusquedaCaso('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="md:col-span-3 relative">
            <Store
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              id="select-filtro-sucursal"
              value={sucursalFiltro}
              onChange={(e) => setSucursalFiltro(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#087334] focus:bg-white transition"
            >
              <option value="TODAS">Todas las Sucursales</option>
              {sucursalesList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 relative">
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
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#087334] focus:bg-white transition"
            >
              <option value="TODOS">
                Todos los Deptos ({departamentos.length})
              </option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.orden}. {d.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              id="btn-limpiar-filtros"
              type="button"
              onClick={limpiarFiltros}
              className="w-full h-full py-2.5 px-3 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            id="btn-filtro-solo-fallas"
            type="button"
            onClick={() => setFiltroSoloFallas((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filtroSoloFallas
                ? 'bg-[#DB0617] text-white border-[#DB0617] shadow-sm'
                : 'bg-[#DB0617]/10 text-[#DB0617] border-[#DB0617]/25 hover:bg-[#DB0617]/20'
            }`}
          >
            <AlertTriangle size={14} />
            Solo Fallas
            <span className="font-mono px-1.5 py-0.5 rounded text-[11px] bg-black/15">
              {conteosRapidos.fallas}
            </span>
          </button>

          <button
            id="btn-filtro-con-evidencia"
            type="button"
            onClick={() => setFiltroConEvidencia((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filtroConEvidencia
                ? 'bg-[#087334] text-white border-[#087334] shadow-sm'
                : 'bg-[#087334]/10 text-[#087334] border-[#087334]/25 hover:bg-[#087334]/20'
            }`}
          >
            <Camera size={14} />
            Con Evidencia Fotográfica
            <span className="font-mono px-1.5 py-0.5 rounded text-[11px] bg-black/15">
              {conteosRapidos.evidencias}
            </span>
          </button>

          <button
            id="btn-filtro-no-marcados"
            type="button"
            onClick={() => setFiltroNoMarcados((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              filtroNoMarcados
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
            }`}
          >
            <HelpCircle size={14} />
            Ítems No Marcados
            <span className="font-mono px-1.5 py-0.5 rounded text-[11px] bg-black/10">
              {conteosRapidos.noMarcados}
            </span>
          </button>
        </div>
      </section>

      {/* 3. Resultados detallados */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/20 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800">
            Registros de Auditoría ({registrosFiltrados.length} ítems)
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Consultando registros de auditoría...
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              No se encontraron registros con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {registrosFiltrados.map((row) => {
              const signedUrl = row.evidencia_url
                ? signedUrls[row.evidencia_url]
                : null;

              return (
                <div
                  key={`${row.inspeccion_id}-${row.item_id}`}
                  className="p-4 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#087334] text-white">
                        {row.codigo_caso}
                      </span>
                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md">
                        #{row.departamento_orden} {row.departamento_nombre}
                      </span>
                      {row.es_critico && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-[#DB0617]/10 text-[#DB0617] px-2 py-0.5 rounded">
                          <ShieldAlert size={11} /> Crítico
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                        <Clock size={11} />
                        {row.fecha_operativa} • {row.analista_nombre}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-slate-900">
                      {row.item_descripcion}
                    </p>

                    {row.observacion_item && (
                      <p className="text-xs text-[#DB0617] bg-[#DB0617]/5 border border-[#DB0617]/20 rounded-lg px-2.5 py-1.5">
                        <strong>Observación:</strong> {row.observacion_item}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {row.tiene_evidencia && (
                      <button
                        type="button"
                        onClick={() =>
                          signedUrl &&
                          setModalEvidencia({ url: signedUrl, row })
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[#087334]/10 text-[#087334] border border-[#087334]/30 hover:bg-[#087334]/20 transition cursor-pointer"
                      >
                        <Camera size={13} />
                        Ver Evidencia
                        <ExternalLink size={11} />
                      </button>
                    )}

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        row.estado_item === 'OK'
                          ? 'bg-[#087334]/15 text-[#087334]'
                          : row.estado_item === 'FALLA'
                          ? 'bg-[#DB0617] text-white'
                          : row.estado_item === 'NA'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {row.estado_item === 'NO_MARCADO' ? (
                        'NO MARCADO'
                      ) : row.estado_item === 'OK' ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 size={12} /> OK
                        </span>
                      ) : (
                        row.estado_item
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de previsualización de evidencia */}
      {modalEvidencia && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#042f16]/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border-2 border-[#B2D034]">
            <div className="px-4 py-3 bg-[#087334] text-white flex items-center justify-between">
              <div className="text-xs">
                <span className="font-mono font-bold text-[#B2D034]">
                  {modalEvidencia.row.codigo_caso}
                </span>{' '}
                • {modalEvidencia.row.departamento_nombre}
              </div>
              <button
                type="button"
                onClick={() => setModalEvidencia(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <img
                src={modalEvidencia.url}
                alt={modalEvidencia.row.item_descripcion}
                className="w-full rounded-xl border border-slate-200 max-h-80 object-contain bg-slate-950"
              />
              <p className="text-xs font-bold text-slate-900">
                {modalEvidencia.row.item_descripcion}
              </p>
              {modalEvidencia.row.observacion_item && (
                <p className="text-xs text-[#DB0617] bg-[#DB0617]/10 p-2.5 rounded-lg border border-[#DB0617]/20">
                  {modalEvidencia.row.observacion_item}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
