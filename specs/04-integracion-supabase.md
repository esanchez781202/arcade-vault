# SPEC 04 — Integración de Supabase (solo cableado)

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-09-11
> **Objetivo:** Dejar los clientes de Supabase (navegador y servidor, en archivos de contexto separados) instalados, configurados por variables de entorno y verificables mediante una ruta de diagnóstico temporal, sin implementar ninguna funcionalidad de producto.

---

## Por qué existe esta spec

El proyecto Supabase (`etynskulubxrowpxuupw`) ya está enlazado en `.mcp.json` pero
vacío: sin tablas en `public`, sin migraciones, sin usuarios. Antes de escribir
autenticación real, leaderboard persistente o catálogo en base de datos —cada uno con
sus propias decisiones de diseño— esta spec separa el cableado puro: instalar el SDK,
definir las variables de entorno y comprobar que la app puede hablar con el proyecto,
tanto desde el navegador como desde el servidor. Ninguna pantalla existente cambia.

El cliente de servidor exige `@supabase/ssr` para leer/escribir la sesión vía cookies
(`next/headers`) y un `middleware.ts` que la refresque en cada request — es el patrón
que Supabase documenta para App Router. Se incluye ya, aunque nada lo consuma todavía,
para que la spec de auth real solo escriba lógica sobre una base ya correcta.

---

## Alcance

**Dentro:**

- **Dependencias `@supabase/supabase-js` y `@supabase/ssr`.** Añadir ambas a
  `dependencies` en `package.json` con versión exacta (sin `^` ni `~`), coherente
  con `next`/`react`/`resend` que ya están clavados. Ejecutar `npm install` para
  actualizar `package-lock.json`.
- **Variables de entorno.** Añadir a `specs/.env.template` (siguiendo la convención ya
  usada por `RESEND_API_KEY` y compañía, no `.env.example`):
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
  ```
  Ambas con prefijo `NEXT_PUBLIC_` porque el cliente de esta spec vive en el
  navegador. `NEXT_PUBLIC_SUPABASE_URL` es `https://etynskulubxrowpxuupw.supabase.co`.
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es la publishable key del proyecto (prefijo
  `sb_publishable_…`, sucesora de la antigua anon key), visible en el panel de API
  settings de Supabase. El `.env.local` real lo rellena el humano y **no** se
  commitea (ya cubierto por la regla `.env*` / `!.env.template` de `.gitignore`).
- **Cliente de navegador.** Nuevo `lib/supabase/client.ts` (`"use client"`):
  - Exporta `crearClienteSupabase(): SupabaseClient`, usando `createBrowserClient` de
    `@supabase/ssr` (sustituye a `createClient` de `@supabase/supabase-js` porque
    `createBrowserClient` ya maneja el almacenamiento de sesión vía cookies,
    necesario para que el cliente de servidor vea la misma sesión) con
    `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - Instancia **singleton** a nivel de módulo: una sola conexión por pestaña, no una
    nueva en cada llamada.
  - Si falta cualquiera de las dos variables, lanza un `Error` cuyo mensaje nombra
    explícitamente la variable ausente (falla temprano y de forma legible, no con un
    `undefined` opaco pasado al SDK).
- **Cliente de servidor, en archivo de contexto separado.** Nuevo
  `lib/supabase/server.ts` (sin `"use client"`; solo se importa desde Server
  Components, Route Handlers o Server Actions):
  - Exporta `async function crearClienteSupabaseServidor(): Promise<SupabaseClient>`,
    usando `createServerClient` de `@supabase/ssr`, con las mismas
    `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y el adaptador
    de cookies de `next/headers` (`cookies()` de la petición actual vía `get`/`set`/
    `remove`, ver `node_modules/next/dist/docs/` para la firma exacta en Next 16 antes
    de escribirlo, según exige `AGENTS.md`).
  - **No** es un singleton de módulo: se crea una instancia nueva por request (regla
    del propio patrón de Supabase con `@supabase/ssr`, porque las cookies cambian
    entre requests). Misma validación de variables ausentes que el cliente de
    navegador.
  - Vive en un archivo distinto (`server.ts`) al del navegador (`client.ts`)
    precisamente para que nada con `"use client"` pueda importarlo por error: un
    cliente de servidor con acceso a cookies nunca debe acabar en el bundle del
    navegador.
