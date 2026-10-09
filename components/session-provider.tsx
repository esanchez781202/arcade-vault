"use client";

// Sesión real (Context) hidratada desde Supabase Auth.
// El primer render siempre es user = null para no desincronizar la
// hidratación SSR → cliente; `getSession()` resuelve el valor real en
// useEffect y `onAuthStateChange` lo mantiene sincronizado después.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { crearClienteSupabase } from "@/lib/supabase/client";

export interface SessionUser {
  name: string; // en mayúsculas, máx. 10 chars
}

interface SessionValue {
  user: SessionUser | null;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function derivarNombre(usuario: User): string {
  const metadata = usuario.user_metadata ?? {};
  const base =
    metadata.display_name ??
    metadata.full_name ??
    metadata.name ??
    usuario.email?.split("@")[0] ??
    "PLAYER1";
  return String(base).toUpperCase().slice(0, 10);
}

function sesionAUsuario(session: Session | null): SessionUser | null {
  return session?.user ? { name: derivarNombre(session.user) } : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const supabase = crearClienteSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(sesionAUsuario(session));
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, session) => {
      setUser(sesionAUsuario(session));
    });

    return () => suscripcion.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(() => {
    crearClienteSupabase().auth.signOut();
  }, []);

  return <SessionContext.Provider value={{ user, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession() debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
