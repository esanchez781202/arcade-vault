"use client";

// ===== components/games/arkanoid/ArkanoidGame.tsx =====
// Monta el motor real de ARKANOID (engine.ts) en un <canvas> y sincroniza su
// estado con el HUD React del reproductor vía onStateChange. Expone
// pause()/resume()/forceGameOver() por ref imperativo para que
// JugarClient.tsx los dispare desde los botones del HUD.
//
// Diferencia respecto a AsteroidsGame: durante la pausa, el motor dibuja un
// selector de nivel clicable (drawPaused()); un click sobre el canvas en ese
// estado reanuda la partida desde dentro del componente y avisa al padre vía
// onResumeRequested para que su botón PAUSA/REANUDAR no quede desincronizado.

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createEngine,
  type ArkanoidEngine,
  type ArkanoidEngineState,
  type ArkanoidInputState,
} from "./engine";
import type { SkinBaseId } from "../skins";

export type { ArkanoidEngineState } from "./engine";

export interface ArkanoidGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  setSkin(skin: SkinBaseId): void;
}

interface ArkanoidGameProps {
  onStateChange: (state: ArkanoidEngineState) => void;
  onResumeRequested?: () => void;
  ref?: Ref<ArkanoidGameHandle>;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

type HeldKey = "ArrowLeft" | "ArrowRight";

export default function ArkanoidGame({ onStateChange, onResumeRequested, ref }: ArkanoidGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ArkanoidEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const loopRef = useRef<(ts: number) => void>(() => {});
  const heldKeysRef = useRef<Record<HeldKey, boolean>>({
    ArrowLeft: false,
    ArrowRight: false,
  });
  const lastReportedRef = useRef<ArkanoidEngineState | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const onResumeRequestedRef = useRef(onResumeRequested);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  useEffect(() => {
    onResumeRequestedRef.current = onResumeRequested;
  }, [onResumeRequested]);

  function reportIfChanged(state: ArkanoidEngineState) {
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
        engineRef.current?.drawPaused();
      },
      resume() {
        resumeInternal();
      },
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
        // Redibuja de inmediato, incluso en pausa (el loop no corre ahí) —
        // mismo patrón que AsteroidsGame.tsx/TetrisGame.tsx. En pausa hay
        // que repintar el selector de nivel, no la escena "playing".
        if (pausedRef.current) engine.drawPaused();
        else engine.draw();
      },
    }),
    [],
  );

  function resumeInternal() {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }

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
      code === "ArrowLeft" || code === "ArrowRight";

    function handleKeyDown(e: KeyboardEvent) {
      if (!isTrackedCode(e.code)) return;
      heldKeys[e.code] = true;
      if (engineRef.current?.getState().state === "playing") e.preventDefault();
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (!isTrackedCode(e.code)) return;
      heldKeys[e.code] = false;
    }

    function handleClick(e: MouseEvent) {
      if (!pausedRef.current) return;
      const eng = engineRef.current;
      if (!eng || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const level = eng.hitTestPauseButton(x, y);
      if (level === null) return;
      eng.jumpToLevel(level);
      reportIfChanged(eng.getState());
      resumeInternal();
      onResumeRequestedRef.current?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("click", handleClick);

    function loop(ts: number) {
      const eng = engineRef.current;
      if (!eng) return;
      const dt =
        lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = ts;

      const input: ArkanoidInputState = {
        left: heldKeys.ArrowLeft,
        right: heldKeys.ArrowRight,
      };

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
      canvas.removeEventListener("click", handleClick);
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