- **`middleware.ts`.** Nuevo archivo en la raíz del repo: en cada request, crea un
  cliente Supabase vía `createServerClient` (con el adaptador de cookies sobre
  `NextRequest`/`NextResponse`, patrón estándar de Supabase para App Router) y llama a
  `supabase.auth.getUser()` para refrescar el token si hace falta, propagando las
  cookies actualizadas en la respuesta. Sin lógica de redirección ni rutas
  protegidas — eso es de la spec de auth. `matcher` cubre todas las rutas salvo
  estáticos (`_next/static`, `_next/image`, `favicon.ico`), patrón estándar de
  Supabase.
- **Ruta de diagnóstico temporal.** Nueva `app/diagnostico-supabase/page.tsx`
  (Server Component, sin `"use client"`), con la estética existente del sitio
  (`.kicker`, `.pixel`, `.neon-*`, `.fade-in`; sin CSS nuevo):
  - Llama a `crearClienteSupabaseServidor()` y a `auth.getSession()` en el propio
    Server Component (sin `useEffect`, ya que ahora corre en servidor).
  - Muestra dos líneas: el resultado del cliente de servidor (`> SERVIDOR: CONEXIÓN
OK · SIN SESIÓN` / `> SERVIDOR: ERROR DE CONEXIÓN: {mensaje}`) y, en un
    componente hijo `"use client"` pequeño, el resultado del cliente de navegador
    con la misma lógica (`> NAVEGADOR: CONEXIÓN OK · SIN SESIÓN` / `> NAVEGADOR:
ERROR DE CONEXIÓN: {mensaje}`), para verificar ambos contextos en una sola
    página. Colores: `.neon-cyan`/`.neon-green` en éxito, `.neon-magenta` en error.
  - **No** se enlaza desde `components/nav.tsx` ni desde `components/footer.tsx` ni
    desde ninguna pantalla existente: se accede escribiendo la URL directamente.
  - Esta página es temporal: **se borra en la primera spec que implemente
    funcionalidad real contra Supabase** (auth, leaderboard o catálogo). Esta spec
    deja esa nota aquí para que la siguiente la recoja.

**Fuera de alcance (para specs futuras):**

- Autenticación real (`signUp`, `signInWithPassword`, OAuth Google/GitHub). No se
  toca `app/acceso/page.tsx`.
- Sustituir o eliminar `components/session-provider.tsx` ni la clave `av_user` de
  `localStorage`.
- Leaderboard real: tablas `scores` / `profiles`, lectura de `av_scores` en
  `/salon` o `/juego/[id]`, retirar `seededScores` de `lib/games.ts`.
- Mover el catálogo `GAMES` de `lib/games.ts` a una tabla `games`.
- Lógica de redirección o rutas protegidas en `middleware.ts` (solo refresca la
  sesión, no decide accesos). Cualquier Server Action que llame a Supabase.
- Cualquier SQL: tablas, RLS, triggers, funciones, migraciones. El proyecto se queda
  vacío tal y como está hoy.
- Tipos generados (`database.types.ts`): sin tablas no hay nada que generar.
- Storage, Realtime, Edge Functions.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

**No introduce estructuras nuevas.** No se añaden claves de `localStorage` ni se
tocan las existentes (`av_user`, `av_scores`). El proyecto Supabase permanece sin
tablas en `public` y sin migraciones.

Lo único que esta spec define son las variables de entorno y la firma de los dos
clientes:

```ts
// lib/supabase/client.ts (contexto navegador, "use client")
function crearClienteSupabase(): SupabaseClient;

// lib/supabase/server.ts (contexto servidor, sin "use client")
async function crearClienteSupabaseServidor(): Promise<SupabaseClient>;
```

| Variable                               | Uso                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto (`https://etynskulubxrowpxuupw.supabase.co`). Expuesta al cliente a propósito. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key del proyecto. Segura para el navegador (no es la secret key / service role).    |

---

## Plan de implementación

Cada paso deja la app arrancando (`next dev`) sin errores.

1. **Dependencias.** Añadir `@supabase/supabase-js` y `@supabase/ssr` (versión
   exacta) a `package.json`, `npm install`. Prueba manual: `npm ls
@supabase/supabase-js @supabase/ssr` resuelve ambas.
2. **Variables de entorno.** Añadir las dos claves a `specs/.env.template` con un
   comentario apuntando al panel de API settings del proyecto. Rellenar
   `.env.local` con los valores reales (paso humano). Prueba manual: `git status`
   muestra `specs/.env.template` modificado y **no** aparece `.env.local`.
