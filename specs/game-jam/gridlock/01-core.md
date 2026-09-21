# GAME JAM — GRIDLOCK (core): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-21
> **Objetivo:** Dar de alta `gridlock` como primer juego real de la categoría VERSUS — una
> campaña 1P contra una CPU que bloquea carriles de tráfico en tiempo real mientras tu
> criatura intenta cruzarlos oleada tras oleada, con score entero ascendente para el
> leaderboard.

---

## Por qué existe esta spec

VERSUS es hoy la única categoría de `CATS` (`lib/games.ts`) sin ningún juego real ni
placeholder sembrado — `references/game-suggestions-todo.md` ya lo señala como hueco
prioritario ("el chip de `/biblioteca` devuelve lista vacía"). GRIDLOCK cubre ese hueco desde
el mismo tema del jam (cruzar sin convertirte en papilla), pero con una mecánica opuesta a
CRUCE: en vez de un patrón de tráfico fijo que el jugador aprende a leer, un **oponente
activo** decide en tiempo real dónde y cuándo lanzar vehículos contra el carril que el
corredor está a punto de cruzar. Es el mismo espíritu adversarial que
`references/game-suggestions-todo.md` describe para COMBATE ("campaña 1P contra CPU que
alimenta el leaderboard con un entero ascendente"), aplicado aquí al tema del jam en vez de a
un duelo de tanques.

No parte de ningún prototipo — el diseño se define directamente en esta spec, igual que
SPEC 09 hizo con `snake`. Dos decisiones de encaje resueltas de entrada:

- **Dos roles, un solo teclado, pero (en el core) uno de los dos es siempre la CPU.** El
  filtro duro de controles permite "como mucho un `click` puntual" y descarta multijugador en
  red, pero no descarta un segundo humano en el mismo teclado local (ver SPEC de COMBATE en
  el TODO). El core, sin embargo, se limita a **1P contra CPU** para mantener el alcance
  mínimo estrictamente jugable de principio a fin; el modo 2P local (segundo humano
  controlando al bloqueador) se traslada a `02-ampliada.md`, igual que Tetris trasladó su
  selector de nivel inicial a su ampliación (SPEC 07, paso 9).
- **Puntuación ascendente pese a ser "versus".** Solo el progreso del corredor (filas
  avanzadas + oleadas completadas) alimenta `scores`; no hay concepto de "victorias/derrotas"
  persistido, que es justo el motivo por el que `references/game-suggestions-todo.md` descartó
  Pong ("DUELO DE PALAS") de este catálogo. La CPU nunca "gana": su única función es subir la
  dificultad de forma adaptativa, así que el score sigue siendo un entero único ascendente
  igual que en cualquier otro motor real del sitio.

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo `games`.** `id: "gridlock"`, `title: "GRIDLOCK"`,
  `cat: "VERSUS"`, `color: "magenta"`, `difficulty: 4`, `best: 0`, `plays: "0"`,
  `cover: "cover-gridlock"` (clase nueva).
- **Portada CSS nueva `.cover-gridlock"`** en el bloque de portadas de `app/globals.css`.
- **Motor con dos roles internos**, en `components/games/gridlock/engine.ts`:
  - Grilla lógica de `COLS = 10` × `ROWS = 12` celdas de `LANE_W = 80`px / `LANE_H = 50`px
    sobre un canvas de 800×600. El corredor ocupa la fila inferior al inicio de cada oleada y
    debe llegar a la fila superior (meta) para completarla.
  - **Rol corredor** (jugador humano, flechas): se mueve una celda por pulsación
    (edge-triggered, mismo patrón que CRUCE) hacia arriba/lateral, nunca hacia abajo salvo
    para esquivar.
  - **Rol bloqueador** (en el core, siempre CPU): controla un "cursor de carril" que se
    desplaza horizontalmente sobre las filas intermedias y, con un cooldown propio por carril
    (`BLOCKER_COOLDOWN_MS = 900`, escalado `×0.92` por nivel), lanza un vehículo que recorre
    ese carril de lado a lado. La IA del core es reactiva simple: prioriza lanzar vehículos en
    el carril donde está o va a estar el corredor en los próximos `REACTION_MS = 400`ms
    (lectura directa de la posición del corredor, sin aprendizaje).
  - Colisión: el corredor tocado por un vehículo pierde una vida y respawnea en la fila
    inferior de la oleada actual (sin perder el progreso de oleadas ya completadas); si era la
    última vida, `state = "gameover"`.
  - Puntuación: `+10` por cada fila nueva más avanzada que la mejor alcanzada en la oleada
    actual, `+100` al completar una oleada (llegar a la fila superior). Al completar una
    oleada, `level += 1`, se genera una oleada nueva con una fila más de recorrido
    (`ROWS += 1`, hasta un máximo interno razonable antes de estabilizarse) y el cooldown del
    bloqueador se acorta — progresión indefinida, sin techo de niveles.
  - `getState(): GridlockEngineState` con `wave` (oleada actual) como campo propio.
  - `forceGameOver()`: mismo patrón que el resto de motores.
- **Componente canvas** `components/games/gridlock/GridlockGame.tsx` (`"use client"`),
  clonando el patrón de `AsteroidsGame.tsx`: `ref` como prop, `useImperativeHandle`
  (`pause/resume/forceGameOver`), `reportIfChanged`, `onStateChangeRef`, `resume()` resetea
  `lastTimeRef.current = null`, `dt` capado a `0.05`, listeners de flechas sobre `window`
  (edge-triggered), canvas 800×600 escalado por `aspectRatio` inline, cleanup de RAF y
  listeners. La lógica de IA del bloqueador vive enteramente dentro de `engine.ts` (el
  componente no la orquesta).
- **Registro de motores.** Añadir `gridlock: GridlockGame` a `REGISTRO_MOTORES` en
  `components/games/registry.ts`. `JugarClient.tsx` no necesita cambios.
- **Migración SQL** sembrando `gridlock` en `games`.

**Fuera de alcance (por defecto):**

- Controles táctiles/móviles.
- **Modo 2P local** (segundo humano en el rol bloqueador, WASD + Espacio) — ver
  `02-ampliada.md`.
- IA adaptativa que aprende del jugador (el core usa una IA reactiva simple y fija) — ver
  `02-ampliada.md`.
- Power-ups (escudo, etc.) — ver `02-ampliada.md`.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage` (ya no aplica).
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales (el core es 100% vectorial).
- Tests automatizados.

---

## Modelo de datos

```sql
-- supabase/migrations/<YYYYMMDDHHMMSS>_gridlock.sql

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'gridlock', 'GRIDLOCK',
  'Cruza oleada tras oleada mientras una CPU corta el tráfico para atraparte.',
  'Una IA de bloqueo lee tu posición y lanza vehículos justo por el carril que pisas. Avanza fila a fila hasta la meta, completa la oleada y afronta la siguiente: más filas, cooldown de bloqueo más corto, cero margen de error.',
  'VERSUS', 'cover-gridlock', 'magenta',
  0, '0', 4
);
```

`difficulty` es `not null` **sin default** — la migración debe darlo siempre. `cat: 'VERSUS'`
y `color: 'magenta'` ya son valores válidos por `CHECK`.

Contrato TypeScript entre el motor y el componente:

```ts
// components/games/gridlock/engine.ts
export type GridlockGameState = "playing" | "dead" | "gameover";

