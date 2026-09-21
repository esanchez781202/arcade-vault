# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

No test runner configured yet. Scripts: `dev`, `build`, `lint` (eslint), `format` (prettier).

## Skills

Usa siempre `/frontend-design` para diseñar las interfaces de usuario.

## Agentes

Los subagentes del proyecto viven en `.claude/agents/`.

- **`game-planner`** (`.claude/agents/game-planner.md`) — decide _qué_ juego añadir al
  catálogo, no _cómo_. Invócalo **antes** de `/add-game`, cuando toque elegir un juego nuevo
  o el usuario pregunte "¿qué añadimos ahora?". Lee `references/implemented-games.md`,
  `components/games/registry.ts`, `lib/games.ts` (`CATS`), `references/started-games/` y
  `specs/` para detectar huecos de categoría, y aplica el filtro duro que impone el
  reproductor: marco CRT 4/3 de un solo canvas, solo teclado (+ click puntual), score como
  entero único ascendente, motor encapsulable en `engine.ts` sin React. Su memoria entre
  sesiones es `references/game-suggestions-todo.md` — **el único archivo que modifica**; no
  escribe specs, código ni migraciones. Handoff: `game-planner` → `/add-game` (spec) →
  `/spec-impl NN-slug` (implementación).
- **`game-jam`** (`.claude/agents/game-jam.md`) — a partir de un tema libre del usuario,
  propone tres juegos nuevos (mismo filtro duro que `game-planner`) y por cada uno escribe
  **dos specs completas** — `01-core.md` (MVP) y `02-ampliada.md` (con extras) — en
  `specs/game-jam/<game-id>/`, siguiendo el formato de `specs/07-*.md`/`08-*.md`/`09-*.md` y
  la receta de `.claude/skills/add-game/template.md`. Son specs `Draft` sin número de
  `specs/NN-slug.md` asignado — puro material de revisión: no escribe código, no aplica
  migraciones y nunca elige un ganador entre las tres. Para construir una, el usuario la
  aprueba a mano, la renombra a `specs/NN-slug.md` y corre `/spec-impl NN-slug`.
- **`skin-designer`** (`.claude/agents/skin-designer.md`) — aplica los skins `clasico`
  (default), `retro` y `neon` a **un único juego por invocación**, el que el usuario indique
  (`asteroids`, `tetris`, `arkanoid` o `snake`); nunca recorre los cuatro motores solo. A
  diferencia de `game-planner`/`game-jam`, sí escribe código: extrae los colores literales de
  `engine.ts` a paletas (`components/games/skins.ts` + `<juego>/skins.ts`), diseña las paletas
  nuevas con `/frontend-design` y verifica su contraste sobre el marco CRT oscuro con
  Playwright. Su memoria entre sesiones es `references/games-with-themes.md` (qué juego tiene
  qué skins y desde cuándo). Nunca toca lógica de juego, Supabase ni hace commit.

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

Arcade Vault: plataforma web para jugar online y competir en una tabla de puntos.
Las 9 specs de `specs/` están en estado `Implementado`. El scaffold de
`create-next-app` ya no existe: la app completa está portada al App Router.

**Rutas** (`app/`):

| Ruta                | Archivo                                 | Notas                                                 |
| ------------------- | --------------------------------------- | ----------------------------------------------------- |
| `/`                 | `page.tsx` + `HomeClient.tsx`           | Home; animaciones de scroll con `useReveal()`         |
| `/biblioteca`       | `biblioteca/` + `BibliotecaClient.tsx`  | Catálogo desde Supabase, filtros por categoría        |
| `/juego/[id]`       | `juego/[id]/page.tsx`                   | Ficha de detalle (incl. `difficulty`)                 |
| `/juego/[id]/jugar` | `juego/[id]/jugar/` + `JugarClient.tsx` | Reproductor; `actions.ts` guarda el score             |
| `/salon`            | `salon/page.tsx`                        | Hall of Fame; `actions.ts` envuelve la capa de datos  |
| `/acerca-de`        | `acerca-de/page.tsx`                    | About + formulario de contacto; `actions.ts` → Resend |
| `/acceso`           | `acceso/page.tsx`                       | Login **falso** (ver Sesión)                          |

Layout global: `components/nav.tsx`, `components/footer.tsx`, `components/session-provider.tsx`;
fuentes (Press Start 2P, JetBrains Mono, Courier Prime) self-hosted vía `next/font/google`
exponiendo variables CSS que consume `app/globals.css` (~2.8K líneas, portado de
`references/templates/styles.css`).

**Sesión.** `SessionProvider` (Context) con `localStorage` clave `av_user`. Es un login
simulado: `/acceso` acepta cualquier usuario y lo pone en mayúsculas (máx. 10 chars).
**No usa Supabase Auth** todavía; `proxy.ts` solo refresca la sesión de Supabase si
existen las env vars, sin rutas protegidas ni redirecciones.

## Supabase (SPEC 04/06)

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
- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y `RESEND_API_KEY` para el correo de
  contacto (`lib/email.ts`, solo servidor). Viven en `.env.local`, no versionado.

## Motores de juego (SPEC 05, 07, 08, 09, ...)

Cuatro juegos reales portados: `asteroids`, `tetris`, `arkanoid`, `snake`, .... (revisa references/implemented-games.md cuando necesites saber que juegos estan implementados)
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
- La numeración de `specs/` es secuencial con dos dígitos (`01-`, `02-`, …).
- `specs/.spec-config.yml` controla `AutoCreateBranch` (default `true`).
- Al terminar, el estado de la spec pasa a `Implementado`.

Los skills viven en `.claude/skills/` y `.agents/skills/`. `spec` y `spec-impl` están
fijados en `skills-lock.json` (origen `Klerith/fernando-skills`); `add-game` es local
del proyecto y no está en el lock.

## `references/` — material de origen (no conectado al build)

- `references/templates/` — prototipo autónomo **HTML/React 18 + Babel standalone** de
  la app completa; fuente de verdad visual/UX que se portó al App Router.
  `Arcade Vault.html` es la entrada; `app.jsx` hace routing por hash + `localStorage`
  (`av_user`, `av_scores`); `data.jsx` tiene el catálogo mock; pantallas en
  `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx`, `auth.jsx`, `salon.jsx`,
  `home-about/`; estilos en `styles.css`.
- `references/started-games/` — prototipos JS de los juegos de origen
  (`02-asteroids`, `03-tetris`, `04-arkanoid`) desde los que se portan los motores.
- `references/source-assets/` — assets crudos (`snake-assets/`) antes de moverse a
  `public/games/`.
- `references/game-suggestions-todo.md` — TODO de juegos candidatos; memoria persistente del
  agente `game-planner`. Editable a mano.

Para verificar cambios visuales, guarda los screenshots de Playwright en
`.playwright-screenshots/`.

## Idioma

El código, los comentarios y la UI del proyecto están en castellano. Responde en castellano.
