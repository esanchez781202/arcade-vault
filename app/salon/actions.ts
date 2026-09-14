"use server";

// Server Actions que envuelven la capa de datos para /salon, que es un Client
// Component (necesita useState para la tab activa) y por eso no puede llamar
// a crearClienteSupabaseServidor() directamente.

import { obtenerJuegos } from "@/lib/data/games";
import { obtenerMejoresScores } from "@/lib/data/scores";
import type { Game, ScoreRow } from "@/lib/games";

export async function obtenerJuegosAction(): Promise<Game[]> {
  return obtenerJuegos();
}

export async function obtenerMejoresScoresAction(
  gameId: string,
  limite: number,
): Promise<ScoreRow[]> {
  return obtenerMejoresScores(gameId, limite);
}
