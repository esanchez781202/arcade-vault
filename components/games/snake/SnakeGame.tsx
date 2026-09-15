"use client";

// ===== components/games/snake/SnakeGame.tsx =====
// Monta el motor real de SNAKE (engine.ts) en un <canvas> y sincroniza su
// estado con el HUD React del reproductor vía onStateChange. Expone
// pause()/resume()/forceGameOver() por ref imperativo, mismo patrón que
// AsteroidsGame.tsx/TetrisGame.tsx.
//
// Único motor que depende de un asset raster (fruits.png): antes de crear el
// motor, precarga la imagen con `new Image()` y muestra "CARGANDO..." en el
// canvas mientras no dispara `onload` — createEngine(ctx, spriteImage) recibe
// la imagen ya cargada, el resto del contrato queda igual que los otros motores.

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createEngine,
  type SnakeEngine,
  type SnakeEngineState,
  type SnakeInputState,
} from "./engine";
import { FRUIT_IMAGE_SRC } from "./sprites";

export type { SnakeEngineState } from "./engine";

export interface SnakeGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}

interface SnakeGameProps {
  onStateChange: (state: SnakeEngineState) => void;
  ref?: Ref<SnakeGameHandle>;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

type HeldKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export default function SnakeGame({ onStateChange, ref }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const loopRef = useRef<(ts: number) => void>(() => {});
  const pendingRef = useRef({ up: false, down: false, left: false, right: false });
  const lastReportedRef = useRef<SnakeEngineState | null>(null);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  function reportIfChanged(state: SnakeEngineState) {
    const prev = lastReportedRef.current;
    if (
      !prev ||
      prev.score !== state.score ||
      prev.level !== state.level ||
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
    const pending = pendingRef.current;
    pending.up = false;
    pending.down = false;
    pending.left = false;
    pending.right = false;
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
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;

    ctx.fillStyle = "#0a0a18";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#00ff88";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("CARGANDO...", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

    const spriteImage = new Image();
    spriteImage.src = FRUIT_IMAGE_SRC;

    let cleanupInput = () => {};

    spriteImage.onload = () => {
      if (!active) return;

      const engine = createEngine(ctx, spriteImage);
      engineRef.current = engine;
      lastReportedRef.current = null;
      reportIfChanged(engine.getState());

      const pending = pendingRef.current;
      const isTrackedCode = (code: string): code is HeldKey =>
        code === "ArrowUp" || code === "ArrowDown" || code === "ArrowLeft" || code === "ArrowRight";

      function handleKeyDown(e: KeyboardEvent) {
        if (!isTrackedCode(e.code)) return;
        if (pausedRef.current) return;
        const playing = engineRef.current?.getState().state === "playing";
        if (playing) e.preventDefault();
        if (!playing) return;
        switch (e.code) {
          case "ArrowUp":
            pending.up = true;
            break;
          case "ArrowDown":
            pending.down = true;
            break;
          case "ArrowLeft":
            pending.left = true;
            break;
          case "ArrowRight":
            pending.right = true;
            break;
        }
      }

      window.addEventListener("keydown", handleKeyDown);
      cleanupInput = () => window.removeEventListener("keydown", handleKeyDown);

      function loop(ts: number) {
        const eng = engineRef.current;
        if (!eng) return;
        const dt =
          lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = ts;

        const input: SnakeInputState = {
          up: pending.up,
          down: pending.down,
          left: pending.left,
          right: pending.right,
        };
        pending.up = false;
        pending.down = false;
        pending.left = false;
        pending.right = false;

        eng.update(dt, input);
        eng.draw();
        reportIfChanged(eng.getState());

        rafRef.current = requestAnimationFrame(loop);
      }
      loopRef.current = loop;
      rafRef.current = requestAnimationFrame(loop);
    };

    return () => {
      active = false;
      cleanupInput();
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
