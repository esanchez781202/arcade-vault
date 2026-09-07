"use client";

// Sesión en memoria (Context) hidratada desde localStorage `av_user`.
// Portado de references/templates/app.jsx (handleLogin / handleSignOut).
// El primer render siempre es user = null para no desincronizar la
// hidratación SSR → cliente; el valor de `av_user` se aplica en useEffect.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface SessionUser {
  name: string; // en mayúsculas, máx. 10 chars
}

interface SessionValue {
  user: SessionUser | null;
  login: (u: SessionUser | null) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("av_user");
      if (raw) setUser(JSON.parse(raw) as SessionUser);
    } catch {
      // localStorage no disponible (modo privado): la sesión vive solo en memoria.
    }
  }, []);

  const login = useCallback((u: SessionUser | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem("av_user", JSON.stringify(u));
      else localStorage.removeItem("av_user");
    } catch {
      // sin persistencia: la sesión sigue en memoria.
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem("av_user");
    } catch {
      // no-op
    }
  }, []);

  return (
    <SessionContext.Provider value={{ user, login, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession() debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