export interface GridlockEngineState {
  score: number;
  lives: number;
  level: number;
  state: GridlockGameState;
  wave: number; // oleada actual, campo propio de GRIDLOCK
}

export interface GridlockInputState {
  up: boolean; // edge-triggered, mismo patrón que CruceInputState
  down: boolean;
  left: boolean;
  right: boolean;
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* la IA del bloqueador vive dentro del motor; no se expone como input externo en el core */
  return { update, draw, getState, forceGameOver };
}
export type GridlockEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/gridlock/GridlockGame.tsx
export interface GridlockGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}
interface GridlockGameProps {
  onStateChange: (state: GridlockEngineState) => void;
  ref?: Ref<GridlockGameHandle>; // React 19: ref como prop, sin forwardRef
}
```

`GridlockEngineState` reporta `wave` extra que `RealGameProps.onStateChange` no tipa — mismo
patrón que `lines` en `TetrisEngineState` (SPEC 07): el HUD del reproductor lo lee de forma
específica cuando `game.id === "gridlock"`.

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Migración SQL.** Crear `supabase/migrations/<YYYYMMDDHHMMSS>_gridlock.sql` con el
   `insert` de la sección anterior. Aplicar con `apply_migration` del MCP de Supabase. Prueba
   manual: `list_tables` muestra la fila `gridlock` en `games`; `get_advisors` no reporta RLS
   deshabilitada.
2. **Portada CSS.** `.cover-gridlock` nueva en `app/globals.css`, convención `cover-bg` base +
   detalle en `::after` + glifo en `::before` + `filter: drop-shadow(...)` con `--magenta`.
   Prueba manual: `/biblioteca` muestra la portada nueva, categoría VERSUS deja de estar
   vacía.
3. **Motor.** Crear `components/games/gridlock/engine.ts`: grilla `10×12`, rol corredor
   (movimiento edge-triggered), rol bloqueador con IA reactiva simple (lee posición del
   corredor, lanza vehículos con cooldown por carril), colisión y respawn, puntuación por
   avance y por oleada completada, progresión de oleada indefinida. Render 100% vectorial. Sin
   `window`/`document`/`canvas` a nivel de módulo. Prueba manual: `npx tsc --noEmit` compila.
4. **Componente canvas.** Crear `components/games/gridlock/GridlockGame.tsx`
   (`"use client"`), clonando `AsteroidsGame.tsx` en sus puntos load-bearing, con manejo
   edge-triggered de las flechas del corredor. Prueba manual: montar el componente muestra al
   corredor avanzando y a la CPU lanzando vehículos con cooldown visible.
5. **Registro de motores.** Añadir `gridlock: GridlockGame as ComponentType<RealGameProps>` a
   `REGISTRO_MOTORES` en `components/games/registry.ts`. `JugarClient.tsx` no se toca. Prueba
   manual: `npx tsc --noEmit` compila; el resto de motores reales sigue funcionando igual.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/gridlock/jugar`: HUD
   React (Puntuación/Vidas/Nivel) en tiempo real más `wave`, PAUSA congela el canvas (incluida
   la IA del bloqueador), REANUDAR retoma sin salto de tiempo, ser alcanzado por un vehículo
   resta una vida y respawnea sin perder oleadas completadas, completar una oleada sube de
   nivel y acorta el cooldown del bloqueador, perder la última vida abre el modal de fin con
   el score real, `GUARDAR PUNTUACIÓN` inserta en `scores` vía la Server Action existente.
   Confirmar que `/juego/gridlock` (mini-tabla) y `/salon` (tab `gridlock`) reflejan esa fila
   tras recargar; confirmar que `/biblioteca` filtrado por VERSUS ya no devuelve lista vacía.
   Ejecutar `npx next build` y corregir errores. Si `next dev` reescribió el bloque
   `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `gridlock` en `games` con
      `difficulty = 4` explícita; `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra una tarjeta nueva "GRIDLOCK" con la portada `.cover-gridlock`; el
      chip de categoría VERSUS deja de devolver lista vacía.
