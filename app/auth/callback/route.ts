import { NextResponse, type NextRequest } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

// Recibe el `code` del flujo PKCE (OAuth, registro, recuperación de
// contraseña) y lo intercambia por una sesión real antes de redirigir.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await crearClienteSupabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/biblioteca`);
    }
    return NextResponse.redirect(`${origin}/acceso?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/acceso?error=codigo_ausente`);
}
