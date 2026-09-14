// ===== components/games/registry.ts =====
// Registro genérico de motores reales por `game.id`, sustituyendo el
// booleano `isAsteroids` que usaba JugarClient.tsx antes de que TETRIS
// (SPEC 07) se convirtiera en el segundo motor real. Añadir un motor nuevo
// es agregar una entrada aquí; JugarClient.tsx no necesita más cambios.

import type { ComponentType, Ref } from "react";
import AsteroidsGame from "./asteroids/AsteroidsGame";
import TetrisGame from "./tetris/TetrisGame";

export interface RealGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  /** Solo implementado por TetrisGame (ampliaciones portadas del prototipo). */
  setTheme?(theme: "dark" | "light"): void;
  setSkin?(skin: "retro" | "neon" | "pastel" | "pixel"): void;
}

export interface RealGameState {
  score: number;
  lives: number;
  level: number;
  state: string;
}

export interface RealGameProps {
  onStateChange: (state: RealGameState) => void;
  ref?: Ref<RealGameHandle>;
}

export const REGISTRO_MOTORES: Record<string, ComponentType<RealGameProps>> = {
  asteroids: AsteroidsGame as ComponentType<RealGameProps>,
  tetris: TetrisGame as ComponentType<RealGameProps>,
};
