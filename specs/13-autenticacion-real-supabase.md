# SPEC 13 — Autenticación real (registro, login, OAuth) con Supabase Auth

> **Estado:** Aprobado
> **Depende de:** SPEC 04
> **Fecha:** 2026-10-09
> **Objetivo:** Sustituir el login simulado (`localStorage` `av_user`) de `/acceso` y `components/session-provider.tsx` por autenticación real con Supabase Auth (email+contraseña, OAuth Google/GitHub y recuperación de contraseña), con confirmación de email obligatoria y sin proteger ninguna ruta.

---

## Por qué existe esta spec

SPEC 04 instaló los clientes de Supabase y dejó explícitamente fuera de alcance "autenticación real (`signUp`, `signInWithPassword`, OAuth Google/GitHub)" y "sustituir `session-provider.tsx`". Esta es esa spec: el proyecto Supabase ya tiene `scores`/`games` en producción, pero el login sigue siendo una tarjeta que acepta cualquier nombre sin verificarlo contra nada. Esta spec conecta `/acceso` al servicio de Auth real, manteniendo el resto de la app (nav, salón, reproductor) funcionando igual que hoy.

---

## Alcance

**Dentro:**

- Reescribir `components/session-provider.tsx` para que la sesión salga de Supabase Auth (`crearClienteSupabase()` de `lib/supabase/client.ts`, vía `getSession()` al montar + `onAuthStateChange`) en vez de `localStorage` `av_user`. La forma pública (`useSession()` → `{ user, login, signOut }`) se mantiene todo lo posible para no tocar `components/nav.tsx` ni `app/juego/[id]/jugar/JugarClient.tsx`.
- `SessionUser.name` se deriva de `user_metadata.display_name` (cuentas email+contraseña) o, si no existe (cuentas OAuth), de `user_metadata.full_name`/`user_metadata.name` o del prefijo del email antes de `@`; en mayúsculas, máx. 10 caracteres, igual que hoy.
- Reescribir `app/acceso/page.tsx`:
  - **INICIAR SESIÓN:** campos email + contraseña, llama a `supabase.auth.signInWithPassword`. Error visible bajo el formulario (credenciales inválidas, email sin confirmar, error de red) sin recargar la página. Éxito → `router.push("/biblioteca")`.
  - **CREAR CUENTA:** campos Usuario (display name, máx. 10 caracteres), Correo electrónico, Contraseña y **Confirmar contraseña** (campo nuevo). Validación en cliente: contraseñas coinciden y cumplen el mínimo de Supabase (6 caracteres) antes de llamar a la API. Llama a `supabase.auth.signUp` con `options.data.display_name` y `options.emailRedirectTo: ${location.origin}/auth/callback` (sin este último, el enlace del correo no pasa por el Route Handler). La respuesta tiene tres desenlaces distintos:
    - `data.session` presente (confirmación de email desactivada en el panel) → entra directo, `router.push("/biblioteca")`.
    - `data.user.identities.length === 0` (respuesta anti-enumeración: el correo ya tenía cuenta) → mensaje "Ya existe una cuenta con ese correo. Inicia sesión o entra con Google/GitHub." en el mismo hueco de error, sin cambiar de pantalla. Supabase no envía nada en este caso; sin esta rama el código mentía mostrando la pantalla de confirmación igualmente.
    - Resto (caso esperado) → el formulario se sustituye por una tarjeta "Te hemos enviado un enlace de confirmación a `{email}`" con botón **REENVIAR CORREO** (`supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } })`, con su propio error visible, p. ej. un 429 de límite de envío) y botón para volver a INICIAR SESIÓN.
  - **Botones GOOGLE / GITHUB:** dejan de ser inertes; llaman a `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } })`.
  - **JUGAR COMO INVITADO:** se mantiene; pasa a navegar directo a `/biblioteca` sin crear sesión (ya no llama a `login(null)`, que desaparece de la API).
  - **Enlace "¿Olvidaste tu contraseña?":** bajo el formulario de INICIAR SESIÓN. Abre un tercer estado de la misma tarjeta con un único campo Correo electrónico; llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/restablecer-contrasena` })` y muestra "Te hemos enviado un enlace para restablecer tu contraseña a `{email}`" (mismo patrón visual que la pantalla de confirmación de registro). Enlace para volver a INICIAR SESIÓN.
