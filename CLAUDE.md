# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Versión de Next.js

Fijado a `next@16.3.4` / `react@19.2.8`. Las APIs difieren de versiones anteriores
de Next.js — consulta `node_modules/next/dist/docs/` (ver `01-app/`) antes de escribir
código de framework, según indica `AGENTS.md`. El bloque `nextjs-agent-rules` de
`AGENTS.md` lo regenera `next dev`; haz commit de él junto con tus cambios en lugar
de revertirlo. Detalle propio de esta versión: `layout.tsx` usa el tipo global
`LayoutProps<"/">` (no un tipo importado).

App Router, Tailwind CSS v4 (vía `@tailwindcss/postcss`), alias de import `@/*` → raíz del repo.

## Estado e intención del proyecto

Arcade Vault: plataforma web para jugar online y competir en una tabla de puntos.
El código es todavía el scaffold sin tocar de `create-next-app` — `app/layout.tsx` y
`app/page.tsx` mantienen el contenido por defecto.

**Flujo spec-driven (obligatorio para features grandes).** Antes de escribir código
para una feature nueva, usa el skill `/spec` para definir la spec y `/spec-impl` para
implementarla. Reglas clave de esos skills:

- `/spec` no escribe código; produce `specs/NN-slug.md` en estado `Draft`. El humano
  cambia el estado a `Aprobado` manualmente.
- `/spec-impl NN-slug` solo actúa si la spec está `Aprobado`; crea la rama
  `spec-NN-slug`, implementa paso a paso y **nunca hace commit automáticamente**.
- La numeración de `specs/` es secuencial con dos dígitos (`01-`, `02-`, …).
- `specs/.spec-config.yml` controla `AutoCreateBranch` (default `true`).

Los skills viven en `.claude/skills/` y `.agents/skills/` (fijados en `skills-lock.json`,
origen `Klerith/fernando-skills`).

## `references/templates/` — prototipo de referencia de diseño

Prototipo autónomo **HTML/React 18 + Babel standalone** de la app completa. Es la
fuente de verdad visual/UX que hay que portar al App Router de Next.js. No está
conectado al build. Los archivos están **borrados en el working tree pero presentes
en git** — recupéralos con `git show HEAD:references/templates/<archivo>` o
`git restore references/`.

- `Arcade Vault.html` — entrada; carga los `.jsx` en orden vía Babel standalone
- `app.jsx` — raíz: routing por hash (`location.hash` = JSON de la ruta) + `localStorage`
  (claves `av_user`, `av_scores`)
- `data.jsx` — catálogo mock `GAMES` (id, título, categoría ARCADE/PUZZLE/SHOOTER, color, best, plays)
- `nav.jsx` — nav superior; rutas: `biblioteca`, `detalle`, `player`, `auth`, `salon`
- Pantallas: `biblioteca` (catálogo), `detalle` (ficha de juego), `reproductor` → `GamePlayer`,
  `auth` (login), `salon` → `HallOfFame` (leaderboard)
- UI en castellano, estética retro-arcade (Press Start 2P, neón); custom properties CSS en `styles.css`

## Idioma

El código, los comentarios y la UI del proyecto están en castellano. Responde en castellano.
