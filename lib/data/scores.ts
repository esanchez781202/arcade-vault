// ===== lib/data/scores.ts — acceso a la tabla `scores` de Supabase =====

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { ScoreRow } from "@/lib/games";

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

export async function obtenerMejoresScores(gameId: string, limite: number): Promise<ScoreRow[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limite);

  if (error) {
    throw new Error(`Error al obtener los scores de "${gameId}": ${error.message}`);
  }

  return (data ?? []).map((fila, indice) => ({
    rank: indice + 1,
    name: fila.player_name as string,
    score: fila.score as number,
    date: formatearFecha(fila.created_at as string),
  }));
}

export async function guardarScore(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.gameId,
    player_name: entry.name,
    score: entry.score,
  });

  if (error) {
    throw new Error(`Error al guardar el score de "${entry.gameId}": ${error.message}`);
  }
}