- Nueva `app/restablecer-contrasena/page.tsx` (Client Component, misma estética `auth-card`): un único campo Nueva contraseña + Confirmar contraseña. Supabase deja al usuario con una sesión temporal al llegar desde el enlace del correo; el formulario llama a `supabase.auth.updateUser({ password })` y redirige a `/biblioteca` en éxito. Si no hay sesión activa al cargar la página (enlace caducado o reutilizado), muestra un mensaje de error con enlace de vuelta a `/acceso`.
- Nuevo `app/auth/callback/route.ts` (Route Handler): recibe `code` por query string, lo intercambia por sesión con un cliente de servidor (`@supabase/ssr` + cookies de la request, mismo patrón que `proxy.ts`), redirige a `/biblioteca` en éxito o a `/acceso?error=...` en fallo.
- Eliminar `app/diagnostico-supabase/` (anotado como deuda por SPEC 04: se borra "en la primera spec que implemente funcionalidad real contra Supabase").
- Configuración humana fuera del repo, documentada aquí como paso explícito: activar los providers Google y GitHub en el panel de Supabase Auth (Authentication → Providers) con sus client id/secret, y dejar "Confirm email" activado (ya es el valor por defecto del proyecto).
- Configuración humana adicional, también fuera del repo (sin variables de entorno nuevas; las credenciales viven en el panel): en **Authentication → Emails → SMTP Settings**, activar _Enable Custom SMTP_ con la misma cuenta Resend que ya usa el formulario de contacto (host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = `RESEND_API_KEY`, sender `onboarding@resend.dev`). Necesario porque el servicio de correo integrado de Supabase tiene un límite de ~2 correos/hora que bloquea cualquier prueba con más de un registro o recuperación seguidos. Subir también el límite en **Authentication → Rate Limits** y confirmar `http://localhost:3000/**` en **Authentication → URL Configuration → Redirect URLs**.
  - **Limitación conocida:** `onboarding@resend.dev` es el remitente sandbox de Resend y solo entrega al correo del propietario de la cuenta (`esanchez7802@gmail.com`, el mismo de `CONTACT_TO_EMAIL`). Basta para verificar esta spec en solitario, pero no sirve para destinatarios arbitrarios; eso requiere verificar un dominio propio en Resend (fuera de alcance, ver SPEC 03).

**Fuera de alcance (para specs futuras):**

- Tabla `profiles` o columna `user_id` en `scores`. `scores.player_name` sigue siendo texto libre, sin FK a `auth.users`. Vincular puntuaciones a cuentas es una spec distinta.
- Edición de perfil (cambiar usuario/email tras el registro) y borrado de cuenta.
- Rutas protegidas o redirecciones por falta de sesión. Nada en `/biblioteca`, `/salon`, `/juego/[id]` ni el reproductor cambia su acceso.
- Exigir sesión para guardar puntuación (`guardarScoreAction` sigue llamable sin login).
- Cambios en las políticas RLS de `scores`/`games`.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

No se añaden tablas ni migraciones. No se añaden claves nuevas de `localStorage` (`av_user` deja de leerse y escribirse, pero no requiere migración: la sesión real vive en las cookies que ya gestiona `@supabase/ssr`).

Única estructura que cambia es la forma derivada en memoria:

```ts
// components/session-provider.tsx
interface SessionUser {
  name: string; // user_metadata.display_name ?? full_name/name ?? prefijo del email; mayúsculas, máx. 10 chars
}
```

---

## Plan de implementación

