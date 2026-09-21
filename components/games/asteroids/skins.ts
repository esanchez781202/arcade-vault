// ===== components/games/asteroids/skins.ts =====
// Paletas de ASTEROIDS. `clasico` es una copia fiel de los literales que
// tenía engine.ts antes de esta migración (ver git blame) — no se toca
// nunca por estética. `retro` y `neon` diseñadas con /frontend-design y
// verificadas con Playwright (ver references/games-with-themes.md).

import type { SkinBaseId, SkinSet } from "../skins";

/** Roles propios de Asteroids: bala del disparo y llama del propulsor. */
export type AsteroidsRole = "bala" | "propulsor";

export const ASTEROIDS_SKINS: SkinSet<SkinBaseId, AsteroidsRole> = {
  clasico: {
    bg: "#000000",
    grid: "transparent",
    ink: "#ffffff",
    inkDim: "#ffffff",
    accent: "#00ffff",
    // Sin consumidor hoy: Particle no distingue origen de la explosión
    // (nave vs. asteroide), así que diferenciar "danger" sería tocar
    // lógica de dibujo fuera del alcance de esta migración.
    danger: "#ffffff",
    hud: "#ffffff",
    glow: null,
    entities: {
      bala: "#ffffff",
      propulsor: "rgba(255, 130, 0, 0.85)",
    },
  },
  retro: {
    bg: "#140f0a",
    grid: "transparent",
    ink: "#ffb545",
    inkDim: "#c07a1e",
    accent: "#8dff5a",
    danger: "#ff6a2b",
    hud: "#ffd9a0",
    glow: null,
    entities: {
      bala: "#fff0c8",
      propulsor: "rgba(255, 170, 60, 0.9)",
    },
  },
  neon: {
    bg: "#000000",
    grid: "transparent",
    ink: "#00f5ff",
    inkDim: "#7df9ff",
    accent: "#ff006e",
    danger: "#ff3131",
    hud: "#f5ff00",
    glow: "#00f5ff",
    entities: {
      bala: "#ffffff",
      propulsor: "rgba(255, 0, 110, 0.9)",
    },
  },
};

export const ASTEROIDS_SKIN_IDS = Object.keys(ASTEROIDS_SKINS) as readonly SkinBaseId[];
