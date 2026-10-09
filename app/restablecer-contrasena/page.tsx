"use client";

// Pantalla de recuperación de contraseña, destino de `resetPasswordForEmail`.
// Supabase (cliente de navegador, `detectSessionInUrl` activo por defecto)
// intercambia el `code` de la URL por una sesión temporal de recuperación
// antes de que este componente pueda comprobarla con getSession().

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase/client";

type Estado = "cargando" | "listo" | "sin-sesion" | "hecho";

export default function RestablecerContrasena() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [pass, setPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const supabase = crearClienteSupabase();

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session) setEstado("listo");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setEstado("listo");
        return;
      }
      // El intercambio del `code` de la URL por sesión es asíncrono: se da
      // un margen antes de concluir que el enlace está caducado o reutilizado.
      setTimeout(async () => {
        const {
          data: { session: sesionTardia },
        } = await supabase.auth.getSession();
        setEstado(sesionTardia ? "listo" : "sin-sesion");
      }, 1500);
    });

    return () => suscripcion.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pass !== confirmarPass) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (pass.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCargando(true);
    const supabase = crearClienteSupabase();
    const { error: errorSupabase } = await supabase.auth.updateUser({ password: pass });
    setCargando(false);
    if (errorSupabase) {
      setError(errorSupabase.message);
      return;
    }
    router.push("/biblioteca");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            NUEVA CONTRASEÑA
          </div>
        </div>

        {estado === "cargando" && (
          <p className="mono" style={{ textAlign: "center", color: "var(--ink-dim)" }}>
            Comprobando el enlace…
          </p>
        )}

        {estado === "sin-sesion" && (
          <div className="slide-in" style={{ textAlign: "center" }}>
            <p className="mono" style={{ color: "var(--ink)", fontSize: 13, lineHeight: 1.6 }}>
              Este enlace de recuperación ha caducado o ya se usó.
            </p>
            <Link
              href="/acceso"
              className="btn lg"
              style={{ width: "100%", marginTop: 16, display: "block", textAlign: "center" }}
            >
              VOLVER A INICIAR SESIÓN
            </Link>
          </div>
        )}

        {estado === "listo" && (
          <form onSubmit={submit} className="slide-in">
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={confirmarPass}
                onChange={(e) => setConfirmarPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="mono" style={{ color: "var(--magenta)", fontSize: 12, marginTop: 4 }}>
                {error}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={cargando}
              style={{ width: "100%", marginTop: 8 }}
            >
              GUARDAR CONTRASEÑA
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
