// ===== lib/games.ts — tipos del catálogo y del leaderboard =====
// El catálogo (`games`) y los scores (`scores`) viven en Supabase desde SPEC 06;
// ver lib/data/games.ts y lib/data/scores.ts para el acceso a datos.

export interface Game {
  id: string; // slug, p.ej. "bloque-buster"
  title: string;
  short: string; // descripción corta (tarjeta)
  long: string; // descripción larga (detalle)
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS de portada, p.ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string; // texto ya formateado, p.ej. "12.4K"
}

export const CATS: string[] = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // formateada desde created_at, "DD/MM/YYYY"
}