3. **Cliente de navegador.** Antes de escribir código, consultar la documentación de
   Supabase vía el MCP (`search_docs`) para confirmar la forma actual de
   `createBrowserClient`. Crear `lib/supabase/client.ts` con `crearClienteSupabase()`,
   el singleton de módulo y la validación de variables ausentes. Prueba manual:
   `npx tsc --noEmit` compila.
4. **Cliente de servidor.** Consultar `search_docs` y
   `node_modules/next/dist/docs/01-app/` para la firma actual de `cookies()` en
   Next 16 antes de escribirlo (exige `AGENTS.md`). Crear `lib/supabase/server.ts`
   con `crearClienteSupabaseServidor()` usando `createServerClient` de
   `@supabase/ssr` y el adaptador de cookies. Prueba manual: `npx tsc --noEmit`
   compila.
5. **`middleware.ts`.** Crear el middleware de refresco de sesión en la raíz, sin
   lógica de rutas protegidas. Prueba manual: `next dev` arranca y cualquier ruta
   responde igual que antes (sin redirecciones nuevas).
6. **Ruta de diagnóstico.** Crear `app/diagnostico-supabase/page.tsx` (Server
   Component) más el componente hijo `"use client"` para el chequeo de navegador,
   con los estados descritos. Prueba manual: navegar a `/diagnostico-supabase`
   muestra las líneas `SERVIDOR` y `NAVEGADOR`, ambas `CONEXIÓN OK · SIN SESIÓN`.
7. **Ruta de fallo.** Vaciar temporalmente
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`, reiniciar `next dev` y
   comprobar que ambos chequeos (servidor y navegador) muestran un error que
   nombra la variable, en lugar de romper de forma opaca. Restaurar el valor real
   al terminar.
8. **Cierre.** Si `next dev` regeneró el bloque `nextjs-agent-rules` de
   `AGENTS.md`, dejarlo incluido en los cambios. Ejecutar `npx next build` y
   corregir errores de tipos o de framework.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr` en
      `dependencies` con versión exacta (sin `^` ni `~`).
- [ ] `specs/.env.template` contiene `NEXT_PUBLIC_SUPABASE_URL` y
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] `.env.local` no está rastreado por git.
- [ ] `lib/supabase/client.ts` exporta `crearClienteSupabase` (singleton de
      módulo, misma instancia en llamadas sucesivas en la misma pestaña) y tiene
      `"use client"`.
- [ ] `lib/supabase/server.ts` exporta `crearClienteSupabaseServidor` (instancia
      nueva por request), no tiene `"use client"` y no es importado desde ningún
      archivo con `"use client"`.
- [ ] `middleware.ts` existe en la raíz, refresca la sesión en cada request y no
      contiene lógica de redirección ni de rutas protegidas.
- [ ] `/diagnostico-supabase` muestra las líneas `SERVIDOR` y `NAVEGADOR`, ambas
      `CONEXIÓN OK · SIN SESIÓN`, sin errores de consola, cuando las variables de
      entorno están configuradas.
