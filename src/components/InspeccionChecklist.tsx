'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  supabase,
  Departamento,
  ChecklistItem,
  Inspeccion,
  InspeccionDetalle,
} from '@/lib/supabase';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Camera,
  ShieldAlert,
  CloudCheck,
  Loader2,
  ChevronRight,
  ChevronLeft,
  PlusCircle,
  FileCheck2,
  ClipboardList,
  Sparkles,
} from 'lucide-react';

interface InspeccionChecklistProps {
  departamentos: Departamento[];
  items: ChecklistItem[];
  inspeccionActiva: Inspeccion;
  inspeccionesDisponibles: Inspeccion[];
  onCambiarInspeccion: (inspeccionId: string) => void;
  onCrearNuevaInspeccion: (analista: string, turno: string) => Promise<void>;
  onFinalizarYVerReporte: (inspeccionId: string, codigoCaso: string) => void;
  onDatosActualizados: () => void;
}

export default function InspeccionChecklist({
  departamentos,
  items,
  inspeccionActiva,
  inspeccionesDisponibles,
  onCambiarInspeccion,
  onCrearNuevaInspeccion,
  onFinalizarYVerReporte,
  onDatosActualizados,
}: InspeccionChecklistProps) {
  const [deptoActivoId, setDeptoActivoId] = useState<number>(
    departamentos[0]?.id || 1
  );
  const [detallesMap, setDetallesMap] = useState<
    Record<number, InspeccionDetalle>
  >({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [guardandoItemId, setGuardandoItemId] = useState<number | null>(null);
  const [subiendoFotoItemId, setSubiendoFotoItemId] = useState<number | null>(
    null
  );
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);

  const [obsManuales, setObsManuales] = useState<string>(
    inspeccionActiva.observaciones_manuales || ''
  );
  const [cerrandoInspeccion, setCerrandoInspeccion] = useState(false);

  // Modal de Nueva Inspección
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevoAnalista, setNuevoAnalista] = useState('Ing. Carlos Mendoza');
  const [nuevoTurno, setNuevoTurno] = useState('Mañana (07:00 - 15:00)');

  // Cargar detalles de la inspección activa
  useEffect(() => {
    setObsManuales(inspeccionActiva.observaciones_manuales || '');
    async function cargarDetalles() {
      const { data } = await supabase
        .from('inspeccion_detalles')
        .select('*')
        .eq('inspeccion_id', inspeccionActiva.id);

      const mapa: Record<number, InspeccionDetalle> = {};
      if (data) {
        for (const row of data as InspeccionDetalle[]) {
          mapa[row.item_id] = row;
        }
      }
      setDetallesMap(mapa);
    }
    cargarDetalles();
  }, [inspeccionActiva]);

  // Generar Signed URLs temporales (3600s) para fotos en evidencia_url
  useEffect(() => {
    async function resolverUrlsFirmadas() {
      const rutas = Object.values(detallesMap)
        .map((d) => d.evidencia_url)
        .filter((url): url is string => Boolean(url && !signedUrls[url]));

      if (rutas.length === 0) return;

      const nuevas: Record<string, string> = {};
      for (const filePath of rutas) {
        const { data } = await supabase.storage
          .from('evidencias-auditoria')
          .createSignedUrl(filePath, 3600);
        if (data?.signedUrl) {
          nuevas[filePath] = data.signedUrl;
        }
      }
      if (Object.keys(nuevas).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...nuevas }));
      }
    }
    resolverUrlsFirmadas();
  }, [detallesMap, signedUrls]);

  // Upsert en tiempo real de un ítem en inspeccion_detalles
  async function handleMarcarEstado(
    itemId: number,
    nuevoEstado: 'OK' | 'FALLA' | 'NA'
  ) {
    setGuardandoItemId(itemId);
    const actual = detallesMap[itemId];

    const payload = {
      inspeccion_id: inspeccionActiva.id,
      item_id: itemId,
      estado: nuevoEstado,
      observacion_item:
        nuevoEstado === 'FALLA' ? actual?.observacion_item || '' : null,
      evidencia_url:
        nuevoEstado === 'FALLA' ? actual?.evidencia_url || null : null,
      registrado_at: new Date().toISOString(),
    };

    const { data } = await supabase
      .from('inspeccion_detalles')
      .upsert(payload, { onConflict: 'inspeccion_id,item_id' })
      .select('*')
      .single();

    if (data) {
      setDetallesMap((prev) => ({
        ...prev,
        [itemId]: data as InspeccionDetalle,
      }));
      setUltimoGuardado(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      onDatosActualizados();
    }
    setGuardandoItemId(null);
  }

  // Upsert en tiempo real de la observación de falla
  async function handleActualizarObservacionItem(
    itemId: number,
    texto: string
  ) {
    const actual = detallesMap[itemId];
    if (!actual) return;

    setDetallesMap((prev) => ({
      ...prev,
      [itemId]: { ...actual, observacion_item: texto },
    }));

    setGuardandoItemId(itemId);
    await supabase
      .from('inspeccion_detalles')
      .upsert(
        {
          inspeccion_id: inspeccionActiva.id,
          item_id: itemId,
          estado: actual.estado,
          observacion_item: texto,
          evidencia_url: actual.evidencia_url,
          registrado_at: new Date().toISOString(),
        },
        { onConflict: 'inspeccion_id,item_id' }
      )
      .select('*');
    setUltimoGuardado(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    setGuardandoItemId(null);
  }

  // Subida de foto desde cámara móvil (capture="environment") al bucket privado evidencias-auditoria
  async function handleSubirEvidenciaCamara(itemId: number, file: File | null) {
    if (!file) return;
    setSubiendoFotoItemId(itemId);

    const timestamp = Date.now();
    const filePath = `${inspeccionActiva.id}/${itemId}-${timestamp}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('evidencias-auditoria')
      .upload(filePath, file, { upsert: true, contentType: file.type || 'image/jpeg' });

    if (!uploadError) {
      const actual = detallesMap[itemId];
      const { data: upserted } = await supabase
        .from('inspeccion_detalles')
        .upsert(
          {
            inspeccion_id: inspeccionActiva.id,
            item_id: itemId,
            estado: 'FALLA',
            observacion_item:
              actual?.observacion_item ||
              'Evidencia fotográfica capturada desde dispositivo móvil.',
            evidencia_url: filePath,
            registrado_at: new Date().toISOString(),
          },
          { onConflict: 'inspeccion_id,item_id' }
        )
        .select('*')
        .single();

      // Generar Signed URL inmediatamente (3600s)
      const { data: signed } = await supabase.storage
        .from('evidencias-auditoria')
        .createSignedUrl(filePath, 3600);

      if (signed?.signedUrl) {
        setSignedUrls((prev) => ({ ...prev, [filePath]: signed.signedUrl }));
      }
      if (upserted) {
        setDetallesMap((prev) => ({
          ...prev,
          [itemId]: upserted as InspeccionDetalle,
        }));
      }
      setUltimoGuardado(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      onDatosActualizados();
    }

    setSubiendoFotoItemId(null);
  }

  // Guardar Observaciones Manuales Generales en tiempo real
  async function handleGuardarObsGenerales(valor: string) {
    setObsManuales(valor);
    await supabase
      .from('inspecciones')
      .update({ observaciones_manuales: valor })
      .eq('id', inspeccionActiva.id);
  }

  // Marcar todos los ítems pendientes del departamento actual como OK con un toque (asistente táctil rápido)
  async function handleMarcarRestantesDeptoOk() {
    const itemsDepto = items.filter((i) => i.departamento_id === deptoActivoId);
    for (const item of itemsDepto) {
      if (!detallesMap[item.id]) {
        await handleMarcarEstado(item.id, 'OK');
      }
    }
  }

  // Finalizar y Generar Reporte Ejecutivo
  async function handleFinalizarInspeccion() {
    setCerrandoInspeccion(true);
    await supabase
      .from('inspecciones')
      .update({
        estado: 'COMPLETADA',
        fecha_fin: new Date().toISOString(),
        observaciones_manuales: obsManuales,
      })
      .eq('id', inspeccionActiva.id);

    setCerrandoInspeccion(false);
    onDatosActualizados();
    onFinalizarYVerReporte(inspeccionActiva.id, inspeccionActiva.codigo_caso);
  }

  // Métricas por cada uno de los 16 departamentos independientes
  const progresoPorDepto = useMemo(() => {
    const map: Record<
      number,
      { respondidos: number; total: number; fallas: number }
    > = {};
    for (const d of departamentos) {
      const deptoItems = items.filter((i) => i.departamento_id === d.id);
      let respondidos = 0;
      let fallas = 0;
      for (const it of deptoItems) {
        const det = detallesMap[it.id];
        if (det) {
          respondidos++;
          if (det.estado === 'FALLA') fallas++;
        }
      }
      map[d.id] = { respondidos, total: deptoItems.length, fallas };
    }
    return map;
  }, [departamentos, items, detallesMap]);

  const deptoActual =
    departamentos.find((d) => d.id === deptoActivoId) || departamentos[0];
  const itemsDeptoActual = useMemo(
    () =>
      items
        .filter((i) => i.departamento_id === deptoActivoId)
        .sort((a, b) => a.orden - b.orden),
    [items, deptoActivoId]
  );

  const totalRespondidosGlobal = Object.keys(detallesMap).length;
  const totalItemsGlobal = items.length;
  const porcentajeAvanceGlobal =
    totalItemsGlobal > 0
      ? Math.round((totalRespondidosGlobal / totalItemsGlobal) * 100)
      : 0;

  const idxDeptoActual = departamentos.findIndex((d) => d.id === deptoActivoId);
  const deptoAnterior =
    idxDeptoActual > 0 ? departamentos[idxDeptoActual - 1] : null;
  const deptoSiguiente =
    idxDeptoActual < departamentos.length - 1
      ? departamentos[idxDeptoActual + 1]
      : null;

  return (
    <div className="space-y-4">
      {/* 1. Cabecera Operativa del Caso Activo y Progreso Global */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-xs sm:text-sm bg-slate-900 text-amber-400 px-3 py-1.5 rounded-xl">
              {inspeccionActiva.codigo_caso}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                inspeccionActiva.estado === 'COMPLETADA'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {inspeccionActiva.estado === 'COMPLETADA'
                ? 'INSPECCIÓN COMPLETADA'
                : 'EN PROGRESO'}
            </span>
            <span className="text-xs text-slate-600 font-medium">
              {inspeccionActiva.analista_nombre} • {inspeccionActiva.turno} •{' '}
              <span className="font-mono">{inspeccionActiva.fecha_operativa}</span>
            </span>
          </div>

          {/* Selector de Caso o Crear Nueva Inspección */}
          <div className="flex items-center gap-2">
            <select
              id="select-cambiar-caso"
              aria-label="Cambiar caso de inspección"
              value={inspeccionActiva.id}
              onChange={(e) => onCambiarInspeccion(e.target.value)}
              className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:border-slate-900"
            >
              {inspeccionesDisponibles.map((insp) => (
                <option key={insp.id} value={insp.id}>
                  {insp.codigo_caso} ({insp.fecha_operativa} - {insp.estado})
                </option>
              ))}
            </select>
            <button
              id="btn-nueva-inspeccion"
              onClick={() => setModalNueva(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl transition cursor-pointer shrink-0"
            >
              <PlusCircle size={14} /> Nuevo Caso
            </button>
          </div>
        </div>

        {/* Barra de progreso global y estado de autoguardado */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Avance Global (16 Departamentos):{' '}
              <strong className="font-mono text-slate-900">
                {totalRespondidosGlobal}/{totalItemsGlobal} ítems ({porcentajeAvanceGlobal}%)
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
              <CloudCheck size={14} />
              {ultimoGuardado
                ? `Upsert sincronizado a las ${ultimoGuardado}`
                : 'Autoguardado en tiempo real activo'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${porcentajeAvanceGlobal}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. Navegación Horizontal de los 16 Departamentos Independientes (Nunca fusionados) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Selector de los 16 Departamentos Independientes (Toque para evaluar)
          </p>
          <span className="text-[11px] font-mono text-slate-500">
            Depto {deptoActual?.orden || 1} de 16
          </span>
        </div>

        <div
          role="tablist"
          aria-label="16 Departamentos de Río Supermarket"
          className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar"
        >
          {departamentos.map((depto) => {
            const prog = progresoPorDepto[depto.id] || {
              respondidos: 0,
              total: 0,
              fallas: 0,
            };
            const esActivo = depto.id === deptoActivoId;
            const completo = prog.total > 0 && prog.respondidos === prog.total;

            return (
              <button
                key={depto.id}
                role="tab"
                id={`tab-depto-${depto.id}`}
                aria-selected={esActivo}
                onClick={() => setDeptoActivoId(depto.id)}
                className={`shrink-0 px-3.5 py-2.5 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                  esActivo
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : completo
                    ? 'bg-emerald-50/70 text-slate-900 border-emerald-200 hover:bg-emerald-100/60'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        esActivo
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      #{depto.orden}
                    </span>
                    <span className="text-xs font-bold whitespace-nowrap">
                      {depto.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[11px] font-mono ${
                        esActivo
                          ? 'text-slate-300'
                          : completo
                          ? 'text-emerald-700 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {prog.respondidos}/{prog.total} ítems
                    </span>
                    {prog.fallas > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-red-600 text-white px-1.5 py-0.2 rounded">
                        {prog.fallas}F
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Lista de Evaluación Táctil por Ítem del Departamento Seleccionado */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                Depto #{deptoActual.orden}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {deptoActual.nombre}
              </h2>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {deptoActual.tipo_area}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ítems individuales sin agrupar • Evaluación táctil con guardado en
              tiempo real
            </p>
          </div>

          <button
            id="btn-marcar-restantes-ok"
            onClick={handleMarcarRestantesDeptoOk}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition cursor-pointer self-start sm:self-center"
          >
            <Sparkles size={14} /> Marcar pendientes del área como OK
          </button>
        </div>

        {/* Tarjetas de cada ítem individual del departamento */}
        <div className="space-y-3.5">
          {itemsDeptoActual.map((item) => {
            const detalle = detallesMap[item.id];
            const estadoActual = detalle?.estado || null;
            const esFalla = estadoActual === 'FALLA';
            const guardando = guardandoItemId === item.id;
            const subiendoFoto = subiendoFotoItemId === item.id;
            const signedUrl =
              detalle?.evidencia_url ? signedUrls[detalle.evidencia_url] : null;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition space-y-3 ${
                  estadoActual === 'FALLA'
                    ? 'bg-red-50/40 border-red-300'
                    : estadoActual === 'OK'
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : estadoActual === 'NA'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Descripción e indicador de ítem crítico */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        ÍTEM #{item.orden}
                      </span>
                      {item.es_critico && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-md">
                          <ShieldAlert size={11} /> Crítico
                        </span>
                      )}
                      {guardando && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Loader2 size={12} className="animate-spin" />
                          Guardando...
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {item.descripcion}
                    </h3>
                  </div>
                </div>

                {/* Botones grandes para uso con una mano: OK, FALLA, N/A */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <button
                    id={`btn-item-${item.id}-ok`}
                    type="button"
                    onClick={() => handleMarcarEstado(item.id, 'OK')}
                    className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition active:scale-[0.98] cursor-pointer ${
                      estadoActual === 'OK'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <CheckCircle2 size={18} /> OK
                  </button>

                  <button
                    id={`btn-item-${item.id}-falla`}
                    type="button"
                    onClick={() => handleMarcarEstado(item.id, 'FALLA')}
                    className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition active:scale-[0.98] cursor-pointer ${
                      estadoActual === 'FALLA'
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-white hover:bg-red-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <XCircle size={18} /> FALLA
                  </button>

                  <button
                    id={`btn-item-${item.id}-na`}
                    type="button"
                    onClick={() => handleMarcarEstado(item.id, 'NA')}
                    className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition active:scale-[0.98] cursor-pointer ${
                      estadoActual === 'NA'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <MinusCircle size={18} /> N/A
                  </button>
                </div>

                {/* Panel desplegable inmediato al marcar FALLA: Novedad + Cámara Móvil (capture="environment") */}
                {esFalla && (
                  <div className="mt-3 p-3.5 rounded-xl bg-white border border-red-200 space-y-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`obs-item-${item.id}`}
                        className="block text-xs font-bold text-red-900"
                      >
                        Descripción de la Novedad / Falla Detectada:
                      </label>
                      <textarea
                        id={`obs-item-${item.id}`}
                        rows={2}
                        value={detalle?.observacion_item || ''}
                        onChange={(e) =>
                          handleActualizarObservacionItem(item.id, e.target.value)
                        }
                        placeholder="Describe el síntoma técnico, número de equipo, código de error o acción tomada..."
                        className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-600 focus:bg-white"
                      />
                    </div>

                    {/* Captura desde cámara del teléfono y vista previa con createSignedUrl */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <label
                        htmlFor={`camara-item-${item.id}`}
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 px-4 rounded-xl cursor-pointer transition shadow-xs"
                      >
                        {subiendoFoto ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Subiendo al bucket evidencias-auditoria...
                          </>
                        ) : (
                          <>
                            <Camera size={16} className="text-amber-400" />
                            {detalle?.evidencia_url
                              ? 'Reemplazar Foto de Evidencia (Cámara)'
                              : 'Abrir Cámara y Subir Evidencia'}
                          </>
                        )}
                        <input
                          id={`camara-item-${item.id}`}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) =>
                            handleSubirEvidenciaCamara(
                              item.id,
                              e.target.files?.[0] || null
                            )
                          }
                        />
                      </label>

                      {detalle?.evidencia_url && (
                        <span className="text-[11px] font-mono text-slate-500 truncate">
                          Ruta bucket: {detalle.evidencia_url}
                        </span>
                      )}
                    </div>

                    {signedUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                        <img
                          src={signedUrl}
                          alt={`Evidencia ítem ${item.id}`}
                          className="w-full max-h-56 object-contain mx-auto"
                        />
                        <div className="px-3 py-1.5 bg-slate-900 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                          <span>evidencias-auditoria (Privado)</span>
                          <span>Signed URL 3600s activa</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Navegación rápida entre departamentos Anterior / Siguiente */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {deptoAnterior ? (
            <button
              onClick={() => setDeptoActivoId(deptoAnterior.id)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2.5 rounded-xl transition cursor-pointer"
            >
              <ChevronLeft size={16} /> #{deptoAnterior.orden}{' '}
              {deptoAnterior.nombre}
            </button>
          ) : (
            <div />
          )}

          {deptoSiguiente ? (
            <button
              onClick={() => setDeptoActivoId(deptoSiguiente.id)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              Siguiente: #{deptoSiguiente.orden} {deptoSiguiente.nombre}{' '}
              <ChevronRight size={16} />
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-700">
              Último departamento (#16 Seguridad CECOM)
            </span>
          )}
        </div>
      </section>

      {/* 4. Cierre de Auditoría y Generación de Reporte Ejecutivo */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-slate-800" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Cierre de Turno y Reporte Ejecutivo Consolidado
            </h2>
            <p className="text-xs text-slate-500">
              Registra las observaciones generales antes de finalizar y exportar
              el PDF / WhatsApp
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="textarea-observaciones-manuales"
            className="block text-xs font-bold uppercase tracking-wider text-slate-600"
          >
            Observaciones Manuales Generales del Turno
          </label>
          <textarea
            id="textarea-observaciones-manuales"
            rows={3}
            value={obsManuales}
            onChange={(e) => handleGuardarObsGenerales(e.target.value)}
            placeholder="Escribe el resumen ejecutivo del turno, tickets escalados a proveedores, estado de enlaces o novedades relevantes..."
            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500">
            Al finalizar, el caso{' '}
            <strong className="font-mono text-slate-800">
              {inspeccionActiva.codigo_caso}
            </strong>{' '}
            quedará marcado como <code className="font-mono">COMPLETADA</code> y
            se abrirá el consolidado de{' '}
            <code className="font-mono">vw_reporte_inspeccion</code>.
          </div>

          <button
            id="btn-finalizar-generar-reporte"
            type="button"
            disabled={cerrandoInspeccion}
            onClick={handleFinalizarInspeccion}
            className="bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer shrink-0"
          >
            <FileCheck2 size={18} />
            {cerrandoInspeccion
              ? 'Cerrando y calculando métricas...'
              : 'Finalizar y Generar Reporte'}
          </button>
        </div>
      </section>

      {/* Modal para crear una nueva inspección (CAS-XXXX) */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Iniciar Nueva Inspección Diaria
            </h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Nombre del Analista de Sistemas
                </label>
                <input
                  type="text"
                  value={nuevoAnalista}
                  onChange={(e) => setNuevoAnalista(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Turno Operativo
                </label>
                <select
                  value={nuevoTurno}
                  onChange={(e) => setNuevoTurno(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white"
                >
                  <option value="Mañana (07:00 - 15:00)">
                    Mañana (07:00 - 15:00)
                  </option>
                  <option value="Tarde (14:00 - 22:00)">
                    Tarde (14:00 - 22:00)
                  </option>
                  <option value="Cierre / Nocturno">Cierre / Nocturno</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalNueva(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onCrearNuevaInspeccion(nuevoAnalista, nuevoTurno);
                  setModalNueva(false);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Crear Caso CAS-XXXX
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
