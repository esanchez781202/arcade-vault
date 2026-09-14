// Pantalla Reproductor (ruta /juego/[id]/jugar). Server Component: carga el
// juego desde Supabase (notFound() si no existe) y delega el reproductor al
// cliente.

import { notFound } from "next/navigation";
import { obtenerJuego } from "@/lib/data/games";
import JugarClient from "./JugarClient";

export default async function GamePlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await obtenerJuego(id);
  if (!game) notFound();

  return <JugarClient game={game} />;
}
