---
name: add-game
description: Designs the spec for adding a new playable game to Arcade Vault — engine port, player wiring, Supabase catalog seed and leaderboard. Audits the source prototype, asks the questions the port always needs, and writes specs/NN-slug.md in Draft. Does not write code.
disable-model-invocation: true
argument-hint: "prototype folder (e.g. 03-tetris) or a one-sentence game description"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /add-game — Spec designer for new playable games

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Specs that already exist (for the next sequential number):
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

Prototypes available under references/started-games/:
!`ls references/started-games/ 2>/dev/null || echo "references/started-games/ does not exist"`

Real game engines already ported under components/games/:
!`ls components/games/ 2>/dev/null || echo "components/games/ does not exist yet"`

Supabase migrations already applied (naming convention to follow):
!`ls supabase/migrations/ 2>/dev/null || echo "supabase/migrations/ does not exist yet"`

---

This skill produces a spec for turning one more game into a real, playable entry with its own
leaderboard in Arcade Vault. **You don't write code here.** SPEC 05 (real Asteroids engine) and
SPEC 06 (Supabase catalog + leaderboard) already worked out the full recipe for doing this —
your job is to apply that recipe to a new game, audit its source prototype (or draft its design
from a description when there is no prototype), ask the questions the port always needs, and
write the spec.

## Philosophy

The recipe from SPEC 05/06 is repeatable but was never written down as a checklist — it lives
scattered across two ~20KB specs and the code they produced. Read `template.md` (in the same
directory as this skill) before writing anything: it carries that recipe frozen into concrete
file paths, gotchas, and acceptance criteria. Lean on it at every step instead of re-deriving the
recipe from scratch.

## Command flow

Your replies must be in the same language as the rest of this project's specs — Spanish
(castellano). Every spec you produce is written in Spanish, matching `specs/05-*.md` and
`specs/06-*.md`.

### Phase 1 — Context

1. Read `CLAUDE.md` and `AGENTS.md` at the repo root.
2. Read `specs/05-asteroids-motor-real.md` and `specs/06-leaderboard-y-catalogo-supabase.md` in
   full — not just their headers. They define the header labels
   (`**Estado:** / **Depende de:** / **Fecha:** / **Objetivo:**`), the section names
   (`## Por qué existe esta spec`, `## Alcance`, `## Modelo de datos`,
   `## Plan de implementación`, `## Criterios de aceptación`, `## Decisiones`, `## Riesgos`,
   `## Lo que **no** entra en esta spec`), and the tone your new spec must match.
3. Read `template.md` (in the same directory as this skill) for the technical recipe: which
   files a game port always touches, in which order, and the traps already hit once (RLS,
   `difficulty` with no default, the catalog not auto-repopulating, the engine/component
   contract, the motor-registry threshold).
4. Look at the session context above: how many real engines already exist under
   `components/games/`. **Zero or one** → the new spec adds a single conditional branch, same
   shape as `asteroids` today. **One or more** → the new spec's plan must include refactoring
   `app/juego/[id]/jugar/JugarClient.tsx` from its `isAsteroids` boolean into a generic
   id→component registry (`template.md` has the exact shape). This refactor is owed the moment a
   second real game exists — SPEC 05 deferred it explicitly for exactly that trigger.

### Phase 2 — Resolve the source

`$ARGUMENTS` is either a prototype folder name under `references/started-games/` (e.g.
`03-tetris`) or a free-text one-sentence game description. Decide which:

**If it names a prototype folder**, read everything inside it: `game.js` (or equivalent),
`index.html`, `CLAUDE.md`/`README.md`, and any `levels.js`/`assets/`. Build an **audit sheet**
from what you read — do not skip any row, each one has bitten a previous port:

| Dato                                               | Por qué importa                                                                                                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolución lógica y nº de canvas                   | `.crt-screen` en `app/globals.css` es `aspect-ratio: 4 / 3`. Asteroids encajó por ser 800×600 en un solo canvas; un prototipo con proporciones distintas o un segundo canvas (HUD auxiliar tipo "pieza siguiente") no encaja sin decidir cómo. |
| Estados del juego                                  | El contrato hoy es `"playing" \| "dead" \| "gameover"`. Si el prototipo tiene un estado extra (p. ej. `'win'`), hay que decidir si se añade a la unión de ese juego.                                                                           |
| HUD dibujado en canvas o en DOM externo            | En este repo el HUD React del reproductor es el único HUD visible; cualquier `drawHUD()`/HUD en DOM del prototipo se retira del `draw()` portado.                                                                                              |
| Assets asíncronos (spritesheet, audio)             | `createEngine(ctx)` es síncrono hoy; si el prototipo carga imágenes o sonido, hay que decidir cómo entra eso en el contrato.                                                                                                                   |
| Globals de módulo (`window`, `document`, `canvas`) | Prohibidos en `engine.ts`; todo se inyecta al crear la instancia.                                                                                                                                                                              |
| Esquema de puntuación, vidas y niveles             | Alimenta `getState(): { score, lives, level, state }`.                                                                                                                                                                                         |
| Controles (teclas)                                 | Define `<X>InputState` y qué teclas necesitan `preventDefault` mientras se juega.                                                                                                                                                              |

