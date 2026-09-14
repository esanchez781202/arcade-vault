"use client";

// ===== components/games/tetris/TetrisGame.tsx =====
// Monta el motor real de TETRIS (engine.ts) en un <canvas> y sincroniza su
// estado con el HUD React del reproductor vía onStateChange. Expone
// pause()/resume()/forceGameOver() por ref imperativo para que
// JugarClient.tsx los dispare desde los botones del HUD (mismo patrón que
// AsteroidsGame.tsx).
//
// El canvas "next" (pieza siguiente) se porta como un segundo <canvas> React
// montado vía portal dentro del HUD del reproductor (fuera del marco CRT
// principal), en el nodo con id "tetris-next-slot" que JugarClient.tsx
// renderiza cuando game.id === "tetris".

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  createEngine,
  type TetrisEngine,
  type TetrisEngineState,
  type TetrisInputState,
  type TetrisSkin,
  type TetrisTheme,
} from "./engine";

export type { TetrisEngineState, TetrisSkin, TetrisTheme } from "./engine";

export interface TetrisGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  setTheme(theme: TetrisTheme): void;
  setSkin(skin: TetrisSkin): void;
}

const THEME_KEY = "tetris-theme";
const SKIN_KEY = "tetris-skin";
const START_LEVEL_KEY = "tetris-start-level";

function readInitialSettings(): { theme: TetrisTheme; skin: TetrisSkin; startLevel: number } {
  const theme: TetrisTheme = window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  const savedSkin = window.localStorage.getItem(SKIN_KEY);
  const skin: TetrisSkin =
    savedSkin === "neon" || savedSkin === "pastel" || savedSkin === "pixel" ? savedSkin : "retro";
  const savedLevel = parseInt(window.localStorage.getItem(START_LEVEL_KEY) ?? "1", 10);
  const startLevel = Number.isFinite(savedLevel) ? Math.min(15, Math.max(1, savedLevel)) : 1;
  return { theme, skin, startLevel };
}

interface TetrisGameProps {
  onStateChange: (state: TetrisEngineState) => void;
  ref?: Ref<TetrisGameHandle>;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const NEXT_CANVAS_SIZE = 120;
const NEXT_SLOT_ID = "tetris-next-slot";

type HeldKey = "ArrowLeft" | "ArrowRight" | "ArrowDown" | "ArrowUp" | "KeyX" | "Space";

export default function TetrisGame({ onStateChange, ref }: TetrisGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // El canvas "next" se crea en memoria (no vía JSX) para que el motor pueda
  // obtener su contexto 2D sin depender de que "tetris-next-slot" ya esté
  // montado en el DOM; se adjunta a ese nodo en el efecto de más abajo.
  const nextCanvasElRef = useRef<HTMLCanvasElement | null>(null);
  if (nextCanvasElRef.current === null && typeof document !== "undefined") {
    const el = document.createElement("canvas");
    el.width = NEXT_CANVAS_SIZE;
    el.height = NEXT_CANVAS_SIZE;
    el.style.display = "block";
    nextCanvasElRef.current = el;
  }
  const engineRef = useRef<TetrisEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const loopRef = useRef<(ts: number) => void>(() => {});
  const pendingRef = useRef({
    left: false,
    right: false,
    softDrop: false,
    rotate: false,
    hardDrop: false,
  });
  const lastReportedRef = useRef<TetrisEngineState | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const [nextSlot, setNextSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    setNextSlot(document.getElementById(NEXT_SLOT_ID));
  }, []);

  useEffect(() => {
    const el = nextCanvasElRef.current;
    if (!nextSlot || !el) return;
    nextSlot.appendChild(el);
    return () => {
      if (el.parentNode === nextSlot) nextSlot.removeChild(el);
    };
  }, [nextSlot]);

  function reportIfChanged(state: TetrisEngineState) {
    const prev = lastReportedRef.current;
    if (
      !prev ||
      prev.score !== state.score ||
      prev.level !== state.level ||
      prev.lines !== state.lines ||
      prev.maxCombo !== state.maxCombo ||
      prev.state !== state.state
    ) {
      lastReportedRef.current = state;
      onStateChangeRef.current(state);
    }
  }

