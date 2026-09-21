# GAME JAM — RAPIDS (core): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-21
> **Objetivo:** Dar de alta `rapids` como segundo juego SHOOTER del catálogo — pilota una
> balsa en carriles fijos que desciende un río en crecida, disparando hacia adelante para
> despejar troncos del carril y esquivando rocas indestructibles, con distancia + impactos
> como score entero ascendente.

---

## Por qué existe esta spec

SHOOTER solo tiene un motor real (`asteroids`, disparo inercial vectorial en gravedad cero).
RAPIDS cubre el mismo tema del jam ("cruza [...] sin convertirte en papilla") desde un ángulo
de disparo que no existe todavía en el catálogo: en vez de disparar libremente en cualquier
dirección mientras flotas en el vacío, aquí el disparo es siempre hacia adelante y su función
no es "matar enemigos" sino **despejar el camino** — un obstáculo destruido dentro de un
carril libera el paso, uno indestructible obliga a cambiar de carril. Es la mecánica de
"selecciona bien qué destruir y qué esquivar" que
`references/game-suggestions-todo.md` reserva para RASANTE/PROFUNDIDAD (SHOOTER pendientes,
sin construir), aplicada aquí al tema del río en crecida del jam en vez de a un desfiladero o
a cargas de profundidad.

No parte de ningún prototipo — el diseño se define directamente en esta spec, igual que
SPEC 09 hizo con `snake`. Una decisión de encaje resuelta de entrada:

- **Carriles fijos, no posición libre.** A diferencia de `asteroids` (posición y rotación
  libres con inercia), la balsa solo puede ocupar uno de `LANE_COUNT = 5` carriles
  horizontales fijos; el desplazamiento lateral entre carriles es discreto (edge-triggered,
  mismo patrón que CRUCE), mientras que el avance hacia adelante es automático y continuo
  (auto-scroll) — el jugador nunca controla la velocidad de avance directamente, solo el
  carril y el disparo.

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo `games`.** `id: "rapids"`, `title: "RAPIDS"`,
  `cat: "SHOOTER"`, `color: "yellow"`, `difficulty: 4`, `best: 0`, `plays: "0"`,
  `cover: "cover-rapids"` (clase nueva).
- **Portada CSS nueva `.cover-rapids`** en el bloque de portadas de `app/globals.css`.
- **Motor de disparo en carriles**, en `components/games/rapids/engine.ts`:
  - `LANE_COUNT = 5` carriles de `LANE_W = 160`px sobre un canvas de 800×600. La balsa se fija
    verticalmente cerca de la base (`y = 520`) y solo cambia de carril (eje X), nunca de
    posición Y.
  - Auto-scroll: el mundo (obstáculos) se desplaza hacia la balsa a `SCROLL_SPEED` px/s,
    creciente con `level` (`SCROLL_SPEED = 220 + level * 15`, sin techo).
  - Dos tipos de obstáculo, generados aleatoriamente por carril con separación mínima
    garantizada entre spawns del mismo carril (para que siempre exista al menos un carril
    limpio o despejable a tiempo):
    - **Tronco** (destructible): requiere 1 impacto de bala para desaparecer.
    - **Roca** (indestructible): las balas no le hacen nada; solo se esquiva cambiando de
      carril.
  - Disparo: `Space` dispara una bala hacia adelante (arriba) en el carril actual de la balsa,
    con cooldown `FIRE_COOLDOWN_MS = 220`; la bala se destruye al impactar un tronco o al salir
    del canvas por arriba.
  - Colisión: la balsa choca contra una roca, o contra un tronco no destruido a tiempo → pierde
    una vida (`state = "dead"` un instante, respawn con 1s de invulnerabilidad) o, si era la
    última vida, `state = "gameover"`.
  - Puntuación: `+1` por cada `DISTANCE_UNIT` recorrida (acumulación continua por `dt` mientras
    `state === "playing"`, redondeada al entero más cercano para el HUD), `+15` por cada tronco
    destruido. `level` sube automáticamente cada `LEVEL_DISTANCE` unidades recorridas — sin
    techo de niveles ni de distancia.
  - `getState(): RapidsEngineState` con `distance` como campo propio (además de `score`).
  - `forceGameOver()`: mismo patrón que el resto de motores.
