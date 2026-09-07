"use server";

// Server Action del formulario de contacto (SPEC 03). Se invoca desde
// app/acerca-de/page.tsx ("use client") dentro de un handler de submit.
// La RESEND_API_KEY sólo se lee aquí y en lib/email.ts, nunca en el bundle
// de cliente.

import { enviarCorreoContacto } from "@/lib/email";

export interface ContactoInput {
  nombre: string;
  email: string;
  mensaje: string;
  empresa: string; // honeypot: siempre "" en envíos legítimos
}

export type ContactoResult =
  | { ok: true }
  | { ok: false; error: "validacion" | "config" | "envio" };

// Regex simple: algo@algo.algo sin espacios.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function enviarMensaje(input: ContactoInput): Promise<ContactoResult> {
  // 1. Honeypot: si el campo oculto trae contenido es un bot. Se responde OK
  //    sin enviar nada (bot silenciado).
  if (input.empresa.trim() !== "") {
    return { ok: true };
  }

  // 2. Revalidación en servidor (el input del cliente es no confiable).
  const nombre = input.nombre.trim();
  const email = input.email.trim();
  const mensaje = input.mensaje.trim();
  if (nombre === "" || email === "" || mensaje === "" || !EMAIL_RE.test(email)) {
    return { ok: false, error: "validacion" };
  }

  // 3. Sin API key configurada → error controlado, sin lanzar ni 500.
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "config" };
  }

  // 4. Envío real. Si lanza o Resend devuelve error → error: "envio".
  try {
    await enviarCorreoContacto({ nombre, email, mensaje });
  } catch {
    return { ok: false, error: "envio" };
  }

  // 5. Éxito.
  return { ok: true };
}
