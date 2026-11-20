// ============================================================================
// FECHA OPERATIVA OFICIAL RÍO SUPERMARKET — HORA DE VENEZUELA (America/Caracas)
// El día operativo cierra exactamente a las 12:00 AM hora de Venezuela (UTC-4),
// sin importar la zona horaria del teléfono, PC o servidor.
// Módulo sin dependencias para poder probarse directamente con `node --test`.
// ============================================================================

export const ZONA_HORARIA_RIO = 'America/Caracas';

const formateadorFechaCaracas = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA_RIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Convierte un instante cualquiera a la fecha (YYYY-MM-DD) que corresponde en Venezuela. */
export function fechaCaracasDeInstante(instante: Date): string {
  const partes = formateadorFechaCaracas.formatToParts(instante);
  const y = partes.find((p) => p.type === 'year')?.value ?? '1970';
  const m = partes.find((p) => p.type === 'month')?.value ?? '01';
  const d = partes.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/** Suma (o resta) días a una fecha YYYY-MM-DD sin depender de la zona horaria local. */
export function sumarDiasAFecha(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  utc.setUTCDate(utc.getUTCDate() + dias);
  return utc.toISOString().slice(0, 10);
}

/**
 * Fecha operativa de hoy en Venezuela (YYYY-MM-DD).
 * @param offsetDias -1 = ayer, 0 = hoy, 1 = mañana
 * @param ahora instante de referencia (solo para pruebas)
 */
export function getFechaOperativaCaracas(
  offsetDias = 0,
  ahora: Date = new Date()
): string {
  const hoy = fechaCaracasDeInstante(ahora);
  return offsetDias === 0 ? hoy : sumarDiasAFecha(hoy, offsetDias);
}
