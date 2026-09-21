# GAME JAM — GRIDLOCK (ampliada): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06, `specs/game-jam/gridlock/01-core.md`
> **Fecha:** 2026-09-21
> **Objetivo:** Extender GRIDLOCK con un modo 2P local, IA adaptativa que escala con el
> récord del jugador, un power-up de escudo temporal y stats de racha/récord en el modal de
> fin.

---

## Por qué existe esta spec

`01-core.md` entrega GRIDLOCK jugable de principio a fin en modo 1P contra una CPU con IA
reactiva fija. Esta ampliación añade la capa versus completa (un segundo humano puede tomar
el rol de bloqueador en el mismo teclado, como ya insinuaba
`references/game-suggestions-todo.md` para COMBATE) y tres extras que profundizan el bucle
sin tocar el contrato base del motor — mismo tipo de extensión que SPEC 07 (pasos 7-11) hizo
sobre Tetris.

Los cuatro extras:

- **Modo 2P local**, alternable antes de empezar la partida con una tecla dedicada (sin
  ratón), que reemplaza la IA por un segundo jugador humano controlando el cursor de
  bloqueo.
- **IA adaptativa**, que en modo 1P ajusta su agresividad según el mejor score histórico del
  jugador (leído de Supabase), en vez de una dificultad fija por nivel.
- **Power-up de escudo**, un ítem que aparece ocasionalmente en el carril del corredor y que,
  al recogerlo, absorbe el próximo impacto sin perder vida.
- **Récord + racha de oleadas**, comparando contra el mejor score real de Supabase y
  mostrando la racha de oleadas consecutivas sin perder vida.

---

## Alcance

**Dentro:**

- **Selector de modo 1P/2P**, solo en la pantalla previa a iniciar partida (mientras
  `state !== "playing"` y no ha arrancado el primer frame): tecla `M` alterna entre
  "1P vs CPU" y "2P local", con el modo elegido mostrado en el HUD antes de arrancar. Ningún
  `click` involucrado — cumple el filtro de controles del proyecto sin usar el único click
  puntual permitido.
- **Rol bloqueador humano (modo 2P local).** Segundo jugador controla el cursor de bloqueo
  con `KeyA`/`KeyD` (mover el cursor entre carriles) y `Space` (lanzar vehículo en el carril
  actual del cursor, sujeto al mismo `BLOCKER_COOLDOWN_MS` que la IA). El motor expone un
  método `setBlockerInput(input: GridlockBlockerInput)` que `GridlockGame.tsx` llama en modo
  2P en vez de dejar que la IA decida; en modo 1P, el motor sigue gobernando el bloqueador
  internamente como en el core.
