'use client';

import { useState, useMemo } from 'react';
import {
  supabase,
  Inspeccion,
  RolUsuarioSistema,
  getSucursalesObj,
  getAnalistasPorSucursal,
  getJefesPorSucursal,
  getInspeccionExtraMeta,
  saveInspeccionExtraMeta,
  esInspeccionEditablePorFechaYRol,
  getTodayStr,
  getPinJefe,
  TURNOS_OFICIALES_RIO,
} from '@/lib/supabase';
import {
  History,
  Lock,
  Unlock,
  Eye,
  Pencil,
  FileText,
  Store,
  UserCheck,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  PlusCircle,
  Search,
  X,
  FlaskConical,
} from 'lucide-react';

interface VistaEvaluacionesAnterioresProps {
  inspecciones: Inspeccion[];
  inspeccionActivaId: string;
  rolUsuario: RolUsuarioSistema;
  onCambiarRol: (nuevoRol: RolUsuarioSistema) => Promise<void>;
  onAbrirInspeccion: (inspeccionId: string) => void;
  onVerReportePdf: (inspeccionId: string, codigoCaso: string) => void;
  onDatosActualizados: () => void;
}

export default function VistaEvaluacionesAnteriores({
  inspecciones,
  inspeccionActivaId,
  rolUsuario,
  onCambiarRol,
  onAbrirInspeccion,
  onVerReportePdf,
  onDatosActualizados,
}: VistaEvaluacionesAnterioresProps) {
  const sucursalesObj = useMemo(() => getSucursalesObj(), []);
  const hoy = getTodayStr(0);

  const [filtroSucursalId, setFiltroSucursalId] = useState<number | 'TODAS'>(
    'TODAS'
  );
  const [filtroCondicionDia, setFiltroCondicionDia] = useState<
    'TODAS' | 'MISMO_DIA' | 'OTRO_DIA'
  >('TODAS');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  // Modal de PIN de Jefe Encargado para desbloquear evaluación de otro día
  const [modalPinJefeInspId, setModalPinJefeInspId] = useState<string | null>(
    null
  );
  const [pinInput, setPinInput] = useState('');
  const [errorPin, setErrorPin] = useState('');

  // Modal para crear nueva evaluación (hoy o simular día anterior para prueba)
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [sucursalNuevaId, setSucursalNuevaId] = useState<number>(
    sucursalesObj[0]?.id || 1
  );
  const analistasNuevaSede = useMemo(
    () => getAnalistasPorSucursal(sucursalNuevaId),
    [sucursalNuevaId]
  );
  const jefesNuevaSede = useMemo(
    () => getJefesPorSucursal(sucursalNuevaId),
    [sucursalNuevaId]
  );
  const [analistaNuevoId, setAnalistaNuevoId] = useState<number>(
    () => getAnalistasPorSucursal(sucursalesObj[0]?.id || 1)[0]?.id || 101
  );
  const [jefeNuevoId, setJefeNuevoId] = useState<number>(
    () => getJefesPorSucursal(sucursalesObj[0]?.id || 1)[0]?.id || 10001
  );
  const [turnoNuevo, setTurnoNuevo] = useState<string>(TURNOS_OFICIALES_RIO[0]);
  const [fechaNueva, setFechaNueva] = useState<string>(hoy);
  const [creando, setCreando] = useState(false);

  function handleCambiarSucursalModal(nuevoId: number) {
    setSucursalNuevaId(nuevoId);
    const aSede = getAnalistasPorSucursal(nuevoId);
    const jSede = getJefesPorSucursal(nuevoId);
    const primerAnalista = aSede.find((a) => a.disponible) || aSede[0];
    const primerJefe = jSede.find((j) => j.disponible) || jSede[0];
    if (primerAnalista) {
      setAnalistaNuevoId(primerAnalista.id);
      setTurnoNuevo(primerAnalista.turno_habitual);
    }
    if (primerJefe) {
      setJefeNuevoId(primerJefe.id);
    }
  }

  async function handleCrearEvaluacion(fechaPersonalizada?: string) {
    setCreando(true);
    const sucObj =
      sucursalesObj.find((s) => s.id === sucursalNuevaId) || sucursalesObj[0];
    const analistaObj =
      analistasNuevaSede.find((a) => a.id === analistaNuevoId) ||
      analistasNuevaSede[0] ||
      null;
    const jefeObj =
      jefesNuevaSede.find((j) => j.id === jefeNuevoId) ||
      jefesNuevaSede[0] ||
      null;

    const fechaOp = fechaPersonalizada || fechaNueva || hoy;
    const esDeOtroDia = fechaOp !== hoy;

    const payloadBase: Record<string, any> = {
      analista_nombre:
        analistaObj?.nombre_completo || 'Analista de Sistemas (Sin asignar)',
      turno: turnoNuevo,
      fecha_operativa: fechaOp,
      estado: esDeOtroDia ? 'COMPLETADA' : 'EN_PROGRESO',
      fecha_fin: esDeOtroDia ? new Date().toISOString() : null,
    };
    const payloadCompleto: Record<string, any> = {
      ...payloadBase,
      sucursal_id: sucObj.id,
      sucursal_nombre: sucObj.nombre,
      analista_id: analistaObj?.id || null,
      jefe_encargado_id: jefeObj?.id || null,
      jefe_encargado_nombre:
        jefeObj?.nombre_completo || 'Jefe Encargado de Sucursal',
    };

    let { data, error } = await supabase
      .from('inspecciones')
      .insert(payloadCompleto)
      .select('*')
      .single();

    if (error) {
      const retry = await supabase
        .from('inspecciones')
        .insert(payloadBase)
        .select('*')
        .single();
      data = retry.data;
    }

    if (data) {
      const creada = data as Inspeccion;
      saveInspeccionExtraMeta(creada.id, {
        sucursalId: sucObj.id,
        sucursal: sucObj.nombre,
        analistaId: analistaObj?.id || null,
        jefeEncargadoId: jefeObj?.id || null,
        recibidoPor: jefeObj?.nombre_completo || 'Jefe Encargado de Sucursal',
      });
      onDatosActualizados();
      setModalCrearAbierto(false);
      onAbrirInspeccion(creada.id);
    }
    setCreando(false);
  }

  // Crear evaluación de demostración del día de ayer en 1 clic para verificar el cierre automático 12:00 AM VET
  async function handleSimularEvaluacionDiaAnterior() {
    const ayer = getTodayStr(-1);
    const sucObj = sucursalesObj[0];
    const analistaObj = getAnalistasPorSucursal(sucObj.id)[0] || null;
    const jefeObj = getJefesPorSucursal(sucObj.id)[0] || null;

    const payloadBase: Record<string, any> = {
      analista_nombre:
        analistaObj?.nombre_completo || 'Analista de Sistemas',
      turno: 'Cierre (15:00 PM a 23:59 PM)',
      fecha_operativa: ayer,
      estado: 'COMPLETADA',
      fecha_fin: new Date().toISOString(),
      observaciones_manuales:
        'Evaluación del día anterior cerrada automáticamente a las 12:00 AM (America/Caracas).',
    };
    const payloadCompleto: Record<string, any> = {
      ...payloadBase,
      sucursal_id: sucObj.id,
      sucursal_nombre: sucObj.nombre,
      analista_id: analistaObj?.id || null,
      jefe_encargado_id: jefeObj?.id || null,
      jefe_encargado_nombre:
        jefeObj?.nombre_completo || 'Jefe Encargado de Sucursal',
    };

    let { data, error } = await supabase
      .from('inspecciones')
      .insert(payloadCompleto)
      .select('*')
      .single();

    if (error) {
      const retry = await supabase
        .from('inspecciones')
        .insert(payloadBase)
        .select('*')
        .single();
      data = retry.data;
    }

    if (data) {
      const creada = data as Inspeccion;
      saveInspeccionExtraMeta(creada.id, {
        sucursalId: sucObj.id,
        sucursal: sucObj.nombre,
        analistaId: analistaObj?.id || null,
        jefeEncargadoId: jefeObj?.id || null,
        recibidoPor: jefeObj?.nombre_completo || 'Jefe Encargado de Sucursal',
      });
      onDatosActualizados();
    }
  }

  const evaluacionesEnriquecidas = useMemo(() => {
    return inspecciones.map((insp) => {
      const meta = getInspeccionExtraMeta(insp.id, insp as any);
      const permiso = esInspeccionEditablePorFechaYRol(insp, rolUsuario);
      return {
        insp,
        meta,
        permiso,
      };
    });
  }, [inspecciones, rolUsuario]);

  const evaluacionesFiltradas = useMemo(() => {
    return evaluacionesEnriquecidas.filter(({ insp, meta, permiso }) => {
      if (
        filtroSucursalId !== 'TODAS' &&
        meta.sucursalId !== filtroSucursalId
      ) {
        return false;
      }
      if (filtroCondicionDia === 'MISMO_DIA' && !permiso.esMismoDia) {
        return false;
      }
      if (filtroCondicionDia === 'OTRO_DIA' && permiso.esMismoDia) {
        return false;
      }
      if (busquedaTexto.trim()) {
        const q = busquedaTexto.trim().toLowerCase();
        const matchCaso = insp.codigo_caso.toLowerCase().includes(q);
        const matchAnalista = insp.analista_nombre.toLowerCase().includes(q);
        const matchSede = meta.sucursal.toLowerCase().includes(q);
        const matchJefe = meta.recibidoPor.toLowerCase().includes(q);
        if (!matchCaso && !matchAnalista && !matchSede && !matchJefe) {
          return false;
        }
      }
      return true;
    });
  }, [
    evaluacionesEnriquecidas,
    filtroSucursalId,
    filtroCondicionDia,
    busquedaTexto,
  ]);

  const totalMismoDia = evaluacionesEnriquecidas.filter(
    (e) => e.permiso.esMismoDia
  ).length;
  const totalOtrosDias = evaluacionesEnriquecidas.filter(
    (e) => !e.permiso.esMismoDia
  ).length;

  return (
    <div className="space-y-5">
      {/* 1. CABECERA EXPLICATIVA DE LA REGLA DE EDICIÓN DE EVALUACIONES ANTERIORES */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/25 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <History size={20} className="text-[#087334]" />
                Vista de Evaluaciones Anteriores y Control de Cierre por Día
              </h2>
              <span className="text-[11px] font-mono font-extrabold bg-[#087334]/10 text-[#087334] px-2.5 py-0.5 rounded-lg border border-[#087334]/25">
                Fecha Operativa Hoy: {hoy}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Modifica evaluaciones anteriores <strong>únicamente si aún pertenecen al día de hoy ({hoy})</strong>. Si pasan a otro día, se cierran automáticamente en <strong>Modo Solo Vista</strong>, a menos que seas <strong>Jefe Encargado / Coordinador</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSimularEvaluacionDiaAnterior}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl transition cursor-pointer"
              title="Crea una evaluación con fecha de ayer para probar cómo se bloquea en Solo Vista para el Analista y se desbloquea para el Jefe Encargado"
            >
              <FlaskConical size={14} className="text-[#087334]" />
              + Simular Evaluación de Ayer
            </button>

            <button
              type="button"
              onClick={() => {
                setFechaNueva(hoy);
                setModalCrearAbierto(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#087334] hover:bg-[#054d22] text-white px-3.5 py-2 rounded-xl border border-[#B2D034] transition cursor-pointer shadow-xs"
            >
              <PlusCircle size={14} className="text-[#B2D034]" />
              Nueva Evaluación por Sucursal
            </button>
          </div>
        </div>

        {/* Resumen de las 3 Condiciones de Acceso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-[#087334] shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-[#042f16]">
                1. Aún en el Mismo Día ({hoy})
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Tanto el <strong>Analista</strong> como el{' '}
                <strong>Jefe Encargado</strong> pueden abrir y modificar
                cualquier evaluación realizada hoy ({totalMismoDia} registradas
                hoy).
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-start gap-2.5">
            <Lock size={18} className="text-slate-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-slate-900">
                2. Otro Día (Cierre Automático)
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Al cambiar de día, la evaluación se cierra automáticamente. El{' '}
                <strong>Analista</strong> solo puede entrar en{' '}
                <strong>👁️ Modo Solo Vista</strong> ({totalOtrosDias} de otros
                días).
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5">
            <Unlock size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-amber-950">
                3. Permiso de Jefe Encargado
              </p>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Si eres <strong>Jefe Encargado / Coordinador</strong> (Rol
                activo: <strong>{rolUsuario}</strong>), tienes autorización para
                modificar evaluaciones de días anteriores.
              </p>
            </div>
          </div>
        </div>

        {/* Filtros por las 23 Sucursales Reales de Río Supermarket, Condición de Día y Búsqueda */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          <div className="md:col-span-5 relative">
            <Store
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#087334]"
            />
            <select
              value={filtroSucursalId}
              onChange={(e) =>
                setFiltroSucursalId(
                  e.target.value === 'TODAS' ? 'TODAS' : Number(e.target.value)
                )
              }
              className="w-full pl-9 pr-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#087334]"
            >
              <option value="TODAS">
                📍 Todas las Sucursales Reales de Río ({sucursalesObj.length}{' '}
                Sedes)
              </option>
              {sucursalesObj.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo} • {s.nombre} ({s.ciudad})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              value={filtroCondicionDia}
              onChange={(e) =>
                setFiltroCondicionDia(
                  e.target.value as 'TODAS' | 'MISMO_DIA' | 'OTRO_DIA'
                )
              }
              className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#087334]"
            >
              <option value="TODAS">
                📅 Todas las Evaluaciones ({evaluacionesEnriquecidas.length})
              </option>
              <option value="MISMO_DIA">
                🟢 Solo del Día de Hoy — Modificables ({totalMismoDia})
              </option>
              <option value="OTRO_DIA">
                🔒 De Otros Días — Cerradas Automáticamente ({totalOtrosDias})
              </option>
            </select>
          </div>

          <div className="md:col-span-3 relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              placeholder="Buscar CAS-XXXX, analista..."
              className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#087334]"
            />
            {busquedaTexto && (
              <button
                type="button"
                onClick={() => setBusquedaTexto('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. LISTADO DE EVALUACIONES CON ACCIÓN SEGÚN FECHA Y ROL */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evaluacionesFiltradas.map(({ insp, meta, permiso }) => {
          const esActiva = insp.id === inspeccionActivaId;

          return (
            <div
              key={insp.id}
              className={`rounded-2xl border-2 p-4 sm:p-5 bg-white shadow-sm flex flex-col justify-between gap-4 transition ${
                esActiva
                  ? 'border-[#087334] ring-2 ring-[#B2D034]/60'
                  : permiso.esMismoDia
                  ? 'border-emerald-300/80 hover:border-[#087334]'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                {/* Fila superior: Código de caso + Fecha + Insignia de Permiso (Mismo Día vs Cerrada Otro Día vs Jefe) */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs sm:text-sm bg-[#087334] text-white border border-[#B2D034] px-3 py-1 rounded-xl">
                      {insp.codigo_caso}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Calendar size={12} className="text-[#087334]" />
                      {insp.fecha_operativa}
                      {permiso.esMismoDia ? ' (HOY)' : ' (OTRO DÍA)'}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                      permiso.esMismoDia
                        ? 'bg-emerald-100 text-[#042f16] border-emerald-300'
                        : permiso.desbloqueadaPorJefe
                        ? 'bg-amber-100 text-amber-950 border-amber-400'
                        : 'bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    {permiso.esMismoDia ? (
                      <Pencil size={11} />
                    ) : permiso.desbloqueadaPorJefe ? (
                      <Unlock size={11} />
                    ) : (
                      <Lock size={11} />
                    )}
                    {permiso.etiquetaEstado}
                  </span>
                </div>

                {/* Datos específicos de la Sucursal Real, su Analista y su Jefe Encargado */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-extrabold text-[#087334]">
                    <Store size={14} className="shrink-0" />
                    <span className="truncate">{meta.sucursal}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <UserCheck size={13} className="text-[#087334]" />
                      Analista: <strong>{insp.analista_nombre}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Users size={13} className="text-[#087334]" />
                      Jefe Encargado: <strong>{meta.recibidoPor}</strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock size={12} /> {insp.turno}
                    </span>
                    <span
                      className={`font-extrabold px-2 py-0.5 rounded ${
                        insp.estado === 'COMPLETADA'
                          ? 'bg-[#087334]/15 text-[#087334]'
                          : 'bg-[#B2D034]/40 text-[#042f16]'
                      }`}
                    >
                      Estado: {insp.estado}
                    </span>
                  </div>
                </div>

                {/* Explicación clara de por qué puede modificar o solo ver */}
                <p
                  className={`text-[11px] px-3 py-2 rounded-xl border font-medium ${
                    permiso.esMismoDia
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : permiso.desbloqueadaPorJefe
                      ? 'bg-amber-50 border-amber-200 text-amber-950'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {permiso.descripcionRegla}
                </p>
              </div>

              {/* Botones de Acción según Condición de Día y Rol */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                {permiso.editable ? (
                  <button
                    type="button"
                    onClick={() => onAbrirInspeccion(insp.id)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-xs ${
                      permiso.esMismoDia
                        ? 'bg-[#087334] hover:bg-[#054d22] text-white border border-[#B2D034]'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-700'
                    }`}
                  >
                    <Pencil size={14} />
                    {permiso.esMismoDia
                      ? 'Modificar Evaluación (Aún es Hoy)'
                      : 'Modificar como Jefe Encargado'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onAbrirInspeccion(insp.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white transition cursor-pointer"
                    >
                      <Eye size={14} className="text-[#B2D034]" />
                      Solo Ver Vista (Día Cerrado)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setModalPinJefeInspId(insp.id);
                        setPinInput('');
                        setErrorPin('');
                      }}
                      className="inline-flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 border border-amber-500/40 transition cursor-pointer"
                      title="Desbloquear modificación con PIN de Jefe Encargado"
                    >
                      <KeyRound size={13} className="text-amber-700" />
                      Jefe Encargado
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onVerReportePdf(insp.id, insp.codigo_caso)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition cursor-pointer"
                >
                  <FileText size={14} className="text-[#087334]" />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Modal de Autorización de Jefe Encargado para Modificar Evaluación de Otro Día */}
      {modalPinJefeInspId && (
        <div className="fixed inset-0 z-50 bg-[#042f16]/85 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (pinInput.trim() === getPinJefe()) {
                const targetId = modalPinJefeInspId;
                setModalPinJefeInspId(null);
                setPinInput('');
                setErrorPin('');
                await onCambiarRol('COORDINADOR');
                onAbrirInspeccion(targetId);
              } else {
                setErrorPin(
                  'PIN incorrecto. Solo el Jefe Encargado / Coordinador puede modificar evaluaciones de días anteriores.'
                );
              }
            }}
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border-2 border-[#B2D034]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#087334] text-[#B2D034] flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#087334]">
                    Autorización de Jefe Encargado
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Desbloquear modificación de evaluación de día anterior
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPinJefeInspId(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">
                Ingresa el PIN de Jefe Encargado / Coordinador:
              </label>
              <input
                type="password"
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setErrorPin('');
                }}
                placeholder="PIN (Por defecto: 2026)"
                className="w-full border-2 border-slate-200 focus:border-[#087334] rounded-xl px-3.5 py-2.5 text-sm font-mono font-extrabold tracking-widest text-slate-900 focus:outline-none"
              />
              {errorPin && (
                <p className="text-xs font-bold text-[#DB0617] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorPin}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalPinJefeInspId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#087334] text-white hover:bg-[#054d22] flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock size={14} className="text-[#B2D034]" /> Desbloquear y
                Modificar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal para Crear Nueva Evaluación seleccionando primero la Sucursal Real de Río y su Personal exclusivo */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 z-50 bg-[#042f16]/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border-2 border-[#B2D034]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#087334]">
                  Nueva Evaluación por Sucursal Oficial — Río Supermarket
                </h3>
                <p className="text-[11px] text-slate-500">
                  Los analistas y jefes encargados se filtran automáticamente
                  según la sucursal seleccionada
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCrearAbierto(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-extrabold text-[#087334] flex items-center gap-1.5">
                  <Store size={13} /> 1. Sucursal Oficial de Río Supermarket (23
                  Sedes Reales)
                </label>
                <select
                  value={sucursalNuevaId}
                  onChange={(e) =>
                    handleCambiarSucursalModal(Number(e.target.value))
                  }
                  className="w-full border-2 border-[#087334]/40 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                >
                  {sucursalesObj.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.codigo} • {s.nombre} ({s.ciudad})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-[#087334] flex items-center gap-1.5">
                  <UserCheck size={13} /> 2. Analista de Sistemas de esta
                  Sucursal
                </label>
                <select
                  value={analistaNuevoId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setAnalistaNuevoId(id);
                    const found = analistasNuevaSede.find((a) => a.id === id);
                    if (found) setTurnoNuevo(found.turno_habitual);
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                >
                  {analistasNuevaSede.length === 0 ? (
                    <option value={0}>
                      — Sin analistas registrados en esta sede (usa Gestionar Personal / Importar CSV) —
                    </option>
                  ) : (
                    analistasNuevaSede.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.disponible ? '🟢 ' : '⚪ '}
                        {a.nombre_completo} — {a.cargo}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-[#087334] flex items-center gap-1.5">
                  <Users size={13} /> 3. Jefe Encargado / Coordinador de esta
                  Sucursal
                </label>
                <select
                  value={jefeNuevoId}
                  onChange={(e) => setJefeNuevoId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                >
                  {jefesNuevaSede.length === 0 ? (
                    <option value={0}>
                      — Sin Jefe Encargado registrado en esta sede (usa Gestionar Personal / Importar CSV) —
                    </option>
                  ) : (
                    jefesNuevaSede.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.disponible ? '🟢 ' : '⚪ '}
                        {j.nombre_completo} — {j.cargo}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    4. Turno Operativo
                  </label>
                  <select
                    value={turnoNuevo}
                    onChange={(e) => setTurnoNuevo(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                  >
                    {TURNOS_OFICIALES_RIO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    5. Fecha Operativa
                  </label>
                  <input
                    type="date"
                    value={fechaNueva}
                    onChange={(e) => setFechaNueva(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalCrearAbierto(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={creando}
                onClick={() => handleCrearEvaluacion()}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#087334] text-white hover:bg-[#054d22] cursor-pointer"
              >
                {creando ? 'Creando...' : 'Crear y Abrir Evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
