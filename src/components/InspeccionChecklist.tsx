'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  supabase,
  Departamento,
  ChecklistItem,
  Inspeccion,
  InspeccionDetalle,
  getObservacionesPorDepto,
  saveObservacionDepto,
  getSucursales,
  getSucursalesObj,
  addSucursal,
  getAnalistasPorSucursal,
  crearAnalistaSucursal,
  actualizarAnalistaSucursal,
  eliminarAnalistaSucursal,
  getJefesPorSucursal,
  crearJefeSucursal,
  actualizarJefeSucursal,
  eliminarJefeSucursal,
  getPinJefe,
  savePinJefe,
  cargarLotePersonalSucursal,
  RolUsuarioSistema,
  UsuarioRolBD,
  getUsuariosRoles,
  crearOActualizarUsuarioRol,
  eliminarUsuarioRol,
  getInspeccionExtraMeta,
  saveInspeccionExtraMeta,
  InspeccionExtraMeta,
  esInspeccionEditablePorFechaYRol,
  SucursalRio,
  AnalistaSistemas,
  JefeEncargado,
  getTodosAnalistas,
  getTodosJefes,
  sincronizarPersonalDesdeCloud,
  importarFilasPersonal,
  analizarCsvPersonal,
  generarCsvPersonal,
  ResultadoAnalisisCsv,
  normalizarTurnoOficial,
} from '@/lib/supabase';
import FirmaDigitalCanvas from '@/components/FirmaDigitalCanvas';
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
  ChevronDown,
  PlusCircle,
  FileCheck2,
  ClipboardList,
  Sparkles,
  Pencil,
  Trash2,
  Plus,
  Building2,
  Check,
  X,
  MessageSquarePlus,
  UserCheck,
  Clock,
  Store,
  PenTool,
  Users,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Crown,
  Eye,
  History,
  Download,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';

interface InspeccionChecklistProps {
  departamentos: Departamento[];
  items: ChecklistItem[];
  inspeccionActiva: Inspeccion;
  inspeccionesDisponibles: Inspeccion[];
  rolUsuario?: RolUsuarioSistema;
  onCambiarRol?: (nuevoRol: RolUsuarioSistema) => void;
  onCambiarInspeccion: (inspeccionId: string) => void;
  onCrearNuevaInspeccion: (
    analista: string,
    turno: string,
    extraMeta?: Partial<InspeccionExtraMeta>
  ) => Promise<void>;
  onFinalizarYVerReporte: (inspeccionId: string, codigoCaso: string) => void;
  onIrAEvaluacionesAnteriores?: () => void;
  onDatosActualizados: () => void;
}

