# GAME JAM — CRUCE (core): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-21
> **Objetivo:** Dar de alta `cruce` como juego real jugable — cruza carriles de tráfico y un río de troncos hasta la orilla opuesta sin convertirte en papilla, en una grilla discreta con vidas y temporizador por intento.

---

## Por qué existe esta spec

`cruce` ya es un candidato descrito en `references/game-suggestions-todo.md` (sección ARCADE):
"esquivar carriles de tráfico y saltar troncos hasta la orilla; mecánica de evasión por
carriles, ninguna parecida entre los motores portados". Esta spec le da forma completa de
motor real: es la variante más fiel al tema del jam ("cruza la carretera y el río sin
convertirte en papilla") y el único de los tres conceptos de esta terna en categoría ARCADE.

No parte de ningún prototipo en `references/started-games/` — el diseño se define aquí
directamente, igual que hizo SPEC 09 con `snake`. Dos particularidades resueltas de entrada:

- **Movimiento discreto por grilla, no continuo.** A diferencia de `asteroids`/`arkanoid`
  (movimiento por `dt` continuo) y más parecido a `snake` (grilla), pero aquí cada pulsación
  de flecha mueve exactamente una celda, sin repetición automática mientras se mantiene
  pulsada. Decisión: el componente marca el flag de dirección correspondiente en
  `CruceInputState` como `true` solo durante el ciclo de `update` inmediatamente posterior al
  `keydown` (edge-triggered), y lo vuelve a poner en `false`; el motor nunca mueve dos veces
  por la misma pulsación mantenida. `update(dt, input)` sigue teniendo la misma firma que el
  resto de motores, así que el contrato del registro no cambia.
- **Temporizador por intento.** El prototipo mental de Frogger clásico incluye un límite de
  tiempo por vida (si se agota, se pierde una vida aunque no haya colisión). Se porta como
  `timeLeft` interno del motor, visible en el HUD del reproductor a través de un campo extra
  de `CruceEngineState` (mismo patrón que `lines` en `TetrisEngineState`, SPEC 07).

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo `games`.** `id: "cruce"`, `title: "CRUCE"`, `cat: "ARCADE"`,
  `color: "cyan"`, `difficulty: 3`, `best: 0`, `plays: "0"`, `cover: "cover-cruce"` (clase
  nueva).
- **Portada CSS nueva `.cover-cruce`** en el bloque de portadas de `app/globals.css`.
- **Motor por grilla discreta**, en `components/games/cruce/engine.ts`:
  - Grilla lógica de `COLS = 20` × `ROWS = 15` celdas de `CELL = 40`px sobre un canvas de
    800×600 (mismo patrón de resolución fija que el resto de motores).
  - Filas, de abajo hacia arriba: fila 14 = zona de salida segura; filas 9-13 = 5 carriles de
    tráfico (velocidad y sentido alternados por fila, coches como rectángulos de color);
    fila 8 = mediana segura; filas 2-7 = 6 carriles de río (troncos que se mueven en sentidos
    alternados, dos longitudes de tronco distintas); fila 0-1 = orilla con 5 huecos de meta
    (columnas 1, 5, 9, 13, 17), el resto de la orilla es agua (muerte si se aterriza ahí).
  - Estado del jugador: celda actual `(col, row)`, `onLog` (id del tronco que lo arrastra si
    aplica), `timeLeft` (25s por vida, cuenta atrás en `update`).
  - Colisión: pisar un carril de tráfico ocupado por un coche, o quedar en una celda de río
    sin tronco debajo, o ser arrastrado fuera de los límites horizontales por un tronco, o que
    `timeLeft` llegue a 0 → pierde una vida (`state = "dead"` un instante, luego respawn en la
    fila de salida con `timeLeft` reiniciado) o, si era la última vida, `state = "gameover"`.
  - Puntuación: `+10` por cada fila nueva más avanzada que la mejor alcanzada en el intento
    actual (no se puntúa retroceder ni repetir fila), `+50` al ocupar un hueco de meta vacío.
    Cuando los 5 huecos de meta están ocupados, el tablero se reinicia completo (`level += 1`,
    velocidad de carriles y troncos escalada `×1.08` por nivel, los 5 huecos vuelven a
    vaciarse), de forma indefinida — sin techo de niveles.
  - `getState(): CruceEngineState` con `timeLeft` y `goalsFilled` como campos propios.
  - `forceGameOver()`: mismo patrón que el resto de motores.
- **Componente canvas** `components/games/cruce/CruceGame.tsx` (`"use client"`), clonando el
  patrón de `AsteroidsGame.tsx`: `ref` como prop, `useImperativeHandle`
  (`pause/resume/forceGameOver`), `reportIfChanged`, `onStateChangeRef`, `resume()` resetea
  `lastTimeRef.current = null`, `dt` capado a `0.05`, listeners de flechas sobre `window` con
  `preventDefault` condicionado a `state === "playing"` (edge-triggered, ver arriba), canvas
  800×600 escalado por `aspectRatio` inline, cleanup de RAF y listeners.
- **Registro de motores.** Añadir `cruce: CruceGame` a `REGISTRO_MOTORES` en
  `components/games/registry.ts`. `JugarClient.tsx` no necesita cambios (el registro genérico
  ya existe desde SPEC 07).
- **Migración SQL** sembrando `cruce` en `games`.

**Fuera de alcance (por defecto):**

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage` (ya no aplica).
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales de vehículos/troncos/rana (ver `02-ampliada.md`) — el core es 100%
  vectorial (`fillRect`/`arc`), sin `Image`/`fetch`.
- Troncos/tortugas que se sumergen, ítems de bonificación, rescate de pareja (ver
  `02-ampliada.md`).
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```sql
-- supabase/migrations/<YYYYMMDDHHMMSS>_cruce.sql

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'cruce', 'CRUCE',
  'Esquiva el tráfico y salta de tronco en tronco hasta la otra orilla.',
  'Guía a tu criatura por una carretera de carriles cruzados y un río de troncos a la deriva. Un golpe de parachoques o un chapuzón sin tronco debajo te cuesta una vida; el reloj también corre en tu contra. Llena los cinco huecos de la orilla para subir de nivel: la velocidad no perdona.',
  'ARCADE', 'cover-cruce', 'cyan',
  0, '0', 3
);
```

`difficulty` es `not null` **sin default** — la migración debe darlo siempre. `cat` y `color`
ya son valores válidos por `CHECK`.

Contrato TypeScript entre el motor y el componente:

```ts
// components/games/cruce/engine.ts
export type CruceGameState = "playing" | "dead" | "gameover";

