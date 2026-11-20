'use client';

import { useEffect, useState } from 'react';
import { supabase, AlertaReporteDiario, getTodayStr } from '@/lib/supabase';
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, X } from 'lucide-react';

interface AlertaReporteBannerProps {
  refreshTrigger?: number;
  onIrACasoPendiente?: () => void;
}

function normalizarRespuestaRpc(raw: any): AlertaReporteDiario | null {
  if (!raw) return null;
  const obj = Array.isArray(raw) ? raw[0] : raw;
  if (!obj) return null;

  const hoy = getTodayStr(0);
  const ayer = getTodayStr(-1);

  // Soportar tanto formato JSON estructurado como tabla SQL de verificar_reporte_diario()
  const ayerOmitido = Boolean(
    obj.ayer_omitido ??
      obj.reporte_omitido ??
      obj.alerta ??
      (obj.estado_ayer && obj.estado_ayer !== 'COMPLETADA')
  );
  const turnoPendiente = Boolean(
    obj.turno_actual_pendiente ??
      obj.pendiente_hoy ??
      (obj.estado_hoy && obj.estado_hoy !== 'COMPLETADA')
  );
  const alertaActiva =
    obj.alerta_activa !== undefined
      ? Boolean(obj.alerta_activa)
      : typeof obj === 'boolean'
      ? obj
      : ayerOmitido || turnoPendiente || Boolean(obj.mensaje || obj.alerta_mensaje);

  return {
    fecha_ayer: obj.fecha_ayer || obj.fecha || ayer,
    fecha_hoy: obj.fecha_hoy || hoy,
    ayer_omitido: ayerOmitido,
    ayer_en_progreso: Boolean(obj.ayer_en_progreso),
    turno_actual_pendiente: turnoPendiente,
    caso_en_progreso: obj.caso_en_progreso || obj.codigo_caso || null,
    alerta_activa: alertaActiva,
    mensaje:
      obj.mensaje ||
      obj.alerta_mensaje ||
      (alertaActiva
        ? 'Alerta: Existe un reporte diario del día anterior o del turno actual pendiente por cerrar.'
        : 'Reportes diarios al día.'),
  };
}

export default function AlertaReporteBanner({
  refreshTrigger = 0,
  onIrACasoPendiente,
}: AlertaReporteBannerProps) {
  const [alerta, setAlerta] = useState<AlertaReporteDiario | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function consultarRpcAlerta() {
      const { data, error } = await supabase.rpc('verificar_reporte_diario');
      if (!error && data !== null && data !== undefined) {
        const norm = normalizarRespuestaRpc(data);
        if (norm) setAlerta(norm);
      }
    }
    consultarRpcAlerta();
  }, [refreshTrigger]);

  if (!alerta || dismissed) return null;

  if (!alerta.alerta_activa) {
    return (
      <div className="bg-emerald-950/90 text-emerald-100 border-b border-emerald-800/80 px-4 py-2 text-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>
              <strong>Control RPC Diario:</strong> {alerta.mensaje}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-emerald-300 hover:text-white p-1 cursor-pointer"
            aria-label="Ocultar aviso"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Alerta de Reporte Omitido"
      className={`${
        alerta.ayer_omitido
          ? 'bg-red-950 text-red-100 border-b border-red-800'
          : 'bg-amber-950 text-amber-100 border-b border-amber-800'
      } px-4 py-2.5 text-xs transition`}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start sm:items-center gap-2.5">
          {alerta.ayer_omitido ? (
            <AlertTriangle
              size={16}
              className="text-red-400 shrink-0 mt-0.5 sm:mt-0"
            />
          ) : (
            <BellRing
              size={16}
              className="text-amber-400 shrink-0 mt-0.5 sm:mt-0"
            />
          )}
          <div className="space-y-0.5">
            <p className="font-semibold">{alerta.mensaje}</p>
            <p className="text-[11px] opacity-85 font-mono">
              RPC verificar_reporte_diario() • Ayer ({alerta.fecha_ayer}):{' '}
              {alerta.ayer_omitido ? 'SIN CIERRE' : 'CERRADO'} • Turno Hoy (
              {alerta.fecha_hoy}):{' '}
              {alerta.turno_actual_pendiente ? 'PENDIENTE' : 'COMPLETADO'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {onIrACasoPendiente && (
            <button
              id="btn-alerta-revisar-pendiente"
              onClick={onIrACasoPendiente}
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer"
            >
              <CalendarClock size={13} /> Ver Calendario / Casos
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="opacity-75 hover:opacity-100 p-1 cursor-pointer"
            aria-label="Cerrar alerta"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
