# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

No test runner configured yet. Scripts: `dev`, `build`, `lint` (eslint), `format` (prettier).

## Skills

Usa siempre `/frontend-design` para diseñar las interfaces de usuario.

## Agentes

Los subagentes del proyecto viven en `.claude/agents/`. Un juego/motor/ruta por invocación
cada uno (nunca recorren el catálogo completo solos); detalle completo en su propio archivo.

- **`game-planner`** (`.claude/agents/game-planner.md`) — decide _qué_ juego añadir al
  catálogo (no _cómo_); paso previo a `/add-game`.
- **`game-jam`** (`.claude/agents/game-jam.md`) — a partir de un tema libre, propone tres
  juegos y escribe sus specs de borrador en `specs/game-jam/<game-id>/`.
- **`skin-designer`** (`.claude/agents/skin-designer.md`) — aplica los skins
  `clasico`/`retro`/`neon` a un motor existente.
- **`mobile-porter`** (`.claude/agents/mobile-porter.md`) — adapta a móvil una ruta
  existente.
- **`performance-auditor`** (`.claude/agents/performance-auditor.md`) — mide y, si procede,
  optimiza el FPS de un motor existente.

## Architecture

Fijado a `next@16.3.4` / `react@19.2.8`. Las APIs difieren de versiones anteriores
de Next.js — consulta `node_modules/next/dist/docs/` (ver `01-app/`) antes de escribir
código de framework, según indica `AGENTS.md`. El bloque `nextjs-agent-rules` de
`AGENTS.md` lo regenera `next dev`; haz commit de él junto con tus cambios en lugar
de revertirlo. Detalles propios de esta versión ya presentes en el código:

- `app/layout.tsx` usa el tipo global `LayoutProps<"/">` (no un tipo importado).
- El middleware es `proxy.ts` con `export async function proxy()` — en 16.3.4 el
  convenio `middleware.ts` está deprecado a favor de `proxy.ts`.

App Router, Tailwind CSS v4 (vía `@tailwindcss/postcss`), alias de import `@/*` → raíz del repo.
Prettier + ESLint se ejecutan automáticamente sobre cada archivo que escribes: hook
`PostToolUse` (`Write|Edit`) → `.claude/hooks/format-on-write.mjs` (ver `.claude/settings.json`).
Nunca bloquea; no reformatees a mano después de editar.

## Estado del proyecto

Arcade Vault: plataforma web para jugar online y competir en una tabla de puntos. La app completa está portada al
App Router.

**Rutas** (`app/`):

| Ruta                      | Archivo                                 | Notas                                                 |
| ------------------------- | --------------------------------------- | ----------------------------------------------------- |
| `/`                       | `page.tsx` + `HomeClient.tsx`           | Home; animaciones de scroll con `useReveal()`         |
| `/biblioteca`             | `biblioteca/` + `BibliotecaClient.tsx`  | Catálogo desde Supabase, filtros por categoría        |
| `/juego/[id]`             | `juego/[id]/page.tsx`                   | Ficha de detalle (incl. `difficulty`)                 |
| `/juego/[id]/jugar`       | `juego/[id]/jugar/` + `JugarClient.tsx` | Reproductor; `actions.ts` guarda el score             |
| `/salon`                  | `salon/page.tsx`                        | Hall of Fame; `actions.ts` envuelve la capa de datos  |
| `/acerca-de`              | `acerca-de/page.tsx`                    | About + formulario de contacto; `actions.ts` → Resend |
| `/acceso`                 | `acceso/page.tsx`                       | Login real con Supabase Auth (ver Sesión)             |
| `/auth/callback`          | `auth/callback/route.ts`                | Route Handler: intercambia `code` por sesión (PKCE)   |
| `/restablecer-contrasena` | `restablecer-contrasena/page.tsx`       | Nueva contraseña tras el enlace de recuperación       |

Layout global: `components/nav.tsx`, `components/footer.tsx`, `components/session-provider.tsx`;
fuentes (Press Start 2P, JetBrains Mono, Courier Prime) self-hosted vía `next/font/google`
exponiendo variables CSS que consume `app/globals.css` (~2.8K líneas, portado de
`references/templates/styles.css`).

**Sesión.** `SessionProvider` (Context) hidratado desde Supabase Auth real
(`crearClienteSupabase().auth.getSession()` + `onAuthStateChange`), sin `localStorage`.
`/acceso` soporta email+contraseña (`signInWithPassword`/`signUp`), OAuth Google/GitHub
(`signInWithOAuth`) y recuperación de contraseña (`resetPasswordForEmail` +
`/restablecer-contrasena`), con confirmación de email obligatoria (SPEC 13). `proxy.ts`
refresca la sesión de Supabase en cada request si existen las env vars, sin rutas
protegidas ni redirecciones.

## Supabase

- Clientes: `lib/supabase/client.ts` (navegador) y `lib/supabase/server.ts`
  (`crearClienteSupabaseServidor()`, instancia nueva por request).
