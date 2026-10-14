# SPEC 14 — Checklist de seguridad básico

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 06, SPEC 13
> **Fecha:** 2026-10-09
> **Objetivo:** Cerrar los hallazgos de seguridad de `references/security/security-checklist.md` (advisories de Supabase y cabeceras HTTP) mediante una migración que revoca acceso a una función `SECURITY DEFINER` expuesta, headers de seguridad en Next.js, validación de complejidad de contraseña en el formulario de registro, y una lista de pasos manuales a aplicar en el panel de Supabase Auth.

---

## Por qué existe esta spec

`references/security/security-checklist.md` recoge un checklist manual más el resultado del linter de seguridad de Supabase (advisors). De los 5 puntos del checklist, uno ya está resuelto por SPEC 06 (RLS habilitado) y tres son ajustes de panel sin código versionable (no existe `supabase/config.toml` en este repo). Solo dos hallazgos requieren cambios en el repo: la función `rls_auto_enable()` expuesta como `SECURITY DEFINER` (no proviene de ninguna migración existente, se creó directamente en el panel) y la ausencia total de cabeceras de seguridad en `next.config.ts`.

El warning sobre `scores_insert_publico` (`WITH CHECK (true)`) se documenta como riesgo aceptado, no se corrige: el insert público en `scores` sin sesión es diseño intencional de SPEC 06/13 (cualquiera puede guardar su puntuación, incluidos invitados).

---

## Alcance

**Dentro:**

