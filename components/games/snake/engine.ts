// ===== components/games/snake/engine.ts =====
// Motor de SNAKE, diseñado en SPEC 09 (sin prototipo de referencia previo).
// Movimiento por grilla de 40x30 celdas de 20px sobre un canvas lógico de
// 800x600 (misma resolución que asteroids/tetris/arkanoid, encaja en
// `.crt-screen` sin CSS condicional). Sin `window`/`document`/`canvas`
// globales de nivel de módulo: el contexto y la imagen del sprite de fruta
// se inyectan al crear la instancia.
//
// Snake no tiene concepto de vidas ni un estado "dead" intermedio (chocar
// contra la pared o contra el propio cuerpo es game over directo): `state`
// se limita a "playing" | "gameover" y `lives` se reporta fijo en 0, mismo
// patrón que components/games/tetris/engine.ts.

import { FRUIT_ATLAS, FRUIT_NAMES, type FruitSprite } from "./sprites";
import { conGlow, type SkinBaseId } from "../skins";
import { SNAKE_SKINS } from "./skins";

export type SnakeGameState = "playing" | "gameover";

export interface SnakeEngineState {
  score: number;
  lives: 0;
  level: number;
  state: SnakeGameState;
}

export interface SnakeInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

const CANVAS_W = 800;
const CANVAS_H = 600;
const CELL = 20;
const COLS = CANVAS_W / CELL; // 40
const ROWS = CANVAS_H / CELL; // 30

const START_TICK_MS = 150;
const MIN_TICK_MS = 60;
const TICK_STEP_MS = 10;
const FRUIT_PER_LEVEL = 5;
const SCORE_PER_FRUIT = 10;

interface Cell {
  x: number;
  y: number;
}

interface Food {
  cell: Cell;
  fruit: string;
}

const DIRECTIONS: Record<"up" | "down" | "left" | "right", Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function isOpposite(a: Cell, b: Cell): boolean {
  return a.x === -b.x && a.y === -b.y;
}

function randomFruit(): string {
  return FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
}

