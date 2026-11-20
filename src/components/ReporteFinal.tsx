'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  supabase,
  getObservacionesPorDepto,
  BusquedaAuditoriaRow,
  getSucursales,
  getInspeccionExtraMeta,
  saveInspeccionExtraMeta,
  getTodayStr,
} from '@/lib/supabase';
import RioLogo, { RIO_LOGO_WHITE_DATA_URL } from '@/components/RioLogo';
import FirmaDigitalCanvas from '@/components/FirmaDigitalCanvas';
import {
  FileDown,
  MessageSquareShare,
  ArrowLeft,
  ShieldCheck,
  Printer,
  SlidersHorizontal,
  Eye,
  CheckCircle2,
  AlertTriangle,
  PenTool,
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
  const [detallesFallas, setDetallesFallas] = useState<BusquedaAuditoriaRow[]>(
    []
  );
  const [obsPorDepto, setObsPorDepto] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  // Estado del Editor de Impresión, Multi-Sucursal y Firmas Digitales
  const [mostrarEditorImpresion, setMostrarEditorImpresion] = useState(true);
  const [mostrarPadsFirmaEditor, setMostrarPadsFirmaEditor] = useState(false);
  const [sucursalesList, setSucursalesList] = useState<string[]>([]);
  const [tituloReporte, setTituloReporte] = useState(
    'RÍO SUPERMARKET • AUDITORÍA DE SISTEMAS'
  );
  const [subtituloReporte, setSubtituloReporte] = useState(
    'Gerencia de Tecnología • Control Operativo Diario por Departamento'
  );
  const [sedeTienda, setSedeTienda] = useState(
    'Río Supermarket — Las Mercedes (Caracas)'
  );
  const [analistaEdit, setAnalistaEdit] = useState('Ing. Analista de Sistemas');
  const [turnoEdit, setTurnoEdit] = useState('Apertura (08:00 AM a 17:00 PM)');
  const [fechaEdit, setFechaEdit] = useState('');
  const [recibidoPor, setRecibidoPor] = useState(
    'Coordinación de Sistemas / Gerencia de Tienda'
  );
  const [firmaAnalistaUrl, setFirmaAnalistaUrl] = useState<string | null>(null);
  const [firmaSupervisorUrl, setFirmaSupervisorUrl] = useState<string | null>(
    null
  );
  const [obsManuales, setObsManuales] = useState('');

  // Opciones de configuración de la hoja impresa / PDF
  const [incluirDetalleFallas, setIncluirDetalleFallas] = useState(true);
  const [incluirObsPorDepto, setIncluirObsPorDepto] = useState(true);
  const [incluirFirmas, setIncluirFirmas] = useState(true);
  const [ocultarDeptosSinItems, setOcultarDeptosSinItems] = useState(false);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);
      setSucursalesList(getSucursales());
      const extraMeta = getInspeccionExtraMeta(inspeccionId);
      setSedeTienda(extraMeta.sucursal);
      setRecibidoPor(extraMeta.recibidoPor);
      setFirmaAnalistaUrl(extraMeta.firmaAnalistaDataUrl);
      setFirmaSupervisorUrl(extraMeta.firmaSupervisorDataUrl);

      const [{ data: repData }, { data: busqData }] = await Promise.all([
        supabase
          .from('vw_reporte_inspeccion')
          .select('*')
          .eq('inspeccion_id', inspeccionId),
        supabase
          .from('vw_busqueda_auditorias')
          .select('*')
          .eq('inspeccion_id', inspeccionId),
      ]);

      if (repData && repData.length > 0) {
        setDatosReporte(repData);
        setAnalistaEdit(repData[0].analista_nombre || 'Analista de Sistemas');
        setTurnoEdit(
          repData[0].turno
            ? repData[0].turno.startsWith('Mañana')
              ? 'Apertura (08:00 AM a 17:00 PM)'
              : repData[0].turno.startsWith('Tarde')
              ? 'Intermedio (10:00 AM a 19:00 PM)'
              : repData[0].turno.includes('Nocturno')
              ? 'Cierre (15:00 PM a 23:59 PM)'
              : repData[0].turno
            : 'Apertura (08:00 AM a 17:00 PM)'
        );
        setFechaEdit(
          repData[0].fecha_operativa || getTodayStr(0)
        );
        setObsManuales(repData[0].observaciones_manuales || '');
      }

      if (busqData) {
        const conNovedad = (busqData as BusquedaAuditoriaRow[]).filter(
          (r) =>
            r.estado_item === 'FALLA' ||
            (r.observacion_item && r.observacion_item.trim().length > 0)
        );
        setDetallesFallas(conNovedad);
      }

      setObsPorDepto(getObservacionesPorDepto(inspeccionId));
      setLoading(false);
    }
    cargarDatos();
  }, [inspeccionId]);

  // Guardar cambios de observaciones o analista desde el editor de impresión
  async function handleGuardarCambiosEditor(nuevaObs: string) {
    setObsManuales(nuevaObs);
    await supabase
      .from('inspecciones')
      .update({
        observaciones_manuales: nuevaObs,
        analista_nombre: analistaEdit,
        turno: turnoEdit,
      })
      .eq('id', inspeccionId);
  }

  const filasVisibles = useMemo(() => {
    if (!ocultarDeptosSinItems) return datosReporte;
    return datosReporte.filter((d) => (d.total_items || 0) > 0);
  }, [datosReporte, ocultarDeptosSinItems]);

  const totalItemsConfiguradosGlobal = useMemo(
    () =>
      filasVisibles.reduce((acc, curr) => acc + (curr.total_items || 0), 0),
    [filasVisibles]
  );
  const totalEvaluadosGlobal = useMemo(
    () =>
      filasVisibles.reduce((acc, curr) => acc + (curr.total_evaluados || 0), 0),
    [filasVisibles]
  );
  const totalOkGlobal = useMemo(
    () => filasVisibles.reduce((acc, curr) => acc + (curr.total_ok || 0), 0),
    [filasVisibles]
  );
  const totalFallasGlobal = useMemo(
    () =>
      filasVisibles.reduce((acc, curr) => acc + (curr.total_fallas || 0), 0),
    [filasVisibles]
  );
  const promedioGlobal = useMemo(() => {
    if (filasVisibles.length === 0) return '100.0';
    return (
      filasVisibles.reduce(
        (acc, curr) => acc + Number(curr.porcentaje_cumplimiento || 0),
        0
      ) / filasVisibles.length
    ).toFixed(1);
  }, [filasVisibles]);

  // Generar PDF Ejecutivo respetando todas las ediciones de la Vista Previa
  function descargarPDF() {
    const doc = new jsPDF();

    // Encabezado Corporativo Río Supermarket (#087334 + #B2D034)
    doc.setFillColor(8, 115, 52);
    doc.rect(0, 0, 210, 27, 'F');
    doc.setFillColor(178, 208, 52);
    doc.rect(0, 27, 210, 2.5, 'F');

    try {
      doc.addImage(RIO_LOGO_WHITE_DATA_URL, 'PNG', 12, 3.5, 20, 20);
    } catch {
      // ignore
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12.5);
    doc.text(tituloReporte.toUpperCase(), 36, 13);
    doc.setFontSize(8.5);
    doc.setTextColor(178, 208, 52);
    doc.text(subtituloReporte, 36, 19);
    doc.setTextColor(255, 255, 255);
    doc.text(sedeTienda, 36, 24);

    doc.setFontSize(10);
    doc.text(`CASO: ${codigoCaso}`, 160, 14);
    doc.setFontSize(8.5);
    doc.text(`Cumplimiento: ${promedioGlobal}%`, 160, 20);

    // Metadatos del turno editables
    doc.setTextColor(8, 115, 52);
    doc.setFontSize(11);
    doc.text(
      `Reporte Diario Consolidado (${filasVisibles.length} Departamentos • ${totalItemsConfiguradosGlobal} Ítems)`,
      14,
      37
    );

    doc.setFontSize(8.5);
    doc.setTextColor(60, 70, 85);
    doc.text(`Fecha Operativa: ${fechaEdit}`, 14, 43);
    doc.text(`Analista Responsable: ${analistaEdit}`, 14, 48);
    doc.text(`Turno Operativo: ${turnoEdit}`, 115, 43);
    doc.text(
      `Ítems Evaluados: ${totalEvaluadosGlobal} de ${totalItemsConfiguradosGlobal} (${totalOkGlobal} OK / ${totalFallasGlobal} Fallas)`,
      115,
      48
    );

    // Tabla dinámica según la cantidad de ítems de cada departamento
    const tablaRows = filasVisibles.map((item) => [
      `#${item.departamento_orden || ''} ${item.departamento}`,
      item.total_items ?? item.total_evaluados,
      item.total_evaluados,
      item.total_ok,
      item.total_fallas,
      `${item.porcentaje_cumplimiento}%`,
    ]);

    const tableConfig = {
      startY: 53,
      head: [
        [
          'Departamento',
          'Total Ítems',
          'Evaluados',
          'OK',
          'Fallas',
          'Cumplimiento',
        ],
      ],
      body: tablaRows,
      theme: 'grid' as const,
      headStyles: { fillColor: [8, 115, 52] as [number, number, number] },
      styles: { fontSize: 8, cellPadding: 2.5 },
    };

    if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(tableConfig);
    } else {
      autoTable(doc, tableConfig);
    }

    let currentY = ((doc as any).lastAutoTable?.finalY || 175) + 8;

    // Detalle de fallas/observaciones por ítem si está activo
    if (incluirDetalleFallas && detallesFallas.length > 0) {
      doc.setFontSize(9.5);
      doc.setTextColor(219, 6, 23);
      doc.text(
        `Detalle de Incidencias y Observaciones por Ítem (${detallesFallas.length}):`,
        14,
        currentY
      );
      currentY += 5;
      doc.setFontSize(8);
      doc.setTextColor(60, 70, 85);
      for (const f of detallesFallas.slice(0, 8)) {
        const line = `• [${f.departamento_nombre}] ${f.item_descripcion} (${f.estado_item}): ${
          f.observacion_item || 'Sin nota adicional'
        }`;
        doc.text(line, 14, currentY, { maxWidth: 182 });
        currentY += 5;
      }
      currentY += 2;
    }

    // Observaciones Generales
    doc.setFontSize(9.5);
    doc.setTextColor(8, 115, 52);
    doc.text('Observaciones Generales y Cierre del Turno:', 14, currentY);
    doc.setFontSize(8.5);
    doc.setTextColor(60, 70, 85);
    doc.text(
      obsManuales || 'Sin observaciones adicionales registradas.',
      14,
      currentY + 5,
      { maxWidth: 182 }
    );

    if (incluirFirmas) {
      const firmaY = Math.min(currentY + 34, 275);
      // Estampar Firma Digital del Analista si existe
      if (firmaAnalistaUrl) {
        try {
          doc.addImage(firmaAnalistaUrl, 'PNG', 26, firmaY - 19, 55, 17);
        } catch {
          // ignore
        }
      }
      // Estampar Firma Digital del Supervisor / Gerencia si existe
      if (firmaSupervisorUrl) {
        try {
          doc.addImage(firmaSupervisorUrl, 'PNG', 126, firmaY - 19, 55, 17);
        } catch {
          // ignore
        }
      }
      doc.setDrawColor(148, 163, 184);
      doc.line(20, firmaY, 90, firmaY);
      doc.line(120, firmaY, 190, firmaY);
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Entregado por: ${analistaEdit}`, 25, firmaY + 5);
      doc.text(`Recibido por: ${recibidoPor}`, 125, firmaY + 5);
    }

    doc.save(`Reporte_Auditoria_Rio_${codigoCaso}.pdf`);
  }

  function compartirWhatsApp() {
    let mensaje = `🛒💚 *${tituloReporte}*\n`;
    mensaje += `📍 *Sede:* ${sedeTienda}\n`;
    mensaje += `🔹 *Caso:* ${codigoCaso} (${fechaEdit})\n`;
    mensaje += `👤 *Analista:* ${analistaEdit} (${turnoEdit})\n`;
    mensaje += `📦 *Ítems Evaluados:* ${totalEvaluadosGlobal}/${totalItemsConfiguradosGlobal}\n`;
    mensaje += `📊 *Cumplimiento Global:* ${promedioGlobal}%\n`;
    mensaje += `⚠️ *Total Fallas:* ${totalFallasGlobal}\n\n`;
    mensaje += `*Detalle por Departamento:*\n`;

    filasVisibles.forEach((d) => {
      mensaje += `• ${d.departamento}: ${d.total_evaluados}/${
        d.total_items ?? d.total_evaluados
      } ítems (${d.porcentaje_cumplimiento}% | ${d.total_fallas}F)\n`;
    });

    if (obsManuales) {
      mensaje += `\n📝 *Observaciones:* ${obsManuales}`;
    }

    const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      mensaje
    )}`;
    window.open(urlWhatsApp, '_blank');
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
        Preparando Editor de Impresión y Vista Previa del Reporte Diario...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Barra superior de acciones rápidas (Se oculta al imprimir con window.print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border-2 border-[#087334]/20 print:hidden">
        <button
          id="btn-volver-checklist"
          type="button"
          onClick={onVolver}
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#087334] hover:bg-[#087334]/10 px-3 py-2 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver a Departamentos e Ítems
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarEditorImpresion((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-2 rounded-xl border transition cursor-pointer ${
              mostrarEditorImpresion
                ? 'bg-[#087334] text-white border-[#087334]'
                : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal size={14} />
            {mostrarEditorImpresion
              ? 'Ocultar Editor de Impresión'
              : 'Editar Impresión'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <Printer size={14} /> Imprimir Hoja
          </button>

          <button
            type="button"
            onClick={descargarPDF}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#B2D034] hover:bg-[#9fbb29] text-[#042f16] px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
          >
            <FileDown size={15} /> Descargar PDF
          </button>
        </div>
      </div>

      {/* PANEL EDITOR DE IMPRESIÓN (Personalización antes de imprimir/exportar) */}
      {mostrarEditorImpresion && (
        <section className="bg-white rounded-2xl border-2 border-[#087334]/25 p-4 sm:p-5 shadow-sm space-y-4 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-[#087334]" />
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Editor de Impresión del Reporte Diario
                </h2>
                <p className="text-xs text-slate-500">
                  Modifica sucursal, títulos, responsables, firmas digitales y
                  observaciones; los cambios se ven en vivo abajo
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#B2D034]/30 text-[#042f16] px-2.5 py-1 rounded-lg">
              <Eye size={13} /> Vista Previa en Vivo Activa
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Encabezado Principal del Reporte
              </label>
              <input
                type="text"
                value={tituloReporte}
                onChange={(e) => setTituloReporte(e.target.value)}
                className="w-full border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-slate-900 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Subtítulo Institucional
              </label>
              <input
                type="text"
                value={subtituloReporte}
                onChange={(e) => setSubtituloReporte(e.target.value)}
                className="w-full border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Sede / Sucursal Río Supermarket
              </label>
              <select
                value={sedeTienda}
                onChange={(e) => {
                  const val = e.target.value;
                  setSedeTienda(val);
                  saveInspeccionExtraMeta(inspeccionId, { sucursal: val });
                }}
                className="w-full border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-slate-900 font-semibold bg-white"
              >
                {!sucursalesList.includes(sedeTienda) && (
                  <option value={sedeTienda}>{sedeTienda}</option>
                )}
                {sucursalesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Analista Responsable (Firma Entrega)
              </label>
              <input
                type="text"
                value={analistaEdit}
                onChange={(e) => setAnalistaEdit(e.target.value)}
                className="w-full border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-slate-900 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                Recibido Por (Firma Recepción)
              </label>
              <input
                type="text"
                value={recibidoPor}
                onChange={(e) => {
                  const val = e.target.value;
                  setRecibidoPor(val);
                  saveInspeccionExtraMeta(inspeccionId, { recibidoPor: val });
                }}
                className="w-full border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Turno</label>
                <select
                  value={turnoEdit}
                  onChange={(e) => setTurnoEdit(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-2.5 py-2 text-slate-900 font-semibold"
                >
                  <option value="Apertura (08:00 AM a 17:00 PM)">
                    Apertura (08:00 AM a 17:00 PM)
                  </option>
                  <option value="Intermedio (10:00 AM a 19:00 PM)">
                    Intermedio (10:00 AM a 19:00 PM)
                  </option>
                  <option value="Cierre (15:00 PM a 23:59 PM)">
                    Cierre (15:00 PM a 23:59 PM)
                  </option>
                  <option value="Completo (08:00 AM a 23:59 PM)">
                    Completo (08:00 AM a 23:59 PM)
                  </option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Fecha</label>
                <input
                  type="date"
                  value={fechaEdit}
                  onChange={(e) => setFechaEdit(e.target.value)}
                  className="w-full border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-2.5 py-2 text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Edición en vivo de las Observaciones Generales del Reporte */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Observaciones Generales y Conclusiones que saldrán impresas:
            </label>
            <textarea
              rows={2}
              value={obsManuales}
              onChange={(e) => handleGuardarCambiosEditor(e.target.value)}
              placeholder="Escribe o edita aquí las observaciones generales para la impresión..."
              className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-[#087334] focus:bg-white"
            />
          </div>

          {/* Opciones de visualización en la hoja impresa + Botón para abrir/editar Firmas Digitales */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs font-bold text-slate-700">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirDetalleFallas}
                  onChange={(e) => setIncluirDetalleFallas(e.target.checked)}
                  className="accent-[#087334]"
                />
                Incluir detalle de fallas/notas por ítem
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirObsPorDepto}
                  onChange={(e) => setIncluirObsPorDepto(e.target.checked)}
                  className="accent-[#087334]"
                />
                Incluir observaciones por departamento
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirFirmas}
                  onChange={(e) => setIncluirFirmas(e.target.checked)}
                  className="accent-[#087334]"
                />
                Incluir firmas de entrega y recepción
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ocultarDeptosSinItems}
                  onChange={(e) => setOcultarDeptosSinItems(e.target.checked)}
                  className="accent-[#087334]"
                />
                Ocultar departamentos con 0 ítems
              </label>
            </div>

            <button
              type="button"
              onClick={() => setMostrarPadsFirmaEditor((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#087334]/10 hover:bg-[#087334]/20 text-[#087334] px-3 py-1.5 rounded-xl border border-[#087334]/30 cursor-pointer"
            >
              <PenTool size={13} />
              {mostrarPadsFirmaEditor
                ? 'Ocultar Pizarras de Firma'
                : 'Firmar en Pantalla Aquí'}
            </button>
          </div>

          {mostrarPadsFirmaEditor && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <FirmaDigitalCanvas
                titulo="Firma del Analista de Sistemas"
                subtitulo={analistaEdit}
                initialDataUrl={firmaAnalistaUrl}
                onChange={(url) => {
                  setFirmaAnalistaUrl(url);
                  saveInspeccionExtraMeta(inspeccionId, {
                    firmaAnalistaDataUrl: url,
                  });
                }}
              />
              <FirmaDigitalCanvas
                titulo="Firma de Conformidad / Gerencia"
                subtitulo={recibidoPor}
                initialDataUrl={firmaSupervisorUrl}
                onChange={(url) => {
                  setFirmaSupervisorUrl(url);
                  saveInspeccionExtraMeta(inspeccionId, {
                    firmaSupervisorDataUrl: url,
                  });
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* HOJA DE VISTA PREVIA DE IMPRESIÓN EN VIVO (Formato Documento Ejecutivo A4) */}
      <section
        aria-label="Vista Previa de Impresión"
        className="bg-white rounded-2xl shadow-xl border-2 border-[#087334]/30 overflow-hidden print:shadow-none print:border-0"
      >
        {/* Cabezal Oficial Río Supermarket idéntico al PDF */}
        <div className="bg-[#087334] text-white px-6 py-5 border-b-4 border-[#B2D034] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <RioLogo variant="color" size={52} />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wide uppercase text-white">
                {tituloReporte}
              </h1>
              <p className="text-xs text-[#B2D034] font-semibold">
                {subtituloReporte}
              </p>
              <p className="text-[11px] text-white/85 mt-0.5">{sedeTienda}</p>
            </div>
          </div>

          <div className="sm:text-right space-y-1">
            <span className="inline-block font-mono font-black text-xs sm:text-sm bg-[#B2D034] text-[#042f16] px-3 py-1 rounded-lg">
              CASO: {codigoCaso}
            </span>
            <p className="text-xs text-white/90 font-mono">
              Fecha: {fechaEdit}
            </p>
          </div>
        </div>

        {/* Cuerpo de la Hoja de Vista Previa */}
        <div className="p-6 space-y-5">
          {/* Ficha Técnica del Turno y Resumen según Cantidad de Ítems */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Analista Responsable
              </span>
              <strong className="text-slate-900">{analistaEdit}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Turno Operativo
              </span>
              <strong className="text-slate-900">{turnoEdit}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Cantidad Total de Ítems
              </span>
              <strong className="font-mono text-[#087334]">
                {totalEvaluadosGlobal} evaluados de{' '}
                {totalItemsConfiguradosGlobal} ítems
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Cumplimiento Diario
              </span>
              <strong className="font-mono text-sm text-[#087334]">
                {promedioGlobal}% ({totalOkGlobal} OK / {totalFallasGlobal}{' '}
                Fallas)
              </strong>
            </div>
          </div>

          {/* Tabla Consolidada por Departamento (Dependiendo de la cantidad de ítems de cada uno) */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#087334] text-white uppercase text-[11px]">
                  <th className="py-2.5 px-3">Departamento</th>
                  <th className="py-2.5 px-3 text-center">Cant. Ítems</th>
                  <th className="py-2.5 px-3 text-center">Evaluados</th>
                  <th className="py-2.5 px-3 text-center">OK</th>
                  <th className="py-2.5 px-3 text-center">Fallas</th>
                  <th className="py-2.5 px-3 text-right">Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filasVisibles.map((d, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/80 transition font-medium"
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      #{d.departamento_orden || idx + 1} {d.departamento}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                      {d.total_items ?? d.total_evaluados}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {d.total_evaluados}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#087334]">
                      {d.total_ok}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      {d.total_fallas > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#DB0617] bg-[#DB0617]/10 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} /> {d.total_fallas}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold">
                      <span
                        className={`px-2 py-0.5 rounded-md ${
                          Number(d.porcentaje_cumplimiento) >= 90
                            ? 'bg-[#087334]/15 text-[#087334]'
                            : Number(d.porcentaje_cumplimiento) >= 70
                            ? 'bg-[#B2D034]/35 text-[#042f16]'
                            : 'bg-[#DB0617]/15 text-[#DB0617]'
                        }`}
                      >
                        {d.porcentaje_cumplimiento}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detalle de Fallas y Notas por Ítem */}
          {incluirDetalleFallas && detallesFallas.length > 0 && (
            <div className="space-y-2 p-4 rounded-xl bg-[#DB0617]/5 border border-[#DB0617]/25">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#DB0617]">
                Detalle de Incidencias y Observaciones por Ítem (
                {detallesFallas.length})
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-800">
                {detallesFallas.map((f) => (
                  <li
                    key={`${f.inspeccion_id}-${f.item_id}`}
                    className="flex items-start gap-2"
                  >
                    <span className="font-mono font-bold text-[#DB0617] shrink-0">
                      [{f.departamento_nombre}]
                    </span>
                    <span>
                      <strong>{f.item_descripcion}:</strong>{' '}
                      {f.observacion_item || 'Marcado con falla en revisión.'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Observaciones por Departamento (si se agregaron después de los ítems) */}
          {incluirObsPorDepto &&
            Object.entries(obsPorDepto).some(
              ([, txt]) => txt && txt.trim().length > 0
            ) && (
              <div className="space-y-2 p-4 rounded-xl bg-[#087334]/5 border border-[#087334]/20">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#087334]">
                  Observaciones Registradas por Departamento
                </h3>
                <ul className="space-y-1 text-xs text-slate-700">
                  {Object.entries(obsPorDepto)
                    .filter(([, txt]) => txt && txt.trim().length > 0)
                    .map(([dId, txt]) => {
                      const nom =
                        datosReporte.find(
                          (d) => Number(d.departamento_id) === Number(dId)
                        )?.departamento || `Depto #${dId}`;
                      return (
                        <li key={dId}>
                          <strong className="text-[#087334]">{nom}:</strong>{' '}
                          {txt}
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

          {/* Observaciones Generales del Turno */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#087334] flex items-center gap-1.5">
              <ShieldCheck size={14} /> Observaciones Generales del Turno
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line">
              {obsManuales ||
                'Sin observaciones manuales registradas para este turno.'}
            </p>
          </div>

          {/* Bloque de Firmas al Pie de la Vista Previa (con Firma Digital Estampada) */}
          {incluirFirmas && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 pb-2">
              <div className="text-center text-xs flex flex-col items-center">
                <div className="h-16 flex items-end justify-center pb-1">
                  {firmaAnalistaUrl ? (
                    <img
                      src={firmaAnalistaUrl}
                      alt="Firma Analista"
                      className="max-h-14 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] italic text-slate-300">
                      (Sin firma digital registrada)
                    </span>
                  )}
                </div>
                <div className="w-full border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">{analistaEdit}</p>
                  <p className="text-[11px] text-slate-500">
                    Analista de Sistemas • Entrega de Guardia
                  </p>
                </div>
              </div>
              <div className="text-center text-xs flex flex-col items-center">
                <div className="h-16 flex items-end justify-center pb-1">
                  {firmaSupervisorUrl ? (
                    <img
                      src={firmaSupervisorUrl}
                      alt="Firma Conformidad"
                      className="max-h-14 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] italic text-slate-300">
                      (Sin firma digital registrada)
                    </span>
                  )}
                </div>
                <div className="w-full border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">{recibidoPor}</p>
                  <p className="text-[11px] text-slate-500">
                    Conformidad y Recepción • {sedeTienda}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Botonera Inferior para Exportar PDF, Imprimir o Enviar por WhatsApp */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
        <button
          id="btn-descargar-pdf"
          type="button"
          onClick={descargarPDF}
          className="bg-[#087334] hover:bg-[#065928] border-2 border-[#B2D034] text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer"
        >
          <FileDown size={18} className="text-[#B2D034]" />
          Descargar PDF con Vista Previa
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer"
        >
          <Printer size={18} className="text-[#B2D034]" />
          Imprimir Reporte Directo
        </button>

        <button
          id="btn-compartir-whatsapp"
          type="button"
          onClick={compartirWhatsApp}
          className="bg-[#B2D034] hover:bg-[#9fb92d] text-[#053316] font-extrabold py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer"
        >
          <MessageSquareShare size={18} />
          Enviar Resumen a WhatsApp
        </button>
      </div>
    </div>
  );
}