  function doPause() {
    if (pausedRef.current) return;
    pausedRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Descarta cualquier input pendiente: evita un movimiento accidental al
    // reanudar (requisito del menú de pausa del prototipo).
    const pending = pendingRef.current;
    pending.left = false;
    pending.right = false;
    pending.softDrop = false;
    pending.rotate = false;
    pending.hardDrop = false;
  }

  function doResume() {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }

  useImperativeHandle(
    ref,
    () => ({
      pause: doPause,
      resume: doResume,
      forceGameOver() {
        const engine = engineRef.current;
        if (!engine) return;
        engine.forceGameOver();
        reportIfChanged(engine.getState());
      },
      setTheme(theme) {
        const engine = engineRef.current;
        if (!engine) return;
        engine.setTheme(theme);
        // Redibuja de inmediato aunque esté en pausa (el loop no corre en pausa).
        engine.draw();
      },
      setSkin(skin) {
        const engine = engineRef.current;
        if (!engine) return;
        engine.setSkin(skin);
        engine.draw();
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const nextCanvas = nextCanvasElRef.current;
    if (!canvas || !nextCanvas) return;
    const ctx = canvas.getContext("2d");
    const nextCtx = nextCanvas.getContext("2d");
    if (!ctx || !nextCtx) return;

    const engine = createEngine(ctx, nextCtx);
    // Lee tema/skin/nivel inicial directamente de localStorage al construir
    // el motor (en vez de que un efecto externo los reaplique después): así
    // el ajuste queda correcto sin importar cuántas veces React (Strict Mode
    // en desarrollo) invoque este efecto de montaje.
    const { theme, skin, startLevel } = readInitialSettings();
    engine.setTheme(theme);
    engine.setSkin(skin);
    if (startLevel !== 1) engine.setStartLevel(startLevel);
    engineRef.current = engine;
    lastReportedRef.current = null;
    reportIfChanged(engine.getState());

    const pending = pendingRef.current;
    const isTrackedCode = (code: string): code is HeldKey =>
      code === "ArrowLeft" ||
      code === "ArrowRight" ||
      code === "ArrowDown" ||
      code === "ArrowUp" ||
      code === "KeyX" ||
      code === "Space";

    function handleKeyDown(e: KeyboardEvent) {
      // La pausa (tecla P/Esc o botón del HUD) la controla JugarClient.tsx,
      // única fuente de verdad de `paused` — así el botón PAUSA/REANUDAR y
      // el overlay "EN PAUSA" del reproductor no se desincronizan de un
      // pause disparado por teclado. Aquí solo bloqueamos inputs de juego
      // mientras `pause()` (llamado externamente vía ref) esté activo.
      if (!isTrackedCode(e.code)) return;
      if (pausedRef.current) return;
      const playing = engineRef.current?.getState().state === "playing";
      if (playing) e.preventDefault();
      if (!playing) return;
      switch (e.code) {
        case "ArrowLeft":
          pending.left = true;
          break;
        case "ArrowRight":
          pending.right = true;
          break;
        case "ArrowDown":
          pending.softDrop = true;
          break;
        case "ArrowUp":
        case "KeyX":
          pending.rotate = true;
          break;
        case "Space":
          pending.hardDrop = true;
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    function loop(ts: number) {
      const eng = engineRef.current;
      if (!eng) return;
      const dt =
        lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = ts;

      const input: TetrisInputState = {
        left: pending.left,
        right: pending.right,
        softDrop: pending.softDrop,
        rotate: pending.rotate,
        hardDrop: pending.hardDrop,
      };
      pending.left = false;
      pending.right = false;
      pending.softDrop = false;
      pending.rotate = false;
      pending.hardDrop = false;

      eng.update(dt, input);
      eng.draw();
      reportIfChanged(eng.getState());

      rafRef.current = requestAnimationFrame(loop);
    }
    loopRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "auto",
        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
        display: "block",
      }}
    />
  );
}
