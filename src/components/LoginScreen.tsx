'use client';

import { useState } from 'react';
import {
  supabase,
  isSupabaseConfigured,
  RolUsuarioSistema,
  cambiarRolActivoActual,
  resolverRolPorEmail,
} from '@/lib/supabase';
import RioLogo from '@/components/RioLogo';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Smartphone,
  Sparkles,
  CheckCircle2,
  Database,
  UserCheck,
  Crown,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [rolSeleccionado, setRolSeleccionado] =
    useState<RolUsuarioSistema>('ANALISTA');
  const [email, setEmail] = useState(
    isSupabaseConfigured ? '' : 'carlos.mendoza@riosupermarket.com'
  );
  const [password, setPassword] = useState(
    isSupabaseConfigured ? '' : 'RioSistemas2026*'
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.session) {
      setLoading(false);
      setErrorMsg(
        error?.message || 'Error de autenticación. Verifique sus credenciales.'
      );
      return;
    }

    // Resolver o registrar el Rol del usuario en la tabla usuarios_roles de Supabase
    const resuelto = resolverRolPorEmail(email.trim());
    const rolFinal = resuelto.perfil ? resuelto.rol : rolSeleccionado;
    await cambiarRolActivoActual(rolFinal, email.trim());

    setLoading(false);
    onLoginSuccess();
  }

  return (
    <div className="min-h-screen bg-[#042f16] bg-[radial-gradient(ellipse_at_top,_#087334_0%,_#042612_65%,_#02170b_100%)] text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Franja superior multicromática oficial de Río Supermarket */}
      <div className="fixed top-0 inset-x-0 h-1.5 flex z-50">
        <div className="flex-1 bg-[#087334]" />
        <div className="flex-1 bg-[#B2D034]" />
        <div className="flex-1 bg-[#ED4284]" />
        <div className="flex-1 bg-[#FF8700]" />
        <div className="flex-1 bg-[#0095D9]" />
      </div>

      {/* Barra superior informativa */}
      <header className="max-w-md w-full mx-auto pt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RioLogo variant="color" size={48} />
          <div>
            <p className="text-sm font-black tracking-wide uppercase text-white flex items-center gap-1.5">
              Río Supermarket
              <span className="inline-block w-2 h-2 rounded-full bg-[#B2D034]" />
            </p>
            <p className="text-[11px] text-[#B2D034] font-semibold">
              Gerencia de Sistemas • PWA Auditoría
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#087334]/60 border border-[#B2D034]/40 text-white">
          <Smartphone size={12} className="text-[#B2D034]" />
          v3.5 ROLES
        </span>
      </header>

      {/* Contenedor central del formulario */}
      <main className="max-w-md w-full mx-auto my-6">
        <div className="bg-slate-950/90 backdrop-blur-md border-2 border-[#087334] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 relative overflow-hidden">
          {/* Sub-barra verde lima corporativa (#B2D034) */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#087334] via-[#B2D034] to-[#087334]" />

          {/* Cabecera con logo central de Río Supermarket */}
          <div className="flex items-center gap-4 pt-1">
            <RioLogo variant="color" size={64} />
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#B2D034] bg-[#087334]/40 border border-[#B2D034]/40 px-2.5 py-0.5 rounded-full">
                <ShieldCheck size={13} /> Control por Roles (BD)
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Auditoría Tecnológica
              </h1>
              <p className="text-xs text-slate-300">
                Roles: Analista Operativo y Coordinador (Superadmin)
              </p>
            </div>
          </div>

          {/* Selector de Rol de Sesión (Analista vs Coordinador Superadmin) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#B2D034]">
              Selecciona tu Rol de Acceso:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRolSeleccionado('ANALISTA');
                  if (!isSupabaseConfigured || !email) {
                    setEmail('carlos.mendoza@riosupermarket.com');
                  }
                }}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                  rolSeleccionado === 'ANALISTA'
                    ? 'bg-[#087334]/40 border-[#B2D034] text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs text-white">
                  <UserCheck size={15} className="text-[#B2D034]" />
                  <span>ROL: ANALISTA</span>
                </div>
                <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                  Evalúa ítems, firmas y reportes. No modifica sucursales ni
                  personal.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRolSeleccionado('COORDINADOR');
                  if (!isSupabaseConfigured || !email) {
                    setEmail('coordinador@riosupermarket.com');
                  }
                }}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                  rolSeleccionado === 'COORDINADOR'
                    ? 'bg-[#087334]/40 border-[#B2D034] text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs text-[#B2D034]">
                  <Crown size={15} className="text-[#B2D034]" />
                  <span>COORDINADOR</span>
                </div>
                <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                  Superadmin: Gestiona sucursales, analistas, jefes y suplencias
                  en BD.
                </p>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSupabaseConfigured ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#B2D034] bg-[#087334]/30 border border-[#087334] px-3 py-1 rounded-lg">
                <Database size={13} /> Supabase Cloud Conectado (8 Tablas + Roles)
              </div>
            ) : (
              <div className="w-full p-3 rounded-2xl bg-[#087334]/25 border border-[#B2D034]/30 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#B2D034]">
                  <Sparkles size={14} />
                  <span>Entorno Interactivo Preconfigurado</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Los 16 departamentos, 70 ítems individuales y evidencias están listos para inspeccionar.
                </p>
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#DB0617]/15 border border-[#DB0617]/50 text-red-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-[#DB0617]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-bold uppercase tracking-wider text-[#B2D034]"
              >
                Correo Corporativo (Supabase Auth)
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@riosupermarket.com"
                  className="w-full bg-slate-900/90 border border-[#087334] focus:border-[#B2D034] focus:outline-none rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-bold uppercase tracking-wider text-[#B2D034]"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900/90 border border-[#087334] focus:border-[#B2D034] focus:outline-none rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#087334] hover:bg-[#0a8a3e] border-2 border-[#B2D034] active:scale-[0.99] disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-[#087334]/40 flex items-center justify-center gap-2 text-sm transition cursor-pointer"
            >
              {loading ? (
                'Verificando sesión y rol en Supabase...'
              ) : (
                <>
                  Entrar como{' '}
                  {rolSeleccionado === 'COORDINADOR'
                    ? 'Coordinador (Superadmin)'
                    : 'Analista de Sistemas'}{' '}
                  <ArrowRight size={17} className="text-[#B2D034]" />
                </>
              )}
            </button>
          </form>

          {/* Resumen de seguridad y paleta oficial */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#B2D034] shrink-0" />
              <span>Sin registro público</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#B2D034] shrink-0" />
              <span>Signed URLs (3600s)</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-center text-[11px] text-[#B2D034]/80 pb-2 font-medium">
        Río Supermarket® • Departamento de Sistemas y Auditoría Tecnológica
      </footer>
    </div>
  );
}
