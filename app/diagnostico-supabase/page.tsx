// Ruta de diagnóstico temporal (ver SPEC 04). No enlazada desde nav ni
// footer — se accede escribiendo la URL directamente. Se borra en la
// primera spec que implemente funcionalidad real contra Supabase (auth,
// leaderboard o catálogo).

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { ComprobacionNavegador } from "./comprobacion-navegador";

async function comprobarServidor(): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const supabase = await crearClienteSupabaseServidor();
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { ok: false, mensaje: error.message };
    }
    return { ok: true, mensaje: "CONEXIÓN OK · SIN SESIÓN" };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    return { ok: false, mensaje };
  }
}

export default async function DiagnosticoSupabase() {
  const servidor = await comprobarServidor();

  return (
    <div className="about-hero fade-in">
      <div className="kicker pixel neon-cyan">▸ DIAGNÓSTICO</div>
      <h1 className="about-title">DIAGNÓSTICO SUPABASE</h1>

      <div
        className="terminal-success"
        style={{ margin: "32px auto 0", maxWidth: 640, textAlign: "left" }}
      >
        <div className="term-bar">
          <span className="dot r" />
          <span className="dot y" />
          <span className="dot g" />
          <span className="term-title">VAULT-OS // DIAGNOSTICO-SUPABASE</span>
        </div>
        <div className="term-body">
          <div className={"pixel " + (servidor.ok ? "neon-cyan" : "neon-magenta")}>
            {servidor.ok
              ? "> SERVIDOR: CONEXIÓN OK · SIN SESIÓN"
              : `> SERVIDOR: ERROR DE CONEXIÓN: ${servidor.mensaje}`}
          </div>
          <ComprobacionNavegador />
        </div>
      </div>
    </div>
  );
}
