"use client";

// Chequeo de navegador para /diagnostico-supabase (ver SPEC 04). Corre
// crearClienteSupabase() + auth.getSession() en el cliente, misma lógica
// que el Server Component padre.

import { useEffect, useState } from "react";
import { crearClienteSupabase } from "@/lib/supabase/client";

type Estado = { cargando: boolean; ok: boolean; mensaje: string };

export function ComprobacionNavegador() {
  const [estado, setEstado] = useState<Estado>({ cargando: true, ok: false, mensaje: "" });

  useEffect(() => {
    let cancelado = false;

    async function comprobar() {
      try {
        const supabase = crearClienteSupabase();
        const { error } = await supabase.auth.getSession();
        if (cancelado) return;
        if (error) {
          setEstado({ cargando: false, ok: false, mensaje: error.message });
        } else {
          setEstado({ cargando: false, ok: true, mensaje: "CONEXIÓN OK · SIN SESIÓN" });
        }
      } catch (err) {
        if (cancelado) return;
        const mensaje = err instanceof Error ? err.message : String(err);
        setEstado({ cargando: false, ok: false, mensaje });
      }
    }

    comprobar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (estado.cargando) {
    return (
      <div className="pixel" style={{ color: "var(--ink-faint)" }}>
        &gt; NAVEGADOR: COMPROBANDO…
      </div>
    );
  }

  return (
    <div className={"pixel " + (estado.ok ? "neon-green" : "neon-magenta")}>
      {estado.ok
        ? "> NAVEGADOR: CONEXIÓN OK · SIN SESIÓN"
        : `> NAVEGADOR: ERROR DE CONEXIÓN: ${estado.mensaje}`}
    </div>
  );
}
