"use client";

// ===== components/games/frogger/FroggerGame.tsx =====
// Monta el motor real de FROGGER (engine.ts) en un <canvas> y sincroniza su
// estado con el HUD React del reproductor vía onStateChange. Expone
// pause()/resume()/forceGameOver()/setSkin() por ref imperativo, mismo
// patrón que TetrisGame.tsx (inputs "edge-triggered": cada tecla solo marca
// `pending.x = true` una vez, se consume y resetea en el siguiente frame del
// loop — igual que rotate/hardDrop en Tetris, necesario aquí para el salto
// discreto de una celda por pulsación).

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createEngine,
  type FroggerEngine,
  type FroggerEngineState,
  type FroggerInputState,
} from "./engine";
import type { SkinBaseId } from "../skins";

export type { FroggerEngineState } from "./engine";

export interface FroggerGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  setSkin(skin: SkinBaseId): void;
}

interface FroggerGameProps {
  onStateChange: (state: FroggerEngineState) => void;
  ref?: Ref<FroggerGameHandle>;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

type HeldKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export default function FroggerGame({ onStateChange, ref }: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FroggerEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const loopRef = useRef<(ts: number) => void>(() => {});
  const pendingRef = useRef({ up: false, down: false, left: false, right: false });
  const lastReportedRef = useRef<FroggerEngineState | null>(null);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  function reportIfChanged(state: FroggerEngineState) {
    const prev = lastReportedRef.current;
    if (
      !prev ||
      prev.score !== state.score ||
      prev.lives !== state.lives ||
      prev.level !== state.level ||
      prev.state !== state.state
    ) {
      // Copia: engine.getState() (SPEC 12) reutiliza un único objeto mutable
      // entre frames. Guardar la referencia dejaría prev === state siempre,
      // congelando el HUD sin error visible.
      lastReportedRef.current = { ...state };
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
      setSkin(skin) {
        const engine = engineRef.current;
        if (!engine) return;
        engine.setSkin(skin);
        // Redibuja de inmediato aunque esté en pausa (el loop no corre en
        // pausa) — mismo patrón que AsteroidsGame.tsx/TetrisGame.tsx.
        engine.draw();
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = createEngine(ctx);
    engineRef.current = engine;
    lastReportedRef.current = null;
    reportIfChanged(engine.getState());

    const pending = pendingRef.current;
    const isTrackedCode = (code: string): code is HeldKey =>
      code === "ArrowUp" || code === "ArrowDown" || code === "ArrowLeft" || code === "ArrowRight";

    function handleKeyDown(e: KeyboardEvent) {
      // La pausa (tecla P/Esc o botón del HUD) la controla JugarClient.tsx;
      // aquí solo bloqueamos inputs de juego mientras pause() esté activo.
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

    function loop(ts: number) {
      const eng = engineRef.current;
      if (!eng) return;
      const dt =
        lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = ts;

      const input: FroggerInputState = {
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