export interface CruceEngineState {
  score: number;
  lives: number;
  level: number;
  state: CruceGameState;
  timeLeft: number; // segundos restantes del intento actual, campo propio de CRUCE
  goalsFilled: number; // 0-5, huecos de meta ocupados en el tablero actual
}

export interface CruceInputState {
  up: boolean; // edge-triggered: el componente lo pone en true solo un update tras keydown
  down: boolean;
  left: boolean;
  right: boolean;
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* ... */
  return { update, draw, getState, forceGameOver };
}
export type CruceEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/cruce/CruceGame.tsx
export interface CruceGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}
interface CruceGameProps {
  onStateChange: (state: CruceEngineState) => void;
  ref?: Ref<CruceGameHandle>; // React 19: ref como prop, sin forwardRef
}
```

`CruceEngineState` reporta `timeLeft`/`goalsFilled` extra que `RealGameProps.onStateChange`
no tipa — mismo patrón que `lines` en `TetrisEngineState` (SPEC 07): el HUD del reproductor
los lee de forma específica cuando `game.id === "cruce"`.

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Migración SQL.** Crear `supabase/migrations/<YYYYMMDDHHMMSS>_cruce.sql` con el `insert`
   de la sección anterior. Aplicar con `apply_migration` del MCP de Supabase. Prueba manual:
   `list_tables` muestra la fila `cruce` en `games`; `get_advisors` no reporta RLS
   deshabilitada.
2. **Portada CSS.** `.cover-cruce` nueva en el bloque de portadas de `app/globals.css`,
   siguiendo la convención `cover-bg` base + detalle en `::after` + glifo en `::before` +
   `filter: drop-shadow(...)` con `--cyan`. Prueba manual: `/biblioteca` muestra la portada
   nueva sin romper el resto de tarjetas.
3. **Motor.** Crear `components/games/cruce/engine.ts`: grilla `20×15` de celdas de `40`px,
   carriles de tráfico y río con velocidades/sentidos alternados, colisión y respawn,
   temporizador por vida, puntuación por avance de fila y por hueco de meta, progresión de
   nivel indefinida al llenar los 5 huecos. Render 100% vectorial
   (`fillRect` para coches/troncos/orilla, `arc`/`fillRect` para el jugador). Sin
   `window`/`document`/`canvas` a nivel de módulo. Prueba manual: `npx tsc --noEmit` compila.
4. **Componente canvas.** Crear `components/games/cruce/CruceGame.tsx` (`"use client"`),
   clonando `AsteroidsGame.tsx` en sus puntos load-bearing (ver `## Modelo de datos` y
   `## Alcance`), con el manejo edge-triggered de las flechas (un solo paso de grilla por
   pulsación, sin repetición automática al mantener la tecla). Prueba manual: montar el
   componente muestra el tablero, el jugador se mueve una celda por pulsación, los coches y
   troncos se desplazan a velocidad constante por carril.
