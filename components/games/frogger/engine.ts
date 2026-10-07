// ===== components/games/frogger/engine.ts =====
// Motor de FROGGER, diseñado en specs/game-jam/frogger/01-frogger-core.md
// (sin prototipo de referencia previo — primitivas canvas, sin sprites).
//
// Resolución lógica del <canvas>: 800x600, igual que asteroids/tetris/arkanoid/
// snake, para encajar en `.crt-screen` (aspect-ratio 4/3) sin CSS condicional
// (desviación respecto a la spec, que pedía 640x560 — ver OFFSET_X/OFFSET_Y).
// El tablero (16 cols x 14 filas de 40px = 640x560) se dibuja centrado,
// letterbox, mismo patrón que components/games/tetris/engine.ts.
//
// Sin `window`/`document`/`canvas` globales de nivel de módulo: el contexto
// se inyecta al crear la instancia (ver FroggerGame.tsx).

import { type SkinBaseId, type SkinPalette, conGlow, hexARgba } from "../skins";
import { FROGGER_SKINS, type FroggerRole } from "./skins";

type Palette = SkinPalette<FroggerRole>;

export type FroggerGameState = "playing" | "gameover";

export interface FroggerEngineState {
  score: number;
  lives: number;
  level: number;
  state: FroggerGameState;
}

export interface FroggerInputState {
  /** true solo en el frame en que se detectó el keydown (salto discreto, no mantenido). */
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// ── Resolución y grilla ──────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 600;

const COLS = 16;
const ROWS = 14;
const CELL = 40;
const BOARD_W = COLS * CELL; // 640
const BOARD_H = ROWS * CELL; // 560
const OFFSET_X = (CANVAS_W - BOARD_W) / 2; // 80
const OFFSET_Y = (CANVAS_H - BOARD_H) / 2; // 20

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

// ── Reglas de juego ──────────────────────────────────────────────────────────
const START_LIVES = 3;
const JUMP_ANIM_MS = 120;
const ROUND_TIME_S = 15;
const ROUND_TIME_LEVEL_STEP_S = 1;
const MIN_ROUND_TIME_S = 6;
const LEVEL_SPEED_MULT = 1.15;
const SCORE_PER_ADVANCE = 10;
const SCORE_PER_GOAL = 50;
const SCORE_PER_ROUND = 200;
const SCORE_TIME_BONUS_MULT = 10;
const GOAL_COUNT = 5;
const GOAL_WIDTH_COLS = 2; // cada boca ocupa 2 columnas de las 16
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;

type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  /** Fase del ciclo de inmersión (solo tortugas), ms acumulados desde que cambió de fase. */
  submergeT?: number;
}

interface Lane {
  row: number;
  speed: number; // px/frame a 60fps de referencia, escalado por dt
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}

interface Goal {
  /** Columna inicial (izquierda) de la boca, ancho GOAL_WIDTH_COLS. */
  col: number;
  occupied: boolean;
}

// ── Generación de carriles ───────────────────────────────────────────────────
// Carriles reconstruidos por ronda vía buildLanes(level): cada carril arranca
// con un desfase aleatorio y entidades espaciadas por huecos aleatorios (sin
// patrón fijo), suficientes para cubrir el ancho del tablero con margen —
// cuando una entidad sale por un borde se reintroduce por el opuesto
// (step 4, update()), así que basta con sembrar el carril una vez al construirlo.

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function levelSpeedMult(level: number): number {
  return LEVEL_SPEED_MULT ** (level - 1);
}

function buildRoadLane(row: number, laneIndex: number, level: number): Lane {
  const dir: 1 | -1 = laneIndex % 2 === 0 ? 1 : -1;
  const speed = randRange(1.5, 4) * levelSpeedMult(level);
  const entities: Entity[] = [];
  let col = randRange(0, 3);
  while (col < COLS + 4) {
    const isTruck = Math.random() < 0.35;
    const width = isTruck ? 3 : Math.random() < 0.5 ? 1 : 2;
    entities.push({ col, width, type: isTruck ? "truck" : "car" });
    col += width + randRange(2, 5);
  }
  if (entities.length < 2) entities.push({ col: COLS + 2, width: 1, type: "car" });
  return { row, speed, dir, entities };
}

