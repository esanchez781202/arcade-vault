// ===== components/games/arkanoid/skins.ts =====
// Paletas de ARKANOID. `clasico` es una copia fiel de los literales que
// tenía engine.ts antes de esta migración (ver git blame) — no se toca
// nunca por estética. `retro` y `neon` diseñadas con /frontend-design y
// verificadas con Playwright (ver references/games-with-themes.md).

import type { SkinBaseId, SkinSet } from "../skins";

/**
 * Roles propios de Arkanoid: un color por familia de bloque del nivel
 * (antes `BLOCK_COLOR_HEX` en engine.ts). El nivel decide qué rol pinta
 * cada bloque (`BlockSeed.color`); la skin decide a qué color corresponde
 * ese rol.
 */
export type ArkanoidBlockRole =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

export const ARKANOID_SKINS: SkinSet<SkinBaseId, ArkanoidBlockRole> = {
  clasico: {
    bg: "#000000",
    grid: "transparent",
    // Pala.
    ink: "#ffffff",
    // Relleno del botón inactivo del selector de nivel en pausa (antes "#444").
    inkDim: "#444444",
    // Bola. Coincide con `ink` a propósito: en el original pala y bola
    // comparten el mismo blanco — retro/neon sí las distinguen.
    accent: "#ffffff",
    // Sin consumidor hoy: la explosión reutiliza el color del propio bloque
    // destruido, no un color de "peligro" aparte.
    danger: "#ffffff",
    // Texto/trazos del selector de nivel en pausa (antes "#fff").
    hud: "#ffffff",
    glow: null,
    entities: {
      red: "#ff3b3b",
      yellow: "#f0c040",
      cyan: "#00e5ff",
      magenta: "#ff2fd0",
      hotpink: "#ff69b4",
      green: "#39ff6a",
      gray: "#8a8a94",
    },
  },
  retro: {
    bg: "#140f0a",
    grid: "transparent",
    ink: "#e0b060",
    inkDim: "#5a4a2e",
    accent: "#8fd45a",
    danger: "#ff6a2b",
    hud: "#e8c98a",
    glow: null,
    entities: {
      red: "#b5432c",
      yellow: "#c9a13a",
      cyan: "#4a9a92",
      magenta: "#9a4a7a",
      hotpink: "#b5638a",
      green: "#5a9a4a",
      gray: "#6a6a5a",
    },
  },
  neon: {
    bg: "#000000",
    grid: "transparent",
    ink: "#00f5ff",
    inkDim: "#0a3a3d",
    accent: "#ff9d00",
    danger: "#ff3131",
    hud: "#f5ff00",
    glow: "#00f5ff",
    entities: {
      red: "#ff1053",
      yellow: "#e8ff00",
      cyan: "#18ffe0",
      magenta: "#c400ff",
      hotpink: "#ff5fc0",
      green: "#00ff9d",
      gray: "#7a5cff",
    },
  },
};

export const ARKANOID_SKIN_IDS = Object.keys(ARKANOID_SKINS) as readonly SkinBaseId[];
