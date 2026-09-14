// Pantalla Reproductor (ruta /juego/[id]/jugar). Server Component: carga el
// juego desde Supabase (notFound() si no existe) y delega el reproductor al
// cliente.

import { notFound } from "next/navigation";
import { obtenerJuego } from "@/lib/data/games";
import { obtenerMejoresScores } from "@/lib/data/scores";
import JugarClient from "./JugarClient";

export default async function GamePlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await obtenerJuego(id);
  if (!game) notFound();

  // Mejor score real (Supabase), usado para el badge "¡NUEVO RÉCORD!" del
  // reproductor de Tetris — en vez de una tabla de records en localStorage,
  // que contradiría la arquitectura de leaderboard de SPEC 06.
  const [mejorScore] = await obtenerMejoresScores(id, 1);

  return <JugarClient game={game} mejorGlobal={mejorScore?.score ?? 0} />;
}
