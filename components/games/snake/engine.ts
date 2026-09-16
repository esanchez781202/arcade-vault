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
  function draw() {
    ctx.fillStyle = "#0a0a18";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const sprite: FruitSprite = FRUIT_ATLAS[food.fruit];
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

    snake.forEach((segment, i) => {
      ctx.fillStyle = i === 0 ? "#00ff88" : "#00cc6a";
      const pad = 1.5;
      ctx.beginPath();
      ctx.roundRect(
        segment.x * CELL + pad,
        segment.y * CELL + pad,
        CELL - pad * 2,
        CELL - pad * 2,
        4,
      );
      ctx.fill();
    });
  }

  function getState(): SnakeEngineState {
    return { score, lives: 0, level, state };
  }

  function forceGameOver() {
    state = "gameover";
  }

  initGame();

  return { update, draw, getState, forceGameOver };
}

export type SnakeEngine = ReturnType<typeof createEngine>;
