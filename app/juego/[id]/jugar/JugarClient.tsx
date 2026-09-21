"use client";

// Parte interactiva del Reproductor. Portado de references/templates/reproductor.jsx.
// Para juegos sin motor real: simulación visual (puntuación auto-incremental,
// nivel por umbral). Para juegos registrados en REGISTRO_MOTORES (asteroids,
// tetris), el motor real reporta su propio estado vía onStateChange y el
// marco CRT monta su componente en vez del bloque `.game-arena` simulado.
// GUARDAR PUNTUACIÓN escribe en Supabase vía guardarScoreAction (Server
// Action), ver actions.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import { useSession } from "@/components/session-provider";
import {
  REGISTRO_MOTORES,
  type RealGameHandle,
  type RealGameState,
} from "@/components/games/registry";
import { SKIN_LABELS } from "@/components/games/skins";
import { useSkinPreference } from "@/components/games/use-skin-preference";
import { guardarScoreAction } from "./actions";

interface RealGameStateWithLines extends RealGameState {
  lines?: number;
  maxCombo?: number;
}

export default function JugarClient({ game, mejorGlobal }: { game: Game; mejorGlobal: number }) {
  const router = useRouter();
  const { user } = useSession();
  const motor = REGISTRO_MOTORES[game.id];
  const MotorJuego = motor?.component;
  const skinsPermitidas = motor?.skins ?? [];

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "INVITADO");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [mejor, setMejor] = useState(mejorGlobal);
  const gameRef = useRef<RealGameHandle>(null);

  // Selector de skin genérico: aplica a cualquier motor con `skins.length >
  // 0` en REGISTRO_MOTORES (hoy Asteroids y Tetris). Arranca en
  // `skinsPermitidas[0]` (igual en servidor y cliente) y lee la preferencia
  // guardada tras montar, para no desincronizar el HTML de hidratación.
  const [skin, setSkin] = useSkinPreference(game.id, skinsPermitidas);

  // Nivel inicial y controles: portados de references/started-games/03-tetris,
  // solo afectan a la pantalla de Tetris.
  const [tetrisStartLevel, setTetrisStartLevel] = useState(1);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (game.id !== "tetris") return;
    const savedLevel = parseInt(window.localStorage.getItem("tetris-start-level") ?? "1", 10);
    if (Number.isFinite(savedLevel)) setTetrisStartLevel(Math.min(15, Math.max(1, savedLevel)));
  }, [game.id]);

  // Solo para juegos simulados: los motores reales reportan su propio estado
  // real vía onStateChange (ver handleGameStateChange).
  useEffect(() => {
    if (MotorJuego) return;
    if (over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [over, paused, MotorJuego]);

  useEffect(() => {
    if (MotorJuego) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [score, MotorJuego]);

  // Aplica la skin elegida mientras el motor ya está montado (selector) y
  // también tras un reinicio (gameKey cambia y remonta MotorJuego con el
  // motor por defecto en "clasico").
  useEffect(() => {
    if (skinsPermitidas.length === 0) return;
    gameRef.current?.setSkin?.(skin);
  }, [skin, skinsPermitidas.length, gameKey]);

  const changeTetrisStartLevel = (delta: number) => {
    setTetrisStartLevel((l) => {
      const next = Math.min(15, Math.max(1, l + delta));
      window.localStorage.setItem("tetris-start-level", String(next));
      return next;
    });
  };

  const handleGameStateChange = useCallback((s: RealGameStateWithLines) => {
    setScore(s.score);
    setLives(s.lives);
    setLevel(s.level);
    if (typeof s.lines === "number") setLines(s.lines);
    if (typeof s.maxCombo === "number") setMaxCombo(s.maxCombo);
    if (s.state === "gameover" || s.state === "win") setOver(true);
  }, []);

  const endGame = () => {
    if (MotorJuego) {
      gameRef.current?.forceGameOver();
    } else {
      setOver(true);
    }
  };
  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (MotorJuego) {
        if (next) gameRef.current?.pause();
        else gameRef.current?.resume();
      }
      return next;
    });
  };
  const restart = () => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setLines(0);
    setMaxCombo(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (MotorJuego) setGameKey((k) => k + 1);
  };

  // Tecla P/Esc para pausar en Tetris (portado del prototipo): se maneja
  // aquí, no dentro de TetrisGame, para que el botón PAUSA/REANUDAR y el
  // overlay "EN PAUSA" (estado de JugarClient) nunca se desincronicen de
  // una pausa disparada por teclado.
  useEffect(() => {
    if (game.id !== "tetris") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (over) return;
      if (e.code === "KeyP" || e.code === "Escape") togglePause();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.id, over, togglePause]);

  // Tecla P/Esc para pausar en Arkanoid (portado del prototipo), igual
  // patrón que Tetris: se maneja aquí para que el botón PAUSA/REANUDAR y el
  // overlay de pausa nunca se desincronicen de una pausa disparada por teclado.
  useEffect(() => {
    if (game.id !== "arkanoid") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (over) return;
      if (e.code === "KeyP" || e.code === "Escape") togglePause();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.id, over, togglePause]);

  const esNuevoRecord = game.id === "tetris" && over && score > 0 && score > mejor;

  const guardarPuntuacion = async () => {
    setSaving(true);
    try {
      await guardarScoreAction({ gameId: game.id, name, score });
      setSaved(true);
      setMejor((m) => Math.max(m, score));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {game.id === "tetris" && (
            <div className="hud-stat">
              <div className="l">Líneas</div>
              <div className="v">{lines}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          {game.id === "tetris" && (
            <button className="btn ghost" onClick={restart}>
              REINICIAR
            </button>
          )}
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button className="btn ghost" onClick={() => router.push(`/juego/${game.id}`)}>
            SALIR
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="crt" style={{ flex: "1 1 480px", minWidth: 0 }}>
          <div className="crt-screen">
            {MotorJuego ? (
              <MotorJuego
                key={gameKey}
                ref={gameRef}
                onStateChange={handleGameStateChange}
                onResumeRequested={() => {
                  gameRef.current?.resume();
                  setPaused(false);
                }}
              />
            ) : (
              <div className="game-arena">
                <div className="grid-floor" />
                <div className="enemy e1" />
                <div className="enemy e2" />
                <div className="enemy e3" />
                <div className="player-ship" />
              </div>
            )}
            {paused && game.id !== "arkanoid" && (
              <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
                <div>
                  <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                    EN PAUSA
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-dim)",
                      marginTop: 10,
                      letterSpacing: "0.16em",
                    }}
                  >
                    PULSA REANUDAR PARA CONTINUAR
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>{game.title} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        </div>

        {(skinsPermitidas.length > 0 || game.id === "tetris") && (
          <div style={{ flex: "0 0 200px", display: "flex", flexDirection: "column", gap: 16 }}>
            {skinsPermitidas.length > 0 && (
              <div className="hud-stat">
                <div className="l">Skin</div>
                <select
                  value={skin}
                  onChange={(e) => setSkin(e.target.value as typeof skin)}
                  style={{
                    background: "var(--bg-2)",
                    color: "var(--ink)",
                    border: "1px solid var(--ink-faint)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 12,
                  }}
                >
                  {skinsPermitidas.map((s) => (
                    <option key={s} value={s}>
                      {SKIN_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {game.id === "tetris" && (
              <div className="hud-stat">
                <div className="l">Siguiente</div>
                <div
                  id="tetris-next-slot"
                  style={{
                    width: 120,
                    height: 120,
                    background: "#000",
                    border: "1px solid var(--ink-faint)",
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                />
              </div>
            )}

            {game.id === "tetris" && (
              <div className="hud-stat">
                <div className="l">Nivel inicial</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn ghost"
                    style={{ padding: "2px 10px", fontSize: 14 }}
                    onClick={() => changeTetrisStartLevel(-1)}
                    disabled={tetrisStartLevel <= 1}
                  >
                    −
                  </button>
                  <span className="v" style={{ minWidth: 20, textAlign: "center" }}>
                    {tetrisStartLevel}
                  </span>
                  <button
                    className="btn ghost"
                    style={{ padding: "2px 10px", fontSize: 14 }}
                    onClick={() => changeTetrisStartLevel(1)}
                    disabled={tetrisStartLevel >= 15}
                  >
                    +
                  </button>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.05em" }}
                >
                  Aplica en la próxima partida
                </div>
              </div>
            )}

            {game.id === "tetris" && (
              <div className="hud-stat">
                <button
                  className="btn ghost"
                  style={{ fontSize: 10, padding: "6px 10px" }}
                  onClick={() => setShowControls((v) => !v)}
                >
                  {showControls ? "OCULTAR CONTROLES" : "VER CONTROLES"}
                </button>
                {showControls && (
                  <ul
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-dim)",
                      listStyle: "none",
                      padding: 0,
                      marginTop: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <li>← → mover</li>
                    <li>↑ / X rotar</li>
                    <li>↓ caída suave</li>
                    <li>Espacio caída total</li>
                    <li>P / Esc pausa</li>
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            {esNuevoRecord && (
              <div
                className="pixel neon-yellow"
                style={{ fontSize: 13, marginBottom: 4, letterSpacing: "0.08em" }}
              >
                ¡NUEVO RÉCORD!
              </div>
            )}
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {game.id === "tetris" && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  marginTop: 4,
                  letterSpacing: "0.05em",
                }}
              >
                Líneas: {lines} · Combo máximo: {maxCombo}
              </div>
            )}
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={guardarPuntuacion} disabled={saving}>
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/biblioteca")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
