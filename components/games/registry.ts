// ===== components/games/registry.ts =====
// Registro genérico de motores reales por `game.id`, sustituyendo el
// booleano `isAsteroids` que usaba JugarClient.tsx antes de que TETRIS
// (SPEC 07) se convirtiera en el segundo motor real. Añadir un motor nuevo
// es agregar una entrada aquí; JugarClient.tsx no necesita más cambios.

import type { ComponentType, Ref } from "react";
import AsteroidsGame from "./asteroids/AsteroidsGame";
import { ASTEROIDS_SKIN_IDS } from "./asteroids/skins";
import TetrisGame from "./tetris/TetrisGame";
import ArkanoidGame from "./arkanoid/ArkanoidGame";
import { ARKANOID_SKIN_IDS } from "./arkanoid/skins";
import SnakeGame from "./snake/SnakeGame";
import { SNAKE_SKIN_IDS } from "./snake/skins";
import type { SkinId } from "./skins";

export interface RealGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  // Obligatorio: los cuatro motores (asteroids, tetris, arkanoid, snake)
  // están migrados a skins.ts.
  setSkin(skin: SkinId): void;
}

export interface RealGameState {
  score: number;
  lives: number;
  level: number;
  state: string;
}

export interface RealGameProps {
  onStateChange: (state: RealGameState) => void;
  /** Solo lo invoca ArkanoidGame (selector de nivel en pausa, SPEC 08). */
  onResumeRequested?: () => void;
  ref?: Ref<RealGameHandle>;
}

export interface MotorEntry {
  component: ComponentType<RealGameProps>;
  /** Orden de presentación en el selector; skins[0] es el default. [] = sin selector. */
  skins: readonly SkinId[];
}

export const REGISTRO_MOTORES: Record<string, MotorEntry> = {
  asteroids: {
    component: AsteroidsGame as ComponentType<RealGameProps>,
    skins: ASTEROIDS_SKIN_IDS,
  },
  tetris: {
    component: TetrisGame as ComponentType<RealGameProps>,
    // Ids propios de Tetris (retro/neon/pastel/pixel), no migrados a
    // "clasico" todavía — eso es trabajo de su propia invocación de
    // skin-designer.
    skins: ["retro", "neon", "pastel", "pixel"],
  },
  arkanoid: {
    component: ArkanoidGame as ComponentType<RealGameProps>,
    skins: ARKANOID_SKIN_IDS,
  },
  snake: { component: SnakeGame as ComponentType<RealGameProps>, skins: SNAKE_SKIN_IDS },
};
