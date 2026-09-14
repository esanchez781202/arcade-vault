// ===== components/games/tetris/engine.ts =====
// Motor de TETRIS portado a TypeScript de
// references/started-games/03-tetris/game.js.
//
// Mismo tablero 10x20, las 7 piezas estándar (más la pieza N/tuerca del
// prototipo), rotación con wall-kicks, soft/hard drop, pieza fantasma,
// vista previa de la siguiente pieza, puntuación y progresión de nivel que
// el original. Sin `window`/`document`/`canvas` globales de nivel de
// módulo: los dos `CanvasRenderingContext2D` (tablero y "next") se inyectan
// al crear la instancia, para que `createEngine` se pueda instanciar y
// descartar de forma controlada por React (ver TetrisGame.tsx).
//
// Tetris no tiene concepto de vidas ni un estado "dead" intermedio (una
// pieza que colisiona al generarse es game over directo): `state` se limita
// a "playing" | "gameover" y `lives` se reporta fijo en 0.

export type TetrisGameState = "playing" | "gameover";

export interface TetrisEngineState {
  score: number;
  lives: 0;
  level: number;
  lines: number;
  maxCombo: number;
  state: TetrisGameState;
}

export interface TetrisInputState {
  /** true solo en el frame en que se detectó el keydown (o su auto-repeat del SO). */
  left: boolean;
  right: boolean;
  softDrop: boolean;
  rotate: boolean;
  hardDrop: boolean;
}

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Resolución lógica del <canvas> principal: igual que Asteroids (800x600),
// para encajar en `.crt-screen` (aspect-ratio 4/3) sin CSS condicional. El
// tablero (300x600) se dibuja centrado horizontalmente (letterbox).
const CANVAS_W = 800;
const CANVAS_H = 600;
const BOARD_W = COLS * BLOCK;
const BOARD_H = ROWS * BLOCK;
const OFFSET_X = (CANVAS_W - BOARD_W) / 2;
const OFFSET_Y = (CANVAS_H - BOARD_H) / 2;

const NEXT_CANVAS_SIZE = 120;
const NEXT_BLOCK = 30;

// Toggle claro/oscuro portado de references/started-games/03-tetris (botón
// ☾/☀ del prototipo, ver style.css `--canvas-bg`/`--grid-line` por tema).
// Solo afecta al área jugable (tablero + "next"); las barras de letterbox
// fuera del tablero se quedan negras, igual que el resto del marco CRT.
export type TetrisTheme = "dark" | "light";

const THEME_COLORS: Record<TetrisTheme, { canvasBg: string; gridLine: string }> = {
  dark: { canvasBg: "#1a1a25", gridLine: "#22222e" },
  light: { canvasBg: "#e4e4f0", gridLine: "#c8c8dc" },
};

type Shape = number[][];

// Selector de skins portado de references/started-games/03-tetris (bloque
// "SKINS" de game.js). Cada skin trae su propia paleta y su propio
// `drawBlock`; `boardBg` fijo (si existe) ignora el tema claro/oscuro para
// el área jugable — la rejilla sigue el tema siempre, igual que el original
// (ahí `--grid-line` es una variable de tema, no de skin).
export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

type DrawBlockFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  offsetX: number,
  offsetY: number,
  alpha?: number,
) => void;

interface SkinDef {
  name: string;
  colors: readonly (string | null)[];
  boardBg: string | null;
  drawBlock: DrawBlockFn;
}

const RETRO_COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
] as const;

const NEON_COLORS = [
  null,
  "#00ffff",
  "#ffff00",
  "#ff00ff",
  "#00ff00",
  "#ff0040",
  "#00aaff",
  "#ff8000",
  "#8000ff",
] as const;

const PASTEL_COLORS = [
  null,
  "#bae1ff",
  "#ffffba",
  "#e8baff",
  "#baffc9",
  "#ffb3ba",
  "#ffdfba",
  "#ffd9ba",
  "#d9d9d9",
] as const;

const PIXEL_COLORS = [
  null,
  "#3ab8c8",
  "#d4b840",
  "#9a50a8",
  "#60a060",
  "#c05060",
  "#7090d8",
  "#d08030",
  "#808080",
] as const;

