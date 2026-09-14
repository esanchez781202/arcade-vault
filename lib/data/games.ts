// ===== lib/data/games.ts — acceso a la tabla `games` de Supabase =====

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { Game } from "@/lib/games";

export async function obtenerJuegos(): Promise<Game[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.from("games").select("*");

  if (error) {
    throw new Error(`Error al obtener los juegos: ${error.message}`);
  }

  return data as Game[];
}

export async function obtenerJuego(id: string): Promise<Game | null> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Error al obtener el juego "${id}": ${error.message}`);
  }

  return data as Game | null;
}
