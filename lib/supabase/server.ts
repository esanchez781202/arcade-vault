import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Cliente Supabase para el servidor (Server Components, Route Handlers,
 * Server Actions). Instancia nueva en cada request: las cookies cambian
 * entre peticiones, así que no se reutiliza a nivel de módulo como el
 * cliente de navegador.
 */
export async function crearClienteSupabaseServidor(): Promise<SupabaseClient> {
  const url = obtenerVariableEntorno("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = obtenerVariableEntorno("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: se puede ignorar si el
          // middleware/proxy refresca la sesión en cada request.
        }
      },
    },
  });
}
