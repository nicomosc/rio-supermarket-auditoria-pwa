'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  isSupabaseConfigured,
  Departamento,
  ChecklistItem,
  Inspeccion,
} from '@/lib/supabase';
import LoginScreen from '@/components/LoginScreen';
import AlertaReporteBanner from '@/components/AlertaReporteBanner';
import InspeccionChecklist from '@/components/InspeccionChecklist';
import ModuloBusquedaCalendario from '@/components/ModuloBusquedaCalendario';
import ReporteFinal from '@/components/ReporteFinal';
import {
  ClipboardCheck,
  Search,
  FileBarChart2,
  LogOut,
  Database,
  PlusCircle,
} from 'lucide-react';

type VistaActiva = 'CHECKLIST' | 'BUSQUEDA' | 'REPORTE';

export default function HomePage() {
  const [session, setSession] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('CHECKLIST');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [inspeccionActivaId, setInspeccionActivaId] = useState<string>('');
  const [reporteCaso, setReporteCaso] = useState<{
    id: string;
    codigo: string;
  } | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Estado para crear la primera inspección cuando la tabla inspecciones está vacía en Supabase
  const [analistaInicial, setAnalistaInicial] = useState('Ing. Analista de Sistemas');
  const [turnoInicial, setTurnoInicial] = useState('Mañana (07:00 - 15:00)');
  const [creandoInicial, setCreandoInicial] = useState(false);

  // 1. Verificar sesión en Supabase Auth
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user?.email) {
        setAnalistaInicial(
          data.session.user.user_metadata?.nombre || data.session.user.email
        );
      }
      setAuthChecked(true);
    }
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user?.email) {
          setAnalistaInicial(
            newSession.user.user_metadata?.nombre || newSession.user.email
          );
        }
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2. Cargar catálogo de los 16 departamentos, ítems e inspecciones desde Supabase
  const cargarDatosBase = useCallback(async () => {
    const [{ data: deptosData }, { data: itemsData }, { data: inspData }] =
      await Promise.all([
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

    if (deptosData) setDepartamentos(deptosData as Departamento[]);
    if (itemsData) setItems(itemsData as ChecklistItem[]);
    if (inspData) {
      const lista = inspData as Inspeccion[];
      setInspecciones(lista);
      if (lista.length > 0) {
        setInspeccionActivaId((prev) => {
          if (prev && lista.some((i) => i.id === prev)) return prev;
          const enProgreso = lista.find((i) => i.estado === 'EN_PROGRESO');
          return enProgreso ? enProgreso.id : lista[0].id;
        });
      }
    }
  }, []);

  useEffect(() => {
    if (session) {
      cargarDatosBase();
    }
  }, [session, cargarDatosBase, refreshCounter]);

  async function handleCrearNuevaInspeccion(analista: string, turno: string) {
    setCreandoInicial(true);
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('inspecciones')
      .insert({
        analista_nombre: analista,
        turno,
        fecha_operativa: hoy,
        estado: 'EN_PROGRESO',
      })
      .select('*')
      .single();

    setCreandoInicial(false);

    if (data) {
      const nueva = data as Inspeccion;
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
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center p-6 text-xs font-mono">
        Verificando sesión de auditoría tecnológica...
      </div>
    );
  }

  // Bloquea toda la aplicación si no existe una sesión válida
  if (!session) {
    return <LoginScreen onLoginSuccess={() => cargarDatosBase()} />;
  }

  const inspeccionActiva =
    inspecciones.find((i) => i.id === inspeccionActivaId) || inspecciones[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 pb-20 sm:pb-8">
      {/* Banner superior conectado a verificar_reporte_diario() */}
      <AlertaReporteBanner
        refreshTrigger={refreshCounter}
        onIrACasoPendiente={() => setVistaActiva('BUSQUEDA')}
      />

      {/* Cabecera Corporativa Río Supermarket */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs shrink-0">
              RÍO
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight">
                  Río Supermarket • Auditoría Tecnológica
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono bg-slate-800 text-amber-400 border border-slate-700 px-2 py-0.5 rounded-md">
                  <Database size={11} />
                  {isSupabaseConfigured ? 'Supabase Cloud Activo' : 'Modo Demo Local'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                16 Departamentos Independientes • Evidencias Privadas • Reporte Ejecutivo
              </p>
            </div>
          </div>

          {/* Navegación Desktop + Botón Salir */}
          <div className="flex items-center gap-2">
            <nav className="hidden sm:flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
              <button
                id="nav-desktop-checklist"
                onClick={() => setVistaActiva('CHECKLIST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  vistaActiva === 'CHECKLIST'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ClipboardCheck size={14} /> Checklist (16)
              </button>
              <button
                id="nav-desktop-busqueda"
                onClick={() => setVistaActiva('BUSQUEDA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  vistaActiva === 'BUSQUEDA'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Search size={14} /> Calendario y Filtros
              </button>
              <button
                id="nav-desktop-reporte"
                onClick={() => {
                  if (inspeccionActiva) {
                    setReporteCaso({
                      id: inspeccionActiva.id,
                      codigo: inspeccionActiva.codigo_caso,
                    });
                  }
                  setVistaActiva('REPORTE');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  vistaActiva === 'REPORTE'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileBarChart2 size={14} /> Reporte PDF
              </button>
            </nav>

            <button
              id="btn-cerrar-sesion"
              onClick={handleCerrarSesion}
              title="Cerrar sesión"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-red-950/80 hover:text-red-200 text-slate-200 px-3 py-2 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
        {vistaActiva === 'CHECKLIST' &&
          (inspeccionActiva ? (
            <InspeccionChecklist
              departamentos={departamentos}
              items={items}
              inspeccionActiva={inspeccionActiva}
              inspeccionesDisponibles={inspecciones}
              onCambiarInspeccion={(id) => setInspeccionActivaId(id)}
              onCrearNuevaInspeccion={handleCrearNuevaInspeccion}
              onFinalizarYVerReporte={(id, codigo) => {
                setReporteCaso({ id, codigo });
                setVistaActiva('REPORTE');
              }}
              onDatosActualizados={() => setRefreshCounter((c) => c + 1)}
            />
          ) : (
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Iniciar Inspección del Turno Actual
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Crea el primer caso de auditoría en Supabase (auto-genera código{' '}
                  <code className="font-mono">CAS-XXXX</code>) para evaluar los{' '}
                  {departamentos.length || 16} departamentos.
                </p>
              </div>
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Analista Responsable
                  </label>
                  <input
                    type="text"
                    value={analistaInicial}
                    onChange={(e) => setAnalistaInicial(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Turno Operativo
                  </label>
                  <select
                    value={turnoInicial}
                    onChange={(e) => setTurnoInicial(e.target.value)}
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
              <button
                onClick={() =>
                  handleCrearNuevaInspeccion(analistaInicial, turnoInicial)
                }
                disabled={creandoInicial}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm transition cursor-pointer"
              >
                <PlusCircle size={16} />
                {creandoInicial
                  ? 'Creando inspección en Supabase...'
                  : 'Comenzar Auditoría Diaria'}
              </button>
            </div>
          ))}

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
          />
        )}

        {vistaActiva === 'REPORTE' && (
          <ReporteFinal
            inspeccionId={reporteCaso?.id || inspeccionActiva?.id || ''}
            codigoCaso={
              reporteCaso?.codigo || inspeccionActiva?.codigo_caso || 'CAS-0001'
            }
            onVolver={() => setVistaActiva('CHECKLIST')}
          />
        )}
      </main>

      {/* Barra de Navegación Táctil Inferior para Móvil (Mobile-First One-Handed Use) */}
      <nav
        aria-label="Navegación móvil principal"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 text-white border-t border-slate-800 grid grid-cols-3 py-1.5 px-2 shadow-2xl"
      >
        <button
          id="nav-mobile-checklist"
          onClick={() => setVistaActiva('CHECKLIST')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
            vistaActiva === 'CHECKLIST'
              ? 'text-amber-400 bg-slate-800'
              : 'text-slate-400'
          }`}
        >
          <ClipboardCheck size={18} />
          <span className="mt-0.5">Checklist (16)</span>
        </button>

        <button
          id="nav-mobile-busqueda"
          onClick={() => setVistaActiva('BUSQUEDA')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
            vistaActiva === 'BUSQUEDA'
              ? 'text-amber-400 bg-slate-800'
              : 'text-slate-400'
          }`}
        >
          <Search size={18} />
          <span className="mt-0.5">Calendario/Casos</span>
        </button>

        <button
          id="nav-mobile-reporte"
          onClick={() => {
            if (inspeccionActiva) {
              setReporteCaso({
                id: inspeccionActiva.id,
                codigo: inspeccionActiva.codigo_caso,
              });
            }
            setVistaActiva('REPORTE');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
            vistaActiva === 'REPORTE'
              ? 'text-amber-400 bg-slate-800'
              : 'text-slate-400'
          }`}
        >
          <FileBarChart2 size={18} />
          <span className="mt-0.5">Reporte PDF</span>
        </button>
      </nav>
    </div>
  );
}
