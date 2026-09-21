// ===== components/games/snake/skins.ts =====
// Paletas de SNAKE. `clasico` es una copia fiel de los literales que tenía
// engine.ts/SnakeGame.tsx antes de esta migración (ver git blame) — no se
// toca nunca por estética. `retro` y `neon` diseñadas con /frontend-design y
// verificadas con Playwright (ver references/games-with-themes.md).
//
// `ink` y `danger` no tienen consumidor hoy: Snake no dibuja ninguna forma
// "protagonista" distinta de la cabeza (ya cubierta por `accent`) ni un
// color de muerte propio (game over es instantáneo, sin animación de
// explosión). Se rellenan con valores coherentes por si un futuro cambio de
// engine los necesita, no por decoración.
//
// La fruta (public/games/snake/fruits.png) es inmune a la skin: tintar el
// atlas de 21 sprites destruiría su identidad y dibujar tres atlas
// completos es coste desproporcionado para este proyecto. Lo que cambia por
// skin es su ENTORNO: `clasico` la deja limpia, `retro` pinta un plato de
// fondo (`entities.fondoFruta`) detrás de la celda, `neon` envuelve el
// `drawImage` con `conGlow` (el halo sigue la silueta real vía el canal
// alfa del PNG, sin necesidad de asset nuevo).

import type { SkinBaseId, SkinSet } from "../skins";

/** Rol propio de Snake: el plato/celda de fondo que algunas skins pintan bajo la fruta. */
export type SnakeRole = "fondoFruta";

export const SNAKE_SKINS: SkinSet<SkinBaseId, SnakeRole> = {
  clasico: {
    bg: "#0a0a18",
    grid: "transparent",
    ink: "#00ff88",
    inkDim: "#00cc6a",
    accent: "#00ff88",
    danger: "#ff3131",
    hud: "#00ff88",
    glow: null,
    entities: {
      fondoFruta: "transparent",
    },
  },
  retro: {
    bg: "#140f0a",
    grid: "rgba(255, 181, 69, 0.35)",
    ink: "#ffb545",
    inkDim: "#b3792a",
    accent: "#ffd98a",
    danger: "#ff6a2b",
    hud: "#ffd9a0",
    glow: null,
    entities: {
      fondoFruta: "#2a1f10",
    },
  },
  neon: {
    bg: "#000000",
    grid: "rgba(0, 245, 255, 0.3)",
    ink: "#00f5ff",
    inkDim: "#14e6ff",
    accent: "#ff2fd0",
    danger: "#ff3131",
    hud: "#f5ff00",
    glow: "#ff2fd0",
    entities: {
      fondoFruta: "transparent",
    },
  },
};

export const SNAKE_SKIN_IDS = Object.keys(SNAKE_SKINS) as readonly SkinBaseId[];