- [ ] `components/games/gridlock/engine.ts` no referencia `window`, `document` ni `canvas` a
      nivel de módulo, y no carga ninguna imagen — render 100% vectorial.
- [ ] `/juego/gridlock/jugar` muestra el juego real jugable con las flechas del teclado; el
      HUD React refleja Puntuación/Vidas/Nivel/`wave` en tiempo real.
- [ ] La IA del bloqueador lanza vehículos hacia el carril donde está o va a estar el
      corredor, con un cooldown por carril que se acorta al subir de nivel.
- [ ] Ser alcanzado por un vehículo resta una vida y respawnea al corredor sin perder el
      progreso de oleadas ya completadas (salvo en la última vida, que abre el modal de fin).
- [ ] Completar una oleada (llegar a la fila superior) suma `+100`, sube de nivel y genera una
      oleada nueva con recorrido/dificultad crecientes, de forma indefinida.
- [ ] PAUSA congela el canvas incluida la IA del bloqueador; REANUDAR retoma sin salto de
      tiempo.
- [ ] `GUARDAR PUNTUACIÓN` inserta en `scores` vía la Server Action existente; la fila aparece
      en `/juego/gridlock` y en `/salon` (tab `gridlock`) tras recargar.
- [ ] El resto de motores reales sigue comportándose exactamente igual que antes de esta spec.
- [ ] `components/games/registry.ts` incluye `gridlock` en `REGISTRO_MOTORES`;
      `JugarClient.tsx` no cambia.

