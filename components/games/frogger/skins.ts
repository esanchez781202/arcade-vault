// ===== components/games/frogger/skins.ts =====
// Paletas de FROGGER. `clasico` es una copia fiel de los literales que tenía
// engine.ts antes de esta migración (ver git blame) — no se toca nunca por
// estética. `retro` y `neon` diseñadas con /frontend-design y verificadas
// con Playwright (ver references/games-with-themes.md).
//
// Frogger tiene más roles propios que el resto de motores porque pinta
// cuatro fondos de zona distintos (carretera/río/segura/meta) además de los
// vehículos/troncos/tortugas — todos eran literales sueltos en zoneColor(),
// drawVehicle() y drawRiverEntity(). `accent` cubre el verde que ya
// compartían rana/meta-ocupada/vidas/temporizador-alto en el original
// (los cuatro eran literalmente "#39ff6a"); `danger` cubre coche y
// temporizador-bajo (ambos "#e04b4b"). La tortuga sumergida no tiene slot
// propio: se deriva de `entities.tortuga` con `hexARgba(..., 0.25)` en
// drawRiverEntity, igual que hacía el literal original, para que ambos
// colores no puedan desincronizarse entre skins.
//
// `ink`/`inkDim` no tienen consumidor directo hoy (Frogger no tiene una
// forma "protagonista" aparte de la rana, ya cubierta por `accent`, ni
// partículas de apoyo) — se rellenan con valores coherentes, mismo criterio
// que asteroids/snake.

import type { SkinBaseId, SkinSet } from "../skins";

/** Roles propios de Frogger: vehículos, obstáculos de río, zonas y HUD de ronda. */
export type FroggerRole =
  | "camion"
  | "camionCabina"
  | "rueda"
  | "tronco"
  | "troncoLinea"
  | "tortuga"
  | "metaBorde"
  | "zonaCarretera"
  | "zonaRio"
  | "zonaSegura"
  | "zonaMeta"
  | "temporizadorMedio"
  | "pupila";

export const FROGGER_SKINS: SkinSet<SkinBaseId, FroggerRole> = {
  clasico: {
    bg: "#000000",
    grid: "transparent",
    ink: "#ffffff",
    inkDim: "#9aa0a6",
    accent: "#39ff6a",
    danger: "#e04b4b",
    hud: "#ffffff",
    glow: null,
    entities: {
      camion: "#9aa0a6",
      camionCabina: "#5a6066",
      rueda: "#1a1a1a",
      tronco: "#6b4226",
      troncoLinea: "#4a2d19",
      tortuga: "#39b54a",
      metaBorde: "#d4af37",
      zonaCarretera: "#0a0a0a",
      zonaRio: "#0a1a33",
      zonaSegura: "#142a14",
      zonaMeta: "#1a4d2e",
      temporizadorMedio: "#f4d03f",
      pupila: "#111111",
    },
  },
  retro: {
    bg: "#140f0a",
    grid: "rgba(255, 181, 69, 0.15)",
    ink: "#ffcf80",
    inkDim: "#8a6a3a",
    accent: "#8fd96a",
    danger: "#ff6a3a",
    hud: "#ffcf80",
    glow: null,
    entities: {
      camion: "#b0987a",
      camionCabina: "#7a6650",
      rueda: "#2a1f10",
      tronco: "#9c6a34",
      troncoLinea: "#5a3a18",
      tortuga: "#6a9a4a",
      metaBorde: "#d4af37",
      zonaCarretera: "#170f08",
      zonaRio: "#1f1808",
      zonaSegura: "#241a0c",
      zonaMeta: "#2a1f10",
      temporizadorMedio: "#ffb545",
      pupila: "#1a1006",
    },
  },
  neon: {
    bg: "#000000",
    grid: "rgba(0, 245, 255, 0.2)",
    ink: "#00f5ff",
    inkDim: "#14b8cc",
    accent: "#39ff6a",
    danger: "#ff2060",
    hud: "#f5ff00",
    glow: "#00f5ff",
    entities: {
      camion: "#8000ff",
      camionCabina: "#b366ff",
      rueda: "#1a1a1a",
      tronco: "#ff8800",
      troncoLinea: "#cc5500",
      tortuga: "#00ffcc",
      metaBorde: "#ffe066",
      zonaCarretera: "#0a0014",
      zonaRio: "#000a1a",
      zonaSegura: "#001a0a",
      zonaMeta: "#1a0030",
      temporizadorMedio: "#ffcc00",
      pupila: "#000000",
    },
  },
};

export const FROGGER_SKIN_IDS = Object.keys(FROGGER_SKINS) as readonly SkinBaseId[];
