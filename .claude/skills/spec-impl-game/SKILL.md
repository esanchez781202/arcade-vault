---
name: spec-impl-game
description: Implementa una spec aprobada de un juego nuevo (misma mecánica que /spec-impl) y, al terminar, detona en secuencia skin-designer y luego mobile-porter. Nunca en paralelo.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementer de specs de juegos nuevos + post-proceso automático

Este comando es `/spec-impl` más una Fase B: cuando la spec implementada siembra un **motor de
juego nuevo**, al cerrar el último paso del plan detona en secuencia (nunca en paralelo) al
agente `skin-designer` y después al agente `mobile-porter` sobre ese juego.

---

## Fase A — delegar en `/spec-impl`

Lee con la herramienta Read el archivo `.claude/skills/spec-impl/SKILL.md` completo y **ejecuta
sus cuatro fases tal cual están escritas ahí**, pasándole `$ARGUMENTS` como su argumento. Esto
incluye:

- Correr los mismos comandos de _Session context_ que usa ese skill (`git status --short`,
  `git branch --show-current`, `ls specs/ 2>/dev/null`, `cat specs/.spec-config.yml 2>/dev/null`).
- Fase 1: localizar la spec en `specs/` a partir de `$ARGUMENTS`.
- Fase 2: validar que el estado significa "Aprobado" en cualquier idioma. Si no lo es, mostrar
  el mensaje de error estándar de `spec-impl` y **detenerse ahí** — no se entra a la Fase B.
- Fase 3: crear/cambiar a la rama `spec-NN-slug` según `AutoCreateBranch`, y mostrar el resumen
  de la spec (objetivo, alcance, plan, criterios de aceptación).
- Fase 4: implementar paso a paso, pausando tras cada paso para revisión, **sin commitear
  nunca** automáticamente. Resolver ambigüedades preguntando, igual que `spec-impl`.

No copies ni reescribas el contenido de `spec-impl` — leerlo y seguirlo es la fuente de verdad,
porque ese skill está pineado en `skills-lock.json` (origen `Klerith/fernando-skills`) y no se
puede invocar con la herramienta Skill porque lleva `disable-model-invocation: true`.

Solo se avanza a la Fase B cuando la Fase A llega a su mensaje final de cierre ("todos los
pasos del plan están implementados"). Si el usuario abandona, un paso queda sin confirmar, o la
Fase 2 bloqueó por estado no-Aprobado, **el comando termina ahí** y no lanza ningún agente.

---

## Fase B — post-proceso del juego nuevo (secuencial, nunca en paralelo)

### B.0 — Resolver el `gameId`

Determina si la spec recién implementada sembró un motor de juego nuevo, cruzando tres fuentes:

1. `components/games/registry.ts` — ¿`REGISTRO_MOTORES` tiene una clave nueva que no estaba
   antes de esta implementación?
2. `components/games/<gameId>/` — ¿existe el directorio nuevo (`engine.ts` +
   `<Juego>Game.tsx`)?
3. `supabase/migrations/` — ¿hay una migración nueva que siembra esa fila en `games`?

Si las tres coinciden en el mismo `gameId`, continúa a B.1. Si no hay motor nuevo (la spec era
de otra naturaleza — UI, Supabase, etc.) o las fuentes no coinciden, dilo explícitamente y
termina sin lanzar ningún agente, sugiriendo que para ese caso basta `/spec-impl` a secas.

### B.1 — Confirmación única

Antes de lanzar nada, muestra exactamente lo que vas a hacer y espera un solo OK del usuario:

```
Implementación cerrada. Falta el post-proceso del juego nuevo:

  gameId detectado:  <gameId>
  1) @skin-designer  →  skins clasico/retro/neon de <gameId>
  2) @mobile-porter   →  ruta /juego/[id]/jugar con id=<gameId>

Se lanzan uno después de otro, nunca a la vez. ¿Procedo?
```

Espera confirmación explícita antes de continuar.

### B.2 — Lanzar `skin-designer`

Con la herramienta Agent, lanza **una sola** invocación con `subagent_type: "skin-designer"`.
El prompt (en castellano, autocontenido — el agente parte sin memoria de esta conversación)
debe:

- Nombrar un único `gameId`: el detectado en B.0.
- Explicar que es un motor recién implementado por `/spec-impl-game`, ya presente en
  `REGISTRO_MOTORES` (`components/games/registry.ts`) y en `references/implemented-games.md`.
- Pedirle que siga su propio flujo (Fases 0-5 de su definición): auditar, diseñar paletas
  `clasico`/`retro`/`neon`, verificar contraste con Playwright y registrar el resultado en
  `references/games-with-themes.md`.

**Regla dura: esta es la única llamada a Agent en este bloque de respuesta.** No emitas la
llamada a `mobile-porter` en el mismo turno — espera a que `skin-designer` devuelva su informe.

Si el agente falla, se detiene a mitad de camino, o pregunta algo que no puedes responder por
él, reporta la situación al usuario y **no lances `mobile-porter`** sin que el usuario decida
cómo seguir.

### B.3 — Lanzar `mobile-porter`

Solo después de que B.2 haya devuelto su informe final. Con la herramienta Agent, lanza **una
sola** invocación con `subagent_type: "mobile-porter"`. El prompt debe:

- Pedir la ruta `/juego/[id]/jugar` usando `id=<gameId>` (el mismo `gameId` de B.0).
- Advertir que esa ruta puede figurar en `references/mobile-porting-status.md` como
  parcial/PASS de una corrida anterior con _otro_ juego, pero que este motor nuevo trae su
  propio HUD/controles/modal, así que debe re-auditar M1-M6 específicamente para este `id` y
  anotarlo en la nota de esa fila (sin duplicar la fila).

### B.4 — Cierre

Resume en una tabla: agente, qué cambió, resultado de la verificación (Fase 4 de
skin-designer / M1-M6 de mobile-porter), y qué archivos de memoria quedaron actualizados
(`references/games-with-themes.md`, `references/mobile-porting-status.md`).

Termina con el mismo recordatorio que `spec-impl`:

```
Próximo paso: verificar los criterios de aceptación de la spec uno por uno.
Si todos pasan, actualiza el estado de la spec a "Implementado" y haz el commit final
antes de fusionar esta rama.
```

**Este comando nunca hace commit**, ni en la Fase A ni en la Fase B.