function buildRiverLane(row: number, laneIndex: number, level: number): Lane {
  const dir: 1 | -1 = laneIndex % 2 === 0 ? -1 : 1;
  const speed = randRange(1, 3) * levelSpeedMult(level);
  const useTurtles = laneIndex % 2 === 1;
  const entities: Entity[] = [];
  let col = randRange(0, 3);
  while (col < COLS + 4) {
    if (useTurtles) {
      const width = 2 + Math.floor(Math.random() * 2); // grupos de 2-3
      entities.push({
        col,
        width,
        type: "turtle",
        submerged: false,
        submergeT: Math.random() * TURTLE_VISIBLE_MS,
      });
      col += width + randRange(2, 5);
    } else {
      const width = 2 + Math.floor(Math.random() * 3); // troncos de 2-4
      entities.push({ col, width, type: "log" });
      col += width + randRange(1, 4); // hueco de al menos 1 celda
    }
  }
  if (entities.length < 2) entities.push({ col: COLS + 2, width: 2, type: "log" });
  return { row, speed, dir, entities };
}

function buildLanes(level: number): Lane[] {
  const lanes: Lane[] = [];
  for (let row = ROW_ROAD_TOP; row <= ROW_ROAD_BOT; row++) {
    lanes.push(buildRoadLane(row, row - ROW_ROAD_TOP, level));
  }
  for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
    lanes.push(buildRiverLane(row, row - ROW_RIVER_TOP, level));
  }
  return lanes;
}