Show this audit sheet to the user before moving on — it is also going into the spec's "Por qué
existe esta spec" / "Modelo de datos" sections.

**If it is a free-text description** (no matching prototype), there is nothing to audit — you
draft the game's design yourself, at the level of detail `/spec-impl` needs to write the engine
without improvising: mechanics, controls, entities, collisions, scoring, level progression, end
condition. Present that draft to the user and confirm it before continuing; treat it exactly like
an audited prototype from here on.

### Phase 3 — Clarify through questions

Ask in blocks of 3–5 via `AskUserQuestion` when available (recommendation first, labeled), or a
numbered markdown list otherwise. At minimum, always cover:

1. **Identidad de catálogo.** `id` (slug), `title`, `cat` (`ARCADE|PUZZLE|SHOOTER|VERSUS`),
   `color` (`cyan|magenta|yellow|green`), `difficulty` (1–5), `best`/`plays` de siembra.
2. **Portada.** Reutilizar una clase `cover-*` existente (asteroids reutilizó `cover-rocas`) o
   crear `.cover-<slug>` nueva en el bloque de portadas de `app/globals.css`.
3. **Resolución / encaje en el marco CRT.** Si la proporción del prototipo no es 4:3: letterbox
   dentro del canvas, adaptar la resolución lógica, o relajar el `aspect-ratio` de
   `.crt-screen`. Omite esta pregunta si el prototipo ya es 4:3 (como asteroids, 800×600).
4. **Estados extra**, sólo si el prototipo tenía alguno además de `dead`/`gameover`. Se extiende
   la unión del juego concreto; el reproductor sigue reaccionando únicamente a `gameover`.
5. **Assets**, sólo si el prototipo usa spritesheet/audio: portarlos a `public/`, regenerarlos en
   CSS/Canvas puro, o dejarlos fuera de alcance para esta spec.
6. **HUD auxiliar**, sólo si el prototipo tiene uno (p. ej. pieza siguiente): segundo canvas, HUD
   React, o fuera de alcance.

Skip a question outright when the audit sheet (or the drafted description) already answers it
without ambiguity — don't re-ask what Phase 2 already settled.

### Phase 4 — Write the spec

Once every open question is answered:

1. Determine the next sequential number from the `specs/` listing in the session context
   (highest existing + 1, zero-padded to two digits).
2. Generate a kebab-case slug from the objective (e.g. `tetris-motor-y-leaderboard`).
3. Use the date from the session context. **Never write a date you did not read from there.**
4. Follow `template.md` section by section — it already carries the six-step recipe
   (migración → portada CSS → `engine.ts` → `<X>Game.tsx` → registro de motores si aplica →
   verificación) adapted with this game's specifics from Phases 2–3, plus the audit sheet folded
   into "Por qué existe esta spec" / "Modelo de datos".
5. Write directly to `specs/NN-slug.md`. **Do not ask for permission to write it and do not ask
   whether the file name works** — announce the path in the final confirmation. Only ask if the
   target file already exists.
6. Mark the state as `Draft`. **Do not mark it `Aprobado` automatically.**
7. Set `**Depende de:** SPEC 05, SPEC 06` (both — the spec relies on the engine/component
   contract from SPEC 05 and the catalog/leaderboard tables and data layer from SPEC 06).
8. Confirm to the user:
   - Path of the created file.
   - Whether this spec's plan includes the motor-registry refactor, and why (or why not).
   - Reminder: the spec is in `Draft` state. Change it to `Aprobado` once reviewed.
   - Next step: once approved, run `/spec-impl NN-slug` to implement it.
   - **Stop here.** Do not propose implementing the spec, writing code, or applying any Supabase
     migration.

## Hard rules

- **Never write code, apply migrations, or call Supabase MCP tools during this command.** Only
  the spec's `.md` file at the end.
- **Never propose implementing the spec after saving it.** Your job ends when the file is
  written. The user runs `/spec-impl` when ready.
- **Never assume decisions the user did not confirm.** If something in Phase 2's audit is
  ambiguous, ask in Phase 3.
- **Do not re-ask in Phase 4 what Phase 2 or Phase 3 already settled.**
- **If the prototype doesn't fit the repo's constraints as-is** (wrong aspect ratio, async
  assets, extra states, an auxiliary HUD) — don't silently decide how to resolve it. Surface it
  as a Phase 3 question with your recommendation labeled.

## Arguments

`$ARGUMENTS` is either a prototype folder name under `references/started-games/` or a one-sentence
game description — never a spec file name. If invoked with no arguments, ask which of the two the
user means to provide, and wait.