const SKINS: Record<TetrisSkin, SkinDef> = {
  retro: {
    name: "Retro",
    colors: RETRO_COLORS,
    boardBg: null,
    drawBlock(ctx, x, y, colorIndex, size, offsetX, offsetY, alpha) {
      if (!colorIndex) return;
      const color = RETRO_COLORS[colorIndex]!;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    },
  },

  neon: {
    name: "Neon",
    colors: NEON_COLORS,
    boardBg: "#000000",
    drawBlock(ctx, x, y, colorIndex, size, offsetX, offsetY, alpha) {
      if (!colorIndex) return;
      const color = NEON_COLORS[colorIndex]!;
      const a = alpha ?? 1;
      ctx.globalAlpha = a;
      ctx.shadowBlur = a < 0.5 ? 8 : 15;
      ctx.shadowColor = color;
      const [r, g, b] = hexToRgb(color);
      ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
      ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(offsetX + x * size + 1.75, offsetY + y * size + 1.75, size - 3.5, size - 3.5);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    },
  },

  pastel: {
    name: "Pastel",
    colors: PASTEL_COLORS,
    boardBg: "#f8f0ff",
    drawBlock(ctx, x, y, colorIndex, size, offsetX, offsetY, alpha) {
      if (!colorIndex) return;
      const color = PASTEL_COLORS[colorIndex]!;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillRect(offsetX + x * size + 2, offsetY + y * size + 2, size - 4, 5);
      ctx.fillRect(offsetX + x * size + 2, offsetY + y * size + 2, 5, size - 4);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(offsetX + x * size + 2, offsetY + y * size + size - 5, size - 4, 4);
      ctx.fillRect(offsetX + x * size + size - 5, offsetY + y * size + 2, 4, size - 4);
      ctx.globalAlpha = 1;
    },
  },

  pixel: {
    name: "Pixel",
    colors: PIXEL_COLORS,
    boardBg: "#1a1a2e",
    drawBlock(ctx, x, y, colorIndex, size, offsetX, offsetY, alpha) {
      if (!colorIndex) return;
      const color = PIXEL_COLORS[colorIndex]!;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
      const [r, g, b] = hexToRgb(color);
      const dark = `rgba(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)},0.7)`;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.5;
      const bx = offsetX + x * size + 1;
      const by = offsetY + y * size + 1;
      const bw = size - 2;
      for (let i = 4; i < bw; i += 4) {
        ctx.beginPath();
        ctx.moveTo(bx + i, by);
        ctx.lineTo(bx + i, by + bw);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by + i);
        ctx.lineTo(bx + bw, by + i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },
};

const PIECES: (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(board: number[][], shape: Shape, ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// ── Motor ─────────────────────────────────────────────────────────────────────
export function createEngine(ctx: CanvasRenderingContext2D, nextCtx: CanvasRenderingContext2D) {
  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let state: TetrisGameState;
  let dropAccum: number;
  let dropInterval: number;
  let theme: TetrisTheme = "dark";
  let skin: TetrisSkin = "retro";
  let maxCombo: number;
  let currentCombo: number;
  let lastClearWasCombo: boolean;

  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    offsetX: number,
    offsetY: number,
    alpha?: number,
  ) {
    SKINS[skin].drawBlock(context, x, y, colorIndex, size, offsetX, offsetY, alpha);
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(board, current.shape, current.x, current.y)) {
      state = "gameover";
    }
  }

  function initGame(startLevel = 1) {
    board = createBoard();
    score = 0;
    lines = 0;
    level = startLevel;
    state = "playing";
    dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
    dropAccum = 0;
    maxCombo = 0;
    currentCombo = 0;
    lastClearWasCombo = false;
    next = randomPiece();
    spawn();
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(board, current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      currentCombo = lastClearWasCombo ? currentCombo + 1 : 1;
      lastClearWasCombo = true;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
    } else {
      lastClearWasCombo = false;
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function tryMove(dx: number) {
    if (!collide(board, current.shape, current.x + dx, current.y)) current.x += dx;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(board, rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function softDropStep() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function hardDropAction() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number, input: TetrisInputState) {
    if (state === "gameover") return;

    if (input.left) tryMove(-1);
    if (input.right) tryMove(1);
    if (input.rotate) tryRotate();
    if (input.hardDrop) {
      hardDropAction();
      dropAccum = 0;
      return;
    }
    if (input.softDrop) softDropStep();

    dropAccum += dt * 1000;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  // El HUD (SCORE/LINES/LEVEL) del original vivía en el sidebar DOM, fuera del
  // canvas: no hay HUD que retirar del draw() portado. El HUD React del
  // reproductor lo sustituye vía getState().
  function drawGrid() {
    ctx.strokeStyle = THEME_COLORS[theme].gridLine;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(OFFSET_X + c * BLOCK, OFFSET_Y);
      ctx.lineTo(OFFSET_X + c * BLOCK, OFFSET_Y + ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(OFFSET_X, OFFSET_Y + r * BLOCK);
      ctx.lineTo(OFFSET_X + COLS * BLOCK, OFFSET_Y + r * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    const colors = THEME_COLORS[theme];
    // La skin puede fijar su propio fondo (neon/pastel/pixel); "retro" no
    // trae uno propio y usa el fondo del tema claro/oscuro, igual que el
    // prototipo (`--canvas-bg` vía CSS cuando `activeSkin.boardBg` es null).
    const boardBg = SKINS[skin].boardBg ?? colors.canvasBg;

    // Barras de letterbox: negras siempre, igual que el resto del marco CRT.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Área jugable: fondo (skin o tema) y rejilla según el tema.
    ctx.fillStyle = boardBg;
    ctx.fillRect(OFFSET_X, OFFSET_Y, BOARD_W, BOARD_H);

    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(OFFSET_X, OFFSET_Y, BOARD_W, BOARD_H);

    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK, OFFSET_X, OFFSET_Y);

    if (state === "playing") {
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(
              ctx,
              current.x + c,
              gy + r,
              current.shape[r][c],
              BLOCK,
              OFFSET_X,
              OFFSET_Y,
              0.2,
            );

      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          drawBlock(
            ctx,
            current.x + c,
            current.y + r,
            current.shape[r][c],
            BLOCK,
            OFFSET_X,
            OFFSET_Y,
          );
    }

    drawNext();
  }

  function drawNext() {
    nextCtx.fillStyle = SKINS[skin].boardBg ?? THEME_COLORS[theme].canvasBg;
    nextCtx.fillRect(0, 0, NEXT_CANVAS_SIZE, NEXT_CANVAS_SIZE);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NEXT_BLOCK, 0, 0);
  }

  function getState(): TetrisEngineState {
    return { score, lives: 0, level, lines, maxCombo, state };
  }

  function forceGameOver() {
    state = "gameover";
  }

  function setTheme(t: TetrisTheme) {
    theme = t;
  }

  function setSkin(s: TetrisSkin) {
    skin = s;
  }

  /** Reinicia la partida con el nivel inicial elegido (selector "NIVEL INICIAL"). */
  function setStartLevel(startLevel: number) {
    initGame(startLevel);
  }

  initGame();

  return { update, draw, getState, forceGameOver, setTheme, setSkin, setStartLevel };
}

export type TetrisEngine = ReturnType<typeof createEngine>;