export function createEngine(ctx: CanvasRenderingContext2D, spriteImage: HTMLImageElement) {
  let snake: Cell[];
  let direction: Cell;
  let pendingDirection: Cell;
  let food: Food;
  let score: number;
  let level: number;
  let fruitsEaten: number;
  let tickIntervalMs: number;
  let tickAccumMs: number;
  let state: SnakeGameState;
  let skin: SkinBaseId = "clasico";

  function occupiesSnake(cell: Cell): boolean {
    return snake.some((s) => s.x === cell.x && s.y === cell.y);
  }

  function spawnFood() {
    let cell: Cell;
    do {
      cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (occupiesSnake(cell));
    food = { cell, fruit: randomFruit() };
  }

  function initGame() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
      { x: cx - 3, y: cy },
    ];
    direction = { ...DIRECTIONS.right };
    pendingDirection = { ...DIRECTIONS.right };
    score = 0;
    level = 1;
    fruitsEaten = 0;
    tickIntervalMs = START_TICK_MS;
    tickAccumMs = 0;
    state = "playing";
    spawnFood();
  }

  function step() {
    if (!isOpposite(pendingDirection, direction)) direction = pendingDirection;

    const head = snake[0];
    const newHead: Cell = { x: head.x + direction.x, y: head.y + direction.y };

    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      state = "gameover";
      return;
    }

    const ateFood = newHead.x === food.cell.x && newHead.y === food.cell.y;
    const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      state = "gameover";
      return;
    }

    snake.unshift(newHead);
    if (ateFood) {
      score += SCORE_PER_FRUIT;
      fruitsEaten += 1;
      if (fruitsEaten % FRUIT_PER_LEVEL === 0) {
        level += 1;
        tickIntervalMs = Math.max(MIN_TICK_MS, tickIntervalMs - TICK_STEP_MS);
      }
      spawnFood();
    } else {
      snake.pop();
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number, input: SnakeInputState) {
    if (state === "gameover") return;

    if (input.up) pendingDirection = { ...DIRECTIONS.up };
    else if (input.down) pendingDirection = { ...DIRECTIONS.down };
    else if (input.left) pendingDirection = { ...DIRECTIONS.left };
    else if (input.right) pendingDirection = { ...DIRECTIONS.right };

    tickAccumMs += dt * 1000;
    if (tickAccumMs >= tickIntervalMs) {
      tickAccumMs = 0;
      step();
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  // Sin HUD dibujado en canvas: el HUD React del reproductor es el único
  // visible, alimentado por getState().
  // Puntos en las intersecciones de la grilla, no líneas completas: un
  // grid de líneas cada 20px sobre 40x30 celdas cubre ~10-18% del lienzo
  // incluso a baja opacidad (70 líneas), lo que lo convierte en "tinta"
  // medible con más presencia que el propio cuerpo de la serpiente y hace
  // fallar el contraste C1 de la Fase 4 (una rejilla deliberadamente sutil
  // no debe competir en contraste con las formas reales del juego). Puntos
  // espaciados cada 4 celdas mantienen la referencia estructural con una
  // superficie total muy por debajo del umbral de medición.
  //
  // Fondo + rejilla precocinados (SPEC 12 / auditoría performance-auditor):
  // ambos son estáticos mientras la skin no cambia, así que se pintan una
  // sola vez en un canvas fuera del DOM (`bgCanvas`) y `draw()` los vuelca
  // con un único `drawImage()` en vez de 1 `fillRect` + hasta 88 `fillRect`
  // de rejilla por frame.
  let bgCanvas: HTMLCanvasElement | null = null;
  let bgCanvasSkin: SkinBaseId | null = null;

  function paintBackground(s: SkinBaseId) {
    if (!bgCanvas) {
      bgCanvas = document.createElement("canvas");
      bgCanvas.width = CANVAS_W;
      bgCanvas.height = CANVAS_H;
    }
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;
    const p = SNAKE_SKINS[s];
    bgCtx.fillStyle = p.bg;
    bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (p.grid !== "transparent") {
      bgCtx.fillStyle = p.grid;
      for (let x = 0; x <= COLS; x += 4) {
        for (let y = 0; y <= ROWS; y += 4) {
          bgCtx.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
        }
      }
    }
    bgCanvasSkin = s;
  }

  function drawBackground() {
    if (bgCanvasSkin !== skin) paintBackground(skin);
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
  }

  function draw() {
    const p = SNAKE_SKINS[skin];
    drawBackground();

    if (p.entities.fondoFruta !== "transparent") {
      ctx.fillStyle = p.entities.fondoFruta;
      ctx.fillRect(food.cell.x * CELL, food.cell.y * CELL, CELL, CELL);
    }

    const sprite: FruitSprite = FRUIT_ATLAS[food.fruit];
    conGlow(ctx, p.glow, 10, () => {
      ctx.drawImage(
        spriteImage,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        food.cell.x * CELL,
        food.cell.y * CELL,
        CELL,
        CELL,
      );
    });

    // Agrupación de draw calls (SPEC 12 / auditoría performance-auditor): la
    // cabeza (color `accent`) es siempre un único segmento; el resto del
    // cuerpo comparte `inkDim`, así que se agrupan en un único
    // `beginPath()`+`fill()` en vez de uno por segmento.
    const pad = 1.5;
    const head = snake[0];
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.roundRect(head.x * CELL + pad, head.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 4);
    ctx.fill();

    if (snake.length > 1) {
      ctx.fillStyle = p.inkDim;
      ctx.beginPath();
      for (let i = 1; i < snake.length; i++) {
        const segment = snake[i];
        ctx.roundRect(
          segment.x * CELL + pad,
          segment.y * CELL + pad,
          CELL - pad * 2,
          CELL - pad * 2,
          4,
        );
      }
      ctx.fill();
    }
  }

  // Objeto único reutilizado por getState() (SPEC 12, causa #6): evita
  // alojar un literal nuevo cada frame. SnakeGame.tsx hace una copia
  // antes de guardarla en lastReportedRef — si guardara esta misma
  // referencia, prev y state serían siempre el mismo objeto y
  // reportIfChanged nunca detectaría un cambio.
  const stateOut: SnakeEngineState = { score: 0, lives: 0, level: 1, state: "playing" };

  function getState(): SnakeEngineState {
    stateOut.score = score;
    stateOut.level = level;
    stateOut.state = state;
    return stateOut;
  }

  function forceGameOver() {
    state = "gameover";
  }

  function setSkin(s: SkinBaseId) {
    skin = s;
  }

  initGame();

  return { update, draw, getState, forceGameOver, setSkin };
}

export type SnakeEngine = ReturnType<typeof createEngine>;