1. **`components/session-provider.tsx`.** Sustituir el estado basado en `localStorage` por `crearClienteSupabase().auth.getSession()` al montar y una suscripción `onAuthStateChange` que actualice `user`; `signOut()` llama a `supabase.auth.signOut()`. `login()` se retira de la API pública (ya no hace falta: la sesión la fija Supabase, no el formulario). Prueba manual: `npx tsc --noEmit` compila; `nav.tsx`/`JugarClient.tsx` no necesitan tocarse.
2. **`app/auth/callback/route.ts`.** Nuevo Route Handler que intercambia `code` por sesión con cliente de servidor y redirige. Antes de escribirlo, consultar `search_docs` de Supabase para la forma actual de `exchangeCodeForSession` en Route Handlers de App Router. Prueba manual: `npx tsc --noEmit` compila.
3. **`/acceso` — pestaña login.** Email + contraseña contra `signInWithPassword`, estado de error visible. Prueba manual: credenciales inexistentes muestran el mensaje de error sin romper el formulario.
4. **`/acceso` — pestaña registro.** Campos Usuario/Correo/Contraseña/Confirmar, validación de coincidencia antes de llamar a Supabase, `signUp` con `options.data.display_name`, pantalla "revisa tu correo". Prueba manual: contraseñas distintas bloquean el envío sin llamar a la API; contraseñas iguales con email válido muestran la pantalla de confirmación.
5. **`/acceso` — botones OAuth.** `signInWithOAuth` real para Google y GitHub. Prueba manual: el clic dispara la redirección (a Supabase/Google o al error "provider not enabled" si aún no está configurado en el panel).
6. **`/acceso` — "¿Olvidaste tu contraseña?".** Tercer estado de la tarjeta con el campo de email, `resetPasswordForEmail`, pantalla "te hemos enviado un enlace". Prueba manual: enviar el formulario con un email válido muestra la pantalla de confirmación sin lanzar error de consola.
7. **`app/restablecer-contrasena/page.tsx`.** Nueva página con el formulario de nueva contraseña + confirmar, `updateUser({ password })`, manejo del caso sin sesión (enlace caducado). Prueba manual: `npx tsc --noEmit` compila; cargar la ruta sin sesión activa muestra el mensaje de enlace caducado en vez de un formulario roto.
8. **Botón invitado.** Simplificar a navegación directa a `/biblioteca`. Prueba manual: sigue entrando sin sesión.
9. **Eliminar `app/diagnostico-supabase/`.** Prueba manual: la ruta devuelve 404.
10. **Cierre.** `npx next build` sin errores. Si `next dev` regeneró el bloque `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores de TypeScript.
- [ ] Registrarse en CREAR CUENTA con email/contraseña válidos muestra "Te hemos enviado un enlace de confirmación a `{email}`" en vez de navegar a `/biblioteca`.
- [ ] El correo de confirmación llega de verdad (SMTP propio configurado en el panel; ver Alcance) y su enlace entra por `app/auth/callback/route.ts`, dejando una sesión activa.
- [ ] Confirmar el correo (enlace de Supabase) y luego iniciar sesión con esas credenciales en INICIAR SESIÓN navega a `/biblioteca`, y el nav muestra el nombre elegido en el registro.
- [ ] Registrarse con un correo que ya tiene cuenta muestra "Ya existe una cuenta con ese correo..." sin cambiar a la pantalla "revisa tu correo" ni enviar ningún email (respuesta anti-enumeración de Supabase).
- [ ] El botón REENVIAR CORREO de la pantalla "revisa tu correo" vuelve a disparar el envío; si Supabase devuelve un error (p. ej. 429 por límite de envío), se ve en la misma pantalla.
- [ ] Credenciales incorrectas en INICIAR SESIÓN muestran un mensaje de error sin recargar la página.
- [ ] Contraseñas que no coinciden en CREAR CUENTA bloquean el envío antes de llamar a Supabase.
- [ ] Cerrar sesión desde el nav devuelve el nav al estado "Iniciar Sesión" y Supabase deja de reportar sesión activa.
- [ ] Recargar la página tras iniciar sesión mantiene la sesión (vía cookies), sin pedir login de nuevo.
- [ ] JUGAR COMO INVITADO sigue llevando a `/biblioteca` sin crear sesión.
- [ ] `app/diagnostico-supabase/` no existe; la ruta devuelve 404.
- [ ] Clic en GOOGLE o GITHUB en `/acceso` dispara `signInWithOAuth` (verificable por la redirección, aunque el provider no esté configurado todavía en el panel de Supabase).
- [ ] Pulsar "¿Olvidaste tu contraseña?" con un email válido muestra "Te hemos enviado un enlace para restablecer tu contraseña" en la misma tarjeta de `/acceso`.
- [ ] Seguir el enlace del correo de recuperación lleva a `/restablecer-contrasena`, donde fijar una nueva contraseña (con confirmación coincidente) y enviarla redirige a `/biblioteca` con la sesión ya activa.
- [ ] Cargar `/restablecer-contrasena` sin una sesión de recuperación activa (enlace caducado o reutilizado) muestra un mensaje de error con enlace a `/acceso`, no un formulario que falla al enviarse.
- [ ] `components/nav.tsx` no requiere cambios de JSX: sigue leyendo `user.name` y `signOut` desde `useSession()`.
- [ ] `app/juego/[id]/jugar/JugarClient.tsx` sigue guardando el score con el mismo `name` que antes, sin cambios de lógica propios.

---

## Decisiones

- **Sí:** email+contraseña y OAuth (Google/GitHub) en la misma spec, por decisión explícita. OAuth requiere activar los providers en el panel de Supabase con credenciales reales de Google/GitHub — paso humano fuera del código, recogido en Riesgos.
- **Sí:** confirmación de email obligatoria (valor por defecto de Supabase), con pantalla "revisa tu correo" en `/acceso` en vez de dejar entrar sin sesión real.
- **Sí:** mantener JUGAR COMO INVITADO; esta spec no protege ninguna ruta.
- **Sí:** nombre de usuario propio recogido en el registro (`display_name` en `user_metadata`) en vez de derivarlo solo del email. Para cuentas OAuth sin ese campo, fallback a los metadatos del proveedor o al prefijo del email.
- **No:** tabla `profiles` ni `user_id` en `scores`. `scores.player_name` sigue siendo texto libre; vincular puntuaciones a cuentas queda para otra spec.
- **Sí:** recuperación de contraseña vía `resetPasswordForEmail` + `/restablecer-contrasena`, por decisión explícita. El enlace para pedirla vive dentro de `/acceso` (no una ruta nueva para pedir el email), coherente con los otros dos estados de la misma tarjeta (login/registro).
- **No:** edición de perfil ni borrado de cuenta.
- **No:** proteger rutas ni el guardado de score por sesión.
- **Sí:** eliminar `app/diagnostico-supabase/` en esta spec, tal y como dejó anotado SPEC 04.
- **No:** variables de entorno nuevas en `.env.local`. Las credenciales OAuth se configuran en el panel de Supabase Auth, no en el repo.

---

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google/GitHub no están activados todavía en el panel de Supabase Auth                                        | El código no rompe por eso: `signInWithOAuth` devuelve el error de Supabase ("provider not enabled") visible en la propia pantalla, no un crash del cliente.                           |
| Confirmación de email depende de que Supabase tenga el envío de correo operativo                             | SMTP propio (Resend) configurado en el panel (ver Alcance); el límite de ~2 correos/hora del servicio integrado de Supabase se detectó durante la verificación y por eso se sustituyó. |
| El remitente sandbox de Resend (`onboarding@resend.dev`) solo entrega al correo del propietario de la cuenta | Suficiente para verificar esta spec en solitario; entregar a destinatarios arbitrarios requiere un dominio verificado en Resend, fuera de alcance (ver SPEC 03).                       |
| `signUp` sobre un correo que ya tiene cuenta devuelve 200 sin enviar nada (anti-enumeración de Supabase)     | El código comprueba `data.user.identities.length === 0` y muestra un mensaje explícito en vez de la pantalla "revisa tu correo" (ver Alcance).                                         |
| `display_name` ausente en cuentas creadas por OAuth                                                          | Fallback a `full_name`/`name` del proveedor o al prefijo del email, según queda fijado en Decisiones.                                                                                  |
| Sesiones `av_user` de `localStorage` de usuarios que ya habían "iniciado sesión"                             | Se ignoran sin migración: tras esta spec simplemente aparecen desconectados y pueden volver a entrar con email+contraseña o crear cuenta.                                              |
| Enlace de recuperación caducado o reutilizado en `/restablecer-contrasena`                                   | La página comprueba si hay sesión de recuperación activa antes de mostrar el formulario; sin ella, muestra el error en vez de dejar enviar `updateUser`.                               |

---

## Lo que **no** entra en esta spec

- Tabla `profiles` o vínculo `scores` ↔ `auth.users`.
- Edición de perfil, borrado de cuenta.
- Rutas protegidas o redirecciones por falta de sesión.
- Guardado de score exigiendo sesión activa.
- Cambios en las políticas RLS existentes.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
