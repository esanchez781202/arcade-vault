// Pantalla Biblioteca (ruta /biblioteca). Server Component: carga el catálogo
// desde Supabase y delega la parte interactiva (buscador, filtro) al cliente.

import { obtenerJuegos } from "@/lib/data/games";
import { obtenerMejoresScoresPorJuego } from "@/lib/data/scores";
import BibliotecaClient from "./BibliotecaClient";

export default async function Library() {
  const games = await obtenerJuegos();
  const mejoresGlobales = await obtenerMejoresScoresPorJuego(games.map((g) => g.id));
  return <BibliotecaClient games={games} mejoresGlobales={mejoresGlobales} />;
}
