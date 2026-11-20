'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  Departamento,
  ChecklistItem,
  Inspeccion,
  getLocalDepartamentos,
  getLocalItems,
  getDemoInspecciones,
  getLastCloudSyncStatus,
  onCloudSyncStatusChange,
  CloudSyncStatus,
  RolUsuarioSistema,
  getRolActivoActual,
  cambiarRolActivoActual,
  sincronizarUsuariosRolesDesdeCloud,
  sincronizarPersonalDesdeCloud,
  normalizarTurnoOficial,
  cerrarAutomaticamenteInspeccionesDiasAnteriores,
  saveInspeccionExtraMeta,
  InspeccionExtraMeta,
  getSucursalesObj,
  getTodayStr,
} from '@/lib/supabase';
import LoginScreen from '@/components/LoginScreen';
import AlertaReporteBanner from '@/components/AlertaReporteBanner';
import InspeccionChecklist from '@/components/InspeccionChecklist';
import VistaEvaluacionesAnteriores from '@/components/VistaEvaluacionesAnteriores';
import ModuloBusquedaCalendario from '@/components/ModuloBusquedaCalendario';
import ReporteFinal from '@/components/ReporteFinal';
import ModalVerificadorBD from '@/components/ModalVerificadorBD';
import RioLogo from '@/components/RioLogo';
import {
  ClipboardCheck,
  Search,
  FileBarChart2,
  LogOut,
  Database,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  History,
} from 'lucide-react';

type VistaActiva = 'CHECKLIST' | 'EVALUACIONES' | 'BUSQUEDA' | 'REPORTE';

