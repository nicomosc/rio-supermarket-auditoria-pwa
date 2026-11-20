// ============================================================================
// REGLA DE EDICIÓN POR DÍA OPERATIVO Y ROL (sin dependencias, probada con node --test)
// - Evaluación de HOY: modificable por Analista y Coordinador / Jefe Encargado.
// - Evaluación de OTRO DÍA: cerrada (Solo Vista) para Analista; editable por Coordinador.
// ============================================================================

export type RolEdicion = 'COORDINADOR' | 'ANALISTA';

export interface PermisoEdicionEvaluacion {
  editable: boolean;
  esMismoDia: boolean;
  cerradaAutomaticamentePorDia: boolean;
  desbloqueadaPorJefe: boolean;
  etiquetaEstado: string;
  descripcionRegla: string;
}

export function calcularPermisoEdicion(
  fechaOperativa: string | null | undefined,
  rol: RolEdicion,
  hoy: string
): PermisoEdicionEvaluacion {
  const fechaEval = (fechaOperativa || hoy).trim();
  const esMismoDia = fechaEval === hoy;

  if (esMismoDia) {
    return {
      editable: true,
      esMismoDia: true,
      cerradaAutomaticamentePorDia: false,
      desbloqueadaPorJefe: false,
      etiquetaEstado: '🟢 En el Día (Modificable Hoy)',
      descripcionRegla: `Evaluación del día de hoy (${fechaEval}): abierta para modificar cualquier ítem, observación o firma hasta las 12:00 AM (hora de Venezuela).`,
    };
  }

  if (rol === 'COORDINADOR') {
    return {
      editable: true,
      esMismoDia: false,
      cerradaAutomaticamentePorDia: true,
      desbloqueadaPorJefe: true,
      etiquetaEstado: '🔓 Otro Día (Editable por Jefe Encargado)',
      descripcionRegla: `Evaluación de fecha anterior (${fechaEval}): cerrada automáticamente por cambio de día, pero desbloqueada para modificación por el Jefe Encargado / Coordinador.`,
    };
  }

  return {
    editable: false,
    esMismoDia: false,
    cerradaAutomaticamentePorDia: true,
    desbloqueadaPorJefe: false,
    etiquetaEstado: '🔒 Día Cerrado (Solo Vista)',
    descripcionRegla: `Evaluación de otro día (${fechaEval}): se cerró automáticamente a las 12:00 AM (hora de Venezuela). Solo está disponible en Modo Vista, a menos que autorice el Jefe Encargado.`,
  };
}