function currentRoundTime(level: number): number {
  return Math.max(MIN_ROUND_TIME_S, ROUND_TIME_S - (level - 1) * ROUND_TIME_LEVEL_STEP_S);
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  let lanes: Lane[];
  let goals: Goal[];
  let frog: Frog;
  let score: number;
  let lives: number;
  let level: number;
  let roundTimeS: number;
  let state: FroggerGameState;
  // Mejor fila alcanzada en el intento actual (se reinicia en cada vida y en
  // cada ronda nueva) — evita puntuar de nuevo el mismo avance tras morir.
  let bestRow: number;
  let skin: SkinBaseId = "clasico";
  // Color de tortuga sumergida: depende solo de la paleta activa, no del
  // frame. Se recalcula una vez por cambio de skin (setSkin) en vez de
  // llamar hexARgba por cada tortuga sumergida y por frame en drawLanes.
  let turtleSubmergedColor: string;
  // Fondo precocinado (zonas + rejilla): estático mientras no cambie la
  // skin, así que se pinta una sola vez en un canvas fuera de pantalla y
  // draw() solo hace drawImage(). Se invalida comparando contra la skin
  // con la que se construyó.
  let bgCanvas: HTMLCanvasElement | null = null;
  let bgCanvasSkin: SkinBaseId | null = null;

  const startCol = Math.floor(COLS / 2);

  function createGoals(): Goal[] {
    const step = Math.floor(COLS / GOAL_COUNT);
    return Array.from({ length: GOAL_COUNT }, (_, i) => ({ col: i * step, occupied: false }));
  }

  function sendFrogToStart() {
    frog = {
      col: startCol,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: startCol,
      fromRow: ROW_START,
      targetCol: startCol,
      targetRow: ROW_START,
    };
    bestRow = ROW_START;
    roundTimeS = currentRoundTime(level);
  }

  function initGame() {
    lives = START_LIVES;
    score = 0;
    level = 1;
    lanes = buildLanes(level);
    goals = createGoals();
    state = "playing";
    sendFrogToStart();
  }

  // ── Colisiones y soporte ──────────────────────────────────────────────────
  // La rana ocupa la celda continua [col, col+1); una entidad cubre
  // [entity.col, entity.col+width) — se solapan si ambos rangos se cruzan.
  function overlapsCol(e: Entity, col: number): boolean {
    return e.col < col + 1 && e.col + e.width > col;
  }

  function checkRoadCollision(f: Frog, allLanes: Lane[]): boolean {
    const lane = allLanes.find((l) => l.row === f.row);
    if (!lane) return false;
    return lane.entities.some((e) => overlapsCol(e, f.col));
  }

  function getSupport(f: Frog, allLanes: Lane[]): Entity | null {
    const lane = allLanes.find((l) => l.row === f.row);
    if (!lane) return null;
    const hit = lane.entities.find((e) => overlapsCol(e, f.col));
    if (!hit) return null;
    if (hit.type === "turtle" && hit.submerged) return null;
    return hit;
  }

  function checkGoal(f: Frog, allGoals: Goal[]): "ok" | "occupied" | "miss" {
    const goal = allGoals.find((g) => f.col >= g.col && f.col < g.col + GOAL_WIDTH_COLS);
    if (!goal) return "miss";
    if (goal.occupied) return "occupied";
    goal.occupied = true;
    return "ok";
  }

  // ── Ronda y muerte ────────────────────────────────────────────────────────
  function completeRound() {
    score += SCORE_PER_ROUND;
    level += 1;
    for (const g of goals) g.occupied = false;
    lanes = buildLanes(level);
    // sendFrogToStart() reposiciona la rana, reinicia bestRow y recalcula el
    // temporizador con currentRoundTime(level) ya actualizado.
    sendFrogToStart();
  }

  function killFrog() {
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      state = "gameover";
    } else {
      sendFrogToStart();
    }
  }

  // ── Input y salto discreto ───────────────────────────────────────────────
  function pickDirection(input: FroggerInputState): Direction | null {
    if (input.up) return "up";
    if (input.down) return "down";
    if (input.left) return "left";
    if (input.right) return "right";
    return null;
  }

  function startJump(dir: Direction) {
    let targetCol = frog.col;
    let targetRow = frog.row;
    if (dir === "up") targetRow -= 1;
    else if (dir === "down") targetRow += 1;
    else if (dir === "left") targetCol -= 1;
    else targetCol += 1;

    if (targetCol < 0 || targetCol >= COLS) return; // bordes laterales: no se mueve
    if (targetRow < ROW_GOALS || targetRow > ROW_START) return; // bordes verticales del tablero

    frog.fromCol = frog.col;
    frog.fromRow = frog.row;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
    frog.animating = true;
    frog.animT = 0;
  }

  function resolveLanding() {
    if (frog.row < bestRow) {
      score += SCORE_PER_ADVANCE * (bestRow - frog.row);
      bestRow = frog.row;
    }

    if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
      if (checkRoadCollision(frog, lanes)) killFrog();
    } else if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      if (!getSupport(frog, lanes)) killFrog();
    } else if (frog.row === ROW_GOALS) {
      const result = checkGoal(frog, goals);
      if (result === "ok") {
        score += SCORE_PER_GOAL + Math.round(roundTimeS * SCORE_TIME_BONUS_MULT);
        if (goals.every((g) => g.occupied)) completeRound();
        else sendFrogToStart();
      } else {
        killFrog();
      }
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────
  function update(dt: number, input: FroggerInputState) {
    if (state !== "playing") return;

    for (const lane of lanes) {
      for (const e of lane.entities) {
        e.col += lane.dir * lane.speed * dt;
        if (lane.dir === 1 && e.col > COLS) e.col = -e.width;
        else if (lane.dir === -1 && e.col + e.width < 0) e.col = COLS;

        if (e.type === "turtle") {
          e.submergeT = (e.submergeT ?? 0) + dt * 1000;
          const limit = e.submerged ? TURTLE_SUBMERGED_MS : TURTLE_VISIBLE_MS;
          if (e.submergeT >= limit) {
            e.submerged = !e.submerged;
            e.submergeT = 0;
          }
        }
      }
    }

    if (frog.animating) {
      frog.animT += dt * 1000;
      if (frog.animT >= JUMP_ANIM_MS) {
        frog.animating = false;
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        resolveLanding();
      }
    } else {
      const dir = pickDirection(input);
      if (dir) {
        startJump(dir);
      } else if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
        const support = getSupport(frog, lanes);
        if (!support) {
          killFrog();
        } else {
          const lane = lanes.find((l) => l.row === frog.row);
          if (lane) {
            frog.col += lane.dir * lane.speed * dt;
            if (frog.col < 0 || frog.col >= COLS) killFrog();
          }
        }
      }
    }

    if (state === "playing") {
      roundTimeS -= dt;
      if (roundTimeS <= 0) {
        roundTimeS = 0;
        killFrog();
      }
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────
  // Paleta activa resuelta una vez por frame (ver draw()) y pasada a cada
  // función de dibujo — mismo patrón que asteroids/engine.ts, para no
  // introducir estado de módulo ni recalcular FROGGER_SKINS[skin] por
  // entidad.
  function zoneColor(row: number, p: Palette): string {
    if (row === ROW_GOALS) return p.entities.zonaMeta;
    if (row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT) return p.entities.zonaRio;
    if (row === ROW_SAFE_MID || row === ROW_START) return p.entities.zonaSegura;
    return p.entities.zonaCarretera;
  }

  function paintBackground(target: CanvasRenderingContext2D, p: Palette) {
    target.fillStyle = p.bg;
    target.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (let row = 0; row < ROWS; row++) {
      target.fillStyle = zoneColor(row, p);
      target.fillRect(OFFSET_X, OFFSET_Y + row * CELL, BOARD_W, CELL);
    }
    // Rejilla sutil: "transparent" en clasico (sin dibujo real). Puntos de
    // 2x2px en las intersecciones cada 2 celdas, no líneas completas — con
    // trazo continuo la rejilla cubre >0.2% del lienzo y Fase 4 (C1) la
    // confunde con un elemento jugable de bajo contraste (mismo problema
    // resuelto en snake/engine.ts, ver games-with-themes.md).
    if (p.grid !== "transparent") {
      target.fillStyle = p.grid;
      for (let col = 0; col <= COLS; col += 2) {
        for (let row = 0; row <= ROWS; row += 2) {
          target.fillRect(OFFSET_X + col * CELL - 1, OFFSET_Y + row * CELL - 1, 2, 2);
        }
      }
    }
  }

  function drawBackground(p: Palette) {
    if (!bgCanvas || bgCanvasSkin !== skin) {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const bgCtx = canvas.getContext("2d");
      if (bgCtx) {
        paintBackground(bgCtx, p);
        bgCanvas = canvas;
        bgCanvasSkin = skin;
      }
    }
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);
    else paintBackground(ctx, p);
  }

  function drawGoals(p: Palette) {
    for (const g of goals) {
      const x = OFFSET_X + g.col * CELL;
      const y = OFFSET_Y + ROW_GOALS * CELL;
      const w = GOAL_WIDTH_COLS * CELL;
      ctx.fillStyle = p.entities.zonaMeta;
      ctx.fillRect(x + 2, y + 2, w - 4, CELL - 4);
      ctx.strokeStyle = p.entities.metaBorde;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
      if (g.occupied) {
        conGlow(ctx, p.glow, 10, () => {
          ctx.fillStyle = p.accent;
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + CELL / 2, w * 0.28, CELL * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }

  // Cuerpo del vehículo (fillRect, no requiere beginPath): se dibuja por
  // entidad porque el color depende del tipo. Las ruedas, en cambio, se
  // agrupan por carril en drawLaneWheels (mismo fillStyle siempre).
  function drawVehicleBody(e: Entity, y: number, p: Palette) {
    const x = OFFSET_X + e.col * CELL;
    const w = e.width * CELL;
    ctx.fillStyle = e.type === "truck" ? p.entities.camion : p.danger;
    ctx.fillRect(x + 2, y + 6, w - 4, CELL - 16);
    if (e.type === "truck") {
      ctx.fillStyle = p.entities.camionCabina;
      ctx.fillRect(x + w - CELL * 0.6, y + 2, CELL * 0.5, CELL - 8);
    }
  }

  function drawLaneWheels(lane: Lane, y: number, p: Palette) {
    ctx.fillStyle = p.entities.rueda;
    ctx.beginPath();
    for (const e of lane.entities) {
      if (e.col + e.width < 0 || e.col > COLS) continue;
      const x = OFFSET_X + e.col * CELL;
      const w = e.width * CELL;
      ctx.arc(x + 10, y + CELL - 8, 5, 0, Math.PI * 2);
      ctx.arc(x + w - 10, y + CELL - 8, 5, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Cuerpo del tronco (roundRect, un beginPath por tronco porque cada uno
  // tiene su propia geometría): las líneas divisorias y las tortugas, en
  // cambio, comparten fillStyle/strokeStyle dentro de un carril y se
  // agrupan en drawLaneLogLines/drawLaneTurtles.
  function drawLogBody(e: Entity, y: number, p: Palette) {
    const x = OFFSET_X + e.col * CELL;
    const w = e.width * CELL;
    ctx.fillStyle = p.entities.tronco;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 8, w - 2, CELL - 16, 8);
    ctx.fill();
  }

  function drawLaneLogLines(lane: Lane, y: number, p: Palette) {
    ctx.strokeStyle = p.entities.troncoLinea;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const e of lane.entities) {
      if (e.type !== "log") continue;
      if (e.col + e.width < 0 || e.col > COLS) continue;
      const x = OFFSET_X + e.col * CELL;
      for (let i = 1; i < e.width; i++) {
        ctx.moveTo(x + i * CELL, y + 8);
        ctx.lineTo(x + i * CELL, y + CELL - 8);
      }
    }
    ctx.stroke();
  }

  function drawLaneTurtles(lane: Lane, y: number, p: Palette) {
    for (const submergedPass of [true, false]) {
      let started = false;
      for (const e of lane.entities) {
        if (e.type !== "turtle" || Boolean(e.submerged) !== submergedPass) continue;
        if (e.col + e.width < 0 || e.col > COLS) continue;
        if (!started) {
          ctx.fillStyle = submergedPass ? turtleSubmergedColor : p.entities.tortuga;
          ctx.beginPath();
          started = true;
        }
        const x = OFFSET_X + e.col * CELL;
        for (let i = 0; i < e.width; i++) {
          ctx.ellipse(
            x + i * CELL + CELL / 2,
            y + CELL / 2,
            CELL * 0.4,
            CELL * 0.32,
            0,
            0,
            Math.PI * 2,
          );
        }
      }
      if (started) ctx.fill();
    }
  }

  function drawLanes(p: Palette) {
    for (const lane of lanes) {
      const y = OFFSET_Y + lane.row * CELL;
      const isRoad = lane.row >= ROW_ROAD_TOP && lane.row <= ROW_ROAD_BOT;
      for (const e of lane.entities) {
        if (e.col + e.width < 0 || e.col > COLS) continue;
        if (isRoad) drawVehicleBody(e, y, p);
        else if (e.type === "log") drawLogBody(e, y, p);
      }
      if (isRoad) {
        drawLaneWheels(lane, y, p);
      } else {
        drawLaneLogLines(lane, y, p);
        drawLaneTurtles(lane, y, p);
      }
    }
  }

  function drawFrog(p: Palette) {
    const t = frog.animating ? Math.min(frog.animT / JUMP_ANIM_MS, 1) : 1;
    const col = frog.animating ? frog.fromCol + (frog.targetCol - frog.fromCol) * t : frog.col;
    const row = frog.animating ? frog.fromRow + (frog.targetRow - frog.fromRow) * t : frog.row;
    const cx = OFFSET_X + col * CELL + CELL / 2;
    const cy = OFFSET_Y + row * CELL + CELL / 2;
    const hop = frog.animating ? -Math.sin(t * Math.PI) * 10 : 0;

    conGlow(ctx, p.glow, 10, () => {
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.ellipse(cx, cy + hop, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 6 + hop, 4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 6 + hop, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.entities.pupila;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 6 + hop, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 6 + hop, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud(p: Palette) {
    ctx.fillStyle = p.hud;
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${score}`, OFFSET_X, OFFSET_Y - 6);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, CANVAS_W / 2, OFFSET_Y - 6);
    ctx.textAlign = "right";
    for (let i = 0; i < lives; i++) {
      ctx.beginPath();
      ctx.arc(OFFSET_X + BOARD_W - i * 20, OFFSET_Y - 10, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.accent;
      ctx.fill();
    }

    const total = currentRoundTime(level);
    const ratio = Math.max(0, Math.min(1, roundTimeS / total));
    ctx.fillStyle = ratio > 0.5 ? p.accent : ratio > 0.25 ? p.entities.temporizadorMedio : p.danger;
    ctx.fillRect(OFFSET_X, OFFSET_Y - 2, BOARD_W * ratio, 4);
  }

  function draw() {
    const p = FROGGER_SKINS[skin];
    drawBackground(p);
    drawGoals(p);
    drawLanes(p);
    drawFrog(p);
    drawHud(p);
  }

  // Objeto único reutilizado por getState() (causa #6): evita alojar un
  // literal nuevo cada frame. FroggerGame.tsx hace una copia antes de
  // guardarla en lastReportedRef — si guardara esta misma referencia,
  // prev y state serían siempre el mismo objeto y reportIfChanged nunca
  // detectaría un cambio.
  const stateOut: FroggerEngineState = { score: 0, lives: START_LIVES, level: 1, state: "playing" };

  function getState(): FroggerEngineState {
    stateOut.score = score;
    stateOut.lives = lives;
    stateOut.level = level;
    stateOut.state = state;
    return stateOut;
  }

  function forceGameOver() {
    state = "gameover";
  }

  function setSkin(s: SkinBaseId) {
    skin = s;
    turtleSubmergedColor = hexARgba(FROGGER_SKINS[s].entities.tortuga, 0.25);
  }

  setSkin(skin);
  initGame();

  return { update, draw, getState, forceGameOver, setSkin };
}

export type FroggerEngine = ReturnType<typeof createEngine>;
