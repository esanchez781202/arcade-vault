# GAME JAM — CRUCE (ampliada): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06, `specs/game-jam/cruce/01-core.md`
> **Fecha:** 2026-09-21
> **Objetivo:** Extender el CRUCE del core con sprites reales, troncos/tortugas que se
> sumergen, bonificaciones de tiempo y rescate, y stats de récord/racha en el modal de fin.

---

## Por qué existe esta spec

`01-core.md` entrega CRUCE jugable de principio a fin con render 100% vectorial y sin
mecánicas de bonificación. Esta ampliación introduce los cuatro extras que separan un MVP
funcional de la experiencia completa que el tema del jam sugiere ("no convertirte en
papilla" gana intensidad con tortugas que se sumergen bajo tus pies) — el mismo tipo de salto
que dio SPEC 07 (pasos 7-11) sobre Tetris tras cerrar su plan base de 6 pasos.

Los cuatro extras, en orden de dependencia (cada uno se apoya en el anterior o es
independiente):

- **Sprites reales** (vehículos/troncos/tortugas/criatura jugable), reemplazando los
  `fillRect`/`arc` del core — mismo patrón de precarga que introdujo SPEC 09 con
  `snake`/`fruits.png`.
- **Troncos/tortugas que se sumergen**, un peligro de temporización nuevo en los carriles de
  río (requiere que el jugador anticipe, no solo reaccione).
- **Bonificación de tiempo + rescate de pareja**, dos multiplicadores de puntuación
  opcionales que premian velocidad y riesgo, fieles al Frogger clásico.
- **Récord global + racha**, comparando contra el mejor score real de Supabase y mostrando
  una racha de cruces consecutivos sin perder vida — mismo patrón que introdujo SPEC 07 (paso 10) para Tetris.

---

## Alcance

**Dentro:**

- **Assets reales.** Atlas de sprites `public/games/cruce/atlas.png` (vehículos por carril,
  dos tipos de tronco, tortuga, criatura jugable en sus 4 orientaciones) + constante tipada
  `CRUCE_ATLAS: Record<string, { x: number; y: number; w: number; h: number }>` portada al
  módulo del motor (mismo patrón que `FRUIT_ATLAS` de SNAKE, SPEC 09). `CruceGame.tsx` precarga
  la imagen con `new Image()` antes de instanciar el motor, mostrando `CARGANDO...` mientras
  tanto (mismo patrón que `SnakeGame.tsx`).
- **Tortugas que se sumergen.** Uno de los dos tipos de "tronco" de río es en realidad un
  grupo de tortugas que, cada cierto intervalo, se sumergen durante ~1.5s (indicado
  visualmente con un frame de sprite distinto antes de sumergirse, a modo de aviso) — si el
  jugador está sobre ellas cuando se sumergen, pierde una vida igual que caer al agua sin
  tronco.
- **Bonificación de tiempo.** Al alcanzar un hueco de meta, el `timeLeft` restante del intento
  se convierte en puntos extra (`+timeLeft * 2`, redondeado).
- **Rescate de pareja.** Un ítem especial (sprite de criatura atrapada) aparece ocasionalmente
  en un carril de tráfico ya cruzado; llevarlo hasta un hueco de meta vacío otorga `+200`
  puntos adicionales sobre el bonus normal de meta, y libera ese hueco con una marca visual
  distinta (no cuenta doble para `goalsFilled`).
- **Récord global + racha de cruces.** `app/juego/[id]/jugar/page.tsx` pasa `mejorGlobal` (vía
  `obtenerMejoresScores("cruce", 1)`) a `JugarClient`; el modal de fin muestra "¡NUEVO
  RÉCORD!" cuando `score > mejorGlobal`, y siempre muestra "Cruces sin perder vida: N" (racha
  máxima de huecos de meta llenados consecutivamente sin perder una vida en el intento). El
  motor añade `maxStreak` a `CruceEngineState` (no se persiste como columna nueva en `scores`,
  solo se muestra como stat de sesión — mismo patrón que `maxCombo` en Tetris, SPEC 07).

