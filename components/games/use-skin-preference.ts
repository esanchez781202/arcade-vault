"use client";

// ===== components/games/use-skin-preference.ts =====
// Hook compartido para el selector de skin genérico de JugarClient.tsx.
// Arranca en `permitidas[0]` tanto en servidor como en cliente (evita
// desincronizar el HTML de hidratación) y lee la preferencia guardada en
// `localStorage` tras montar — mismo patrón antihidratación que usaba
// JugarClient.tsx para tetrisTheme/tetrisSkin antes de la migración a
// skins genéricas.

import { useEffect, useState } from "react";
import { guardarSkin, leerSkin, type SkinId } from "./skins";

export function useSkinPreference(gameId: string, permitidas: readonly SkinId[]) {
  const [skin, setSkinState] = useState<SkinId>(permitidas[0]);

  useEffect(() => {
    setSkinState(leerSkin(gameId, permitidas));
    // Solo al montar (o si cambia el juego): no se relee en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  function setSkin(next: SkinId) {
    setSkinState(next);
    guardarSkin(gameId, next);
  }

  return [skin, setSkin] as const;
}
