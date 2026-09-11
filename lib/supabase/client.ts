"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | undefined;

function obtenerVariableEntorno(
  nombre: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

/**
 * Cliente Supabase para el navegador. Singleton a nivel de módulo: la primera
 * llamada crea la instancia y las siguientes, en la misma pestaña, reutilizan
 * la misma conexión.
 */
export function crearClienteSupabase(): SupabaseClient {
  if (!cliente) {
    const url = obtenerVariableEntorno("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = obtenerVariableEntorno("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    cliente = createBrowserClient(url, publishableKey);
  }
  return cliente;
}