**Fuera de alcance (por defecto):**

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Selector de skin/tema visual (Tetris lo tiene; CRUCE no lo necesita porque el atlas de
  sprites ya define una identidad visual única).
- Tests automatizados.

---

## Modelo de datos

Reutiliza el contrato TypeScript de `01-core.md` (`CruceGameState`, `CruceInputState`,
`CruceGameHandle`, `CruceGameProps`) sin cambios de forma — esta ampliación solo añade campos
y una firma nueva:

```ts
// components/games/cruce/engine.ts (ampliación)
export interface CruceSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CRUCE_ATLAS: Record<string, CruceSprite> = {
  /* coches por carril, tronco-A, tronco-B, tortuga (frames normal/aviso/sumergida), criatura×4 orientaciones, ítem de rescate */
};

export interface CruceEngineState {
  score: number;
  lives: number;
  level: number;
  state: CruceGameState;
  timeLeft: number;
  goalsFilled: number;
  maxStreak: number; // ampliación: racha máxima de cruces consecutivos sin perder vida
}

export function createEngine(ctx: CanvasRenderingContext2D, spriteImage: HTMLImageElement) {
  /* ... amplía la firma del core con la imagen precargada, mismo patrón que components/games/snake/engine.ts */
  return { update, draw, getState, forceGameOver };
}
```

```ts
// components/games/cruce/CruceGame.tsx (ampliación)
// Precarga public/games/cruce/atlas.png con new Image() en un useEffect de montaje;
// mientras no ha cargado, el canvas muestra "CARGANDO..." (mismo patrón que SnakeGame.tsx)
// y no se instancia el motor todavía.
```

---

## Plan de implementación

Continúa la numeración del plan de `01-core.md` (pasos 1-6 ya completados ahí).

7. **Assets.** Crear/exportar `public/games/cruce/atlas.png` (spritesheet propio: vehículos,
   dos tipos de tronco, tortuga en 3 frames, criatura jugable en 4 orientaciones, ítem de
   rescate) y portar sus coordenadas a `CRUCE_ATLAS` en `components/games/cruce/engine.ts`,
   sin depender de ningún global (`window`). Prueba manual: el archivo se sirve en
   `http://localhost:3000/games/cruce/atlas.png`.
8. **Render con sprites + tortugas sumergibles.** Ampliar `createEngine` a
   `createEngine(ctx, spriteImage)`: sustituir los `fillRect`/`arc` del core por
   `ctx.drawImage` recortado sobre `CRUCE_ATLAS` para vehículos/troncos/tortugas/criatura;
   añadir el ciclo de sumersión de tortugas (temporizador interno por grupo de tortugas,
   frame de aviso antes de sumergirse, colisión igual que "agua sin tronco" mientras están
   sumergidas). `CruceGame.tsx` precarga la imagen con el patrón de `SnakeGame.tsx`. Prueba
   manual: `npx tsc --noEmit` compila; el tablero se ve con sprites reales y las tortugas se
   sumergen con aviso visible.
9. **Bonificaciones.** Sumar el bonus de tiempo restante al alcanzar meta (`+timeLeft * 2`) y
   generar el ítem de rescate de pareja de forma ocasional en un carril de tráfico ya cruzado,
   con su propia lógica de recogida/entrega y el bonus de `+200`. Prueba manual: alcanzar meta
   con tiempo restante suma puntos extra visibles en el HUD; recoger y entregar el ítem de
   rescate suma `+200` y libera un hueco marcado de forma distinta.
10. **Récord + racha.** `engine.ts` añade `maxStreak` a `CruceEngineState` (se resetea a 0 al
    perder una vida, se incrementa en cada hueco de meta llenado). `page.tsx` pasa
    `mejorGlobal` a `JugarClient`; el modal de fin muestra "¡NUEVO RÉCORD!" cuando
    `score > mejorGlobal` y siempre "Cruces sin perder vida: N". Prueba manual: perder una
    vida resetea la racha visible en el HUD; el modal de fin muestra el badge de récord solo
    cuando corresponde. Ejecutar `npx next build` y corregir errores.

