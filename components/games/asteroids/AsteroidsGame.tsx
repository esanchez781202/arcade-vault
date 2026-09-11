"use client";

// ===== components/games/asteroids/AsteroidsGame.tsx =====
// Monta el motor real de ASTEROIDS (engine.ts) en un <canvas> y sincroniza su
// estado con el HUD React del reproductor vía onStateChange. Expone
// pause()/resume()/forceGameOver() por ref imperativo para que
// app/juego/[id]/jugar/page.tsx los dispare desde los botones del HUD.

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createEngine,
  type AsteroidsEngine,
  type AsteroidsEngineState,
  type AsteroidsInputState,
} from "./engine";

export type { AsteroidsEngineState } from "./engine";

export interface AsteroidsGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}

interface AsteroidsGameProps {
  onStateChange: (state: AsteroidsEngineState) => void;
  ref?: Ref<AsteroidsGameHandle>;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

type HeldKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "Space";

export default function AsteroidsGame({ onStateChange, ref }: AsteroidsGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const loopRef = useRef<(ts: number) => void>(() => {});
  const heldKeysRef = useRef<Record<HeldKey, boolean>>({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    Space: false,
  });
  const shootJustPressedRef = useRef(false);
  const lastReportedRef = useRef<AsteroidsEngineState | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  function reportIfChanged(state: AsteroidsEngineState) {
    const prev = lastReportedRef.current;
    if (
      !prev ||
      prev.score !== state.score ||
      prev.lives !== state.lives ||
      prev.level !== state.level ||
      prev.state !== state.state
    ) {
      lastReportedRef.current = state;
      onStateChangeRef.current(state);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      pause() {
        if (pausedRef.current) return;
        pausedRef.current = true;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      },
      resume() {
        if (!pausedRef.current) return;
        pausedRef.current = false;
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(loopRef.current);
      },
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

    const engine = createEngine(ctx);
    engineRef.current = engine;
    lastReportedRef.current = null;
    reportIfChanged(engine.getState());

    const heldKeys = heldKeysRef.current;
    const isTrackedCode = (code: string): code is HeldKey =>
      code === "ArrowLeft" || code === "ArrowRight" || code === "ArrowUp" || code === "Space";

    function handleKeyDown(e: KeyboardEvent) {
      if (!isTrackedCode(e.code)) return;
      if (!heldKeys[e.code]) {
        if (e.code === "Space") shootJustPressedRef.current = true;
        heldKeys[e.code] = true;
      }
      if (engineRef.current?.getState().state === "playing") e.preventDefault();
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (!isTrackedCode(e.code)) return;
      heldKeys[e.code] = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    function loop(ts: number) {
      const eng = engineRef.current;
      if (!eng) return;
      const dt =
        lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = ts;

      const input: AsteroidsInputState = {
        left: heldKeys.ArrowLeft,
        right: heldKeys.ArrowRight,
        up: heldKeys.ArrowUp,
        shoot: shootJustPressedRef.current,
      };
      shootJustPressedRef.current = false;

      eng.update(dt, input);
      eng.draw();
      reportIfChanged(eng.getState());

      rafRef.current = requestAnimationFrame(loop);
    }
    loopRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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