export default function InspeccionChecklist({
  departamentos,
  items,
  inspeccionActiva,
  inspeccionesDisponibles,
  rolUsuario = 'ANALISTA',
  onCambiarRol,
  onCambiarInspeccion,
  onCrearNuevaInspeccion,
  onFinalizarYVerReporte,
  onIrAEvaluacionesAnteriores,
  onDatosActualizados,
}: InspeccionChecklistProps) {
  const [deptoActivoId, setDeptoActivoId] = useState<number>(
    departamentos[0]?.id || 1
  );
  const [dropdownDeptoAbierto, setDropdownDeptoAbierto] = useState(false);

  const [detallesMap, setDetallesMap] = useState<
    Record<number, InspeccionDetalle>
  >({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [guardandoItemId, setGuardandoItemId] = useState<number | null>(null);
  const [subiendoFotoItemId, setSubiendoFotoItemId] = useState<number | null>(
    null
  );
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);

  // Datos editables en vivo de Analista, Turno, Sucursal, Jefe Encargado, Firmas y Observaciones
  const [analistaActual, setAnalistaActual] = useState<string>(
    inspeccionActiva.analista_nombre || 'Ing. Analista de Sistemas'
  );
  const [turnoActual, setTurnoActual] = useState<string>(
    inspeccionActiva.turno || 'Apertura (08:00 AM a 17:00 PM)'
  );
  const [obsManuales, setObsManuales] = useState<string>(
    inspeccionActiva.observaciones_manuales || ''
  );
  const [obsPorDepto, setObsPorDepto] = useState<Record<number, string>>({});
  const [itemsConNotaAbierta, setItemsConNotaAbierta] = useState<
    Record<number, boolean>
  >({});
  const [cerrandoInspeccion, setCerrandoInspeccion] = useState(false);

  // Multi-Sucursal (23 Sedes Reales de Río) + Personal Exclusivo por Sucursal + Firmas Digitales
  const [sucursalesObjList, setSucursalesObjList] = useState<SucursalRio[]>(
    () => getSucursalesObj()
  );
  const [sucursalesList, setSucursalesList] = useState<string[]>(() =>
    getSucursales()
  );
  const [sucursalIdActual, setSucursalIdActual] = useState<number>(() =>
    getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
      .sucursalId
  );
  const [sucursalActual, setSucursalActual] = useState<string>(() =>
    getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
      .sucursal
  );
  const [analistaIdActual, setAnalistaIdActual] = useState<number | null>(() =>
    getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
      .analistaId
  );
  const [jefeIdActual, setJefeIdActual] = useState<number | null>(() =>
    getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
      .jefeEncargadoId
  );
  const [recibidoPorActual, setRecibidoPorActual] = useState<string>(() =>
    getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
      .recibidoPor
  );
  const [firmaAnalistaUrl, setFirmaAnalistaUrl] = useState<string | null>(() =>
    getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
      .firmaAnalistaDataUrl
  );
  const [firmaSupervisorUrl, setFirmaSupervisorUrl] = useState<string | null>(
    () =>
      getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
        .firmaSupervisorDataUrl
  );
  const [mostrarInputNuevaSucursal, setMostrarInputNuevaSucursal] =
    useState(false);
  const [nuevaSucursalNombre, setNuevaSucursalNombre] = useState('');

  // Listas exclusivas de la Sucursal Activa (Sin cruzar información entre tiendas)
  const [analistasDeSede, setAnalistasDeSede] = useState<AnalistaSistemas[]>(
    () =>
      getAnalistasPorSucursal(
        getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
          .sucursalId
      )
  );
  const [jefesDeSede, setJefesDeSede] = useState<JefeEncargado[]>(() =>
    getJefesPorSucursal(
      getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
        .sucursalId
    )
  );

  // Rol de Usuario en Sistema: COORDINADOR (Superadmin / Jefe Encargado) vs ANALISTA (Operativo sin tocar sedes ni personal)
  const [modoJefeActivo, setModoJefeActivo] = useState(
    rolUsuario === 'COORDINADOR'
  );
  useEffect(() => {
    setModoJefeActivo(rolUsuario === 'COORDINADOR');
    if (rolUsuario === 'ANALISTA') {
      setMostrarRapidoAnalista(false);
      setMostrarRapidoJefe(false);
      setMostrarInputNuevaSucursal(false);
    }
  }, [rolUsuario]);

  // Regla de Cierre Automático por Día:
  // - Mismo día (fecha_operativa === hoy): Modificable por Analista y Jefe Encargado
  // - Otro día (fecha_operativa !== hoy): Cerrada automáticamente en Solo Vista para Analista; Modificable solo por Jefe Encargado
  const permisoEdicion = useMemo(
    () =>
      esInspeccionEditablePorFechaYRol(
        inspeccionActiva,
        modoJefeActivo ? 'COORDINADOR' : 'ANALISTA'
      ),
    [inspeccionActiva, modoJefeActivo]
  );
  const soloVista = !permisoEdicion.editable;

  const [modalPinJefeAbierto, setModalPinJefeAbierto] = useState(false);
  const [pinIngresado, setPinIngresado] = useState('');
  const [errorPinJefe, setErrorPinJefe] = useState('');
  const [accionTrasDesbloqueo, setAccionTrasDesbloqueo] = useState<
    'PANEL' | 'SUPLENCIA_ANALISTA' | 'NUEVO_JEFE' | 'SOLO_DESBLOQUEAR'
  >('SOLO_DESBLOQUEAR');
  const [nuevoPinConfig, setNuevoPinConfig] = useState('');
  const [mensajePinGuardado, setMensajePinGuardado] = useState(false);

  // Tabla usuarios_roles en BD (Para que el Coordinador Superadmin asigne roles por correo)
  const [usuariosRolesList, setUsuariosRolesList] = useState<UsuarioRolBD[]>(
    () => getUsuariosRoles()
  );
  const [nuevoRolEmail, setNuevoRolEmail] = useState('');
  const [nuevoRolNombre, setNuevoRolNombre] = useState('');
  const [nuevoRolTipo, setNuevoRolTipo] =
    useState<RolUsuarioSistema>('ANALISTA');

  // Opción 5 (Exclusiva Rol COORDINADOR Superadmin): Botón rápido "+ Nuevo en esta Sede" directo en el selector del turno
  const [mostrarRapidoAnalista, setMostrarRapidoAnalista] = useState(false);
  const [rapidoAnalistaNombre, setRapidoAnalistaNombre] = useState('');
  const [mostrarRapidoJefe, setMostrarRapidoJefe] = useState(false);
  const [rapidoJefeNombre, setRapidoJefeNombre] = useState('');

  // Opción 1 (Exclusiva Rol COORDINADOR Superadmin): Panel Visual de Personal por Sucursal + Importación CSV
  const [modalPersonalAbierto, setModalPersonalAbierto] = useState(false);
  const [nuevoAnalistaNombreSede, setNuevoAnalistaNombreSede] = useState('');
  const [nuevoAnalistaCedulaSede, setNuevoAnalistaCedulaSede] = useState('');
  const [nuevoAnalistaEmailSede, setNuevoAnalistaEmailSede] = useState('');
  const [nuevoAnalistaCargoSede, setNuevoAnalistaCargoSede] = useState(
    'Analista de Sistemas'
  );
  const [nuevoAnalistaTurnoSede, setNuevoAnalistaTurnoSede] = useState(
    'Apertura (08:00 AM a 17:00 PM)'
  );
  const [nuevoJefeNombreSede, setNuevoJefeNombreSede] = useState('');
  const [nuevoJefeCedulaSede, setNuevoJefeCedulaSede] = useState('');
  const [nuevoJefeEmailSede, setNuevoJefeEmailSede] = useState('');
  const [nuevoJefeCargoSede, setNuevoJefeCargoSede] = useState(
    'Coordinador / Jefe Encargado de Tienda'
  );
  const [editandoAnalistaId, setEditandoAnalistaId] = useState<number | null>(
    null
  );
  const [editAnalistaNombre, setEditAnalistaNombre] = useState('');
  const [editAnalistaCedula, setEditAnalistaCedula] = useState('');
  const [editAnalistaEmail, setEditAnalistaEmail] = useState('');
  const [editAnalistaCargo, setEditAnalistaCargo] = useState('');
  const [editAnalistaTurno, setEditAnalistaTurno] = useState('');
  const [editandoJefeId, setEditandoJefeId] = useState<number | null>(null);
  const [editJefeNombre, setEditJefeNombre] = useState('');
  const [editJefeCedula, setEditJefeCedula] = useState('');
  const [editJefeEmail, setEditJefeEmail] = useState('');
  const [editJefeCargo, setEditJefeCargo] = useState('');
  const [mostrarCargaLote, setMostrarCargaLote] = useState(false);
  const [loteTipo, setLoteTipo] = useState<'ANALISTAS' | 'JEFES'>('ANALISTAS');
  const [loteTexto, setLoteTexto] = useState('');
  const [mostrarImportarCsv, setMostrarImportarCsv] = useState(false);
  const [resultadoCsv, setResultadoCsv] =
    useState<ResultadoAnalisisCsv | null>(null);
  const [importandoCsv, setImportandoCsv] = useState(false);
  const [mensajeResultadoCsv, setMensajeResultadoCsv] = useState<string | null>(
    null
  );

  function descargarArchivoCsv(nombreArchivo: string, contenido: string) {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleDescargarPlantillaCsv() {
    const sucActualObj =
      sucursalesObjList.find((s) => s.id === sucursalIdActual) ||
      sucursalesObjList[0];
    const codEjemplo = sucActualObj?.codigo || 'RIO-TER';
    const plantilla = generarCsvPersonal([
      {
        tipo: 'ANALISTA',
        sucursal_codigo: codEjemplo,
        nombre_completo: 'Ing. Nombre Apellido',
        cedula: 'V-12345678',
        email: 'analista.sede@riosupermarket.com',
        cargo: 'Analista de Sistemas',
        turno: 'Apertura',
      },
      {
        tipo: 'JEFE',
        sucursal_codigo: codEjemplo,
        nombre_completo: 'Lic. Nombre Apellido',
        cedula: 'V-87654321',
        email: 'gerencia.sede@riosupermarket.com',
        cargo: 'Jefe Encargado de Tienda',
        turno: '',
      },
    ]);
    descargarArchivoCsv('plantilla_personal_rio.csv', plantilla);
  }

  function handleExportarPersonalActualCsv() {
    const sucs = getSucursalesObj();
    const mapaCodigo = new Map(sucs.map((s) => [s.id, s.codigo]));
    const filas = [
      ...getTodosAnalistas().map((a) => ({
        tipo: 'ANALISTA' as const,
        sucursal_codigo: mapaCodigo.get(a.sucursal_id) || String(a.sucursal_id),
        nombre_completo: a.nombre_completo,
        cedula: a.cedula || '',
        email: a.email || '',
        cargo: a.cargo,
        turno: a.turno_habitual,
      })),
      ...getTodosJefes().map((j) => ({
        tipo: 'JEFE' as const,
        sucursal_codigo: mapaCodigo.get(j.sucursal_id) || String(j.sucursal_id),
        nombre_completo: j.nombre_completo,
        cedula: j.cedula || '',
        email: j.email || '',
        cargo: j.cargo,
        turno: '',
      })),
    ];
    descargarArchivoCsv('personal_rio_23_sucursales.csv', generarCsvPersonal(filas));
  }

  function handleAnalizarTextoCsv(texto: string) {
    setMensajeResultadoCsv(null);
    const existentes = [
      ...getTodosAnalistas().map((a) => ({
        tipo: 'ANALISTA' as const,
        id: a.id,
        cedula: a.cedula,
      })),
      ...getTodosJefes().map((j) => ({
        tipo: 'JEFE' as const,
        id: j.id,
        cedula: j.cedula,
      })),
    ];
    const res = analizarCsvPersonal(
      texto,
      getSucursalesObj(),
      existentes,
      normalizarTurnoOficial
    );
    setResultadoCsv(res);
  }

  // Estados CRUD de Ítems
  const [mostrarFormNuevoItem, setMostrarFormNuevoItem] = useState(false);
  const [nuevoItemDesc, setNuevoItemDesc] = useState('');
  const [nuevoItemCritico, setNuevoItemCritico] = useState(false);

  const [itemEditandoId, setItemEditandoId] = useState<number | null>(null);
  const [editItemDesc, setEditItemDesc] = useState('');
  const [editItemCritico, setEditItemCritico] = useState(false);

  // Estados CRUD de Departamentos
  const [modalDeptoCrud, setModalDeptoCrud] = useState<
    'CREAR' | 'EDITAR' | null
  >(null);
  const [formDeptoNombre, setFormDeptoNombre] = useState('');
  const [formDeptoTipo, setFormDeptoTipo] = useState('OFICINA');

  // Modal de Nueva Inspección (Con Sucursal Oficial y Personal exclusivo de esa Sucursal)
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaSucursalModalId, setNuevaSucursalModalId] = useState<number>(
    () =>
      getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
        .sucursalId || 1
  );
  const [nuevoAnalistaModalId, setNuevoAnalistaModalId] = useState<number>(
    () =>
      getAnalistasPorSucursal(
        getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
          .sucursalId || 1
      )[0]?.id || 101
  );
  const [nuevoJefeModalId, setNuevoJefeModalId] = useState<number>(
    () =>
      getJefesPorSucursal(
        getInspeccionExtraMeta(inspeccionActiva.id, inspeccionActiva as any)
          .sucursalId || 1
      )[0]?.id || 10001
  );
  const [nuevoTurno, setNuevoTurno] = useState('Apertura (08:00 AM a 17:00 PM)');

  // Asegurar que deptoActivoId siempre apunte a un departamento válido
  useEffect(() => {
    if (
      departamentos.length > 0 &&
      !departamentos.some((d) => d.id === deptoActivoId)
    ) {
      setDeptoActivoId(departamentos[0].id);
    }
  }, [departamentos, deptoActivoId]);

  // Cargar detalles, sucursal, analistas exclusivos de esa sede, jefes encargados y firmas de la inspección activa
  useEffect(() => {
    const extraMeta = getInspeccionExtraMeta(
      inspeccionActiva.id,
      inspeccionActiva as any
    );
    const analistasSedeActual = getAnalistasPorSucursal(extraMeta.sucursalId);
    const jefesSedeActual = getJefesPorSucursal(extraMeta.sucursalId);
    const analistaDeEstaSede =
      analistasSedeActual.find((a) => a.id === extraMeta.analistaId) ||
      analistasSedeActual.find((a) => a.disponible) ||
      analistasSedeActual[0] ||
      null;

    setAnalistaActual(
      analistaDeEstaSede?.nombre_completo ||
        inspeccionActiva.analista_nombre ||
        'Ing. Analista de Sistemas'
    );
    setTurnoActual(inspeccionActiva.turno || 'Apertura (08:00 AM a 17:00 PM)');
    setObsManuales(inspeccionActiva.observaciones_manuales || '');
    setObsPorDepto(getObservacionesPorDepto(inspeccionActiva.id));
    setSucursalesObjList(getSucursalesObj());
    setSucursalesList(getSucursales());
    setSucursalIdActual(extraMeta.sucursalId);
    setSucursalActual(extraMeta.sucursal);
    setAnalistaIdActual(analistaDeEstaSede?.id || extraMeta.analistaId);
    setJefeIdActual(extraMeta.jefeEncargadoId);
    setRecibidoPorActual(extraMeta.recibidoPor);
    setFirmaAnalistaUrl(extraMeta.firmaAnalistaDataUrl);
    setFirmaSupervisorUrl(extraMeta.firmaSupervisorDataUrl);
    setAnalistasDeSede(analistasSedeActual);
    setJefesDeSede(jefesSedeActual);

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

  // Sincronizar cambio de Analista o Turno en vivo con la inspección activa
  async function handleActualizarAnalistaOTurno(
    nuevoNombre: string,
    nuevoT: string
  ) {
    if (soloVista) return;
    setAnalistaActual(nuevoNombre);
    setTurnoActual(nuevoT);
    await supabase
      .from('inspecciones')
      .update({
        analista_nombre: nuevoNombre,
        turno: nuevoT,
      })
      .eq('id', inspeccionActiva.id);
    setUltimoGuardado(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    onDatosActualizados();
  }

  // Upsert en tiempo real de un ítem en inspeccion_detalles
  async function handleMarcarEstado(
    itemId: number,
    nuevoEstado: 'OK' | 'FALLA' | 'NA'
  ) {
    if (soloVista) return;
    setGuardandoItemId(itemId);
    const actual = detallesMap[itemId];

    const payload = {
      inspeccion_id: inspeccionActiva.id,
      item_id: itemId,
      estado: nuevoEstado,
      observacion_item: actual?.observacion_item || null,
      evidencia_url: actual?.evidencia_url || null,
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

  // Upsert en tiempo real de la observación de un ítem
  async function handleActualizarObservacionItem(
    itemId: number,
    texto: string
  ) {
    if (soloVista) return;
    const actual = detallesMap[itemId] || {
      id: 0,
      inspeccion_id: inspeccionActiva.id,
      item_id: itemId,
      estado: 'OK' as const,
      observacion_item: texto,
      evidencia_url: null,
      registrado_at: new Date().toISOString(),
    };

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

  // Subida de foto desde cámara móvil al bucket privado evidencias-auditoria
  async function handleSubirEvidenciaCamara(itemId: number, file: File | null) {
    if (soloVista || !file) return;
    setSubiendoFotoItemId(itemId);

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${inspeccionActiva.id}/${itemId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('evidencias-auditoria')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (!uploadError) {
      const actual = detallesMap[itemId];
      const { data: updatedRow } = await supabase
        .from('inspeccion_detalles')
        .upsert(
          {
            inspeccion_id: inspeccionActiva.id,
            item_id: itemId,
            estado: actual?.estado || 'FALLA',
            observacion_item:
              actual?.observacion_item ||
              'Evidencia fotográfica adjunta desde cámara móvil.',
            evidencia_url: filePath,
            registrado_at: new Date().toISOString(),
          },
          { onConflict: 'inspeccion_id,item_id' }
        )
        .select('*')
        .single();

      if (updatedRow) {
        setDetallesMap((prev) => ({
          ...prev,
          [itemId]: updatedRow as InspeccionDetalle,
        }));
      }

      const { data: signed } = await supabase.storage
        .from('evidencias-auditoria')
        .createSignedUrl(filePath, 3600);

      if (signed?.signedUrl) {
        setSignedUrls((prev) => ({
          ...prev,
          [filePath]: signed.signedUrl,
        }));
      }
      onDatosActualizados();
    }

    setSubiendoFotoItemId(null);
  }

  // Guardar observaciones generales y por departamento en tiempo real
  async function handleGuardarObsGenerales(texto: string) {
    if (soloVista) return;
    setObsManuales(texto);
    await supabase
      .from('inspecciones')
      .update({ observaciones_manuales: texto })
      .eq('id', inspeccionActiva.id);
    setUltimoGuardado(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }

  async function handleGuardarObsDepartamento(deptoId: number, texto: string) {
    if (soloVista) return;
    const nextMap = { ...obsPorDepto, [deptoId]: texto };
    setObsPorDepto(nextMap);
    saveObservacionDepto(inspeccionActiva.id, deptoId, texto);
    setUltimoGuardado(
      new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }

  // Marcar todos los ítems pendientes del departamento actual como OK
  async function handleMarcarRestantesDeptoOk() {
    if (soloVista) return;
    const itemsDepto = items.filter((i) => i.departamento_id === deptoActivoId);
    for (const item of itemsDepto) {
      if (!detallesMap[item.id]) {
        await handleMarcarEstado(item.id, 'OK');
      }
    }
  }

  // =========================================================================
  // CRUD DE ÍTEMS DEL DEPARTAMENTO SELECCIONADO
  // =========================================================================
  async function handleCrearItem(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoItemDesc.trim()) return;
    await supabase.from('checklist_items').insert({
      departamento_id: deptoActivoId,
      descripcion: nuevoItemDesc.trim(),
      es_critico: nuevoItemCritico,
      activo: true,
    });
    setNuevoItemDesc('');
    setNuevoItemCritico(false);
    setMostrarFormNuevoItem(false);
    onDatosActualizados();
  }

  async function handleGuardarEdicionItem(itemId: number) {
    if (!editItemDesc.trim()) return;
    await supabase
      .from('checklist_items')
      .update({
        descripcion: editItemDesc.trim(),
        es_critico: editItemCritico,
      })
      .eq('id', itemId);
    setItemEditandoId(null);
    onDatosActualizados();
  }

  async function handleEliminarItem(itemId: number) {
    await supabase.from('checklist_items').delete().eq('id', itemId);
    setDetallesMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    onDatosActualizados();
  }

  // =========================================================================
  // CRUD DE DEPARTAMENTOS
  // =========================================================================
  async function handleGuardarDeptoCrud(e: React.FormEvent) {
    e.preventDefault();
    if (!formDeptoNombre.trim()) return;

    if (modalDeptoCrud === 'CREAR') {
      const { data } = await supabase
        .from('departamentos')
        .insert({
          nombre: formDeptoNombre.trim(),
          tipo_area: formDeptoTipo,
          orden: departamentos.length + 1,
          activo: true,
        })
        .select('*')
        .single();
      if (data) {
        setDeptoActivoId((data as Departamento).id);
      }
    } else if (modalDeptoCrud === 'EDITAR') {
      await supabase
        .from('departamentos')
        .update({
          nombre: formDeptoNombre.trim(),
          tipo_area: formDeptoTipo,
        })
        .eq('id', deptoActivoId);
    }

    setModalDeptoCrud(null);
    onDatosActualizados();
  }

  async function handleEliminarDeptoActual() {
    if (departamentos.length <= 1) return;
    await supabase.from('departamentos').delete().eq('id', deptoActivoId);
    const otro = departamentos.find((d) => d.id !== deptoActivoId);
    if (otro) setDeptoActivoId(otro.id);
    onDatosActualizados();
  }

  // Finalizar y cerrar inspección -> Redirigir a ReporteFinal (con vista previa e impresión)
  async function handleFinalizarInspeccion() {
    setCerrandoInspeccion(true);
    // Concatenar observaciones por departamento si existen junto a las observaciones manuales
    const resumenObsDeptos = Object.entries(obsPorDepto)
      .filter(([, txt]) => txt && txt.trim().length > 0)
      .map(([dId, txt]) => {
        const nom =
          departamentos.find((d) => d.id === Number(dId))?.nombre ||
          `Depto #${dId}`;
        return `[${nom}]: ${txt.trim()}`;
      })
      .join(' | ');

    const obsFinalConsolidada = [obsManuales.trim(), resumenObsDeptos]
      .filter(Boolean)
      .join('\n');

    await supabase
      .from('inspecciones')
      .update({
        estado: 'COMPLETADA',
        fecha_fin: new Date().toISOString(),
        analista_nombre: analistaActual,
        turno: turnoActual,
        observaciones_manuales: obsFinalConsolidada,
      })
      .eq('id', inspeccionActiva.id);

    setCerrandoInspeccion(false);
    onDatosActualizados();
    onFinalizarYVerReporte(inspeccionActiva.id, inspeccionActiva.codigo_caso);
  }

  const deptoActual = useMemo(
    () =>
      departamentos.find((d) => d.id === deptoActivoId) ||
      departamentos[0] || {
        id: 1,
        nombre: 'Gerencia',
        tipo_area: 'OFICINA',
        orden: 1,
        activo: true,
      },
    [departamentos, deptoActivoId]
  );

  const itemsDeptoActual = useMemo(
    () =>
      items
        .filter((i) => i.departamento_id === deptoActual.id)
        .sort((a, b) => a.orden - b.orden),
    [items, deptoActual]
  );

  // Cálculo de progreso dinámico por departamento y global según la cantidad real de ítems
  const progresoPorDepto = useMemo(() => {
    const map: Record<
      number,
      { respondidos: number; total: number; ok: number; fallas: number; na: number }
    > = {};
    for (const d of departamentos) {
      const dItems = items.filter((i) => i.departamento_id === d.id);
      let respondidos = 0;
      let ok = 0;
      let fallas = 0;
      let na = 0;
      for (const it of dItems) {
        const det = detallesMap[it.id];
        if (det) {
          respondidos++;
          if (det.estado === 'OK') ok++;
          if (det.estado === 'FALLA') fallas++;
          if (det.estado === 'NA') na++;
        }
      }
      map[d.id] = { respondidos, total: dItems.length, ok, fallas, na };
    }
    return map;
  }, [departamentos, items, detallesMap]);

  const totalItemsGlobal = items.length;
  const totalRespondidosGlobal = useMemo(
    () => items.filter((it) => Boolean(detallesMap[it.id])).length,
    [items, detallesMap]
  );
  const porcentajeAvanceGlobal =
    totalItemsGlobal > 0
      ? Math.round((totalRespondidosGlobal / totalItemsGlobal) * 100)
      : 0;

  const progActual = progresoPorDepto[deptoActual.id] || {
    respondidos: 0,
    total: 0,
    ok: 0,
    fallas: 0,
    na: 0,
  };
  const baseValidaDepto = Math.max(progActual.total - progActual.na, 0);
  const cumplimientoDepto =
    baseValidaDepto === 0
      ? 100
      : Math.round((progActual.ok / baseValidaDepto) * 100);

  const idxDeptoActual = departamentos.findIndex(
    (d) => d.id === deptoActual.id
  );
  const deptoAnterior =
    idxDeptoActual > 0 ? departamentos[idxDeptoActual - 1] : null;
  const deptoSiguiente =
    idxDeptoActual < departamentos.length - 1
      ? departamentos[idxDeptoActual + 1]
      : null;

  return (
    <div className="space-y-4">
      {/* BANNER DE ESTADO DE EDICIÓN SEGÚN FECHA Y ROL (Mismo Día Modificable vs Otro Día Cerrado Automáticamente / Solo Vista vs Jefe Encargado) */}
      <div
        className={`rounded-2xl border-2 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
          soloVista
            ? 'bg-slate-900 text-white border-amber-400'
            : permisoEdicion.desbloqueadaPorJefe
            ? 'bg-amber-50 text-amber-950 border-amber-400'
            : 'bg-emerald-50/90 text-[#042f16] border-[#087334]/35'
        }`}
      >
        <div className="flex items-start gap-2.5 text-xs">
          {soloVista ? (
            <Eye size={18} className="text-[#B2D034] shrink-0 mt-0.5" />
          ) : permisoEdicion.desbloqueadaPorJefe ? (
            <Unlock size={18} className="text-amber-700 shrink-0 mt-0.5" />
          ) : (
            <Pencil size={18} className="text-[#087334] shrink-0 mt-0.5" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm">
                {permisoEdicion.etiquetaEstado}
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/10 font-bold">
                {inspeccionActiva.codigo_caso} • {inspeccionActiva.fecha_operativa}
              </span>
            </div>
            <p
              className={`text-[11px] mt-0.5 ${
                soloVista ? 'text-slate-300' : 'opacity-85'
              }`}
            >
              {permisoEdicion.descripcionRegla}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {soloVista && (
            <button
              type="button"
              onClick={() => {
                setAccionTrasDesbloqueo('SOLO_DESBLOQUEAR');
                setPinIngresado('');
                setErrorPinJefe('');
                setModalPinJefeAbierto(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#B2D034] hover:bg-[#9fbb29] text-[#042f16] px-3 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <KeyRound size={14} /> Desbloquear como Jefe Encargado
            </button>
          )}
          {onIrAEvaluacionesAnteriores && (
            <button
              type="button"
              onClick={onIrAEvaluacionesAnteriores}
              className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-2 rounded-xl border transition cursor-pointer ${
                soloVista
                  ? 'bg-white/10 hover:bg-white/20 text-white border-white/25'
                  : 'bg-white hover:bg-slate-100 text-[#087334] border-[#087334]/30'
              }`}
            >
              <History size={14} /> Evaluaciones Anteriores (
              {inspeccionesDisponibles.length})
            </button>
          )}
        </div>
      </div>

      {/* 1. CABECERA OPERATIVA INTEGRADA: Analista + Turno + Caso + Progreso Dinámico para el Reporte Diario */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/20 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-extrabold text-xs sm:text-sm bg-[#087334] text-white border border-[#B2D034] px-3 py-1.5 rounded-xl shadow-xs">
              {inspeccionActiva.codigo_caso}
            </span>
            <span
              className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                inspeccionActiva.estado === 'COMPLETADA'
                  ? 'bg-[#087334]/15 text-[#087334]'
                  : 'bg-[#B2D034]/35 text-[#042f16]'
              }`}
            >
              {inspeccionActiva.estado === 'COMPLETADA'
                ? 'REPORTE CERRADO'
                : 'AUDITORÍA EN CURSO'}
            </span>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Fecha: {inspeccionActiva.fecha_operativa}
            </span>
          </div>

          {/* Selector de Caso o Crear Nueva Inspección */}
          <div className="flex flex-wrap items-center gap-2">
            {inspeccionesDisponibles.length > 1 && (
              <select
                id="select-cambiar-caso"
                aria-label="Cambiar caso de inspección"
                value={inspeccionActiva.id}
                onChange={(e) => onCambiarInspeccion(e.target.value)}
                className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#087334]"
              >
                {inspeccionesDisponibles.map((insp) => {
                  const p = esInspeccionEditablePorFechaYRol(
                    insp,
                    modoJefeActivo ? 'COORDINADOR' : 'ANALISTA'
                  );
                  return (
                    <option key={insp.id} value={insp.id}>
                      {insp.codigo_caso} ({insp.fecha_operativa} •{' '}
                      {p.esMismoDia
                        ? 'Editable Hoy'
                        : p.editable
                        ? 'Jefe Encargado'
                        : 'Solo Vista'}
                      )
                    </option>
                  );
                })}
              </select>
            )}
            <button
              id="btn-nueva-inspeccion"
              type="button"
              onClick={() => {
                setNuevaSucursalModalId(sucursalIdActual);
                const aSede = getAnalistasPorSucursal(sucursalIdActual);
                const jSede = getJefesPorSucursal(sucursalIdActual);
                setNuevoAnalistaModalId(
                  analistaIdActual || aSede[0]?.id || 101
                );
                setNuevoJefeModalId(jefeIdActual || jSede[0]?.id || 10001);
                setNuevoTurno(
                  aSede.find((a) => a.id === analistaIdActual)
                    ?.turno_habitual || turnoActual
                );
                setModalNueva(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#087334] hover:bg-[#054d22] text-white px-3 py-2 rounded-xl transition cursor-pointer shrink-0 shadow-xs"
            >
              <PlusCircle size={14} className="text-[#B2D034]" /> Nuevo Turno / Caso
            </button>
          </div>
        </div>

        {/* Controles en Vivo de Sucursal, Analista Disponible, Jefe Encargado y Turno (Controlados por Rol: Analista vs Coordinador Superadmin) */}
        <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/90 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087334] flex items-center gap-1.5">
                <ShieldCheck size={14} /> Personal Aislado por Sucursal
              </span>
              {modoJefeActivo ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-[#B2D034]/45 text-[#042f16] border border-[#087334]/35 px-2.5 py-0.5 rounded-full">
                  <Crown size={12} /> ROL: COORDINADOR (SUPERADMIN — Gestión de
                  Sucursales, Personal y Roles en BD)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-200/90 text-slate-700 px-2.5 py-0.5 rounded-full">
                  <UserCheck size={11} /> ROL: ANALISTA DE SISTEMAS (Operativo —
                  No modifica sucursales ni personal)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Cambio de Rol: Analista <-> Coordinador (Superadmin) */}
              {!modoJefeActivo ? (
                <button
                  id="btn-desbloquear-modo-jefe"
                  type="button"
                  onClick={() => {
                    setAccionTrasDesbloqueo('SOLO_DESBLOQUEAR');
                    setPinIngresado('');
                    setErrorPinJefe('');
                    setModalPinJefeAbierto(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-[11px] font-extrabold bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 px-3 py-1.5 rounded-lg border border-amber-500/40 transition cursor-pointer"
                >
                  <Crown size={13} className="text-amber-700" />
                  Cambiar a Rol Coordinador (Superadmin)
                </button>
              ) : (
                <>
                  {/* Opción 1 (Exclusiva Coordinador Superadmin): Panel Visual por Sucursal y Tabla usuarios_roles */}
                  <button
                    id="btn-gestionar-personal-sede"
                    type="button"
                    onClick={() => {
                      setUsuariosRolesList(getUsuariosRoles());
                      setModalPersonalAbierto(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold bg-[#087334] hover:bg-[#054d22] text-white px-3 py-1.5 rounded-lg border border-[#B2D034] transition cursor-pointer shadow-xs"
                  >
                    <Users size={13} className="text-[#B2D034]" />
                    Panel Superadmin: Personal y Roles ({analistasDeSede.length}{' '}
                    Analistas / {jefesDeSede.length} Jefes)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModoJefeActivo(false);
                      setMostrarRapidoAnalista(false);
                      setMostrarRapidoJefe(false);
                      setMostrarInputNuevaSucursal(false);
                      onCambiarRol?.('ANALISTA');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <UserCheck size={12} /> Cambiar a Rol Analista
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Selector Multi-Sucursal de Río Supermarket (Solo el Coordinador Superadmin puede agregar o editar sedes) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#087334]">
                  <Store size={13} /> 1. Sucursal / Sede
                </label>
                {modoJefeActivo && (
                  <button
                    type="button"
                    onClick={() => setMostrarInputNuevaSucursal((v) => !v)}
                    className="text-[10px] font-extrabold text-[#087334] hover:underline cursor-pointer flex items-center gap-0.5"
                    title="Exclusivo Rol Coordinador (Superadmin)"
                  >
                    {mostrarInputNuevaSucursal ? 'Cancelar' : '+ Nueva Sede'}
                  </button>
                )}
              </div>
              {!mostrarInputNuevaSucursal ? (
                <select
                  id="select-sucursal-activa"
                  value={sucursalIdActual}
                  onChange={async (e) => {
                    const nuevoSucId = Number(e.target.value);
                    const sucObj =
                      sucursalesObjList.find((s) => s.id === nuevoSucId) ||
                      sucursalesObjList[0];
                    if (!sucObj) return;

                    setSucursalIdActual(sucObj.id);
                    setSucursalActual(sucObj.nombre);

                    // Filtrar ÚNICAMENTE personal de esta sucursal (sin cruzar información)
                    const analistasSede = getAnalistasPorSucursal(sucObj.id);
                    const jefesSede = getJefesPorSucursal(sucObj.id);
                    setAnalistasDeSede(analistasSede);
                    setJefesDeSede(jefesSede);

                    // Seleccionar automáticamente el Analista Disponible y el Jefe Encargado Disponible de esta sucursal
                    const analistaAuto =
                      analistasSede.find((a) => a.disponible) ||
                      analistasSede[0] ||
                      null;
                    const jefeAuto =
                      jefesSede.find((j) => j.disponible) ||
                      jefesSede[0] ||
                      null;

                    const nuevoNombreAnalista =
                      analistaAuto?.nombre_completo || analistaActual;
                    const nuevoTurnoAuto =
                      analistaAuto?.turno_habitual || turnoActual;
                    const nuevoNombreJefe =
                      jefeAuto?.nombre_completo ||
                      'Coordinador / Jefe Encargado de Tienda';

                    setAnalistaIdActual(analistaAuto?.id || null);
                    setJefeIdActual(jefeAuto?.id || null);
                    setRecibidoPorActual(nuevoNombreJefe);

                    saveInspeccionExtraMeta(inspeccionActiva.id, {
                      sucursalId: sucObj.id,
                      sucursal: sucObj.nombre,
                      analistaId: analistaAuto?.id || null,
                      jefeEncargadoId: jefeAuto?.id || null,
                      recibidoPor: nuevoNombreJefe,
                    });

                    await handleActualizarAnalistaOTurno(
                      nuevoNombreAnalista,
                      nuevoTurnoAuto
                    );
                  }}
                  className="w-full bg-white border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  {sucursalesObjList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nuevaSucursalNombre}
                    onChange={(e) => setNuevaSucursalNombre(e.target.value)}
                    placeholder="Ej. Río Supermarket Lechería..."
                    className="flex-1 bg-white border border-[#087334] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!nuevaSucursalNombre.trim()) return;
                      const updatedNames = addSucursal(
                        nuevaSucursalNombre.trim()
                      );
                      const updatedObjs = getSucursalesObj();
                      setSucursalesList(updatedNames);
                      setSucursalesObjList(updatedObjs);
                      const recienCreada =
                        updatedObjs[updatedObjs.length - 1];
                      if (recienCreada) {
                        setSucursalIdActual(recienCreada.id);
                        setSucursalActual(recienCreada.nombre);
                        const analistasNuevos = getAnalistasPorSucursal(
                          recienCreada.id
                        );
                        const jefesNuevos = getJefesPorSucursal(
                          recienCreada.id
                        );
                        setAnalistasDeSede(analistasNuevos);
                        setJefesDeSede(jefesNuevos);
                        const primerAnalista = analistasNuevos[0] || null;
                        const primerJefe = jefesNuevos[0] || null;
                        setAnalistaIdActual(primerAnalista?.id || null);
                        setJefeIdActual(primerJefe?.id || null);
                        if (primerJefe) {
                          setRecibidoPorActual(primerJefe.nombre_completo);
                        }
                        saveInspeccionExtraMeta(inspeccionActiva.id, {
                          sucursalId: recienCreada.id,
                          sucursal: recienCreada.nombre,
                          analistaId: primerAnalista?.id || null,
                          jefeEncargadoId: primerJefe?.id || null,
                          recibidoPor:
                            primerJefe?.nombre_completo || recibidoPorActual,
                        });
                        if (primerAnalista) {
                          await handleActualizarAnalistaOTurno(
                            primerAnalista.nombre_completo,
                            primerAnalista.turno_habitual
                          );
                        }
                      }
                      setNuevaSucursalNombre('');
                      setMostrarInputNuevaSucursal(false);
                    }}
                    className="bg-[#087334] text-white text-xs font-bold px-2.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>

            {/* 2. Selector de Analista de Sistemas Disponible en esta Sucursal (Opción 5 visible SOLO para Coordinador Superadmin) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#087334]">
                  <UserCheck size={13} /> 2. Analista (Sede Actual)
                </label>
                {modoJefeActivo ? (
                  <button
                    type="button"
                    onClick={() => setMostrarRapidoAnalista((v) => !v)}
                    className="text-[10px] font-extrabold text-[#087334] hover:underline cursor-pointer flex items-center gap-0.5"
                    title="Opción 5 (Exclusiva Coordinador Superadmin): Registrar suplencia o nuevo analista directo en esta sede"
                  >
                    {mostrarRapidoAnalista
                      ? 'Cancelar'
                      : '+ Nuevo en Sede (Suplencia)'}
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-emerald-700">
                    {analistasDeSede.filter((a) => a.disponible).length} disp.
                  </span>
                )}
              </div>

              {!mostrarRapidoAnalista ? (
                <select
                  id="select-analista-sucursal"
                  value={analistaIdActual || ''}
                  onChange={async (e) => {
                    const idSel = Number(e.target.value);
                    const obj = analistasDeSede.find((a) => a.id === idSel);
                    if (!obj) return;
                    setAnalistaIdActual(obj.id);
                    saveInspeccionExtraMeta(inspeccionActiva.id, {
                      analistaId: obj.id,
                    });
                    await handleActualizarAnalistaOTurno(
                      obj.nombre_completo,
                      obj.turno_habitual || turnoActual
                    );
                  }}
                  className="w-full bg-white border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  {analistasDeSede.length === 0 ? (
                    <option value="">
                      — Sin analistas en esta sede (agrégolos en Gestionar Personal / CSV) —
                    </option>
                  ) : (
                    (modoJefeActivo
                      ? analistasDeSede
                      : analistasDeSede.filter(
                          (a) => a.disponible || a.id === analistaIdActual
                        ).length > 0
                        ? analistasDeSede.filter(
                            (a) => a.disponible || a.id === analistaIdActual
                          )
                        : analistasDeSede
                    ).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.disponible ? '🟢 ' : '⚪ '}
                        {a.nombre_completo} (
                        {a.disponible ? 'Disponible' : 'Franco'})
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={rapidoAnalistaNombre}
                    onChange={(e) => setRapidoAnalistaNombre(e.target.value)}
                    placeholder="Ing. Suplente / Nuevo Analista..."
                    className="flex-1 bg-white border border-[#087334] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!rapidoAnalistaNombre.trim()) return;
                      const creado = await crearAnalistaSucursal({
                        sucursal_id: sucursalIdActual,
                        nombre_completo: rapidoAnalistaNombre.trim(),
                        cargo: 'Analista de Sistemas (Guardia)',
                        turno_habitual: turnoActual,
                        disponible: true,
                      });
                      if (!creado) return;
                      setAnalistasDeSede(
                        getAnalistasPorSucursal(sucursalIdActual)
                      );
                      setAnalistaIdActual(creado.id);
                      saveInspeccionExtraMeta(inspeccionActiva.id, {
                        analistaId: creado.id,
                      });
                      await handleActualizarAnalistaOTurno(
                        creado.nombre_completo,
                        creado.turno_habitual
                      );
                      setRapidoAnalistaNombre('');
                      setMostrarRapidoAnalista(false);
                    }}
                    className="bg-[#087334] text-white text-xs font-bold px-2.5 py-1.5 rounded-xl cursor-pointer shrink-0"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>

            {/* 3. Selector de Coordinador / Jefe Encargado de esta Sucursal (Creación rápida visible SOLO para Coordinador Superadmin) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#087334]">
                  <Users size={13} /> 3. Coord. / Jefe Encargado
                </label>
                {modoJefeActivo ? (
                  <button
                    type="button"
                    onClick={() => setMostrarRapidoJefe((v) => !v)}
                    className="text-[10px] font-extrabold text-[#087334] hover:underline cursor-pointer flex items-center gap-0.5"
                    title="Exclusivo Rol Coordinador (Superadmin): Registrar nuevo Coordinador o Jefe Encargado en esta sede"
                  >
                    {mostrarRapidoJefe ? 'Cancelar' : '+ Nuevo Jefe (Sede)'}
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-emerald-700">
                    {jefesDeSede.filter((j) => j.disponible).length} disp.
                  </span>
                )}
              </div>

              {!mostrarRapidoJefe ? (
                <select
                  id="select-jefe-sucursal"
                  value={jefeIdActual || ''}
                  onChange={(e) => {
                    const idSel = Number(e.target.value);
                    const obj = jefesDeSede.find((j) => j.id === idSel);
                    if (!obj) return;
                    setJefeIdActual(obj.id);
                    setRecibidoPorActual(obj.nombre_completo);
                    saveInspeccionExtraMeta(inspeccionActiva.id, {
                      jefeEncargadoId: obj.id,
                      recibidoPor: obj.nombre_completo,
                    });
                    setUltimoGuardado(
                      new Date().toLocaleTimeString('es-VE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    );
                  }}
                  className="w-full bg-white border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  {jefesDeSede.length === 0 ? (
                    <option value="">
                      — Sin Jefe Encargado en esta sede (agrégolo en Gestionar Personal / CSV) —
                    </option>
                  ) : (
                    jefesDeSede.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.disponible ? '🟢 ' : '⚪ '}
                        {j.nombre_completo}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={rapidoJefeNombre}
                    onChange={(e) => setRapidoJefeNombre(e.target.value)}
                    placeholder="Lic. / Ing. Jefe Encargado..."
                    className="flex-1 bg-white border border-[#087334] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!rapidoJefeNombre.trim()) return;
                      const creado = await crearJefeSucursal({
                        sucursal_id: sucursalIdActual,
                        nombre_completo: rapidoJefeNombre.trim(),
                        cargo: 'Coordinador / Jefe Encargado de Tienda',
                        disponible: true,
                      });
                      if (!creado) return;
                      setJefesDeSede(getJefesPorSucursal(sucursalIdActual));
                      setJefeIdActual(creado.id);
                      setRecibidoPorActual(creado.nombre_completo);
                      saveInspeccionExtraMeta(inspeccionActiva.id, {
                        jefeEncargadoId: creado.id,
                        recibidoPor: creado.nombre_completo,
                      });
                      setRapidoJefeNombre('');
                      setMostrarRapidoJefe(false);
                    }}
                    className="bg-[#087334] text-white text-xs font-bold px-2.5 py-1.5 rounded-xl cursor-pointer shrink-0"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>

            {/* 4. Selector de Turno Operativo Activo */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#087334]">
                <Clock size={13} /> 4. Turno Operativo
              </label>
              <select
                value={turnoActual}
                onChange={(e) =>
                  handleActualizarAnalistaOTurno(analistaActual, e.target.value)
                }
                className="w-full bg-white border border-slate-200 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
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
          </div>
        </div>

        {/* Barra de Progreso Dinámica (Dependiendo de la cantidad de Ítems configurados sale el Reporte Diario) */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              Base para Reporte Diario ({departamentos.length} Departamentos):{' '}
              <strong className="font-mono text-[#087334]">
                {totalRespondidosGlobal} de {totalItemsGlobal} ítems evaluados (
                {porcentajeAvanceGlobal}%)
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#087334] font-semibold">
              <CloudCheck size={14} />
              {ultimoGuardado
                ? `Sincronizado a las ${ultimoGuardado}`
                : 'Sincronización automática activa'}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#087334] to-[#B2D034] transition-all duration-300 rounded-full"
              style={{ width: `${porcentajeAvanceGlobal}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. APARTADO DE DEPARTAMENTO: UN SOLO BOTÓN DE SELECCIÓN + CRUD DE DEPARTAMENTOS */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/20 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#087334] flex items-center gap-1.5">
              <Building2 size={14} /> Selección de Departamento y Gestión CRUD
            </p>
            <p className="text-xs text-slate-500">
              Escoge el departamento con un solo botón para desplegar y administrar sus ítems
            </p>
          </div>

          {/* Botones CRUD del Departamento */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setFormDeptoNombre('');
                setFormDeptoTipo('OFICINA');
                setModalDeptoCrud('CREAR');
              }}
              className="inline-flex items-center gap-1 text-xs font-bold bg-[#087334]/10 hover:bg-[#087334]/20 text-[#087334] border border-[#087334]/30 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              <Plus size={13} /> Nuevo Depto
            </button>
            <button
              type="button"
              onClick={() => {
                setFormDeptoNombre(deptoActual.nombre);
                setFormDeptoTipo(deptoActual.tipo_area);
                setModalDeptoCrud('EDITAR');
              }}
              className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              <Pencil size={13} /> Editar Depto
            </button>
            {departamentos.length > 1 && (
              <button
                type="button"
                onClick={handleEliminarDeptoActual}
                title="Eliminar este departamento"
                className="inline-flex items-center gap-1 text-xs font-bold bg-[#DB0617]/10 hover:bg-[#DB0617]/20 text-[#DB0617] px-2.5 py-1.5 rounded-xl transition cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* UN SOLO BOTÓN DESPLEGABLE DE SELECCIÓN DE DEPARTAMENTO */}
        <div className="relative">
          <button
            id="btn-selector-unico-departamento"
            type="button"
            onClick={() => setDropdownDeptoAbierto((v) => !v)}
            className="w-full bg-[#087334] hover:bg-[#065c29] text-white border-2 border-[#B2D034] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="bg-[#B2D034] text-[#042f16] font-mono font-black text-xs sm:text-sm px-3 py-1.5 rounded-xl shrink-0">
                #{deptoActual.orden} de {departamentos.length}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base sm:text-lg font-extrabold tracking-tight">
                    {deptoActual.nombre}
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-white/15 px-2 py-0.5 rounded-md text-[#B2D034]">
                    {deptoActual.tipo_area}
                  </span>
                </div>
                <p className="text-xs text-[#B2D034] font-medium mt-0.5">
                  {progActual.respondidos} de {progActual.total} ítems evaluados •{' '}
                  {cumplimientoDepto}% cumplimiento en el área
                  {progActual.fallas > 0
                    ? ` • ${progActual.fallas} falla(s)`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-xs font-bold bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                Cambiar Departamento
              </span>
              <ChevronDown
                size={20}
                className={`text-[#B2D034] transition-transform ${
                  dropdownDeptoAbierto ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {/* Menú Desplegable con todos los Departamentos y su estado */}
          {dropdownDeptoAbierto && (
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border-2 border-[#087334] shadow-2xl z-40 max-h-80 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {departamentos.map((depto) => {
                const prog = progresoPorDepto[depto.id] || {
                  respondidos: 0,
                  total: 0,
                  ok: 0,
                  fallas: 0,
                  na: 0,
                };
                const esActivo = depto.id === deptoActual.id;
                const completo =
                  prog.total > 0 && prog.respondidos === prog.total;

                return (
                  <button
                    key={depto.id}
                    type="button"
                    onClick={() => {
                      setDeptoActivoId(depto.id);
                      setDropdownDeptoAbierto(false);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      esActivo
                        ? 'bg-[#087334] text-white border-[#087334]'
                        : completo
                        ? 'bg-[#087334]/10 text-slate-900 border-[#087334]/30 hover:bg-[#087334]/20'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-lg shrink-0 ${
                          esActivo
                            ? 'bg-[#B2D034] text-[#042f16]'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        #{depto.orden}
                      </span>
                      <div className="truncate">
                        <p className="text-xs sm:text-sm font-bold truncate">
                          {depto.nombre}
                        </p>
                        <p
                          className={`text-[10px] font-mono ${
                            esActivo ? 'text-[#B2D034]' : 'text-slate-500'
                          }`}
                        >
                          {depto.tipo_area}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                          esActivo
                            ? 'bg-white/15 text-white'
                            : completo
                            ? 'bg-[#087334] text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {prog.respondidos}/{prog.total}
                      </span>
                      {prog.fallas > 0 && (
                        <span className="text-[10px] font-mono font-bold bg-[#DB0617] text-white px-1.5 py-0.5 rounded-md">
                          {prog.fallas}F
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. ÍTEMS DEL DEPARTAMENTO SELECCIONADO (CON CRUD COMPLETO POR ÍTEM) */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/20 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-extrabold bg-[#B2D034]/35 text-[#042f16] px-2.5 py-0.5 rounded-lg">
                Depto #{deptoActual.orden}
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Ítems de {deptoActual.nombre} ({itemsDeptoActual.length} ítems)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              El reporte diario calcula el cumplimiento de{' '}
              <strong>{deptoActual.nombre}</strong> sobre sus{' '}
              <strong>{itemsDeptoActual.length} ítems activos</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarFormNuevoItem((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-[#087334] hover:bg-[#054d22] px-3 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Plus size={14} className="text-[#B2D034]" /> Agregar Ítem (CRUD)
            </button>

            <button
              id="btn-marcar-restantes-ok"
              type="button"
              onClick={handleMarcarRestantesDeptoOk}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#087334] bg-[#087334]/10 hover:bg-[#087334]/20 border border-[#087334]/25 px-3 py-2 rounded-xl transition cursor-pointer"
            >
              <Sparkles size={14} /> Marcar pendientes como OK
            </button>
          </div>
        </div>

        {/* Formulario CRUD para Crear Nuevo Ítem en el Departamento Actual */}
        {mostrarFormNuevoItem && (
          <form
            onSubmit={handleCrearItem}
            className="p-4 rounded-2xl bg-[#087334]/5 border-2 border-[#087334]/30 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#087334]">
                Nuevo Ítem para {deptoActual.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setMostrarFormNuevoItem(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={nuevoItemDesc}
                onChange={(e) => setNuevoItemDesc(e.target.value)}
                placeholder="Ej. Balanza Digi SM-300 #2 (Calibración y Cabezal Térmico)..."
                className="flex-1 bg-white border border-slate-300 focus:border-[#087334] focus:outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900"
              />
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={nuevoItemCritico}
                  onChange={(e) => setNuevoItemCritico(e.target.checked)}
                  className="accent-[#DB0617]"
                />
                Ítem Crítico
              </label>
              <button
                type="submit"
                className="bg-[#087334] hover:bg-[#054d22] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer shrink-0"
              >
                Guardar Ítem
              </button>
            </div>
          </form>
        )}

        {/* Lista de Ítems del Departamento con Evaluación y CRUD individual */}
        {itemsDeptoActual.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-2">
            <p className="text-sm font-bold text-slate-700">
              Este departamento no tiene ítems configurados todavía.
            </p>
            <p className="text-xs text-slate-500">
              Usa el botón <strong>+ Agregar Ítem (CRUD)</strong> de arriba para añadir los equipos o puntos a evaluar.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {itemsDeptoActual.map((item, idx) => {
              const detalle = detallesMap[item.id];
              const estadoActual = detalle?.estado || null;
              const esFalla = estadoActual === 'FALLA';
              const mostrarPanelNota =
                esFalla ||
                Boolean(itemsConNotaAbierta[item.id]) ||
                Boolean(detalle?.observacion_item) ||
                Boolean(detalle?.evidencia_url);
              const guardando = guardandoItemId === item.id;
              const subiendoFoto = subiendoFotoItemId === item.id;
              const signedUrl = detalle?.evidencia_url
                ? signedUrls[detalle.evidencia_url]
                : null;
              const editandoEsteItem = itemEditandoId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    estadoActual === 'FALLA'
                      ? 'bg-[#DB0617]/5 border-[#DB0617]/40'
                      : estadoActual === 'OK'
                      ? 'bg-[#087334]/5 border-[#087334]/30'
                      : estadoActual === 'NA'
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Cabecera del Ítem + Botones CRUD (Editar / Eliminar / Nota) */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          ÍTEM #{idx + 1}
                        </span>
                        {item.es_critico && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#DB0617]/10 text-[#DB0617] border border-[#DB0617]/25 px-2 py-0.5 rounded-md">
                            <ShieldAlert size={11} /> Crítico
                          </span>
                        )}
                        {guardando && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#087334] font-mono">
                            <Loader2 size={12} className="animate-spin" />
                            Guardando...
                          </span>
                        )}
                      </div>

                      {editandoEsteItem ? (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            type="text"
                            value={editItemDesc}
                            onChange={(e) => setEditItemDesc(e.target.value)}
                            className="flex-1 bg-white border border-[#087334] rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-900"
                          />
                          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-xl cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editItemCritico}
                              onChange={(e) =>
                                setEditItemCritico(e.target.checked)
                              }
                            />
                            Crítico
                          </label>
                          <button
                            type="button"
                            onClick={() => handleGuardarEdicionItem(item.id)}
                            className="inline-flex items-center gap-1 bg-[#087334] text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                          >
                            <Check size={14} /> Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemEditandoId(null)}
                            className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-xl cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {item.descripcion}
                        </h3>
                      )}
                    </div>

                    {/* Acciones CRUD por Ítem */}
                    {!editandoEsteItem && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setItemsConNotaAbierta((prev) => ({
                              ...prev,
                              [item.id]: !prev[item.id],
                            }))
                          }
                          title="Agregar observación o foto a este ítem"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#087334] hover:bg-[#087334]/10 transition cursor-pointer"
                        >
                          <MessageSquarePlus size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setItemEditandoId(item.id);
                            setEditItemDesc(item.descripcion);
                            setEditItemCritico(item.es_critico);
                          }}
                          title="Editar ítem"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#087334] hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminarItem(item.id)}
                          title="Eliminar ítem"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#DB0617] hover:bg-[#DB0617]/10 transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Botones grandes de estado: OK, FALLA, N/A */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <button
                      id={`btn-item-${item.id}-ok`}
                      type="button"
                      disabled={soloVista}
                      onClick={() => handleMarcarEstado(item.id, 'OK')}
                      className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition ${
                        soloVista
                          ? 'opacity-60 cursor-not-allowed'
                          : 'active:scale-[0.98] cursor-pointer'
                      } ${
                        estadoActual === 'OK'
                          ? 'bg-[#087334] text-white border-[#087334] shadow-sm'
                          : 'bg-white hover:bg-[#087334]/10 text-slate-700 border-slate-200'
                      }`}
                    >
                      <CheckCircle2 size={17} /> OK
                    </button>

                    <button
                      id={`btn-item-${item.id}-falla`}
                      type="button"
                      disabled={soloVista}
                      onClick={() => handleMarcarEstado(item.id, 'FALLA')}
                      className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition ${
                        soloVista
                          ? 'opacity-60 cursor-not-allowed'
                          : 'active:scale-[0.98] cursor-pointer'
                      } ${
                        estadoActual === 'FALLA'
                          ? 'bg-[#DB0617] text-white border-[#DB0617] shadow-sm'
                          : 'bg-white hover:bg-[#DB0617]/10 text-slate-700 border-slate-200'
                      }`}
                    >
                      <XCircle size={17} /> FALLA
                    </button>

                    <button
                      id={`btn-item-${item.id}-na`}
                      type="button"
                      disabled={soloVista}
                      onClick={() => handleMarcarEstado(item.id, 'NA')}
                      className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition ${
                        soloVista
                          ? 'opacity-60 cursor-not-allowed'
                          : 'active:scale-[0.98] cursor-pointer'
                      } ${
                        estadoActual === 'NA'
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <MinusCircle size={17} /> N/A
                    </button>
                  </div>

                  {/* Panel de Observación del Ítem y Cámara de Evidencia */}
                  {mostrarPanelNota && (
                    <div
                      className={`mt-2 p-3.5 rounded-xl bg-white border space-y-3 ${
                        esFalla ? 'border-[#DB0617]/30' : 'border-[#087334]/30'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`obs-item-${item.id}`}
                          className={`block text-xs font-bold ${
                            esFalla ? 'text-[#DB0617]' : 'text-[#087334]'
                          }`}
                        >
                          {esFalla
                            ? 'Descripción de la Falla / Incidencia Detectada:'
                            : 'Observación Técnica del Ítem:'}
                        </label>
                        <textarea
                          id={`obs-item-${item.id}`}
                          rows={2}
                          readOnly={soloVista}
                          value={detalle?.observacion_item || ''}
                          onChange={(e) =>
                            handleActualizarObservacionItem(
                              item.id,
                              e.target.value
                            )
                          }
                          placeholder="Describe el detalle técnico, serial del equipo, ticket o novedad observada..."
                          className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#087334] focus:bg-white"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <label
                          htmlFor={`camara-item-${item.id}`}
                          className="inline-flex items-center justify-center gap-2 bg-[#087334] hover:bg-[#054d22] text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition shadow-xs"
                        >
                          {subiendoFoto ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              Guardando evidencia...
                            </>
                          ) : (
                            <>
                              <Camera size={15} className="text-[#B2D034]" />
                              {detalle?.evidencia_url
                                ? 'Reemplazar Foto de Evidencia'
                                : 'Adjuntar Foto / Cámara'}
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
                            Evidencia: {detalle.evidencia_url}
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 4. OBSERVACIONES DESPUÉS DE TODOS LOS ÍTEMS DEL DEPARTAMENTO */}
        <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-200 space-y-2">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#087334]">
            📝 Observaciones Adicionales de {deptoActual.nombre} (Después de los{' '}
            {itemsDeptoActual.length} ítems)
          </label>
          <textarea
            rows={2}
            value={obsPorDepto[deptoActual.id] || ''}
            onChange={(e) =>
              handleGuardarObsDepartamento(deptoActual.id, e.target.value)
            }
            placeholder={`Agrega cualquier observación general del departamento de ${deptoActual.nombre} tras revisar sus ${itemsDeptoActual.length} ítems...`}
            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#087334] focus:bg-white transition"
          />
        </div>

        {/* Navegación rápida entre departamentos Anterior / Siguiente */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {deptoAnterior ? (
            <button
              type="button"
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
              type="button"
              onClick={() => setDeptoActivoId(deptoSiguiente.id)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#087334] hover:bg-[#054d22] px-4 py-2.5 rounded-xl transition cursor-pointer shadow-xs"
            >
              Siguiente: #{deptoSiguiente.orden} {deptoSiguiente.nombre}{' '}
              <ChevronRight size={16} className="text-[#B2D034]" />
            </button>
          ) : (
            <span className="text-xs font-bold text-[#087334]">
              Último departamento (#{deptoActual.orden} {deptoActual.nombre})
            </span>
          )}
        </div>
      </section>

      {/* 5. OBSERVACIONES GENERALES DEL TURNO, FIRMA DIGITAL TÁCTIL Y GENERACIÓN DE REPORTE CON VISTA PREVIA */}
      <section className="bg-white rounded-2xl border-2 border-[#087334]/20 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-[#087334]" />
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Observaciones Generales, Firma Digital en Pantalla y Emisión de
              Reporte Diario
            </h2>
            <p className="text-xs text-slate-500">
              El reporte se genera dinámicamente sobre los{' '}
              <strong>{totalItemsGlobal} ítems configurados</strong> para{' '}
              <strong className="text-[#087334]">{sucursalActual}</strong> y
              estampa ambas firmas en el PDF
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="textarea-observaciones-manuales"
            className="block text-xs font-bold uppercase tracking-wider text-slate-600"
          >
            Observaciones Manuales Generales del Turno ({turnoActual})
          </label>
          <textarea
            id="textarea-observaciones-manuales"
            rows={3}
            value={obsManuales}
            onChange={(e) => handleGuardarObsGenerales(e.target.value)}
            placeholder="Escribe el resumen ejecutivo del turno, tickets escalados a soporte, estado de enlaces o conclusiones generales..."
            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#087334] focus:bg-white transition"
          />
        </div>

        {/* Apartado de Firmas Digitales Táctiles (Analista + Supervisor / Gerencia de Tienda) */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#087334] flex items-center gap-1.5">
              <PenTool size={14} /> Firmas Digitales de Entrega y Conformidad (Se
              estampan en la Vista Previa y PDF)
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-600">Recibido por:</span>
              <input
                type="text"
                value={recibidoPorActual}
                onChange={(e) => {
                  const val = e.target.value;
                  setRecibidoPorActual(val);
                  saveInspeccionExtraMeta(inspeccionActiva.id, {
                    recibidoPor: val,
                  });
                }}
                placeholder="Supervisor / Gerencia de Tienda..."
                className="bg-slate-50 border border-slate-200 focus:border-[#087334] focus:outline-none rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FirmaDigitalCanvas
              titulo="Firma del Analista de Sistemas (Entrega)"
              subtitulo={`${analistaActual} • ${turnoActual}`}
              initialDataUrl={firmaAnalistaUrl}
              onChange={(dataUrl) => {
                setFirmaAnalistaUrl(dataUrl);
                saveInspeccionExtraMeta(inspeccionActiva.id, {
                  firmaAnalistaDataUrl: dataUrl,
                });
              }}
            />

            <FirmaDigitalCanvas
              titulo="Firma de Conformidad / Gerencia de Tienda (Recepción)"
              subtitulo={`${recibidoPorActual} • ${sucursalActual}`}
              initialDataUrl={firmaSupervisorUrl}
              onChange={(dataUrl) => {
                setFirmaSupervisorUrl(dataUrl);
                saveInspeccionExtraMeta(inspeccionActiva.id, {
                  firmaSupervisorDataUrl: dataUrl,
                });
              }}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-600">
            Caso:{' '}
            <strong className="font-mono text-[#087334]">
              {inspeccionActiva.codigo_caso}
            </strong>{' '}
            • Sede: <strong>{sucursalActual}</strong> • Analista:{' '}
            <strong>{analistaActual}</strong> • Ítems:{' '}
            <strong className="font-mono text-[#087334]">
              {totalRespondidosGlobal}/{totalItemsGlobal}
            </strong>
          </div>

          <button
            id="btn-finalizar-generar-reporte"
            type="button"
            disabled={cerrandoInspeccion}
            onClick={handleFinalizarInspeccion}
            className="bg-[#B2D034] hover:bg-[#9fbb29] active:scale-[0.99] text-[#042f16] font-extrabold py-3.5 px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer shrink-0"
          >
            <FileCheck2 size={18} />
            {cerrandoInspeccion
              ? 'Calculando Reporte Diario...'
              : 'Finalizar y Abrir Vista Previa de Impresión'}
          </button>
        </div>
      </section>

      {/* Modal CRUD de Departamento (Crear / Editar) */}
      {modalDeptoCrud && (
        <div className="fixed inset-0 z-50 bg-[#042f16]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleGuardarDeptoCrud}
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border-2 border-[#B2D034]"
          >
            <h3 className="text-base font-extrabold text-[#087334]">
              {modalDeptoCrud === 'CREAR'
                ? 'Crear Nuevo Departamento'
                : `Editar Departamento: ${deptoActual.nombre}`}
            </h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Nombre del Departamento
                </label>
                <input
                  type="text"
                  required
                  value={formDeptoNombre}
                  onChange={(e) => setFormDeptoNombre(e.target.value)}
                  placeholder="Ej. Farmacia / Autolavado / Delivery..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#087334]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tipo de Área</label>
                <select
                  value={formDeptoTipo}
                  onChange={(e) => setFormDeptoTipo(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                >
                  <option value="OFICINA">OFICINA</option>
                  <option value="OPERATIVIDAD_FRESCOS">
                    OPERATIVIDAD_FRESCOS
                  </option>
                  <option value="CAJA_PISO">CAJA_PISO</option>
                  <option value="INFRAESTRUCTURA">INFRAESTRUCTURA</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalDeptoCrud(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#087334] text-white hover:bg-[#054d22] cursor-pointer"
              >
                Guardar Departamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal para crear una nueva inspección (CAS-XXXX) seleccionando la Sucursal Real y su Personal Exclusivo */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 bg-[#042f16]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border-2 border-[#B2D034]">
            <div>
              <h3 className="text-base font-extrabold text-[#087334]">
                Iniciar Nuevo Caso de Inspección — Río Supermarket
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Selecciona la sucursal oficial: los analistas y jefes encargados
                se filtran exclusivamente según la sede elegida
              </p>
            </div>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-extrabold text-[#087334] flex items-center gap-1.5">
                  <Store size={13} /> 1. Sucursal Oficial de Río Supermarket (
                  {sucursalesObjList.length} Sedes Reales)
                </label>
                <select
                  value={nuevaSucursalModalId}
                  onChange={(e) => {
                    const nuevoId = Number(e.target.value);
                    setNuevaSucursalModalId(nuevoId);
                    const aSede = getAnalistasPorSucursal(nuevoId);
                    const jSede = getJefesPorSucursal(nuevoId);
                    const primerA =
                      aSede.find((a) => a.disponible) || aSede[0];
                    const primerJ =
                      jSede.find((j) => j.disponible) || jSede[0];
                    if (primerA) {
                      setNuevoAnalistaModalId(primerA.id);
                      setNuevoTurno(primerA.turno_habitual);
                    }
                    if (primerJ) {
                      setNuevoJefeModalId(primerJ.id);
                    }
                  }}
                  className="w-full border-2 border-[#087334]/40 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                >
                  {sucursalesObjList.map((s) => (
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
                  value={nuevoAnalistaModalId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setNuevoAnalistaModalId(id);
                    const obj = getAnalistasPorSucursal(
                      nuevaSucursalModalId
                    ).find((a) => a.id === id);
                    if (obj) setNuevoTurno(obj.turno_habitual);
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                >
                  {getAnalistasPorSucursal(nuevaSucursalModalId).length === 0 ? (
                    <option value={0}>
                      — Sin analistas registrados en esta sede (agrégolos en Gestionar Personal / CSV) —
                    </option>
                  ) : (
                    getAnalistasPorSucursal(nuevaSucursalModalId).map((a) => (
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
                  value={nuevoJefeModalId}
                  onChange={(e) => setNuevoJefeModalId(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
                >
                  {getJefesPorSucursal(nuevaSucursalModalId).length === 0 ? (
                    <option value={0}>
                      — Sin Jefe Encargado registrado en esta sede (agrégolo en Gestionar Personal / CSV) —
                    </option>
                  ) : (
                    getJefesPorSucursal(nuevaSucursalModalId).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.disponible ? '🟢 ' : '⚪ '}
                        {j.nombre_completo} — {j.cargo}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  4. Turno Operativo
                </label>
                <select
                  value={nuevoTurno}
                  onChange={(e) => setNuevoTurno(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#087334]"
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
                  const sucObj =
                    sucursalesObjList.find(
                      (s) => s.id === nuevaSucursalModalId
                    ) || sucursalesObjList[0];
                  const analistaObj =
                    getAnalistasPorSucursal(nuevaSucursalModalId).find(
                      (a) => a.id === nuevoAnalistaModalId
                    ) || getAnalistasPorSucursal(nuevaSucursalModalId)[0];
                  const jefeObj =
                    getJefesPorSucursal(nuevaSucursalModalId).find(
                      (j) => j.id === nuevoJefeModalId
                    ) || getJefesPorSucursal(nuevaSucursalModalId)[0];

                  await onCrearNuevaInspeccion(
                    analistaObj?.nombre_completo || 'Ing. Analista de Sistemas',
                    nuevoTurno,
                    {
                      sucursalId: sucObj.id,
                      sucursal: sucObj.nombre,
                      analistaId: analistaObj?.id || null,
                      jefeEncargadoId: jefeObj?.id || null,
                      recibidoPor:
                        jefeObj?.nombre_completo ||
                        'Jefe Encargado de Sucursal',
                    }
                  );
                  setModalNueva(false);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#087334] text-white hover:bg-[#054d22] cursor-pointer"
              >
                Crear Caso CAS-XXXX en {
                  (sucursalesObjList.find((s) => s.id === nuevaSucursalModalId) || sucursalesObjList[0])?.codigo
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Clave / PIN para elevar a ROL: COORDINADOR (Superadmin) */}
      {modalPinJefeAbierto && (
        <div className="fixed inset-0 z-50 bg-[#042f16]/85 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pinReal = getPinJefe();
              if (pinIngresado.trim() === pinReal) {
                setModoJefeActivo(true);
                onCambiarRol?.('COORDINADOR');
                setModalPinJefeAbierto(false);
                setErrorPinJefe('');
                setPinIngresado('');
                if (accionTrasDesbloqueo === 'PANEL') {
                  setModalPersonalAbierto(true);
                } else if (accionTrasDesbloqueo === 'SUPLENCIA_ANALISTA') {
                  setMostrarRapidoAnalista(true);
                } else if (accionTrasDesbloqueo === 'NUEVO_JEFE') {
                  setMostrarRapidoJefe(true);
                }
              } else {
                setErrorPinJefe(
                  'PIN incorrecto. Solo el Rol COORDINADOR (Superadmin) tiene autorización.'
                );
              }
            }}
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border-2 border-[#B2D034]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#087334] text-[#B2D034] flex items-center justify-center">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#087334]">
                    Activar ROL: COORDINADOR (Superadmin)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    El Analista evalúa todo el checklist, pero solo el Coordinador administra sucursales, personal y roles
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPinJefeAbierto(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-extrabold text-slate-700">
                Ingresa el PIN de Coordinador (Superadmin):
              </label>
              <input
                type="password"
                autoFocus
                value={pinIngresado}
                onChange={(e) => {
                  setPinIngresado(e.target.value);
                  setErrorPinJefe('');
                }}
                placeholder="PIN de Coordinador (Por defecto: 2026)"
                className="w-full border-2 border-slate-200 focus:border-[#087334] rounded-xl px-3.5 py-2.5 text-sm font-mono font-extrabold tracking-widest text-slate-900 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Clave inicial configurada: <code className="font-mono font-bold text-[#087334]">2026</code> (Puedes personalizarla dentro del Panel Superadmin).
              </p>
              {errorPinJefe && (
                <p className="text-xs font-bold text-[#DB0617] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorPinJefe}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalPinJefeAbierto(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#087334] text-white hover:bg-[#054d22] flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock size={14} className="text-[#B2D034]" /> Activar Rol
                Coordinador
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Opción 1 (Exclusiva para ROL COORDINADOR Superadmin): Panel Visual en la App por Sucursal (CRUD directo en BD + Roles de Usuario) */}
      {modalPersonalAbierto && (
        <div className="fixed inset-0 z-50 bg-[#042f16]/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border-2 border-[#B2D034]">
            <div className="bg-[#087334] text-white px-5 py-4 border-b-4 border-[#B2D034] flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <Users size={20} className="text-[#B2D034]" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                    Panel Superadmin: Personal y Roles por Sede (BD PostgreSQL)
                    <span className="text-[10px] bg-[#B2D034] text-[#042f16] px-2 py-0.5 rounded-full font-extrabold">
                      ROL: COORDINADOR
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#B2D034] font-semibold">
                    📍 {sucursalActual} — Datos aislados por sede sin cruzar
                    información
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Selector rápido de Sucursal dentro del Panel para llenar cualquier sede sin salir */}
                <select
                  value={sucursalIdActual}
                  onChange={async (e) => {
                    const nuevoSucId = Number(e.target.value);
                    const sucObj =
                      sucursalesObjList.find((s) => s.id === nuevoSucId) ||
                      sucursalesObjList[0];
                    if (!sucObj) return;
                    setSucursalIdActual(sucObj.id);
                    setSucursalActual(sucObj.nombre);
                    const analistasSede = getAnalistasPorSucursal(sucObj.id);
                    const jefesSede = getJefesPorSucursal(sucObj.id);
                    setAnalistasDeSede(analistasSede);
                    setJefesDeSede(jefesSede);
                    const analistaAuto =
                      analistasSede.find((a) => a.disponible) ||
                      analistasSede[0] ||
                      null;
                    const jefeAuto =
                      jefesSede.find((j) => j.disponible) ||
                      jefesSede[0] ||
                      null;
                    setAnalistaIdActual(analistaAuto?.id || null);
                    setJefeIdActual(jefeAuto?.id || null);
                    if (jefeAuto) {
                      setRecibidoPorActual(jefeAuto.nombre_completo);
                    }
                    saveInspeccionExtraMeta(inspeccionActiva.id, {
                      sucursalId: sucObj.id,
                      sucursal: sucObj.nombre,
                      analistaId: analistaAuto?.id || null,
                      jefeEncargadoId: jefeAuto?.id || null,
                      recibidoPor:
                        jefeAuto?.nombre_completo || recibidoPorActual,
                    });
                    if (analistaAuto) {
                      await handleActualizarAnalistaOTurno(
                        analistaAuto.nombre_completo,
                        analistaAuto.turno_habitual
                      );
                    }
                  }}
                  className="bg-[#042f16] text-white border border-[#B2D034] rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                >
                  {sucursalesObjList.map((s) => (
                    <option key={s.id} value={s.id}>
                      Cambiar Sede: {s.nombre}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setModalPersonalAbierto(false)}
                  className="text-white/80 hover:text-white p-1 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6 text-xs">
              {/* Barra superior de Importación CSV (Excel), Carga por Lote y Configuración de PIN de Jefe */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarImportarCsv((v) => !v);
                      setMostrarCargaLote(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#087334] hover:bg-[#054d22] text-white border border-[#B2D034] px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    <FileSpreadsheet size={14} className="text-[#B2D034]" />
                    {mostrarImportarCsv
                      ? 'Ocultar Importador CSV'
                      : '📥 Importar / Exportar CSV (Excel)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDescargarPlantillaCsv}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-[#087334] border border-[#087334]/40 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <Download size={13} /> Plantilla CSV
                  </button>

                  <button
                    type="button"
                    onClick={handleExportarPersonalActualCsv}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <Download size={13} /> Exportar Todo (CSV)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMostrarCargaLote((v) => !v);
                      setMostrarImportarCsv(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-[#087334]/10 hover:bg-[#087334]/20 text-[#087334] border border-[#087334]/30 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <ClipboardList size={14} />
                    {mostrarCargaLote
                      ? 'Ocultar Texto Rápido'
                      : '📋 Pegar Lista Texto'}
                  </button>
                </div>

                {/* Cambiar PIN de Coordinador */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600">
                    PIN Coordinador:
                  </span>
                  <input
                    type="text"
                    value={nuevoPinConfig}
                    onChange={(e) => setNuevoPinConfig(e.target.value)}
                    placeholder={`Actual: ${getPinJefe()}`}
                    className="w-28 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (nuevoPinConfig.trim().length >= 3) {
                        savePinJefe(nuevoPinConfig.trim());
                        setNuevoPinConfig('');
                        setMensajePinGuardado(true);
                        setTimeout(() => setMensajePinGuardado(false), 2500);
                      }
                    }}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    Cambiar PIN
                  </button>
                  {mensajePinGuardado && (
                    <span className="text-[11px] font-bold text-emerald-700">
                      ✓ PIN actualizado
                    </span>
                  )}
                </div>
              </div>

              {/* Bloque desplegable de Importación / Exportación CSV (Excel guardado como CSV) */}
              {mostrarImportarCsv && (
                <div className="bg-emerald-50/70 border-2 border-[#087334]/35 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-[#087334] text-xs sm:text-sm flex items-center gap-1.5">
                        <FileSpreadsheet size={16} /> Importar Personal Real por CSV (Excel → Guardar como CSV)
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Columnas:{' '}
                        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          tipo;sucursal_codigo;nombre_completo;cedula;email;cargo;turno
                        </code>{' '}
                        (acepta separador <code className="font-mono">;</code> o{' '}
                        <code className="font-mono">,</code>). Si la cédula ya existe, actualiza la persona sin duplicarla.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDescargarPlantillaCsv}
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-[#087334] border border-[#087334] font-extrabold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        <Download size={13} /> 1. Descargar Plantilla CSV
                      </button>
                      <label className="inline-flex items-center gap-1.5 bg-[#087334] hover:bg-[#054d22] text-white font-extrabold px-3 py-1.5 rounded-lg text-xs cursor-pointer">
                        <Upload size={13} /> 2. Subir Archivo .CSV
                        <input
                          type="file"
                          accept=".csv,text/csv,text/plain"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const texto = await file.text();
                            handleAnalizarTextoCsv(texto);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Códigos rápidos de las 23 sucursales para referencia */}
                  <details className="bg-white rounded-lg border border-slate-200 p-2.5 text-[11px]">
                    <summary className="font-bold text-slate-700 cursor-pointer">
                      Ver los 23 códigos de sucursal válidos para la columna{' '}
                      <code className="font-mono">sucursal_codigo</code>
                    </summary>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 mt-2 font-mono text-[10.5px] text-slate-700">
                      {sucursalesObjList.map((s) => (
                        <div key={s.id} className="truncate">
                          <strong className="text-[#087334]">{s.codigo}</strong>{' '}
                          (o #{s.id}): {s.nombre.replace('Río Supermarket • ', '')}
                        </div>
                      ))}
                    </div>
                  </details>

                  {mensajeResultadoCsv && (
                    <div className="p-3 rounded-xl bg-[#087334] text-white font-bold text-xs flex items-center justify-between">
                      <span>{mensajeResultadoCsv}</span>
                      <button
                        type="button"
                        onClick={() => setMensajeResultadoCsv(null)}
                        className="text-white/80 hover:text-white cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {resultadoCsv && (
                    <div className="space-y-2.5 bg-white p-3 rounded-xl border border-slate-200">
                      {resultadoCsv.errorGeneral ? (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 font-bold text-xs">
                          ❌ {resultadoCsv.errorGeneral}
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#087334]">
                                🟢 {resultadoCsv.resumen.crear} para crear
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                                🔵 {resultadoCsv.resumen.actualizar} para actualizar
                              </span>
                              {resultadoCsv.resumen.errores > 0 && (
                                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800">
                                  🔴 {resultadoCsv.resumen.errores} con error
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setResultadoCsv(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                Limpiar vista previa
                              </button>
                              <button
                                type="button"
                                disabled={
                                  importandoCsv ||
                                  resultadoCsv.resumen.crear +
                                    resultadoCsv.resumen.actualizar ===
                                    0
                                }
                                onClick={async () => {
                                  setImportandoCsv(true);
                                  const res = await importarFilasPersonal(
                                    resultadoCsv.filas
                                  );
                                  setAnalistasDeSede(
                                    getAnalistasPorSucursal(sucursalIdActual)
                                  );
                                  setJefesDeSede(
                                    getJefesPorSucursal(sucursalIdActual)
                                  );
                                  setImportandoCsv(false);
                                  setResultadoCsv(null);
                                  const msgFallas =
                                    res.fallidos.length > 0
                                      ? ` (${res.fallidos.length} rechazados por BD: ${res.fallidos[0].mensaje})`
                                      : '';
                                  setMensajeResultadoCsv(
                                    `✅ Importación completada en Supabase: ${res.creados} creados, ${res.actualizados} actualizados${msgFallas}.`
                                  );
                                  onDatosActualizados();
                                }}
                                className="bg-[#087334] hover:bg-[#054d22] disabled:opacity-50 text-white font-extrabold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
                              >
                                {importandoCsv
                                  ? 'Guardando en Supabase...'
                                  : `3. Confirmar e Importar (${
                                      resultadoCsv.resumen.crear +
                                      resultadoCsv.resumen.actualizar
                                    } válidos)`}
                              </button>
                            </div>
                          </div>

                          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead className="bg-slate-100 text-slate-700 sticky top-0">
                                <tr>
                                  <th className="p-2">Fila</th>
                                  <th className="p-2">Estado</th>
                                  <th className="p-2">Tipo</th>
                                  <th className="p-2">Sucursal</th>
                                  <th className="p-2">Nombre</th>
                                  <th className="p-2">Cédula / Email</th>
                                  <th className="p-2">Cargo / Turno</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {resultadoCsv.filas.map((f) => (
                                  <tr
                                    key={f.numeroFila}
                                    className={
                                      f.accion === 'ERROR'
                                        ? 'bg-red-50/70 text-red-900'
                                        : ''
                                    }
                                  >
                                    <td className="p-2 font-mono">
                                      #{f.numeroFila}
                                    </td>
                                    <td className="p-2 font-extrabold">
                                      {f.accion === 'CREAR' && (
                                        <span className="text-[#087334]">
                                          🟢 Nuevo
                                        </span>
                                      )}
                                      {f.accion === 'ACTUALIZAR' && (
                                        <span className="text-blue-700">
                                          🔵 Actualizar
                                        </span>
                                      )}
                                      {f.accion === 'ERROR' && (
                                        <span className="text-red-700">
                                          🔴 {f.errores.join(' • ')}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2 font-mono">
                                      {f.tipo || '—'}
                                    </td>
                                    <td className="p-2 truncate max-w-[160px]">
                                      {f.sucursal_nombre}
                                    </td>
                                    <td className="p-2 font-bold">
                                      {f.nombre_completo || '—'}
                                    </td>
                                    <td className="p-2 font-mono">
                                      {f.cedula || '—'}
                                      {f.email ? ` • ${f.email}` : ''}
                                    </td>
                                    <td className="p-2">
                                      {f.cargo}
                                      {f.turno ? ` (${f.turno.split(' ')[0]})` : ''}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bloque desplegable para pegar varios nombres de una sola vez en esta Sucursal */}
              {mostrarCargaLote && (
                <div className="bg-[#087334]/5 border-2 border-[#087334]/25 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-extrabold text-[#087334] text-xs sm:text-sm">
                      Carga Rápida por Lote para {sucursalActual}
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLoteTipo('ANALISTAS')}
                        className={`px-3 py-1 rounded-lg font-extrabold text-xs cursor-pointer ${
                          loteTipo === 'ANALISTAS'
                            ? 'bg-[#087334] text-white'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        Cargar en analistas_sistemas
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoteTipo('JEFES')}
                        className={`px-3 py-1 rounded-lg font-extrabold text-xs cursor-pointer ${
                          loteTipo === 'JEFES'
                            ? 'bg-[#087334] text-white'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        Cargar en jefes_encargados
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Escribe o pega una persona por línea (puedes separar cargo,
                    cédula y correo con <code className="font-mono">|</code>, ej:{' '}
                    <code className="font-mono">
                      Ing. Nombre Apellido | Analista de Sistemas | V-12345678 | correo@rio.com
                    </code>
                    ):
                  </p>
                  <textarea
                    rows={4}
                    value={loteTexto}
                    onChange={(e) => setLoteTexto(e.target.value)}
                    placeholder={
                      loteTipo === 'ANALISTAS'
                        ? 'Ing. Nombre Apellido | Analista de Sistemas | V-12345678 | correo@riosupermarket.com'
                        : 'Lic. Nombre Apellido | Jefe Encargado de Tienda | V-87654321 | gerencia@riosupermarket.com'
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!loteTexto.trim()) return;
                        await cargarLotePersonalSucursal({
                          sucursal_id: sucursalIdActual,
                          tipo: loteTipo,
                          lineasTexto: loteTexto,
                        });
                        setAnalistasDeSede(
                          getAnalistasPorSucursal(sucursalIdActual)
                        );
                        setJefesDeSede(getJefesPorSucursal(sucursalIdActual));
                        setLoteTexto('');
                        setMostrarCargaLote(false);
                      }}
                      className="bg-[#087334] hover:bg-[#054d22] text-white font-extrabold px-4 py-2 rounded-xl text-xs cursor-pointer"
                    >
                      Guardar Lista en BD ({sucursalActual})
                    </button>
                  </div>
                </div>
              )}

              {/* SECCIÓN A: TABLA ANALISTAS_SISTEMAS DE ESTA SUCURSAL */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#087334] flex items-center gap-1.5">
                      <UserCheck size={15} /> Tabla:{' '}
                      <code className="font-mono">analistas_sistemas</code> (
                      {analistasDeSede.length} registrados en esta sede)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      El Analista solo verá en su selector a quienes estén
                      marcados como <strong>🟢 Disponible en Sede</strong>
                    </p>
                  </div>
                </div>

                {analistasDeSede.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-600 text-xs">
                    Esta sucursal no tiene analistas registrados todavía.
                    Agrégalos con el formulario de abajo o usa{' '}
                    <strong>📥 Importar / Exportar CSV</strong>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analistasDeSede.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2"
                      >
                        {editandoAnalistaId === a.id ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <input
                              type="text"
                              value={editAnalistaNombre}
                              onChange={(e) =>
                                setEditAnalistaNombre(e.target.value)
                              }
                              placeholder="Nombre completo"
                              className="sm:col-span-3 bg-white border border-[#087334] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
                            />
                            <input
                              type="text"
                              value={editAnalistaCedula}
                              onChange={(e) =>
                                setEditAnalistaCedula(e.target.value)
                              }
                              placeholder="Cédula (V-...)"
                              className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900"
                            />
                            <input
                              type="email"
                              value={editAnalistaEmail}
                              onChange={(e) =>
                                setEditAnalistaEmail(e.target.value)
                              }
                              placeholder="Email"
                              className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900"
                            />
                            <input
                              type="text"
                              value={editAnalistaCargo}
                              onChange={(e) =>
                                setEditAnalistaCargo(e.target.value)
                              }
                              placeholder="Cargo"
                              className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900"
                            />
                            <select
                              value={editAnalistaTurno}
                              onChange={(e) =>
                                setEditAnalistaTurno(e.target.value)
                              }
                              className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900"
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
                            <div className="sm:col-span-1 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!editAnalistaNombre.trim()) return;
                                  await actualizarAnalistaSucursal(a.id, {
                                    nombre_completo: editAnalistaNombre.trim(),
                                    cedula: editAnalistaCedula.trim() || null,
                                    email: editAnalistaEmail.trim() || null,
                                    cargo: editAnalistaCargo.trim(),
                                    turno_habitual: editAnalistaTurno,
                                  });
                                  setAnalistasDeSede(
                                    getAnalistasPorSucursal(sucursalIdActual)
                                  );
                                  if (analistaIdActual === a.id) {
                                    await handleActualizarAnalistaOTurno(
                                      editAnalistaNombre.trim(),
                                      editAnalistaTurno
                                    );
                                  }
                                  setEditandoAnalistaId(null);
                                }}
                                className="bg-[#087334] text-white px-2 py-1.5 rounded-lg font-bold text-xs cursor-pointer"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditandoAnalistaId(null)}
                                className="bg-slate-200 text-slate-700 px-2 py-1.5 rounded-lg font-bold text-xs cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="font-extrabold text-slate-900">
                                {a.nombre_completo}
                                {a.cedula && (
                                  <span className="ml-2 font-mono text-[11px] text-[#087334] bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {a.cedula}
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {a.cargo} • Turno: {a.turno_habitual}
                                {a.email ? ` • ${a.email}` : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  const nuevoDisp = !a.disponible;
                                  await actualizarAnalistaSucursal(a.id, {
                                    disponible: nuevoDisp,
                                  });
                                  const actualizados =
                                    getAnalistasPorSucursal(sucursalIdActual);
                                  setAnalistasDeSede(actualizados);
                                  if (nuevoDisp) {
                                    setAnalistaIdActual(a.id);
                                    saveInspeccionExtraMeta(inspeccionActiva.id, {
                                      analistaId: a.id,
                                    });
                                    await handleActualizarAnalistaOTurno(
                                      a.nombre_completo,
                                      a.turno_habitual
                                    );
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] transition cursor-pointer ${
                                  a.disponible
                                    ? 'bg-[#087334] text-white border border-[#B2D034]'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                              >
                                {a.disponible
                                  ? '🟢 Disponible en Sede'
                                  : '⚪ No Disponible / Franco'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditandoAnalistaId(a.id);
                                  setEditAnalistaNombre(a.nombre_completo);
                                  setEditAnalistaCedula(a.cedula || '');
                                  setEditAnalistaEmail(a.email || '');
                                  setEditAnalistaCargo(a.cargo);
                                  setEditAnalistaTurno(a.turno_habitual);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#087334] hover:bg-emerald-50 cursor-pointer"
                                title="Editar nombre, cédula, email, cargo o turno"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  await eliminarAnalistaSucursal(a.id);
                                  setAnalistasDeSede(
                                    getAnalistasPorSucursal(sucursalIdActual)
                                  );
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#DB0617] hover:bg-red-50 cursor-pointer"
                                title="Eliminar analista de esta sede"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar Nuevo Analista exclusivo para esta Sucursal */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-[#087334]/5 p-3 rounded-xl border border-[#087334]/20">
                  <input
                    type="text"
                    value={nuevoAnalistaNombreSede}
                    onChange={(e) => setNuevoAnalistaNombreSede(e.target.value)}
                    placeholder="Nombre del Analista..."
                    className="sm:col-span-3 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <input
                    type="text"
                    value={nuevoAnalistaCedulaSede}
                    onChange={(e) => setNuevoAnalistaCedulaSede(e.target.value)}
                    placeholder="Cédula (V-...)"
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <input
                    type="email"
                    value={nuevoAnalistaEmailSede}
                    onChange={(e) => setNuevoAnalistaEmailSede(e.target.value)}
                    placeholder="Email (opcional)"
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <input
                    type="text"
                    value={nuevoAnalistaCargoSede}
                    onChange={(e) => setNuevoAnalistaCargoSede(e.target.value)}
                    placeholder="Cargo..."
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <select
                    value={nuevoAnalistaTurnoSede}
                    onChange={(e) => setNuevoAnalistaTurnoSede(e.target.value)}
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
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
                  <button
                    type="button"
                    onClick={async () => {
                      if (!nuevoAnalistaNombreSede.trim()) return;
                      const creado = await crearAnalistaSucursal({
                        sucursal_id: sucursalIdActual,
                        nombre_completo: nuevoAnalistaNombreSede,
                        cedula: nuevoAnalistaCedulaSede,
                        email: nuevoAnalistaEmailSede,
                        cargo: nuevoAnalistaCargoSede,
                        turno_habitual: nuevoAnalistaTurnoSede,
                        disponible: true,
                      });
                      if (!creado) return;
                      setAnalistasDeSede(
                        getAnalistasPorSucursal(sucursalIdActual)
                      );
                      setAnalistaIdActual(creado.id);
                      saveInspeccionExtraMeta(inspeccionActiva.id, {
                        analistaId: creado.id,
                      });
                      await handleActualizarAnalistaOTurno(
                        creado.nombre_completo,
                        creado.turno_habitual
                      );
                      setNuevoAnalistaNombreSede('');
                      setNuevoAnalistaCedulaSede('');
                      setNuevoAnalistaEmailSede('');
                    }}
                    className="sm:col-span-1 bg-[#087334] hover:bg-[#054d22] text-white font-extrabold rounded-lg px-2 py-2 text-xs cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              {/* SECCIÓN B: TABLA JEFES_ENCARGADOS (COORDINADORES / JEFES DE TIENDA) DE ESTA SUCURSAL */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <h4 className="text-sm font-extrabold text-[#087334] flex items-center gap-1.5">
                    <Users size={15} /> Tabla:{' '}
                    <code className="font-mono">jefes_encargados</code> (
                    {jefesDeSede.length} registrados en esta sede)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Coordinador o Jefe Encargado que recibe la guardia y firma
                    el reporte en esta sucursal
                  </p>
                </div>

                {jefesDeSede.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-600 text-xs">
                    Esta sucursal no tiene Jefe Encargado registrado todavía.
                    Agrégalo con el formulario de abajo o usa{' '}
                    <strong>📥 Importar / Exportar CSV</strong>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jefesDeSede.map((j) => (
                      <div
                        key={j.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2"
                      >
                        {editandoJefeId === j.id ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <input
                              type="text"
                              value={editJefeNombre}
                              onChange={(e) =>
                                setEditJefeNombre(e.target.value)
                              }
                              placeholder="Nombre completo"
                              className="sm:col-span-4 bg-white border border-[#087334] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
                            />
                            <input
                              type="text"
                              value={editJefeCedula}
                              onChange={(e) =>
                                setEditJefeCedula(e.target.value)
                              }
                              placeholder="Cédula (V-...)"
                              className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900"
                            />
                            <input
                              type="email"
                              value={editJefeEmail}
                              onChange={(e) => setEditJefeEmail(e.target.value)}
                              placeholder="Email"
                              className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900"
                            />
                            <input
                              type="text"
                              value={editJefeCargo}
                              onChange={(e) => setEditJefeCargo(e.target.value)}
                              placeholder="Cargo"
                              className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900"
                            />
                            <div className="sm:col-span-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!editJefeNombre.trim()) return;
                                  await actualizarJefeSucursal(j.id, {
                                    nombre_completo: editJefeNombre.trim(),
                                    cedula: editJefeCedula.trim() || null,
                                    email: editJefeEmail.trim() || null,
                                    cargo: editJefeCargo.trim(),
                                  });
                                  setJefesDeSede(
                                    getJefesPorSucursal(sucursalIdActual)
                                  );
                                  if (jefeIdActual === j.id) {
                                    setRecibidoPorActual(editJefeNombre.trim());
                                    saveInspeccionExtraMeta(
                                      inspeccionActiva.id,
                                      {
                                        recibidoPor: editJefeNombre.trim(),
                                      }
                                    );
                                  }
                                  setEditandoJefeId(null);
                                }}
                                className="bg-[#087334] text-white px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditandoJefeId(null)}
                                className="bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="font-extrabold text-slate-900">
                                {j.nombre_completo}
                                {j.cedula && (
                                  <span className="ml-2 font-mono text-[11px] text-[#087334] bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {j.cedula}
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {j.cargo}
                                {j.email ? ` • ${j.email}` : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  const nuevoDisp = !j.disponible;
                                  await actualizarJefeSucursal(j.id, {
                                    disponible: nuevoDisp,
                                  });
                                  setJefesDeSede(
                                    getJefesPorSucursal(sucursalIdActual)
                                  );
                                  if (nuevoDisp) {
                                    setJefeIdActual(j.id);
                                    setRecibidoPorActual(j.nombre_completo);
                                    saveInspeccionExtraMeta(
                                      inspeccionActiva.id,
                                      {
                                        jefeEncargadoId: j.id,
                                        recibidoPor: j.nombre_completo,
                                      }
                                    );
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] transition cursor-pointer ${
                                  j.disponible
                                    ? 'bg-[#087334] text-white border border-[#B2D034]'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                              >
                                {j.disponible
                                  ? '🟢 Encargado Activo'
                                  : '⚪ No Disponible'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditandoJefeId(j.id);
                                  setEditJefeNombre(j.nombre_completo);
                                  setEditJefeCedula(j.cedula || '');
                                  setEditJefeEmail(j.email || '');
                                  setEditJefeCargo(j.cargo);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#087334] hover:bg-emerald-50 cursor-pointer"
                                title="Editar nombre, cédula, email o cargo"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  await eliminarJefeSucursal(j.id);
                                  setJefesDeSede(
                                    getJefesPorSucursal(sucursalIdActual)
                                  );
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#DB0617] hover:bg-red-50 cursor-pointer"
                                title="Eliminar jefe encargado de esta sede"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar Nuevo Coordinador / Jefe Encargado exclusivo para esta Sucursal */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-[#087334]/5 p-3 rounded-xl border border-[#087334]/20">
                  <input
                    type="text"
                    value={nuevoJefeNombreSede}
                    onChange={(e) => setNuevoJefeNombreSede(e.target.value)}
                    placeholder="Nombre del Jefe Encargado..."
                    className="sm:col-span-4 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <input
                    type="text"
                    value={nuevoJefeCedulaSede}
                    onChange={(e) => setNuevoJefeCedulaSede(e.target.value)}
                    placeholder="Cédula (V-...)"
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <input
                    type="email"
                    value={nuevoJefeEmailSede}
                    onChange={(e) => setNuevoJefeEmailSede(e.target.value)}
                    placeholder="Email (opcional)"
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <input
                    type="text"
                    value={nuevoJefeCargoSede}
                    onChange={(e) => setNuevoJefeCargoSede(e.target.value)}
                    placeholder="Cargo..."
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!nuevoJefeNombreSede.trim()) return;
                      const creado = await crearJefeSucursal({
                        sucursal_id: sucursalIdActual,
                        nombre_completo: nuevoJefeNombreSede,
                        cedula: nuevoJefeCedulaSede,
                        email: nuevoJefeEmailSede,
                        cargo: nuevoJefeCargoSede,
                        disponible: true,
                      });
                      if (!creado) return;
                      setJefesDeSede(getJefesPorSucursal(sucursalIdActual));
                      setJefeIdActual(creado.id);
                      setRecibidoPorActual(creado.nombre_completo);
                      saveInspeccionExtraMeta(inspeccionActiva.id, {
                        jefeEncargadoId: creado.id,
                        recibidoPor: creado.nombre_completo,
                      });
                      setNuevoJefeNombreSede('');
                      setNuevoJefeCedulaSede('');
                      setNuevoJefeEmailSede('');
                    }}
                    className="sm:col-span-2 bg-[#087334] hover:bg-[#054d22] text-white font-extrabold rounded-lg px-3 py-2 text-xs cursor-pointer"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              {/* SECCIÓN C: TABLA USUARIOS_ROLES (ROLES DEL SISTEMA: COORDINADOR SUPERADMIN vs ANALISTA) */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <h4 className="text-sm font-extrabold text-[#087334] flex items-center gap-1.5">
                    <ShieldCheck size={15} /> Tabla:{' '}
                    <code className="font-mono">usuarios_roles</code> (
                    {usuariosRolesList.length} cuentas con rol asignado en BD)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Define quién entra como <strong>COORDINADOR (Superadmin)</strong> y quién entra como <strong>ANALISTA</strong> (evalúa todo, pero no toca sucursales ni personal)
                  </p>
                </div>

                <div className="space-y-2">
                  {usuariosRolesList.map((u) => (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-extrabold text-slate-900">
                          {u.nombre_completo}{' '}
                          <span className="font-mono text-[11px] text-slate-500">
                            ({u.email})
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {u.cargo}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            const siguienteRol: RolUsuarioSistema =
                              u.rol === 'COORDINADOR' ? 'ANALISTA' : 'COORDINADOR';
                            await crearOActualizarUsuarioRol({
                              email: u.email,
                              nombre_completo: u.nombre_completo,
                              rol: siguienteRol,
                              sucursal_id: u.sucursal_id,
                              cargo:
                                siguienteRol === 'COORDINADOR'
                                  ? 'Coordinador de Sistemas (Superadmin)'
                                  : 'Analista de Sistemas',
                            });
                            setUsuariosRolesList(getUsuariosRoles());
                          }}
                          className={`px-3 py-1 rounded-lg font-extrabold text-[11px] cursor-pointer ${
                            u.rol === 'COORDINADOR'
                              ? 'bg-[#B2D034] text-[#042f16] border border-[#087334]'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                          title="Haz clic para alternar entre COORDINADOR (Superadmin) y ANALISTA"
                        >
                          {u.rol === 'COORDINADOR'
                            ? '👑 ROL: COORDINADOR (Superadmin)'
                            : '🛡️ ROL: ANALISTA'}
                        </button>

                        {usuariosRolesList.length > 1 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await eliminarUsuarioRol(u.id);
                              setUsuariosRolesList(getUsuariosRoles());
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#DB0617] hover:bg-red-50 cursor-pointer"
                            title="Eliminar asignación de rol"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Formulario para asignar Rol (COORDINADOR o ANALISTA) a un correo en BD */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-[#087334]/5 p-3 rounded-xl border border-[#087334]/20">
                  <input
                    type="email"
                    value={nuevoRolEmail}
                    onChange={(e) => setNuevoRolEmail(e.target.value)}
                    placeholder="Correo del usuario (ej. analista2@riosupermarket.com)..."
                    className="sm:col-span-4 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <input
                    type="text"
                    value={nuevoRolNombre}
                    onChange={(e) => setNuevoRolNombre(e.target.value)}
                    placeholder="Nombre completo..."
                    className="sm:col-span-4 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#087334]"
                  />
                  <select
                    value={nuevoRolTipo}
                    onChange={(e) =>
                      setNuevoRolTipo(e.target.value as RolUsuarioSistema)
                    }
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#087334]"
                  >
                    <option value="ANALISTA">ROL: ANALISTA</option>
                    <option value="COORDINADOR">ROL: COORDINADOR</option>
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!nuevoRolEmail.trim() || !nuevoRolNombre.trim())
                        return;
                      await crearOActualizarUsuarioRol({
                        email: nuevoRolEmail.trim(),
                        nombre_completo: nuevoRolNombre.trim(),
                        rol: nuevoRolTipo,
                        sucursal_id: sucursalIdActual,
                        cargo:
                          nuevoRolTipo === 'COORDINADOR'
                            ? 'Coordinador de Sistemas (Superadmin)'
                            : 'Analista de Sistemas',
                      });
                      setUsuariosRolesList(getUsuariosRoles());
                      setNuevoRolEmail('');
                      setNuevoRolNombre('');
                    }}
                    className="sm:col-span-2 bg-[#087334] hover:bg-[#054d22] text-white font-extrabold rounded-lg px-3 py-2 text-xs cursor-pointer"
                  >
                    + Asignar Rol
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalPersonalAbierto(false)}
                  className="bg-[#087334] text-white font-extrabold px-5 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Listo y Guardado en BD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