---

## Decisiones

- **Sí:** `id: "gridlock"` (nombre en inglés, siguiendo la convención real de
  `asteroids`/`tetris`/`arkanoid`/`snake`, que usan el nombre del juego, no una traducción del
  tema). "Gridlock" (embotellamiento) describe con precisión el rol del bloqueador.
- **Sí:** `cat: "VERSUS"`, `color: "magenta"`, `difficulty: 4`. VERSUS es la categoría vacía
  del catálogo (`references/game-suggestions-todo.md` ya lo identifica como hueco
  prioritario); `magenta` no coincide con `cyan` de CRUCE dentro de esta misma terna;
  dificultad alta porque exige leer el patrón de la IA en tiempo real bajo presión de tiempo.
- **Sí:** limitar el core a 1P contra CPU, dejando el modo 2P local para `02-ampliada.md`. Es
  la forma más pequeña de tener GRIDLOCK jugable de principio a fin con score persistible;
  añadir el segundo rol humano no cambia el contrato del motor pero sí añade una capa de UI
  (selector de modo) que encaja mejor como extra, siguiendo el precedente de SPEC 07 (nivel
  inicial de Tetris trasladado a la ampliación).
- **Sí:** solo el progreso del corredor alimenta `scores` (entero ascendente: filas + oleadas
  completadas). Ninguna variante de "victorias/derrotas" se persiste — es justo el motivo por
  el que `references/game-suggestions-todo.md` descartó Pong de este catálogo; GRIDLOCK evita
  ese error de diseño desde el core.
- **Sí:** IA reactiva simple (lee la posición actual/futura cercana del corredor) en vez de
  patrones aleatorios puros. Sin lectura de la posición del jugador, la CPU sería
  indistinguible de un patrón de tráfico fijo (duplicaría CRUCE); la reactividad es lo que
  hace de GRIDLOCK un versus real, no una variación cosmética de CRUCE.
- **No:** IA que aprende/se adapta a lo largo de la partida, ni power-ups. Alcance mínimo del
  core; ver `02-ampliada.md`.

---

## Riesgos

| Riesgo                                                                                                                 | Mitigación                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La IA reactiva del bloqueador resulta injugable (bloquea el único carril seguro siempre) o trivial (ignora al jugador) | El paso 3 deja `REACTION_MS`/`BLOCKER_COOLDOWN_MS` como constantes ajustables; el paso 6 verifica jugando varias oleadas completas antes de cerrar el core.  |
| GRIDLOCK se percibe como una simple reskin de CRUCE en vez de una mecánica versus real                                 | Resuelto en Decisiones: la IA lee activamente la posición del corredor (adversarial), frente al patrón fijo de CRUCE; se verifica jugando ambos en paralelo. |
| `requestAnimationFrame` sigue corriendo tras desmontar la página                                                       | El `useEffect` de `GridlockGame` cancela el frame pendiente y limpia listeners en su función de limpieza (mismo patrón que `AsteroidsGame`).                 |
| El campo extra `wave` no encaja limpiamente en el tipo genérico del registro                                           | El registro tipa el caso común (`score`/`lives`/`level`/`state`); `JugarClient.tsx` lee `wave` de forma específica para `game.id === "gridlock"`.            |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles.
- Modo 2P local (segundo humano en el rol bloqueador).
- IA adaptativa que aprende del jugador.
- Power-ups.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec o en `02-ampliada.md`.