- [ ] Con `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ausente, tanto el chequeo de
      servidor como el de navegador muestran un error que nombra esa variable, no
      un fallo opaco.
- [ ] `components/session-provider.tsx`, `app/acceso/page.tsx`,
      `app/salon/page.tsx`, `app/juego/[id]/page.tsx`,
      `app/juego/[id]/jugar/page.tsx` y `lib/games.ts` no aparecen en
      `git diff --stat` de esta spec.
- [ ] El proyecto Supabase sigue sin tablas en el esquema `public` y sin
      migraciones tras esta spec.
- [ ] Ningún enlace de `components/nav.tsx` ni `components/footer.tsx` apunta a
      `/diagnostico-supabase`.

---

## Decisiones

- **Sí:** cliente de navegador y cliente de servidor, cada uno en su propio archivo
  (`lib/supabase/client.ts` / `lib/supabase/server.ts`), vía `@supabase/ssr`. Es el
  patrón que documenta Supabase para App Router y evita que un cliente pensado
  para cookies de servidor acabe importado desde un componente cliente.
- **No:** un único archivo con ambos clientes. Mezclar contextos (`"use client"` vs
  servidor) en el mismo módulo es la fuente de errores que la separación evita.
- **Sí:** `middleware.ts` ya en esta spec, pero solo con refresco de sesión, sin
  rutas protegidas. Sin él, el cliente de servidor vería tokens caducados; las
  reglas de acceso sí dependen de que exista auth real, así que esas se posponen.
- **No:** Server Actions contra Supabase en esta spec. Sin auth real, no hay nada
  que esas acciones necesiten hacer todavía.
- **Sí:** ruta de diagnóstico temporal como criterio de aceptación verificable.
  "Que compile" no demuestra que el proyecto Supabase responde de verdad.
- **No:** enlazar la ruta de diagnóstico desde el nav. Es una herramienta de
  desarrollo, no una pantalla de producto; desaparece en la siguiente spec.
- **Sí:** `NEXT_PUBLIC_*` con la publishable key también en el cliente de servidor.
  Sin RLS ni tablas todavía, no hay nada que justifique saltarse RLS con la secret
  key / service role; el cliente de servidor actúa como un usuario normal
  (autenticado vía cookies o anónimo).
- **Sí:** seguir la convención `specs/.env.template` ya establecida por SPEC 03.
  **No:** crear `.env.example` — introduciría una segunda convención en el mismo
  repo.
- **Sí:** versión exacta de `@supabase/supabase-js`. Coherente con cómo el repo ya
  fija `next`, `react` y `resend`.
- **No:** crear tablas, migraciones o `supabase/migrations/` (ni vacía). Sin
  esquema que versionar, la carpeta no aporta nada hasta la spec que sí lo
  necesite.
- **No:** generar `database.types.ts`. Con la base de datos vacía saldría
  prácticamente sin contenido y quedaría obsoleto en la primera migración real.
- **No:** tocar `av_user`, `av_scores` ni `seededScores`. Es la deuda que cierran
  las specs de auth y de leaderboard, no esta.

---

## Riesgos

| Riesgo                                                                                                                            | Mitigación                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confundir la publishable key con la secret key / service role y exponerla en el bundle de cliente                                 | Solo se usan variables `NEXT_PUBLIC_*` con la publishable key; el criterio de aceptación lo deja explícito.                                                                |
| La ruta `/diagnostico-supabase` queda olvidada como deuda permanente                                                              | La spec la declara temporal y nombra qué spec debe borrarla; sin enlaces desde el nav reduce el riesgo de que llegue a producción visible.                                 |
| `.gitignore` ignora `.env*` y se pierde el nuevo contenido de `specs/.env.template`                                               | Ya existe la excepción `!.env.template`; el criterio de aceptación verifica que sigue rastreado.                                                                           |
| La API de `@supabase/supabase-js` / `@supabase/ssr` difiere del conocimiento previo del modelo                                    | Consultar `search_docs` del MCP de Supabase y `node_modules/next/dist/docs/` (firma de `cookies()`) antes de escribir `lib/supabase/client.ts` y `lib/supabase/server.ts`. |
| El cliente de servidor se importa por error desde un componente `"use client"` y filtra lógica de cookies al bundle del navegador | Vive en un archivo separado (`server.ts`) sin `"use client"`; el criterio de aceptación comprueba que ningún archivo cliente lo importa.                                   |
| `middleware.ts` mal configurado bloquea o redirige rutas que hoy son públicas                                                     | Sin lógica de rutas protegidas en esta spec: solo refresca el token y propaga cookies; prueba manual confirma que todas las rutas responden igual que antes.               |
| `next dev` reescribe el bloque `nextjs-agent-rules` de `AGENTS.md`                                                                | Incluir ese cambio en el commit en lugar de revertirlo (indicado en `CLAUDE.md`).                                                                                          |

---

## Lo que **no** entra en esta spec

- Autenticación real (email/contraseña, OAuth) y cualquier cambio en `/acceso`.
- Leaderboard real: tablas, lectura de `av_scores`, retirar `seededScores`.
- Catálogo `GAMES` movido a base de datos.
- Rutas protegidas o lógica de redirección en `middleware.ts`, y Server Actions
  contra Supabase.
- SQL de cualquier tipo: tablas, RLS, triggers, funciones, migraciones.
- Tipos generados desde el esquema.
- Storage, Realtime, Edge Functions.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
