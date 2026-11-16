// src/components/Login.tsx
import React, { useState, useEffect } from 'react';
import { supabase, getLocalTeamMembers } from '../lib/supabase';
import { LogIn, AlertCircle, Loader2, Lock, User, Sun, Moon } from 'lucide-react';
import { WoofLogo } from './WoofLogo';
import { reproducirLadridoAlerta } from '../lib/audioAlert';

interface LoginProps {
  onSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modo Claro / Oscuro en Login (por defecto modo Claro / Blanco)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('woof_theme_mode');
      if (saved) return saved === 'dark';
      return false; // Por defecto blanco
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('woof_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('woof_theme_mode', 'light');
    }
  }, [isDark]);

  // Traducir mensajes de error comunes de Supabase Auth a español claro
  const humanizarError = (error: string): string => {
    const err = error.toLowerCase();
    if (err.includes('invalid login credentials') || err.includes('invalid_grant')) {
      return 'Credenciales incorrectas. Verifica tu usuario/correo y contraseña.';
    }
    if (err.includes('user not found')) {
      return 'No se encontró un usuario con esas credenciales.';
    }
    if (err.includes('email not confirmed')) {
      return 'Debes confirmar tu correo electrónico antes de ingresar. Revisa tu casilla de entrada.';
    }
    if (err.includes('password should be at least')) {
      return 'La contraseña debe contener al menos 6 caracteres.';
    }
    if (err.includes('rate limit')) {
      return 'Demasiados intentos seguidos. Por favor espera unos minutos antes de volver a intentar.';
    }
    if (err.includes('database error querying schema')) {
      return 'El usuario fue creado pero le falta la identidad de acceso en Supabase Auth. Ejecuta el script SQL de reparación en Supabase.';
    }
    return error || 'Ocurrió un error al procesar el inicio de sesión.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const inputLimpio = identificador.trim();
    const passLimpia = password.trim();

    if (!inputLimpio || !passLimpia) {
      setErrorMessage('Por favor ingresa tu usuario o correo y tu contraseña.');
      return;
    }

    setLoading(true);

    try {
      let emailFinal = inputLimpio;

      // Si el usuario ingresó un nombre de usuario (sin '@'), buscamos su email asociado
      if (!inputLimpio.includes('@')) {
        // Función para normalizar texto (elimina tildes y espacios extras)
        const normalizar = (txt: string) =>
          txt
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

        const inputNorm = normalizar(inputLimpio);

        // 1. Búsqueda instantánea en miembros guardados localmente
        const miembrosLocales = getLocalTeamMembers();
        const miembroEncontrado = miembrosLocales.find((m) => {
          const nomNorm = normalizar(m.nombre || '');
          const emailNorm = normalizar(m.email || '');
          const prefix = emailNorm.split('@')[0];
          return (
            nomNorm === inputNorm ||
            prefix === inputNorm ||
            emailNorm.startsWith(inputNorm + '@') ||
            nomNorm.includes(inputNorm) ||
            prefix.includes(inputNorm)
          );
        });

        if (miembroEncontrado && miembroEncontrado.email) {
          emailFinal = miembroEncontrado.email;
        } else {
          // 2. Intentar resolver mediante la función RPC segura en Supabase (bypassea RLS)
          try {
            const { data: rpcEmail, error: rpcErr } = await supabase.rpc(
              'resolver_email_usuario',
              { p_username: inputLimpio },
            );
            if (!rpcErr && rpcEmail) {
              emailFinal = rpcEmail;
            }
          } catch {}
        }

        // 3. Si aún no lo resolvió, consultar tabla 'perfiles' en Supabase de forma abierta
        if (emailFinal === inputLimpio) {
          try {
            const { data: todosPerfiles } = await supabase
              .from('perfiles')
              .select('email, nombre');

            if (todosPerfiles && todosPerfiles.length > 0) {
              const coincidencia = todosPerfiles.find((p: any) => {
                const n = normalizar(p.nombre || '');
                const e = normalizar(p.email || '');
                const pre = e.split('@')[0];
                return (
                  n === inputNorm ||
                  pre === inputNorm ||
                  n.includes(inputNorm) ||
                  pre.includes(inputNorm)
                );
              });
              if (coincidencia?.email) {
                emailFinal = coincidencia.email;
              }
            }
          } catch {}
        }

        // 4. Si aún no tiene '@', avisar amablemente
        if (!emailFinal.includes('@')) {
          throw new Error(
            `No encontramos un correo registrado para el usuario "${inputLimpio}". Puedes ingresar colocando tu correo completo.`,
          );
        }
      }

      // Autenticar contra Supabase Auth con el email resuelto
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailFinal,
        password: passLimpia,
      });

      if (error) {
        throw error;
      }

      if (data?.session) {
        onSuccess?.();
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      setErrorMessage(humanizarError(err?.message || 'Error al iniciar sesión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#151515] text-neutral-900 dark:text-neutral-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-amber-200 dark:selection:bg-amber-900/40 transition-colors duration-200 relative">
      
      {/* Botón flotante superior para alternar modo oscuro en Login */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#202020] text-neutral-600 dark:text-neutral-300 hover:text-amber-500 shadow-2xs transition cursor-pointer"
          title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
        </button>
      </div>

      {/* Tarjeta de Autenticación estilo Notion con Isotipo Oficial Yema */}
      <div className="w-full max-w-md bg-white dark:bg-[#202020] rounded-2xl shadow-xl dark:shadow-2xl border border-neutral-200 dark:border-neutral-800 p-8 space-y-6 transition-colors duration-200">
        
        {/* Encabezado con Isotipo Oficial */}
        <div className="text-center space-y-3">
          <button 
            type="button"
            onClick={() => reproducirLadridoAlerta(true)}
            className="inline-flex p-2 rounded-2xl bg-amber-400/10 dark:bg-amber-400/20 border border-amber-400/30 dark:border-amber-400/40 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            title="Woof! 🐾"
          >
            <WoofLogo size={56} animated={true} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center justify-center">
              Woof Woof
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Plataforma de gestión y seguimiento de tickets
            </p>
          </div>
        </div>

        {/* Alerta de Error */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="flex-1 leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Formulario de Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Identificador (Email o Nombre de Usuario) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
              Correo o Nombre de Usuario:
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                placeholder="Ej. lucia.gomez o tu-correo@empresa.com"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 focus:outline-none transition shadow-2xs"
              />
            </div>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
              Ingresa con tu nombre tal como figura en tu perfil o tu correo completo.
            </p>
          </div>

          {/* Contraseña */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
              Contraseña:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          {/* Botón de Iniciar Sesión */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-neutral-950 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow cursor-pointer flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Iniciando sesión en Woof Woof...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Iniciar Sesión</span>
              </>
            )}
          </button>

        </form>

      </div>

      {/* Footer minimalista */}
      <div className="mt-6 flex items-center space-x-2 text-xs text-neutral-400 dark:text-neutral-600">
        <span>🐾</span>
        <span>Woof Woof Ticketing Workspace</span>
      </div>

    </div>
  );
};