- Nueva migración `supabase/migrations/<timestamp>_revocar_rls_auto_enable.sql` que hace `REVOKE EXECUTE` sobre `public.rls_auto_enable()` para los roles `anon` y `authenticated`, sin modificar la función en sí (se desconoce su propósito interno; solo se cierra el acceso público vía `/rest/v1/rpc/rls_auto_enable`).
- `next.config.ts`: añadir `headers()` con los 3 headers del checklist (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`) aplicados a `source: '/(.*)'`.
- Protección de rutas con Proxy Next.js: https://nextjs.org/docs/app/getting-started/proxy

Ejemplo: proxy.ts
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}
 
// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }
 
export const config = {
  matcher: '/about/:path*',
}
```
- Documentar en esta spec, como configuración humana fuera del repo (mismo patrón que el SMTP de SPEC 13), los 3 ajustes de Supabase Auth que no se pueden versionar sin `supabase/config.toml`:
  - **Authentication → Policies → Password Requirements:** mínimo de contraseña a 8 caracteres y la opción "Lowercase, uppercase letters, digits and symbols" (hoy 6 caracteres sin requisito de complejidad, ver SPEC 13).
  - **Authentication → Policies → Leaked password protection:** activarla (bloquea contraseñas filtradas vía HaveIBeenPwned).
  - **Authentication → Rate Limits:** limitar signups por IP para mitigar registro automatizado.
- Documentar `rls_policy_always_true` (warning sobre `scores_insert_publico`) como riesgo aceptado con su justificación, sin tocar la policy.
- Validación de complejidad de contraseña en cliente, en el formulario CREAR CUENTA de `app/acceso/page.tsx`: antes de llamar a `supabase.auth.signUp`, comprobar por regex que la contraseña tiene mínimo 8 caracteres y al menos una minúscula, una mayúscula, un dígito y un símbolo — en el mismo bloque donde hoy se valida que "Contraseña" y "Confirmar contraseña" coinciden (SPEC 13). Si no cumple, error visible bajo el formulario: "La contraseña debe tener mínimo 8 caracteres e incluir mayúsculas, minúsculas, números y símbolos.", sin llamar a la API. Mantiene el mismo patrón de SPEC 13 (ahorra una vuelta de red por un fallo detectable en cliente) y queda alineado con el requisito que se activa en el panel.

**Fuera de alcance (para specs futuras):**

- Investigar o modificar el cuerpo de `public.rls_auto_enable()` — solo se revoca el `EXECUTE` público, no se audita su lógica interna.
- `supabase/config.toml` o adopción de Supabase CLI para versionar ajustes de Auth — se documentan como pasos manuales.
- Cambiar `scores_insert_publico` para exigir sesión o añadir validación de forma a los datos — contradice el diseño actual de SPEC 06/13.
- Cabeceras adicionales no listadas en el checklist (`Permissions-Policy`, `Strict-Transport-Security`, CSP, etc.).
- Rate limiting a nivel de aplicación (middleware/`proxy.ts`) — el límite de signups se resuelve en el panel de Supabase, no en código.

---

## Modelo de datos

Esta spec no introduce estructuras de datos nuevas. La única pieza persistente es la migración SQL que revoca un privilegio existente.

```sql
-- supabase/migrations/<timestamp>_revocar_rls_auto_enable.sql
revoke execute on function public.rls_auto_enable() from anon, authenticated;
```

En `app/acceso/page.tsx` se añade una constante de validación (sin estado nuevo en React, solo una función pura):

```ts
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
```

---

## Plan de implementación

1. Crear la migración `supabase/migrations/<timestamp>_revocar_rls_auto_enable.sql` con el `REVOKE EXECUTE` de `public.rls_auto_enable()` para `anon` y `authenticated`. Aplicarla al proyecto de Supabase.
2. Verificar con los advisors de Supabase (`get_advisors` / re-ejecutar el linter) que `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` ya no aparecen para esta función.
3. Editar `next.config.ts` para añadir `headers()` con los 3 headers del checklist sobre `'/(.*)'`. Verificar con `npm run dev` + una petición (`curl -I` o DevTools) que las 3 cabeceras llegan en cualquier ruta, incluida `/`.
4. Añadir a esta misma spec (ya redactado arriba, sección Alcance) la lista de pasos manuales del panel de Supabase Auth — no requiere código, solo queda como checklist operativo para quien implemente.
5. En `app/acceso/page.tsx`, formulario CREAR CUENTA: añadir `PASSWORD_REGEX` y la comprobación antes de `supabase.auth.signUp`, junto a la validación existente de "las contraseñas coinciden". Manual test: intentar crear cuenta con `abc12345` (sin mayúscula/símbolo) → error visible sin llamada de red; con `Abc12345!` → pasa la validación y llega a `signUp`.
6. Protección de rutas con Proxy Next.js.
7. `npm run lint` y `npm run build` para confirmar que `next.config.ts` y `app/acceso/page.tsx` siguen siendo válidos.

---

## Criterios de aceptación

- [ ] La migración `revocar_rls_auto_enable` existe en `supabase/migrations/` y está aplicada al proyecto de Supabase.
- [ ] Los advisors de Supabase ya no reportan `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable` para `rls_auto_enable`.
- [ ] Una petición HTTP a cualquier ruta de la app (p. ej. `/`) devuelve las cabeceras `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] `npm run lint` y `npm run build` pasan sin errores tras el cambio en `next.config.ts`.
- [ ] Esta spec deja constancia explícita, en texto, de los 3 ajustes pendientes en el panel de Supabase Auth (contraseña mínima 8, leaked password protection, rate limit de signups) para que una persona los aplique manualmente.
- [ ] El warning `rls_policy_always_true` sobre `scores_insert_publico` queda documentado como riesgo aceptado, sin cambios en la policy.
- [ ] En CREAR CUENTA, introducir una contraseña sin las 4 clases de carácter (p. ej. `abc12345`) muestra el error de complejidad y no llama a `supabase.auth.signUp`.
- [ ] En CREAR CUENTA, introducir una contraseña con las 4 clases y mínimo 8 caracteres (p. ej. `Abc12345!`) pasa la validación de cliente y continúa el flujo normal de registro.

---

## Decisiones

- **Sí:** revocar `EXECUTE` de `rls_auto_enable()` vía migración versionada, sin tocar el cuerpo de la función. Cierra el acceso público sin arriesgar romper algo que dependa de su lógica interna.
- **No:** investigar/reescribir `rls_auto_enable()`. No aparece en ninguna migración del repo; su origen y propósito reales están fuera del alcance de esta spec.
- **Sí:** aceptar como riesgo conocido el `WITH CHECK (true)` de `scores_insert_publico`. Es diseño intencional confirmado en SPEC 06/13 (scores sin login); corregirlo rompería el flujo de invitado.
- **No:** exigir sesión para insertar en `scores`. Contradice explícitamente el alcance de SPEC 13.
- **Sí:** documentar los ajustes de Auth del panel como pasos manuales en la spec, igual que el SMTP de SPEC 13, en vez de crear `supabase/config.toml`. El proyecto no usa Supabase CLI localmente; introducirlo solo para esto es sobre-ingeniería.
- **No:** añadir cabeceras adicionales (CSP, HSTS, Permissions-Policy) no listadas en el checklist original. Si se necesitan, es una spec propia con sus propias decisiones (p. ej. CSP rompe fácilmente con fuentes/scripts externos).
- **Sí:** exigir las 4 clases de carácter (minúscula, mayúscula, dígito, símbolo) en la regex de cliente, no solo 3. Coincide con la opción "recommended" del panel de Supabase y evita que el cliente acepte algo que el servidor luego rechaza.
- **Sí:** validar solo en CREAR CUENTA de `/acceso`, no en `/restablecer-contrasena`. Mantiene el alcance acotado a lo pedido; si se quiere consistencia en recuperación de contraseña, es una extensión menor para otra spec o un ajuste posterior.

---

## Riesgos

| Riesgo                                                                                                                    | Mitigación                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rls_auto_enable()` es usada por alguna automatización fuera del repo (p. ej. un script del panel) y el `REVOKE` la rompe | Revisar en el panel de Supabase si algo la invoca antes de aplicar la migración en producción; si rompe algo, revertir con un `GRANT EXECUTE` puntual. |
| Los 3 ajustes de panel documentados aquí no se aplican nunca porque no hay recordatorio automático                        | Quedan listados como checklist explícito en "Criterios de aceptación"; quien implemente la spec los marca uno a uno.                                   |

---

## Lo que **no** está en esta spec

- Auditoría o cambio del código interno de `rls_auto_enable()`.
- `supabase/config.toml` / adopción de Supabase CLI.
- Cambios en `scores_insert_publico` o en el modelo de permisos de `scores`/`games`.
- Cabeceras de seguridad distintas a las 3 del checklist original.
- Rate limiting de signups implementado en código de la app.
- Validación de complejidad de contraseña en `/restablecer-contrasena`.

Cada uno de estos, si se necesita, va en su propia spec.
