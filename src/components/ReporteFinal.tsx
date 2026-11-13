'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FileDown,
  MessageSquareShare,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  Clock,
  Calendar,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReporteFinalProps {
  inspeccionId: string;
  codigoCaso: string;
  onVolver: () => void;
}

export default function ReporteFinal({
  inspeccionId,
  codigoCaso,
  onVolver,
}: ReporteFinalProps) {
  const [datosReporte, setDatosReporte] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [obsManuales, setObsManuales] = useState('');

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);
      // 1. Obtener datos de la vista de Supabase vw_reporte_inspeccion
      const { data } = await supabase
        .from('vw_reporte_inspeccion')
        .select('*')
        .eq('inspeccion_id', inspeccionId);

      if (data && data.length > 0) {
        setDatosReporte(data);
        setObsManuales(data[0].observaciones_manuales || '');
      }
      setLoading(false);
    }
    cargarDatos();
  }, [inspeccionId]);

  // 2. Función para Generar PDF Ejecutivo
  function descargarPDF() {
    const doc = new jsPDF();

    // Encabezado Corporativo Río Supermarket
    doc.setFillColor(15, 29, 54); // Azul corporativo profundo
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('RÍO SUPERMARKET • AUDITORÍA DE SISTEMAS', 14, 16);

    doc.setFontSize(10);
    doc.text(`CASO: ${codigoCaso}`, 162, 16);

    // Subtítulo e Info general
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('Reporte Consolidado de Auditoría Tecnológica (16 Departamentos)', 14, 36);

    const fechaOp =
      datosReporte[0]?.fecha_operativa || new Date().toLocaleDateString();
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Fecha Operativa: ${fechaOp}`, 14, 43);
    doc.text(
      `Analista a cargo: ${datosReporte[0]?.analista_nombre || 'N/A'}`,
      14,
      48
    );
    doc.text(`Turno: ${datosReporte[0]?.turno || 'N/A'}`, 14, 53);

    // Tabla de Resultados por Departamento (Los 16 departamentos separados)
    const tablaRows = datosReporte.map((item) => [
      item.departamento,
      item.total_evaluados,
      item.total_ok,
      item.total_fallas,
      `${item.porcentaje_cumplimiento}%`,
    ]);

    const tableConfig = {
      startY: 59,
      head: [['Departamento', 'Evaluados', 'OK', 'Fallas', 'Cumplimiento']],
      body: tablaRows,
      theme: 'grid' as const,
      headStyles: { fillColor: [15, 29, 54] as [number, number, number] },
      styles: { fontSize: 8.5, cellPadding: 3 },
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableConfig);
    } else {
      autoTable(doc, tableConfig);
    }

    // Observaciones Manuales al pie
    const finalY = (doc as any).lastAutoTable?.finalY || 195;
    doc.setFontSize(10);
    doc.setTextColor(15, 29, 54);
    doc.text('Observaciones Manuales Generales:', 14, finalY + 10);
    doc.setFontSize(8.5);
    doc.setTextColor(80, 90, 105);
    doc.text(
      obsManuales || 'Sin observaciones registradas en este turno.',
      14,
      finalY + 16,
      { maxWidth: 180 }
    );

    // Descargar archivo
    doc.save(`Reporte_Auditoria_${codigoCaso}.pdf`);
  }

  // 3. Función para Compartir por WhatsApp
  function compartirWhatsApp() {
    const totalFallasGlobal = datosReporte.reduce(
      (acc, curr) => acc + (curr.total_fallas || 0),
      0
    );
    const promedioCumplimiento =
      datosReporte.length > 0
        ? (
            datosReporte.reduce(
              (acc, curr) => acc + Number(curr.porcentaje_cumplimiento),
              0
            ) / datosReporte.length
          ).toFixed(1)
        : 0;

    let mensaje = `📋 *REPORTE DE AUDITORÍA • RÍO SUPERMARKET*\n`;
    mensaje += `🔹 *Caso:* ${codigoCaso}\n`;
    mensaje += `👤 *Analista:* ${datosReporte[0]?.analista_nombre || 'Sistemas'}\n`;
    mensaje += `📊 *Cumplimiento Promedio:* ${promedioCumplimiento}%\n`;
    mensaje += `⚠️ *Total Fallas Detectadas:* ${totalFallasGlobal}\n\n`;
    mensaje += `*Resumen por los 16 Departamentos:*\n`;

    datosReporte.forEach((d) => {
      mensaje += `• ${d.departamento}: ${d.porcentaje_cumplimiento}% (${d.total_fallas} fallas)\n`;
    });

    if (obsManuales) {
      mensaje += `\n📝 *Obs:* ${obsManuales}`;
    }

    const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(urlWhatsApp, '_blank');
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
        Generando reporte ejecutivo consolidado...
      </div>
    );
  }

  const totalEvaluadosGlobal = datosReporte.reduce(
    (acc, curr) => acc + (curr.total_evaluados || 0),
    0
  );
  const totalOkGlobal = datosReporte.reduce(
    (acc, curr) => acc + (curr.total_ok || 0),
    0
  );
  const totalFallasGlobal = datosReporte.reduce(
    (acc, curr) => acc + (curr.total_fallas || 0),
    0
  );
  const promedioGlobal =
    datosReporte.length > 0
      ? (
          datosReporte.reduce(
            (acc, curr) => acc + Number(curr.porcentaje_cumplimiento),
            0
          ) / datosReporte.length
        ).toFixed(1)
      : '100.0';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Barra superior de retorno e identificación de caso */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
        <button
          id="btn-volver-checklist"
          onClick={onVolver}
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 hover:text-blue-900 px-3 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver al Checklist
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
            <ShieldCheck size={14} /> Auditoría Consolidada
          </span>
          <span className="font-mono font-bold text-xs sm:text-sm bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1 rounded-lg">
            {codigoCaso}
          </span>
        </div>
      </div>

      {/* Tarjeta principal del Reporte Ejecutivo */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-lg text-slate-900">
              Reporte Automático Consolidado
            </h2>
            <p className="text-xs text-slate-500">
              Métricas de cumplimiento calculadas en tiempo real desde{' '}
              <code className="font-mono text-slate-700">vw_reporte_inspeccion</code>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
              <UserCheck size={13} className="text-slate-500" />
              {datosReporte[0]?.analista_nombre || 'Analista Sistemas'}
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Clock size={13} className="text-slate-500" />
              {datosReporte[0]?.turno || 'Turno Diurno'}
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">
              <Calendar size={13} className="text-slate-500" />
              {datosReporte[0]?.fecha_operativa}
            </span>
          </div>
        </div>

        {/* Resumen de KPIs Globales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              Cumplimiento Global
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
              {promedioGlobal}%
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              Ítems Evaluados
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
              {totalEvaluadosGlobal}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">
              Operativos (OK)
            </p>
            <p className="text-xl font-bold text-emerald-800 mt-0.5 font-mono">
              {totalOkGlobal}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200/70">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-red-700">
              Fallas Detectadas
            </p>
            <p className="text-xl font-bold text-red-700 mt-0.5 font-mono">
              {totalFallasGlobal}
            </p>
          </div>
        </div>

        {/* Desglose de los 16 Departamentos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3">
            <span>Departamento (16 Áreas Independientes)</span>
            <span>Estado y Cumplimiento</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {datosReporte.map((rep) => (
              <div
                key={rep.departamento_id}
                className="flex justify-between items-center p-3.5 bg-slate-50/90 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 text-xs transition"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-slate-800 truncate">
                    {rep.departamento}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {rep.total_evaluados}/{rep.total_items || rep.total_evaluados}{' '}
                    evaluados • {rep.total_ok} OK
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
                      rep.total_fallas > 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {rep.total_fallas > 0 ? (
                      <AlertTriangle size={12} />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    {rep.total_fallas} fallas
                  </span>
                  <span className="bg-slate-900 text-white font-mono font-bold px-2.5 py-1 rounded-lg min-w-[54px] text-center">
                    {rep.porcentaje_cumplimiento}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observaciones Manuales del Turno */}
        <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 text-xs space-y-1.5">
          <p className="font-bold text-amber-950 uppercase tracking-wide text-[11px]">
            Observaciones Manuales Generales del Turno:
          </p>
          <p className="text-slate-700 leading-relaxed">
            {obsManuales || 'Sin observaciones manuales registradas en este turno.'}
          </p>
        </div>

        {/* Botones de Acción: PDF y WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            id="btn-descargar-pdf"
            onClick={descargarPDF}
            className="bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer"
          >
            <FileDown size={18} /> Descargar PDF Ejecutivo
          </button>
          <button
            id="btn-compartir-whatsapp"
            onClick={compartirWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer"
          >
            <MessageSquareShare size={18} /> Compartir Resumen por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
