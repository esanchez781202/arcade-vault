// ===== lib/email.ts — envío del correo de contacto vía Resend =====
// Módulo SÓLO de servidor. No lleva "use client" y nunca debe importarse desde
// un componente cliente: aquí se lee RESEND_API_KEY (SPEC 03).

import { Resend } from "resend";

interface CorreoContacto {
  nombre: string;
  email: string;
  mensaje: string;
}

// Escapa los caracteres con significado en HTML para evitar inyección de markup
// en el cuerpo del correo (decisión de SPEC 03: escapar sin traer una librería
// de plantillas).
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Envía el correo del formulario de contacto al buzón del equipo.
// Lanza si Resend devuelve un error; la Server Action lo captura y responde
// { ok: false, error: "envio" }.
export async function enviarCorreoContacto({ nombre, email, mensaje }: CorreoContacto) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const asunto = `[Arcade Vault] Mensaje de ${nombre}`;

  const text = [
    `Nombre: ${nombre}`,
    `Email: ${email}`,
    "",
    "Mensaje:",
    mensaje,
  ].join("\n");

  const html = `<div style="font-family:monospace;font-size:14px;line-height:1.6">
  <p><strong>Nombre:</strong> ${escaparHtml(nombre)}</p>
  <p><strong>Email:</strong> ${escaparHtml(email)}</p>
  <p><strong>Mensaje:</strong></p>
  <pre style="white-space:pre-wrap;font-family:monospace">${escaparHtml(mensaje)}</pre>
</div>`;

  const { data, error } = await resend.emails.send({
    from: process.env.CONTACT_FROM_EMAIL!,
    to: process.env.CONTACT_TO_EMAIL!,
    replyTo: email,
    subject: asunto,
    text,
    html,
  });

  if (error) {
    throw new Error(`Resend rechazó el envío: ${error.message}`);
  }

  return data;
}