5. **Registro de motores.** Añadir `cruce: CruceGame as ComponentType<RealGameProps>` a
   `REGISTRO_MOTORES` en `components/games/registry.ts`. `JugarClient.tsx` no se toca. Prueba
   manual: `npx tsc --noEmit` compila; `/juego/asteroids/jugar`, `/juego/tetris/jugar`,
   `/juego/arkanoid/jugar` y `/juego/snake/jugar` siguen funcionando igual.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/cruce/jugar`: HUD
   React (Puntuación/Vidas/Nivel) en tiempo real, PAUSA congela el canvas, REANUDAR retoma sin
   salto de tiempo (ni descuenta `timeLeft` de golpe), cruzar tráfico y río funciona, quedarse
   sin tronco debajo o sin tiempo resta una vida y respawnea en la fila de salida, llenar los 5
   huecos de meta sube de nivel y acelera el tablero, perder la última vida abre el modal de
   fin con el score real, `GUARDAR PUNTUACIÓN` inserta en `scores` vía la Server Action
   existente. Confirmar que `/juego/cruce` (mini-tabla) y `/salon` (tab `cruce`) reflejan esa
   fila tras recargar. Confirmar que el resto de motores reales no cambia su comportamiento.
   Ejecutar `npx next build` y corregir errores. Si `next dev` reescribió el bloque
   `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `cruce` en `games` con
      `difficulty = 3` explícita; `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra una tarjeta nueva "CRUCE" con la portada `.cover-cruce`.
- [ ] `components/games/cruce/engine.ts` no referencia `window`, `document` ni `canvas` a
      nivel de módulo, y no carga ninguna imagen — render 100% vectorial.
- [ ] `/juego/cruce/jugar` muestra el juego real jugable con las flechas del teclado; cada
      pulsación mueve exactamente una celda, sin repetición automática al mantener la tecla.
- [ ] El HUD React refleja Puntuación/Vidas/Nivel en tiempo real, más el temporizador
      (`timeLeft`) y los huecos de meta ocupados (`goalsFilled`), propios de `cruce`.
- [ ] Quedarse sin tronco debajo en el río, chocar con tráfico o agotar el tiempo resta una
      vida y respawnea en la fila de salida sin terminar la partida (salvo última vida).
- [ ] Llenar los 5 huecos de meta sube de nivel, reinicia los huecos y acelera carriles/río de
      forma indefinida (sin techo).
- [ ] PAUSA congela el canvas (incluido el temporizador); REANUDAR retoma sin salto de tiempo.
- [ ] Perder la última vida abre el modal de fin con el score real; `GUARDAR PUNTUACIÓN`
      inserta en `scores` vía la Server Action existente.
- [ ] La fila guardada aparece en `/juego/cruce` (mini-tabla) y en `/salon` (tab `cruce`) tras
      recargar.
- [ ] El resto de motores reales (`asteroids`/`tetris`/`arkanoid`/`snake`) siguen
      comportándose exactamente igual que antes de esta spec.
- [ ] `components/games/registry.ts` incluye `cruce` en `REGISTRO_MOTORES`; `JugarClient.tsx`
      no cambia.

---

## Decisiones

- **Sí:** `id: "cruce"` / `title: "CRUCE"`, tal cual figura en
  `references/game-suggestions-todo.md`, sin traducir al inglés. A diferencia de
  `asteroids`/`tetris`/`arkanoid`/`snake` (nombres propios de juegos reales en inglés), CRUCE
  no es el port de un clásico con nombre fijo, sino un concepto nuevo del jam; se respeta la
  entrada ya reservada en el TODO para no crear una segunda entrada duplicada.
- **Sí:** `color: "cyan"`, `difficulty: 3`, `cat: "ARCADE"` — datos exactos ya fijados en
  `references/game-suggestions-todo.md`, reutilizados sin cambios.
- **Sí:** movimiento edge-triggered (un paso de grilla por pulsación) en vez de movimiento
  continuo por `dt` o repetición automática al mantener la flecha. Es la mecánica reconocible
  del género (Frogger clásico); un movimiento continuo lo convertiría en un juego de esquiva
  distinto, más parecido a un shooter de scroll.
- **Sí:** temporizador por vida (`timeLeft`), no solo colisión. Sin límite de tiempo, la
  estrategia óptima sería esperar indefinidamente a que se abra un hueco seguro, aplanando la
  dificultad; el reloj obliga a arriesgar.
- **Sí:** progresión de nivel indefinida (sin techo) al llenar los 5 huecos de meta. Mantiene
  el leaderboard con recorrido infinito, consistente con el resto de motores del catálogo.
- **No:** sprites reales de vehículos/troncos/rana en el core. Se prioriza un MVP 100%
  vectorial y síncrono (mismo patrón que `asteroids`/`arkanoid`); los sprites se evalúan en
  `02-ampliada.md`.
- **No:** troncos/tortugas que se sumergen, ítems de bonificación ni rescate de pareja en el
  core — son extras de la ampliación, no del MVP jugable de principio a fin.

---

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El movimiento edge-triggered se siente "pegajoso" o pierde pulsaciones rápidas                 | El paso 4 verifica manualmente una secuencia rápida de pulsaciones consecutivas; si se pierden inputs, se ajusta el tamaño de la ventana de detección de flanco. |
| Que el jugador quede atrapado entre dos coches sin hueco por el que avanzar (nivel injugable)  | El paso 3 fija una densidad máxima de tráfico por carril (huecos garantizados) al generar cada nivel, como hace el Frogger clásico.                              |
| `requestAnimationFrame` sigue corriendo tras desmontar la página                               | El `useEffect` de `CruceGame` cancela el frame pendiente y limpia listeners en su función de limpieza (mismo patrón que `AsteroidsGame`).                        |
| El campo extra `timeLeft`/`goalsFilled` no encaja limpiamente en el tipo genérico del registro | El registro tipa el caso común (`score`/`lives`/`level`/`state`); `JugarClient.tsx` lee los campos extra de forma específica para `game.id === "cruce"`.         |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales, troncos/tortugas que se sumergen, ítems de bonificación, rescate de pareja
  (ver `02-ampliada.md`).
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec o en `02-ampliada.md`.
