import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Nombre de archivo/función `proxy` en vez de `middleware`: en next@16.3.4 el
// convenio `middleware.ts` está deprecado a favor de `proxy.ts` (mismo
// comportamiento, ver node_modules/next/dist/docs/.../file-conventions/proxy.md).
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return respuesta;
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          respuesta.cookies.set(name, value, options),
        );
      },
    },
  });

  // Solo refresca la sesión (token expirado -> nuevo token, cookies
  // propagadas en la respuesta). Sin lógica de redirección ni rutas
  // protegidas: eso es de la spec de auth.
  await supabase.auth.getUser();

  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