- **Componente canvas** `components/games/rapids/RapidsGame.tsx` (`"use client"`), clonando el
  patrón de `AsteroidsGame.tsx`: `ref` como prop, `useImperativeHandle`
  (`pause/resume/forceGameOver`), `reportIfChanged`, `onStateChangeRef`, `resume()` resetea
  `lastTimeRef.current = null`, `dt` capado a `0.05`, listeners de teclado sobre `window`
  (flechas izquierda/derecha edge-triggered para cambiar de carril, `Space` mantenido para
  disparo continuo sujeto al cooldown interno del motor), canvas 800×600 escalado por
  `aspectRatio` inline, cleanup de RAF y listeners.
- **Registro de motores.** Añadir `rapids: RapidsGame` a `REGISTRO_MOTORES` en
  `components/games/registry.ts`. `JugarClient.tsx` no necesita cambios.
- **Migración SQL** sembrando `rapids` en `games`.

**Fuera de alcance (por defecto):**

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage` (ya no aplica).
- Pantalla de administración del catálogo.
- Sonido/música.
- Power-ups, jefes de tramo, combo de destrucción, sprites reales, selector de skin (ver
  `02-ampliada.md`).
- Tests automatizados.

---

## Modelo de datos

```sql
-- supabase/migrations/<YYYYMMDDHHMMSS>_rapids.sql

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'rapids', 'RAPIDS',
  'Dispara para despejar troncos, esquiva las rocas, no te conviertas en papilla.',
  'Tu balsa desciende un río en crecida sin control sobre la velocidad: solo eliges el carril y el gatillo. Un tronco se destruye con un disparo bien colocado; una roca no perdona, hay que esquivarla. La corriente acelera sin parar.',
  'SHOOTER', 'cover-rapids', 'yellow',
  0, '0', 4
);
```

`difficulty` es `not null` **sin default** — la migración debe darlo siempre. `cat: 'SHOOTER'`
y `color: 'yellow'` ya son valores válidos por `CHECK`.

Contrato TypeScript entre el motor y el componente:

```ts
// components/games/rapids/engine.ts
export type RapidsGameState = "playing" | "dead" | "gameover";

export interface RapidsEngineState {
  score: number;
  lives: number;
  level: number;
  state: RapidsGameState;
  distance: number; // unidades recorridas, campo propio de RAPIDS
}

