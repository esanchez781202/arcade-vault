"use client";

// Pantalla Reproductor. Portado de references/templates/reproductor.jsx.
// Simulación visual: puntuación auto-incremental, pausa, nivel por umbral,
// marco CRT y modal de fin. GUARDAR escribe en localStorage `av_scores`
// (ninguna vista lo lee en esta spec).

import { use, useCallback, useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { GAMES } from "@/lib/games";
import { useSession } from "@/components/session-provider";
import AsteroidsGame, {
  type AsteroidsGameHandle,
  type AsteroidsEngineState,
} from "@/components/games/asteroids/AsteroidsGame";

interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

function saveScore(entry: ScoreEntry) {
  try {
    const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem("av_scores", JSON.stringify(all));
  } catch {
    // localStorage no disponible: no se persiste.
  }
}

export default function GamePlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const game = GAMES.find((g) => g.id === id);
  const isAsteroids = game?.id === "asteroids";

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "INVITADO");
  const [saved, setSaved] = useState(false);
  const [asteroidsKey, setAsteroidsKey] = useState(0);
  const asteroidsRef = useRef<AsteroidsGameHandle>(null);

  // Solo para juegos simulados: asteroids reporta su propio estado real vía onStateChange.
  useEffect(() => {
    if (isAsteroids) return;
    if (over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [over, paused, isAsteroids]);

  useEffect(() => {
    if (isAsteroids) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [score, isAsteroids]);

  if (!game) notFound();

  const handleAsteroidsStateChange = useCallback((s: AsteroidsEngineState) => {
    setScore(s.score);
    setLives(s.lives);
    setLevel(s.level);
    if (s.state === "gameover") setOver(true);
  }, []);

  const endGame = () => {
    if (isAsteroids) {
      asteroidsRef.current?.forceGameOver();
    } else {
      setOver(true);
    }
  };
  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (isAsteroids) {
        if (next) asteroidsRef.current?.pause();
        else asteroidsRef.current?.resume();
      }
      return next;
    });
  };
  const restart = () => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (isAsteroids) setAsteroidsKey((k) => k + 1);
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
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button className="btn ghost" onClick={() => router.push(`/juego/${game.id}`)}>
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsGame
              key={asteroidsKey}
              ref={asteroidsRef}
              onStateChange={handleAsteroidsStateChange}
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
          {paused && (
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

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
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
