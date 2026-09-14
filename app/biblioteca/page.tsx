// Pantalla Biblioteca (ruta /biblioteca). Server Component: carga el catálogo
// desde Supabase y delega la parte interactiva (buscador, filtro) al cliente.

import { obtenerJuegos } from "@/lib/data/games";
import BibliotecaClient from "./BibliotecaClient";

export default async function Library() {
  const games = await obtenerJuegos();
  return <BibliotecaClient games={games} />;
}
