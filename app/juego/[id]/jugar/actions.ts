"use server";

// Server Action que envuelve guardarScore() para el botón "GUARDAR PUNTUACIÓN"
// del reproductor (Client Component).

import { guardarScore } from "@/lib/data/scores";

export async function guardarScoreAction(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  await guardarScore(entry);
}
