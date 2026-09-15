// ===== components/games/arkanoid/engine.ts =====
// Motor de ARKANOID portado a TypeScript de
// references/started-games/04-arkanoid/game.js + levels.js.
//
// Misma física, colisiones AABB, niveles y multiplicadores de velocidad que
// el original. Sin `window`/`document`/`canvas` globales de nivel de módulo:
// el `CanvasRenderingContext2D` y el estado de input se inyectan, para que
// `createEngine` se pueda instanciar y descartar de forma controlada por
// React (ver ArkanoidGame.tsx).
//
// Render 100% vectorial (rectángulos/arcos de color): el prototipo original
// usaba un spritesheet PNG cargado de forma asíncrona; se descartó a favor de
// mantener el motor síncrono, sin `Image`/`fetch` (SPEC 08).

export type ArkanoidGameState = "playing" | "gameover" | "win";

export interface ArkanoidEngineState {
  score: number;
  lives: number;
  level: number;
  state: ArkanoidGameState;
}

export interface ArkanoidInputState {
  left: boolean;
  right: boolean;
}

const W = 800;
const H = 600;

// ── Constantes de física (copiadas 1:1 de game.js) ─────────────────────────────
const PADDLE_SPEED = 400;
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;
const BALL_SIZE = 16;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;

const EXPLOSION_DURATION = 150;

// Colores vectoriales aproximados a los del spritesheet original.
const BLOCK_COLOR_HEX: Record<string, string> = {
  red: "#ff3b3b",
  yellow: "#f0c040",
  cyan: "#00e5ff",
  magenta: "#ff2fd0",
  hotpink: "#ff69b4",
  green: "#39ff6a",
  gray: "#8a8a94",
};

// ── Niveles (portados 1:1 de levels.js) ────────────────────────────────────────
interface BlockSeed {
  col: number;
  row: number;
  color: string;
}
interface Level {
  speed: number;
  blocks: BlockSeed[];
}

const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: BlockSeed[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) l1.push({ col, row, color: rowColors1[row] });

  const l2: BlockSeed[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: BlockSeed[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockSeed[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  const l5: BlockSeed[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// ── Tipos internos ──────────────────────────────────────────────────────────────
interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}
interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}
interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}

// Layout del selector de nivel en pausa (idéntico al del prototipo).
const PAUSE_BTN_W = 60;
const PAUSE_BTN_H = 40;
const PAUSE_BTN_GAP = 12;
const PAUSE_BTN_Y = 340;
const PAUSE_BTN_ROW_X = (W - (5 * PAUSE_BTN_W + 4 * PAUSE_BTN_GAP)) / 2;

function collideAABB(ball: Ball, block: Block) {
  return (
    ball.x < block.x + block.w &&
    ball.x + ball.w > block.x &&
    ball.y < block.y + block.h &&
    ball.y + ball.h > block.y
  );
}

// ── Motor ─────────────────────────────────────────────────────────────────────
export function createEngine(ctx: CanvasRenderingContext2D) {
  const paddle: Paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball: Ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: ArkanoidGameState = "playing";

  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function initBall(speed: number) {
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    level = n;
    const lv = LEVELS[n - 1];
    blocks = lv.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall(lv.speed);
  }

  function initGame() {
    score = 0;
    lives = 3;
    state = "playing";
    initPaddle();
    loadLevel(1);
  }

  function update(dt: number, input: ArkanoidInputState) {
    if (state !== "playing") return;

    if (input.left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (input.right) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(ball, block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          if (level < 5) loadLevel(level + 1);
          else state = "win";
        }
        break; // un bloque por frame
      }
    }

    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        state = "gameover";
      } else {
        initBall(LEVELS[level - 1].speed);
      }
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  // drawHUD()/drawOverlay() del original se eliminan: el HUD React del
  // reproductor es el único HUD visible; el modal de fin ya existente
  // cubre 'gameover'/'win'.
  function drawScene() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (const block of blocks) {
      if (block.alive) {
        ctx.fillStyle = BLOCK_COLOR_HEX[block.color] ?? "#fff";
        ctx.fillRect(block.x, block.y, block.w, block.h);
      }
    }

    for (const exp of explosions) {
      const t = exp.elapsed / EXPLOSION_DURATION; // 0 → 1
      const scale = 1 + t * 0.6;
      const w = exp.w * scale;
      const h = exp.h * scale;
      const cx = exp.x + exp.w / 2;
      const cy = exp.y + exp.h / 2;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = BLOCK_COLOR_HEX[exp.color] ?? "#fff";
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#fff";
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    ctx.beginPath();
    ctx.arc(ball.x + ball.w / 2, ball.y + ball.h / 2, ball.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  function draw() {
    drawScene();
  }

  function drawPaused() {
    drawScene();

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, W, H);

    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText("Saltar al nivel:", W / 2, PAUSE_BTN_Y - 30);

    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      const isActive = i + 1 === level;
      ctx.fillStyle = isActive ? "#f0c040" : "#444";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActive ? "#000" : "#fff";
      ctx.font = "bold 20px monospace";
      ctx.fillText(String(i + 1), bx + PAUSE_BTN_W / 2, PAUSE_BTN_Y + PAUSE_BTN_H / 2);
    }
  }

  function hitTestPauseButton(x: number, y: number): number | null {
    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      if (x >= bx && x <= bx + PAUSE_BTN_W && y >= PAUSE_BTN_Y && y <= PAUSE_BTN_Y + PAUSE_BTN_H) {
        return i + 1;
      }
    }
    return null;
  }

  function jumpToLevel(n: number) {
    loadLevel(n);
  }

  function getState(): ArkanoidEngineState {
    return { score, lives, level, state };
  }

  function forceGameOver() {
    lives = 0;
    state = "gameover";
  }

  initGame();

  return { update, draw, drawPaused, hitTestPauseButton, jumpToLevel, getState, forceGameOver };
}

export type ArkanoidEngine = ReturnType<typeof createEngine>;