export interface RapidsInputState {
  laneLeft: boolean; // edge-triggered, cambia un carril a la izquierda
  laneRight: boolean; // edge-triggered, cambia un carril a la derecha
  fire: boolean; // mantenido; el motor aplica su propio cooldown
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* ... */
  return { update, draw, getState, forceGameOver };
}
export type RapidsEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/rapids/RapidsGame.tsx
export interface RapidsGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}
interface RapidsGameProps {
  onStateChange: (state: RapidsEngineState) => void;
  ref?: Ref<RapidsGameHandle>; // React 19: ref como prop, sin forwardRef
}
```

`RapidsEngineState` reporta `distance` extra que `RealGameProps.onStateChange` no tipa —
mismo patrón que `lines` en `TetrisEngineState` (SPEC 07): el HUD del reproductor lo lee de
forma específica cuando `game.id === "rapids"`.

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Migración SQL.** Crear `supabase/migrations/<YYYYMMDDHHMMSS>_rapids.sql` con el `insert`
   de la sección anterior. Aplicar con `apply_migration` del MCP de Supabase. Prueba manual:
   `list_tables` muestra la fila `rapids` en `games`; `get_advisors` no reporta RLS
   deshabilitada.
2. **Portada CSS.** `.cover-rapids` nueva en `app/globals.css`, convención `cover-bg` base +
   detalle en `::after` + glifo en `::before` + `filter: drop-shadow(...)` con `--yellow`.
   Prueba manual: `/biblioteca` muestra la portada nueva sin romper el resto de tarjetas.
3. **Motor.** Crear `components/games/rapids/engine.ts`: 5 carriles fijos, auto-scroll
   continuo con velocidad creciente por nivel, dos tipos de obstáculo (tronco
   destructible/roca indestructible) con separación mínima garantizada por carril, disparo con
   cooldown, colisión con invulnerabilidad post-respawn, puntuación por distancia continua +
   impactos, progresión de nivel indefinida por distancia. Render 100% vectorial
   (`fillRect`/`arc` para balsa, troncos, rocas, balas). Sin `window`/`document`/`canvas` a
   nivel de módulo. Prueba manual: `npx tsc --noEmit` compila.
4. **Componente canvas.** Crear `components/games/rapids/RapidsGame.tsx` (`"use client"`),
   clonando `AsteroidsGame.tsx` en sus puntos load-bearing, con cambio de carril
   edge-triggered y disparo mantenido sujeto al cooldown interno del motor. Prueba manual:
   montar el componente muestra la balsa avanzando sola, obstáculos entrando desde arriba,
   cambio de carril y disparo funcionando.
5. **Registro de motores.** Añadir `rapids: RapidsGame as ComponentType<RealGameProps>` a
   `REGISTRO_MOTORES` en `components/games/registry.ts`. `JugarClient.tsx` no se toca. Prueba
   manual: `npx tsc --noEmit` compila; el resto de motores reales sigue funcionando igual.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/rapids/jugar`: HUD
   React (Puntuación/Vidas/Nivel) en tiempo real más `distance`, PAUSA congela el canvas
   (incluido el auto-scroll), REANUDAR retoma sin salto de tiempo, destruir un tronco libera el
   carril y suma puntos, chocar contra una roca o un tronco no destruido resta una vida con
   invulnerabilidad breve al respawnear, la velocidad de avance sube con el nivel de forma
   indefinida, perder la última vida abre el modal de fin con el score real, `GUARDAR
PUNTUACIÓN` inserta en `scores` vía la Server Action existente. Confirmar que `/juego/rapids`
   (mini-tabla) y `/salon` (tab `rapids`) reflejan esa fila tras recargar. Confirmar que el
   resto de motores reales no cambia su comportamiento. Ejecutar `npx next build` y corregir
   errores. Si `next dev` reescribió el bloque `nextjs-agent-rules` de `AGENTS.md`, incluirlo
   en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `rapids` en `games` con
      `difficulty = 4` explícita; `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra una tarjeta nueva "RAPIDS" con la portada `.cover-rapids`.
- [ ] `components/games/rapids/engine.ts` no referencia `window`, `document` ni `canvas` a
      nivel de módulo, y no carga ninguna imagen — render 100% vectorial.
- [ ] `/juego/rapids/jugar` muestra el juego real jugable con las flechas (cambio de carril,
      edge-triggered) y `Space` (disparo, con cooldown); el HUD React refleja
      Puntuación/Vidas/Nivel/`distance` en tiempo real.
- [ ] Un tronco requiere exactamente un impacto para desaparecer y liberar el carril; una roca
      es indestructible incluso tras varios impactos.
- [ ] Chocar contra una roca o un tronco no destruido a tiempo resta una vida y otorga un
      breve periodo de invulnerabilidad tras el respawn (salvo en la última vida, que abre el
      modal de fin).
- [ ] La velocidad de auto-scroll sube con el nivel de forma indefinida, sin techo.
- [ ] PAUSA congela el canvas (incluido el auto-scroll y los proyectiles en vuelo); REANUDAR
      retoma sin salto de tiempo.
- [ ] `GUARDAR PUNTUACIÓN` inserta en `scores` vía la Server Action existente; la fila aparece
      en `/juego/rapids` y en `/salon` (tab `rapids`) tras recargar.
- [ ] El resto de motores reales sigue comportándose exactamente igual que antes de esta spec.
- [ ] `components/games/registry.ts` incluye `rapids` en `REGISTRO_MOTORES`; `JugarClient.tsx`
      no cambia.

---

## Decisiones

- **Sí:** `id: "rapids"` (nombre en inglés, siguiendo la convención real de
  `asteroids`/`tetris`/`arkanoid`/`snake`). "Rapids" (rápidos de río) describe con precisión
  el escenario sin necesitar traducción forzada.
- **Sí:** `cat: "SHOOTER"`, `color: "yellow"`, `difficulty: 4`. Segundo SHOOTER del catálogo,
  cubre un hueco real; `yellow` no coincide con `cyan` (CRUCE) ni `magenta` (GRIDLOCK) dentro
  de esta misma terna; dificultad alta por la combinación de decisión rápida
  (destruir/esquivar) bajo velocidad creciente sin techo.
- **Sí:** carriles fijos + auto-scroll, en vez de posición libre con inercia (como
  `asteroids`). Es la diferencia estructural clave frente al único SHOOTER ya portado; el
  disparo deja de ser "eliminar amenazas" y pasa a ser "seleccionar qué destruir para abrir
  paso", una decisión táctica distinta.
- **Sí:** dos tipos de obstáculo con roles opuestos (destructible vs. indestructible) en vez
  de un solo tipo de obstáculo. Sin esa distinción, el disparo sería opcional/decorativo (todo
  se podría esquivar); con ella, el jugador debe decidir activamente en cada carril.
- **Sí:** invulnerabilidad breve post-respawn. Sin ella, chocar contra un obstáculo que sigue
  en pantalla justo tras respawnear (por el auto-scroll continuo) sería una pérdida de vida en
  cadena injusta.
- **No:** control de velocidad de avance por el jugador. Mantiene la tensión central (la
  corriente no espera) y evita que el juego se resuelva "yendo despacio", que aplanaría la
  dificultad.
- **No:** power-ups, jefes de tramo, combo de destrucción ni sprites reales en el core — ver
  `02-ampliada.md`.

---

## Riesgos

| Riesgo                                                                                                    | Mitigación                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La generación aleatoria de obstáculos crea un tramo sin ningún carril despejable a tiempo                 | El paso 3 fija una separación mínima garantizada entre spawns por carril y asegura que al menos un carril quede libre o despejable con el cooldown de disparo actual. |
| El `SCROLL_SPEED` sin techo vuelve el juego injugable en sesiones muy largas                              | Aceptado como diseño (igual que la velocidad creciente de Tetris/Arkanoid); el paso 6 verifica que el ritmo de subida sea gradual, no un salto brusco por nivel.      |
| La invulnerabilidad post-respawn se solapa con el disparo y permite "tanquear" obstáculos indefinidamente | El paso 3 limita la invulnerabilidad a colisión únicamente (1s fijo), sin afectar al cooldown de disparo ni a la puntuación por distancia.                            |
| `requestAnimationFrame` sigue corriendo tras desmontar la página                                          | El `useEffect` de `RapidsGame` cancela el frame pendiente y limpia listeners en su función de limpieza (mismo patrón que `AsteroidsGame`).                            |
| El campo extra `distance` no encaja limpiamente en el tipo genérico del registro                          | El registro tipa el caso común (`score`/`lives`/`level`/`state`); `JugarClient.tsx` lee `distance` de forma específica para `game.id === "rapids"`.                   |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Power-ups, jefes de tramo, combo de destrucción, sprites reales, selector de skin.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec o en `02-ampliada.md`.
