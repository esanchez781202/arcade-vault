"use client";

// Instrumentación de performance (SPEC 12). Mide FPS/frame-time con un
// requestAnimationFrame propio, aislado en este componente para que su
// re-render por frame no arrastre al resto del reproductor (mismo patrón
// que el paso 6 de la spec aplica al setInterval de JugarClient).
// Solo se monta en desarrollo o con ?fps=1 en la URL — nunca en producción
// sin el flag explícito.

import { useEffect, useRef, useState } from "react";

const TAMANO_MUESTRA = 120;

function debeMostrarOverlay(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("fps") === "1";
}

export default function FpsOverlay() {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState({ fps: 0, fpsMedio: 0, p95: 0 });
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setVisible(debeMostrarOverlay());
  }, []);

  useEffect(() => {
    if (!visible) return;

    let rafId: number;

    const tick = (time: number) => {
      const lastTime = lastTimeRef.current;
      if (lastTime !== null) {
        const delta = time - lastTime;
        const frameTimes = frameTimesRef.current;
        frameTimes.push(delta);
        if (frameTimes.length > TAMANO_MUESTRA) frameTimes.shift();

        const deltaMedio = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const ordenados = [...frameTimes].sort((a, b) => a - b);
        const p95Delta = ordenados[Math.floor(ordenados.length * 0.95)] ?? deltaMedio;

        setStats({
          fps: delta > 0 ? Math.round(1000 / delta) : 0,
          fpsMedio: deltaMedio > 0 ? Math.round(1000 / deltaMedio) : 0,
          p95: Math.round(p95Delta * 10) / 10,
        });
      }
      lastTimeRef.current = time;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 4,
        left: 4,
        zIndex: 20,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.65)",
        color: "#39ff14",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.4,
        padding: "4px 6px",
        borderRadius: 4,
        whiteSpace: "pre",
      }}
    >
      {`FPS ${stats.fps} · media ${stats.fpsMedio} · p95 ${stats.p95}ms`}
    </div>
  );
}
