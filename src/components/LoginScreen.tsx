'use client';

import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
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

    setLoading(false);

    if (error || !data.session) {
      setErrorMsg(
        error?.message || 'Error de autenticación. Verifique sus credenciales.'
      );
      return;
    }

    onLoginSuccess();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Barra superior informativa */}
      <header className="max-w-md w-full mx-auto pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shadow-sm">
            RÍO
          </div>
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-white">
              Río Supermarket
            </p>
            <p className="text-[11px] text-slate-400">
              Gerencia de Sistemas • PWA Mobile-First
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
          <Smartphone size={12} className="text-amber-400" />
          v2.4 PWA
        </span>
      </header>

      {/* Contenedor central del formulario */}
      <main className="max-w-md w-full mx-auto my-8">
        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
                <ShieldCheck size={14} /> Acceso Restringido (RLS Activo)
              </div>
              {isSupabaseConfigured && (
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  <Database size={13} /> Supabase Cloud Conectado
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Auditoría Tecnológica Diaria
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Inspección táctica de los 16 departamentos operativos, captura de
              evidencia en bucket privado y reportes ejecutivos.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <Sparkles size={14} />
                <span>Entorno Demo Interactivo Preconfigurado</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Los 16 departamentos, 70 ítems individuales, casos históricos y el
                bucket simulado están listos para usar.
              </p>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Correo Corporativo (Supabase Auth)
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@riosupermarket.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 transition"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm transition cursor-pointer"
            >
              {loading ? (
                'Verificando sesión en Supabase Auth...'
              ) : (
                <>
                  Iniciar Sesión de Auditoría <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Resumen de seguridad */}
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span>Sin registro público</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span>Signed URLs (3600s)</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-center text-[11px] text-slate-500 pb-2">
        Río Supermarket • Departamento de Sistemas y Auditoría Tecnológica
      </footer>
    </div>
  );
}
