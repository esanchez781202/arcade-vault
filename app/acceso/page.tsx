"use client";

// Pantalla Acceso. Portado de references/templates/auth.jsx.
// Autenticación real con Supabase Auth; los botones sociales se activan
// en un paso posterior de esta misma spec.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase/client";

export default function Auth() {
  const router = useRouter();

  const [tab, setTab] = useState<"in" | "up">("in");
  const [pantalla, setPantalla] = useState<
    "form" | "revisa-correo" | "recuperar" | "revisa-recuperacion"
  >("form");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const iniciarOAuth = async (provider: "google" | "github") => {
    setError(null);
    const supabase = crearClienteSupabase();
    const { error: errorSupabase } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (errorSupabase) setError(errorSupabase.message);
  };

  const volverAIniciarSesion = () => {
    setPantalla("form");
    setTab("in");
    setError(null);
    setPass("");
    setConfirmarPass("");
  };

  const submitRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const supabase = crearClienteSupabase();
    const { error: errorSupabase } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/restablecer-contrasena`,
    });
    setCargando(false);
    if (errorSupabase) {
      setError(errorSupabase.message);
      return;
    }
    setPantalla("revisa-recuperacion");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === "in") {
      setCargando(true);
      const supabase = crearClienteSupabase();
      const { error: errorSupabase } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      setCargando(false);
      if (errorSupabase) {
        setError(errorSupabase.message);
        return;
      }
      router.push("/biblioteca");
      return;
    }

    // CREAR CUENTA
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
    const { error: errorSupabase } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { display_name: (user || "PLAYER1").toUpperCase().slice(0, 10) },
      },
    });
    setCargando(false);
    if (errorSupabase) {
      setError(errorSupabase.message);
      return;
    }
    setPantalla("revisa-correo");
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
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {pantalla === "revisa-correo" || pantalla === "revisa-recuperacion" ? (
          <div className="slide-in" style={{ textAlign: "center" }}>
            <p className="mono" style={{ color: "var(--ink)", fontSize: 13, lineHeight: 1.6 }}>
              {pantalla === "revisa-correo"
                ? "Te hemos enviado un enlace de confirmación a "
                : "Te hemos enviado un enlace para restablecer tu contraseña a "}
              <strong>{email}</strong>
            </p>
            <button
              className="btn lg"
              type="button"
              style={{ width: "100%", marginTop: 16 }}
              onClick={volverAIniciarSesion}
            >
              VOLVER A INICIAR SESIÓN
            </button>
          </div>
        ) : pantalla === "recuperar" ? (
          <div className="slide-in">
            <form onSubmit={submitRecuperar}>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                />
              </div>

              {error && (
                <div
                  className="mono"
                  style={{ color: "var(--magenta)", fontSize: 12, marginTop: 4 }}
                >
                  {error}
                </div>
              )}

              <button
                className="btn lg"
                type="submit"
                disabled={cargando}
                style={{ width: "100%", marginTop: 8 }}
              >
                ENVIAR ENLACE
              </button>
            </form>

            <button
              className="btn ghost"
              type="button"
              style={{ width: "100%", marginTop: 10 }}
              onClick={volverAIniciarSesion}
            >
              VOLVER A INICIAR SESIÓN
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button className={tab === "in" ? "on" : ""} onClick={() => setTab("in")}>
                INICIAR SESIÓN
              </button>
              <button className={tab === "up" ? "on" : ""} onClick={() => setTab("up")}>
                CREAR CUENTA
              </button>
            </div>

            <form onSubmit={submit}>
              {tab === "up" && (
                <div className="field">
                  <label>Usuario</label>
                  <input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="px_kai"
                    maxLength={10}
                  />
                </div>
              )}
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {tab === "up" && (
                <div className="field">
                  <label>Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmarPass}
                    onChange={(e) => setConfirmarPass(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              )}

              {error && (
                <div
                  className="mono"
                  style={{ color: "var(--magenta)", fontSize: 12, marginTop: 4 }}
                >
                  {error}
                </div>
              )}

              <button
                className="btn lg"
                type="submit"
                disabled={cargando}
                style={{ width: "100%", marginTop: 8 }}
              >
                {tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
              </button>
            </form>

            {tab === "in" && (
              <button
                className="btn ghost"
                type="button"
                style={{
                  width: "100%",
                  marginTop: 10,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                }}
                onClick={() => {
                  setError(null);
                  setPantalla("recuperar");
                }}
              >
                ¿OLVIDASTE TU CONTRASEÑA?
              </button>
            )}

            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => router.push("/biblioteca")}
            >
              JUGAR COMO INVITADO
            </button>

            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button className="btn ghost" type="button" onClick={() => iniciarOAuth("google")}>
                ◆ GOOGLE
              </button>
              <button className="btn ghost" type="button" onClick={() => iniciarOAuth("github")}>
                ▣ GITHUB
              </button>
            </div>

            <div
              style={{
                marginTop: 18,
                textAlign: "center",
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
            </div>
          </>
        )}
      </div>
    </div>
  );
}
