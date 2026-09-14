// Pantalla Home (landing, ruta /). Server Component: carga el catálogo desde
// Supabase para la previsualización de juegos y delega el resto al cliente.

import { obtenerJuegos } from "@/lib/data/games";
import HomeClient from "./HomeClient";

export default async function Home() {
  const games = await obtenerJuegos();
  return <HomeClient games={games} />;
}