- **Solo el modo 1P vs CPU guarda score.** En 2P local, al terminar la partida el modal de
  fin muestra el resultado (oleadas alcanzadas) pero **no** ofrece "GUARDAR PUNTUACIÓN" —
  mismo criterio que `references/game-suggestions-todo.md` fija para COMBATE ("campaña 1P
  [...] alimenta el leaderboard [...] y modo 2P en el mismo teclado" sin persistencia). Evita
  que una partida cooperativa/competitiva entre dos humanos locales distorsione un ranking
  pensado para comparar contra una IA constante.
- **IA adaptativa (solo modo 1P).** `page.tsx` pasa `mejorGlobal` (vía
  `obtenerMejoresScores("gridlock", 1)`) también a `GridlockGame` (no solo al modal de fin);
  el motor usa ese valor para fijar `BLOCKER_COOLDOWN_MS` inicial (más bajo cuanto mayor sea
  el récord del jugador, con un piso mínimo), en vez del valor fijo del core.
- **Power-up de escudo.** Ítem que aparece cada `SHIELD_INTERVAL_MS` (con jitter aleatorio) en
  una celda del carril que el corredor está a punto de cruzar; recogerlo activa `shield: true`
  en `GridlockEngineState` durante el resto de la oleada actual o hasta absorber un impacto
  (lo que ocurra antes).
- **Récord global + racha de oleadas.** Modal de fin muestra "¡NUEVO RÉCORD!" cuando
  `score > mejorGlobal` (solo aplica en modo 1P, que es el único que guarda) y siempre
  "Oleadas consecutivas sin perder vida: N" (`maxStreak`, stat de sesión, no persistida).

**Fuera de alcance (por defecto):**

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales (GRIDLOCK se mantiene 100% vectorial, a diferencia de CRUCE — su identidad
  visual es el contraste de colores entre corredor/bloqueador/vehículos, no una ilustración).
- Guardado de partidas 2P local en `scores`.
- Tests automatizados.

---

## Modelo de datos

Reutiliza el contrato TypeScript de `01-core.md` (`GridlockGameState`, `GridlockInputState`,
`GridlockGameHandle`, `GridlockGameProps`) sin cambios de forma — esta ampliación añade tipos
y métodos nuevos:

```ts
// components/games/gridlock/engine.ts (ampliación)
export type GridlockMode = "cpu" | "local2p";

export interface GridlockBlockerInput {
  left: boolean; // mover cursor de bloqueo un carril a la izquierda (edge-triggered)
  right: boolean;
  launch: boolean; // lanzar vehículo en el carril actual del cursor (edge-triggered)
}

export interface GridlockEngineState {
  score: number;
  lives: number;
  level: number;
  state: GridlockGameState;
  wave: number;
  mode: GridlockMode; // ampliación
  shield: boolean; // ampliación: escudo activo
  maxStreak: number; // ampliación: racha máxima de oleadas sin perder vida
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* ... */
  return {
    update,
    draw,
    getState,
    forceGameOver,
    setMode, // (mode: GridlockMode) => void — solo válido antes de state === "playing"
    setBlockerInput, // (input: GridlockBlockerInput) => void — no-op si mode !== "local2p"
    setInitialCooldown, // (cooldownMs: number) => void — IA adaptativa, calculado a partir de mejorGlobal
  };
}
```

```ts
// components/games/gridlock/GridlockGame.tsx (ampliación)
export interface GridlockGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  setMode(mode: GridlockMode): void; // ampliación, aplica antes de empezar partida
}
interface GridlockGameProps {
  onStateChange: (state: GridlockEngineState) => void;
  mejorGlobal?: number; // ampliación: para IA adaptativa, solo se usa en modo "cpu"
  ref?: Ref<GridlockGameHandle>;
}
```

---

## Plan de implementación

Continúa la numeración del plan de `01-core.md` (pasos 1-6 ya completados ahí).

7. **Selector de modo 1P/2P.** `GridlockGame.tsx` escucha `KeyM` mientras
   `state !== "playing"` y llama a `engine.setMode()`, mostrando el modo actual en el HUD
   (`JugarClient.tsx`, gateado por `game.id === "gridlock"`). Prueba manual: alternar con `M`
   antes de empezar cambia el modo mostrado; una vez en `"playing"`, `M` deja de surtir
   efecto.
8. **Rol bloqueador humano.** `engine.ts` añade `setBlockerInput()`; en modo `"local2p"`, el
   `update()` interno deja de invocar la IA y en su lugar consume el último
   `GridlockBlockerInput` recibido. `GridlockGame.tsx` añade listeners de `KeyA`/`KeyD`/`Space`
   (edge-triggered para movimiento del cursor, mantenido para el disparo si se decide así tras
   probar la sensación de juego) activos solo cuando `mode === "local2p"`. El modal de fin
   oculta "GUARDAR PUNTUACIÓN" cuando el modo de la partida jugada fue `"local2p"`. Prueba
   manual: en modo 2P, un segundo jugador en `A`/`D`/`Space` bloquea carriles en tiempo real;
   terminar esa partida no ofrece guardar score.
9. **IA adaptativa + power-up de escudo.** `page.tsx` pasa `mejorGlobal` a `GridlockGame`
   (además de al modal de fin); en modo `"cpu"`, `engine.setInitialCooldown()` se llama al
   crear la instancia con un valor calculado a partir de `mejorGlobal` (más bajo cuanto mayor
   el récord, con piso mínimo `BLOCKER_COOLDOWN_MIN_MS`). Añadir generación periódica del
   power-up de escudo, recogida por el corredor, y consumo al absorber un impacto (en vez de
   restar vida). Prueba manual: jugar 1P con un `mejorGlobal` alto se siente más agresivo desde
   el primer segundo; recoger el escudo y chocar una vez no resta vida, la segunda sí.
10. **Récord + racha de oleadas.** `engine.ts` añade `maxStreak` (se resetea a 0 al perder una
    vida, se incrementa en cada oleada completada). El modal de fin muestra "¡NUEVO RÉCORD!"
    (solo en modo 1P) cuando `score > mejorGlobal`, y siempre "Oleadas consecutivas sin perder
    vida: N". Prueba manual: perder una vida resetea la racha visible; el badge de récord solo
    aparece en partidas 1P que superan el mejor score real. Ejecutar `npx next build` y
    corregir errores.

---

## Criterios de aceptación

- [ ] `KeyM` alterna 1P/2P antes de empezar la partida; el HUD muestra el modo activo; `KeyM`
      deja de surtir efecto una vez en `"playing"`.
- [ ] En modo 2P local, `A`/`D` mueven el cursor de bloqueo y `Space` lanza un vehículo en el
      carril del cursor, sujeto al mismo cooldown que usa la CPU en modo 1P.
- [ ] Una partida jugada en modo 2P local no ofrece "GUARDAR PUNTUACIÓN" en el modal de fin.
- [ ] En modo 1P, la agresividad inicial de la CPU (`BLOCKER_COOLDOWN_MS` de arranque) varía
      según `mejorGlobal`, con un piso mínimo que nunca hace el juego literalmente imposible.
- [ ] El power-up de escudo aparece de forma periódica, se puede recoger, y absorbe
      exactamente un impacto antes de desactivarse.
- [ ] El motor expone `maxStreak`, reseteado a 0 al perder una vida.
- [ ] El modal de fin muestra "¡NUEVO RÉCORD!" solo en partidas 1P con `score > mejorGlobal`, y
      siempre "Oleadas consecutivas sin perder vida: N".
- [ ] `npx next build` termina sin errores ni warnings de TypeScript tras los cuatro pasos.
- [ ] El core de `01-core.md` (modo 1P por defecto, colisión, puntuación, guardado de score en
      1P) sigue funcionando exactamente igual que antes de esta ampliación.

---

## Decisiones

- **Sí:** alternar modo con tecla dedicada (`M`) en vez de un menú clicable. Cumple el filtro
  de controles del proyecto (solo teclado, como mucho un click puntual) sin gastar ese único
  click en algo que una tecla resuelve igual de bien.
- **Sí:** solo el modo 1P vs CPU persiste en `scores`. El leaderboard compara partidas contra
  una referencia constante (la IA); dos partidas 2P locales no son comparables entre sí de
  forma justa en una tabla global, mismo criterio que ya adelantaba
  `references/game-suggestions-todo.md` para COMBATE.
- **Sí:** IA adaptativa basada en `mejorGlobal`, no en el progreso dentro de la partida actual.
  Mantiene el motor determinista dentro de una misma partida (mismo comportamiento si se
  reinicia con el mismo récord), evitando una curva de aprendizaje en vivo que sería más
  compleja de depurar y de verificar manualmente.
- **Sí:** power-up de escudo como único power-up de esta ampliación. Introduce riesgo/premio
  sin desbalancear la mecánica central; más power-ups quedarían para una spec futura si el
  usuario los pide.
- **No:** guardar partidas 2P local en `scores`, ni introducir una tabla de resultados
  separada para 2P. Fuera del propósito del leaderboard actual (SPEC 06).

---

## Riesgos

| Riesgo                                                                                                      | Mitigación                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La IA adaptativa vuelve el juego injugable para un jugador con `mejorGlobal` muy alto                       | El paso 9 fija `BLOCKER_COOLDOWN_MIN_MS` como piso mínimo, verificado jugando con un `mejorGlobal` artificialmente alto antes de cerrar el paso.                |
| El modo 2P local reutiliza mal las teclas del corredor (conflicto `WASD` vs flechas)                        | El paso 8 usa exclusivamente `KeyA`/`KeyD`/`Space` para el bloqueador, dejando las flechas intactas para el corredor — se verifica que ambos roles no se pisen. |
| Ocultar "GUARDAR PUNTUACIÓN" en 2P local requiere que `JugarClient.tsx` sepa en qué modo se jugó la partida | El motor expone `mode` en `GridlockEngineState`; el modal de fin lo lee del último estado reportado antes de decidir si mostrar el botón, sin estado adicional. |
| El power-up de escudo aparece en una posición imposible de alcanzar a tiempo                                | El paso 9 genera el escudo únicamente en el carril inmediato que el corredor va a cruzar a continuación, nunca detrás ni en un carril lejano.                   |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales.
- Guardado de partidas 2P local en `scores`.
- Power-ups adicionales más allá del escudo.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
