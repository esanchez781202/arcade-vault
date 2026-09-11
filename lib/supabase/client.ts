"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | undefined;

function requerirVariable(valor: string | undefined, nombre: string): string {
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
    // Acceso literal (`process.env.NEXT_PUBLIC_...`), no indexado: Next.js
    // solo inlinea en el bundle del navegador las variables NEXT_PUBLIC_*
    // referenciadas así; un `process.env[nombre]` dinámico llega como
    // `undefined` en tiempo de ejecución en el cliente.
    const url = requerirVariable(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requerirVariable(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
    cliente = createBrowserClient(url, publishableKey);
  }
  return cliente;
}