- Capa de datos: `lib/data/games.ts` y `lib/data/scores.ts`. Los Client Components
  no los llaman directamente — lo hacen a través de los `actions.ts` (`"use server"`)
  de cada ruta.
- Tipos del dominio en `lib/games.ts` (`Game`, `ScoreRow`, `CATS`).
- Migraciones en `supabase/migrations/` (`YYYYMMDDHHMMSS_slug.sql`): tablas `games` y
  `scores` con RLS (select público, insert público en `scores`), columna `difficulty`,
  y una migración de siembra por juego real.
- **`games` solo contiene juegos con motor real jugable.** Un juego se siembra en la
  misma spec que implementa su motor, no antes.
- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  y `RESEND_API_KEY`/`CONTACT_FROM_EMAIL`/`CONTACT_TO_EMAIL` para el correo de contacto
  (`lib/email.ts`, solo servidor). Viven en `.env.local`, no versionado.
- El SMTP de Supabase Auth (correos de confirmación/recuperación) se configura en el
  panel (Authentication → Emails → SMTP Settings), no en `.env.local`: reusa la misma
  cuenta Resend. Ver SPEC 13.

## Motores de juego

Cada uno vive en `components/games/<juego>/` como par `engine.ts` (lógica sobre canvas,
sin React) + `<Juego>Game.tsx` (wrapper cliente que sincroniza score/vidas/nivel/estado
con el HUD).

`components/games/registry.ts` es el punto de extensión: `REGISTRO_MOTORES` mapea
`game.id` → componente, y define el contrato `RealGameHandle` / `RealGameState` /
`RealGameProps`. **Añadir un motor nuevo es añadir una entrada ahí**; `JugarClient.tsx`
no necesita cambios. Partes opcionales del contrato: `setTheme`/`setSkin` (solo Tetris),
`onResumeRequested` (solo Arkanoid). Arkanoid amplía su unión de estados con `'win'`,
que el reproductor trata igual que `'gameover'`.

Assets de juego en `public/games/<juego>/` (p. ej. sprites de fruta de Snake), cargados
con `new Image()` + `onload` antes de instanciar el motor.

## Flujo spec-driven (obligatorio para features grandes)

Antes de escribir código para una feature nueva, define la spec y luego impleméntala:

- Agente `game-planner` — **paso previo a `/add-game`**: decide _qué_ juego añadir (ver
  `## Agentes`).
- `/add-game` — **para añadir un juego jugable nuevo**. Skill propio del proyecto
  (`.claude/skills/add-game/`, con su `template.md`): audita el prototipo de origen,
  hace las preguntas que todo port necesita y escribe la spec. No escribe código.
- `/spec` — cualquier otra feature. No escribe código; produce `specs/NN-slug.md` en
  estado `Draft`. El humano cambia el estado a `Aprobado` manualmente.
- `/spec-impl NN-slug` — solo actúa si la spec está `Aprobado`; crea la rama
  `spec-NN-slug`, implementa paso a paso y **nunca hace commit automáticamente**.
- `/spec-impl-game NN-slug` — igual que `/spec-impl` pero para specs de **motores de juego
  nuevos**: al cerrar la implementación detona `@skin-designer` y después `@mobile-porter`
  (secuencial, nunca en paralelo). Tampoco hace commit.
- La numeración de `specs/` es secuencial con dos dígitos (`01-`, `02-`, …).
- `specs/.spec-config.yml` controla `AutoCreateBranch` (default `true`).
- Al terminar, el estado de la spec pasa a `Implementado`.

Los skills viven en `.claude/skills/` y `.agents/skills/`. `spec` y `spec-impl` están
fijados en `skills-lock.json` (origen `Klerith/fernando-skills`); `add-game` y
`spec-impl-game` son locales del proyecto y no están en el lock.

## `references/` — material de origen (no conectado al build)

- `references/templates/` — prototipo autónomo **HTML/React 18 + Babel standalone** de
  la app completa; fuente de verdad visual/UX que se portó al App Router.
  `Arcade Vault.html` es la entrada; `app.jsx` hace routing por hash + `localStorage`
  (`av_user`, `av_scores`); `data.jsx` tiene el catálogo mock; pantallas en
  `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx`, `auth.jsx`, `salon.jsx`,
  `home-about/`; estilos en `styles.css`.
- `references/started-games/`.
- `references/source-assets/` — assets crudos antes de moverse a
  `public/games/`.
- `references/game-suggestions-todo.md` — TODO de juegos candidatos; memoria persistente del
  agente `game-planner`. Editable a mano.
- `references/games-with-themes.md` — qué juego tiene qué skins y
  extras); memoria persistente del agente `skin-designer`. Editable a mano.
- `references/mobile-porting-status.md` — qué ruta está adaptada a móvil y con qué
  verificación (M1-M6); memoria persistente del agente `mobile-porter`. Editable a mano.

Para verificar cambios visuales, guarda los screenshots de Playwright en
`.playwright-screenshots/`.

## Idioma

El código, los comentarios y la UI del proyecto están en castellano. Responde en castellano.