---

## Criterios de aceptación

- [ ] `public/games/cruce/atlas.png` existe y se sirve correctamente; `CRUCE_ATLAS` está
      tipado y no depende de ningún global.
- [ ] El tablero se dibuja con sprites reales (vehículos, troncos, tortugas, criatura
      jugable), no formas de color plano.
- [ ] Las tortugas muestran un frame de aviso antes de sumergirse; estar sobre ellas cuando se
      sumergen cuenta como perder una vida, igual que caer al agua sin tronco.
- [ ] Alcanzar un hueco de meta con `timeLeft > 0` suma puntos extra proporcionales al tiempo
      restante, visibles de inmediato en el HUD.
- [ ] El ítem de rescate de pareja aparece de forma ocasional, se puede recoger y entregar en
      un hueco de meta vacío, y suma `+200` puntos sobre el bonus normal de meta.
- [ ] El motor expone `maxStreak` (racha máxima de cruces consecutivos sin perder vida); se
      resetea a 0 al perder una vida.
- [ ] El modal de fin muestra "¡NUEVO RÉCORD!" solo cuando `score > mejorGlobal` (dato real de
      Supabase) y siempre "Cruces sin perder vida: N".
- [ ] `npx next build` termina sin errores ni warnings de TypeScript tras los cuatro pasos.
- [ ] El core de `01-core.md` (movimiento, colisión base, progresión de nivel, guardado de
      score) sigue funcionando exactamente igual que antes de esta ampliación.

---

## Decisiones

- **Sí:** portar sprites reales en vez de mantener el render vectorial del core. El tema del
  jam ("no convertirte en papilla") se beneficia directamente de vehículos/troncos/tortugas
  reconocibles a simple vista; SNAKE (SPEC 09) ya estableció el patrón de precarga síncrona
  para este mismo repositorio.
- **Sí:** tortugas que se sumergen como único peligro de temporización nuevo (no se añaden
  más tipos de hazard). Es la mecánica de bonus/riesgo más icónica del género y encaja con el
  aviso visual ya previsto en el atlas, sin inflar el alcance de la ampliación.
- **Sí:** bonus de tiempo y rescate de pareja como multiplicadores de puntuación opcionales,
  no obligatorios para completar una partida. Mantienen la curva de puntuación abierta sin
  cambiar la condición de victoria/derrota del core.
- **Sí:** `maxStreak` como stat de sesión mostrada en el modal de fin, sin nueva columna en
  `scores`. Mismo patrón que `maxCombo` en Tetris (SPEC 07, paso 10): SPEC 06 fijó `scores`
  como esquema mínimo, y no hay necesidad de persistir esta racha entre partidas.
- **No:** selector de skin/tema visual. El atlas de sprites ya resuelve la identidad visual
  del juego; un selector adicional no aporta valor distinto al que ya dio Tetris.

---

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| El atlas de sprites no carga a tiempo y el jugador ve el canvas en blanco                        | El paso 8 exige mostrar `CARGANDO...` desde el primer render, antes de que exista el `<img>`, mismo patrón verificado ya en SNAKE (SPEC 09).  |
| El aviso visual de sumersión de tortugas es demasiado breve para reaccionar, sintiéndose injusto | El paso 8 deja el tiempo de aviso como constante ajustable (`TURTLE_WARN_MS`); el paso de verificación manual prueba que dé margen razonable. |
| El ítem de rescate satura el tablero si aparece con demasiada frecuencia                         | El paso 9 fija un intervalo mínimo entre apariciones y un máximo de un ítem activo a la vez.                                                  |
| `maxStreak` se desincroniza del HUD tras un REINICIAR                                            | El paso 10 resetea `maxStreak` a 0 en la misma inicialización que resetea `score`/`lives`, sin depender de estado externo al motor.           |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Selector de skin/tema visual.
- Nuevas columnas en `scores` para persistir `maxStreak` — queda como stat de sesión.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