export default function HomePage() {
  const [session, setSession] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('CHECKLIST');
  const [departamentos, setDepartamentos] = useState<Departamento[]>(() =>
    getLocalDepartamentos()
  );
  const [items, setItems] = useState<ChecklistItem[]>(() => getLocalItems());
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [inspeccionActivaId, setInspeccionActivaId] = useState<string>('');
  const [reporteCaso, setReporteCaso] = useState<{
    id: string;
    codigo: string;
  } | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Rol del Sistema Activo: 'ANALISTA' (evalúa hoy, bloqueado en días anteriores) o 'COORDINADOR' (Jefe Encargado / Superadmin)
  const [rolActivo, setRolActivo] = useState<RolUsuarioSistema>('ANALISTA');

  // Estado del Monitor de Base de Datos en Vivo
  const [modalBDAbierto, setModalBDAbierto] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() =>
    getLastCloudSyncStatus()
  );

  useEffect(() => {
    return onCloudSyncStatusChange((st) => setSyncStatus(st));
  }, []);

  // 1. Verificar sesión en Supabase Auth
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await sincronizarPersonalDesdeCloud();
      if (data.session?.user?.email) {
        await sincronizarUsuariosRolesDesdeCloud();
        setRolActivo(getRolActivoActual(data.session.user.email));
      } else {
        setRolActivo(getRolActivoActual(null));
      }
      setAuthChecked(true);
    }
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setRolActivo(getRolActivoActual(newSession?.user?.email));
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2. Cargar catálogo dinámico de departamentos, ítems, personal desde BD e inspecciones + Cierre Automático 12:00 AM VET
  const cargarDatosBase = useCallback(async () => {
    const [, { data: deptosData }, { data: itemsData }, { data: inspData }] =
      await Promise.all([
        sincronizarPersonalDesdeCloud(),
        supabase
          .from('departamentos')
          .select('*')
          .eq('activo', true)
          .order('orden', { ascending: true }),
        supabase
          .from('checklist_items')
          .select('*')
          .eq('activo', true)
          .order('orden', { ascending: true }),
        supabase
          .from('inspecciones')
          .select('*')
          .order('fecha_operativa', { ascending: false }),
      ]);

    const finalDeptos =
      deptosData && (deptosData as Departamento[]).length > 0
        ? (deptosData as Departamento[])
        : getLocalDepartamentos().filter((d) => d.activo);

    const finalItems =
      itemsData && (itemsData as ChecklistItem[]).length > 0
        ? (itemsData as ChecklistItem[])
        : getLocalItems().filter((i) => i.activo);

    setDepartamentos(finalDeptos);
    setItems(finalItems);

    let lista = (
      inspData && (inspData as Inspeccion[]).length > 0
        ? (inspData as Inspeccion[])
        : getDemoInspecciones()
    ).map((i) => ({
      ...i,
      turno: normalizarTurnoOficial(i.turno),
    }));

    const hoy = getTodayStr(0);
    if (lista.length === 0) {
      const { data: creada } = await supabase
        .from('inspecciones')
        .insert({
          analista_nombre:
            session?.user?.user_metadata?.nombre ||
            session?.user?.email ||
            'Analista de Sistemas',
          turno: 'Apertura (08:00 AM a 17:00 PM)',
          fecha_operativa: hoy,
          estado: 'EN_PROGRESO',
        })
        .select('*')
        .single();
      if (creada) {
        lista = [creada as Inspeccion];
      }
    }

    // REGLA OFICIAL v3.7: Si una evaluación pertenece a un día anterior (< hoy en America/Caracas), se cierra automáticamente
    lista = await cerrarAutomaticamenteInspeccionesDiasAnteriores(lista);

    setInspecciones(lista);
    if (lista.length > 0) {
      setInspeccionActivaId((prev) => {
        if (prev && lista.some((i) => i.id === prev)) return prev;
        const hoyEnProgreso = lista.find(
          (i) => i.fecha_operativa === hoy && i.estado === 'EN_PROGRESO'
        );
        if (hoyEnProgreso) return hoyEnProgreso.id;
        const deHoy = lista.find((i) => i.fecha_operativa === hoy);
        return deHoy ? deHoy.id : lista[0].id;
      });
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      cargarDatosBase();
    }
  }, [session, cargarDatosBase, refreshCounter]);

  async function handleCrearNuevaInspeccion(
    analista: string,
    turno: string,
    extraMeta?: Partial<InspeccionExtraMeta>
  ) {
    const hoy = getTodayStr(0);
    const payloadBase: Record<string, any> = {
      analista_nombre: analista || 'Analista de Sistemas',
      turno: normalizarTurnoOficial(turno),
      fecha_operativa: hoy,
      estado: 'EN_PROGRESO',
    };
    const payloadCompleto: Record<string, any> = extraMeta
      ? {
          ...payloadBase,
          sucursal_id: extraMeta.sucursalId ?? null,
          sucursal_nombre: extraMeta.sucursal ?? null,
          analista_id: extraMeta.analistaId ?? null,
          jefe_encargado_id: extraMeta.jefeEncargadoId ?? null,
          jefe_encargado_nombre: extraMeta.recibidoPor ?? null,
          creado_por_rol: rolActivo,
          creado_por_email: session?.user?.email ?? null,
        }
      : payloadBase;

    let { data, error } = await supabase
      .from('inspecciones')
      .insert(payloadCompleto)
      .select('*')
      .single();

    if (error && extraMeta) {
      const retry = await supabase
        .from('inspecciones')
        .insert(payloadBase)
        .select('*')
        .single();
      data = retry.data;
    }

    if (data) {
      const nueva = data as Inspeccion;
      if (extraMeta) {
        saveInspeccionExtraMeta(nueva.id, extraMeta);
      }
      await cargarDatosBase();
      setInspeccionActivaId(nueva.id);
      setVistaActiva('CHECKLIST');
      setRefreshCounter((c) => c + 1);
    }
  }

  async function handleCerrarSesion() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#042f16] text-[#B2D034] flex items-center justify-center p-6 text-xs font-mono">
        Verificando sesión de auditoría tecnológica Río Supermarket...
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={() => {
          setRolActivo(getRolActivoActual(null));
          cargarDatosBase();
        }}
      />
    );
  }

  const sucursalesOficialesCount = getSucursalesObj().length;

  const inspeccionActiva: Inspeccion = inspecciones.find(
    (i) => i.id === inspeccionActivaId
  ) ||
    inspecciones[0] || {
      id: '11111111-1111-4111-8111-111111111101',
      codigo_caso: 'CAS-0001',
      analista_nombre:
        session?.user?.user_metadata?.nombre ||
        session?.user?.email ||
        'Analista de Sistemas',
      turno: 'Apertura (08:00 AM a 17:00 PM)',
      fecha_operativa: getTodayStr(0),
      fecha_inicio: new Date().toISOString(),
      fecha_fin: null,
      estado: 'EN_PROGRESO',
      observaciones_manuales: '',
    };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 pb-20 sm:pb-8">
      <AlertaReporteBanner
        refreshTrigger={refreshCounter}
        onIrACasoPendiente={() => setVistaActiva('EVALUACIONES')}
      />

      {/* Cabecera Corporativa Oficial Río Supermarket (#087334 + #B2D034) */}
      <header className="bg-[#087334] text-white border-b-4 border-[#B2D034] sticky top-0 z-30 shadow-md print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <RioLogo variant="color" size={44} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  Río Supermarket • Auditoría Tecnológica
                </h1>

                {/* INSIGNIA DE ROL ACTIVO (ANALISTA vs COORDINADOR / JEFE ENCARGADO) */}
                <span
                  className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border ${
                    rolActivo === 'COORDINADOR'
                      ? 'bg-[#B2D034] text-[#042f16] border-white'
                      : 'bg-[#042f16] text-white border-[#B2D034]/60'
                  }`}
                >
                  <ShieldCheck size={12} />
                  {rolActivo === 'COORDINADOR'
                    ? 'ROL: JEFE ENCARGADO / COORDINADOR'
                    : 'ROL: ANALISTA'}
                </span>

                {/* BOTÓN MONITOR EN VIVO DE BASE DE DATOS SUPABASE */}
                <button
                  id="btn-abrir-verificador-bd"
                  type="button"
                  onClick={() => setModalBDAbierto(true)}
                  className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono px-2.5 py-1 rounded-lg font-extrabold border transition cursor-pointer ${
                    syncStatus.modo === 'CLOUD_OK'
                      ? 'bg-[#042f16] text-[#B2D034] border-[#B2D034] hover:bg-black/40'
                      : 'bg-amber-400 text-slate-950 border-amber-200 hover:bg-amber-300'
                  }`}
                  title="Haz clic para ver las filas reales guardadas en PostgreSQL (Supabase)"
                >
                  {syncStatus.modo === 'CLOUD_OK' ? (
                    <CheckCircle2 size={12} className="text-[#B2D034]" />
                  ) : (
                    <AlertTriangle size={12} className="text-slate-950" />
                  )}
                  <Database size={11} />
                  <span>
                    {syncStatus.modo === 'CLOUD_OK'
                      ? syncStatus.hora
                        ? `BD Cloud OK (${syncStatus.hora}) • Verificar`
                        : 'Verificar BD Supabase'
                      : 'Aviso RLS BD • Clic para activar'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-[#B2D034] font-medium">
                {sucursalesOficialesCount} Sucursales Oficiales Río •{' '}
                {departamentos.length} Departamentos • {items.length} Ítems •
                Cierre Automático por Día
              </p>
            </div>
          </div>

          {/* Navegación Desktop + Botón Salir */}
          <div className="flex items-center gap-2">
            <nav className="hidden sm:flex items-center gap-1 bg-[#055223] p-1 rounded-xl border border-[#B2D034]/30">
              <button
                id="nav-desktop-checklist"
                onClick={() => setVistaActiva('CHECKLIST')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  vistaActiva === 'CHECKLIST'
                    ? 'bg-[#B2D034] text-[#053316] shadow-xs'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <ClipboardCheck size={14} /> Auditoría ({departamentos.length})
              </button>
              <button
                id="nav-desktop-evaluaciones"
                onClick={() => setVistaActiva('EVALUACIONES')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  vistaActiva === 'EVALUACIONES'
                    ? 'bg-[#B2D034] text-[#053316] shadow-xs'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <History size={14} /> Evaluaciones ({inspecciones.length})
              </button>
              <button
                id="nav-desktop-busqueda"
                onClick={() => setVistaActiva('BUSQUEDA')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  vistaActiva === 'BUSQUEDA'
                    ? 'bg-[#B2D034] text-[#053316] shadow-xs'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <Search size={14} /> Calendario
              </button>
              <button
                id="nav-desktop-reporte"
                onClick={() => {
                  setReporteCaso({
                    id: inspeccionActiva.id,
                    codigo: inspeccionActiva.codigo_caso,
                  });
                  setVistaActiva('REPORTE');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                  vistaActiva === 'REPORTE'
                    ? 'bg-[#B2D034] text-[#053316] shadow-xs'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <FileBarChart2 size={14} /> Impresión PDF
              </button>
            </nav>

            <button
              id="btn-cerrar-sesion"
              onClick={handleCerrarSesion}
              title="Cerrar sesión"
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#055223] hover:bg-[#DB0617] text-white px-3 py-2 rounded-xl border border-[#B2D034]/40 transition cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
        {vistaActiva === 'CHECKLIST' && (
          <InspeccionChecklist
            departamentos={departamentos}
            items={items}
            inspeccionActiva={inspeccionActiva}
            inspeccionesDisponibles={inspecciones}
            rolUsuario={rolActivo}
            onCambiarRol={async (nuevoRol) => {
              await cambiarRolActivoActual(
                nuevoRol,
                session?.user?.email,
                session?.user?.user_metadata?.nombre
              );
              setRolActivo(nuevoRol);
            }}
            onCambiarInspeccion={(id) => setInspeccionActivaId(id)}
            onCrearNuevaInspeccion={handleCrearNuevaInspeccion}
            onFinalizarYVerReporte={(id, codigo) => {
              setReporteCaso({ id, codigo });
              setVistaActiva('REPORTE');
            }}
            onIrAEvaluacionesAnteriores={() => setVistaActiva('EVALUACIONES')}
            onDatosActualizados={() => {
              cargarDatosBase();
              setRefreshCounter((c) => c + 1);
            }}
          />
        )}

        {vistaActiva === 'EVALUACIONES' && (
          <VistaEvaluacionesAnteriores
            inspecciones={inspecciones}
            inspeccionActivaId={inspeccionActiva.id}
            rolUsuario={rolActivo}
            onCambiarRol={async (nuevoRol) => {
              await cambiarRolActivoActual(
                nuevoRol,
                session?.user?.email,
                session?.user?.user_metadata?.nombre
              );
              setRolActivo(nuevoRol);
            }}
            onAbrirInspeccion={(id) => {
              setInspeccionActivaId(id);
              setVistaActiva('CHECKLIST');
            }}
            onVerReportePdf={(id, codigo) => {
              setReporteCaso({ id, codigo });
              setVistaActiva('REPORTE');
            }}
            onDatosActualizados={() => {
              cargarDatosBase();
              setRefreshCounter((c) => c + 1);
            }}
          />
        )}

        {vistaActiva === 'BUSQUEDA' && (
          <ModuloBusquedaCalendario
            departamentos={departamentos}
            onVerReporteCaso={(id, codigo) => {
              setReporteCaso({ id, codigo });
              setVistaActiva('REPORTE');
            }}
            onSeleccionarInspeccionActiva={(id) => {
              setInspeccionActivaId(id);
              setVistaActiva('CHECKLIST');
            }}
            onConfigChange={() => setRefreshCounter((c) => c + 1)}
          />
        )}

        {vistaActiva === 'REPORTE' && (
          <ReporteFinal
            inspeccionId={reporteCaso?.id || inspeccionActiva.id}
            codigoCaso={reporteCaso?.codigo || inspeccionActiva.codigo_caso}
            onVolver={() => setVistaActiva('CHECKLIST')}
          />
        )}
      </main>

      {/* Modal Monitor en Vivo de Base de Datos PostgreSQL (Supabase) */}
      <ModalVerificadorBD
        abierto={modalBDAbierto}
        onCerrar={() => {
          setModalBDAbierto(false);
          cargarDatosBase();
        }}
      />

      {/* Barra de Navegación Táctil Inferior para Móvil */}
      <nav
        aria-label="Navegación móvil principal"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#087334] text-white border-t-4 border-[#B2D034] grid grid-cols-4 py-1.5 px-1.5 shadow-2xl print:hidden"
      >
        <button
          id="nav-mobile-checklist"
          onClick={() => setVistaActiva('CHECKLIST')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
            vistaActiva === 'CHECKLIST'
              ? 'bg-[#B2D034] text-[#053316]'
              : 'text-white/80'
          }`}
        >
          <ClipboardCheck size={17} />
          <span className="mt-0.5">Auditoría</span>
        </button>

        <button
          id="nav-mobile-evaluaciones"
          onClick={() => setVistaActiva('EVALUACIONES')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
            vistaActiva === 'EVALUACIONES'
              ? 'bg-[#B2D034] text-[#053316]'
              : 'text-white/80'
          }`}
        >
          <History size={17} />
          <span className="mt-0.5">Evaluaciones</span>
        </button>

        <button
          id="nav-mobile-busqueda"
          onClick={() => setVistaActiva('BUSQUEDA')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
            vistaActiva === 'BUSQUEDA'
              ? 'bg-[#B2D034] text-[#053316]'
              : 'text-white/80'
          }`}
        >
          <Search size={17} />
          <span className="mt-0.5">Calendario</span>
        </button>

        <button
          id="nav-mobile-reporte"
          onClick={() => {
            setReporteCaso({
              id: inspeccionActiva.id,
              codigo: inspeccionActiva.codigo_caso,
            });
            setVistaActiva('REPORTE');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
            vistaActiva === 'REPORTE'
              ? 'bg-[#B2D034] text-[#053316]'
              : 'text-white/80'
          }`}
        >
          <FileBarChart2 size={17} />
          <span className="mt-0.5">PDF</span>
        </button>
      </nav>
    </div>
  );
}
