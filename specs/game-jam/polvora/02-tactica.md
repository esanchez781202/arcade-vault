# GAME JAM — PÓLVORA TÁCTICA (variante por turnos): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-10-08
> **Objetivo:** Dar de alta `polvora-tactica`, una variante de PÓLVORA donde el mundo solo avanza cuando el jugador actúa: mechas que cuentan turnos, bots de tres tipos que telegrafían su próximo movimiento y cadenas planificadas como un puzle, con oleadas infinitas y score entero ascendente.

---

## Por qué existe esta spec

`references/game-suggestions-todo.md` describe PÓLVORA (`polvora`, Pendientes → VERSUS) como
"bombas **por turnos** en grilla destructible con bots". `01-clasico.md`, en este mismo
directorio, lo resuelve como arena en tiempo real (reflejos, bots que piensan cada X ms). Esta
spec toma la otra lectura de la descripción y la convierte en una **variante jugable distinta**,
no en una ampliación:

- **El reloj es el jugador.** Cada pulsación (mover, plantar, esperar) es un turno; entre
  turnos no pasa nada. No hay reflejos que entrenar: hay información perfecta que leer.
- **Los bots enseñan sus cartas.** Cada bot muestra sobre sí la intención que ejecutará en el
  próximo turno (flecha, icono de bomba o punto de espera). El juego pasa de "esquivar" a
  **tender trampas**: predecir dónde estará cada bot y hacer que una cadena le llegue justo ahí.
- **Tres tipos de bot** con reglas distintas (`rondador`, `cazador`, `artificiero`) que se
  introducen por oleadas — el eje que la variante clásica deja fuera a propósito.
- **Presión por turnos, no por segundos.** Cada oleada tiene un límite de turnos; superarlo
  arranca el derrumbe (dos celdas por turno) y lo que sobra se cobra como bonus.

Ninguna de las dos variantes depende de la otra. Si el usuario aprueba ambas, conviven como
dos entradas de catálogo con leaderboards separados (sus puntuaciones no son comparables); si
aprueba solo esta, sigue llevando su propio `id` para no bloquear una futura variante clásica.

No parte de ningún prototipo — el diseño se define aquí, igual que SPEC 09 con `snake`.
Decisiones de encaje (detalle en `## Decisiones`):

- **Contrato de tiempo real sobre un juego por turnos.** El reproductor espera un bucle
  `requestAnimationFrame` con `update(dt)`. Se conserva: `update(dt, input)` solo anima (deslizar
  actores `TURN_ANIM_S`, llamas, banners) y, cuando no hay animación en curso y llega una acción
  válida, resuelve un turno completo de forma síncrona. PAUSA sigue funcionando igual.
- **Marco CRT 4/3.** Misma arena 15×11 de 48px que la variante clásica, letterbox 40/36px en el
  canvas 800×600; la franja superior muestra `TURNO n/límite` y bots vivos por tipo.
- **Score ascendente en un juego sin tiempo.** Pensar más no da ni quita puntos; solo las
  acciones del jugador suman (bloques, bajas en cadena, oleadas y turnos sobrantes). Esperar
  indefinidamente no es un exploit: el score no crece y el límite de turnos solo avanza al
  actuar, pero tampoco se puede superar la oleada sin actuar.

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo `games`.** `id: "polvora-tactica"`, `title: "PÓLVORA TÁCTICA"`,
  `cat: "VERSUS"`, `color: "cyan"`, `difficulty: 4`, `best: 0`, `plays: "0"`,
  `cover: "cover-polvora-tactica"` (clase nueva).
- **Portada CSS nueva `.cover-polvora-tactica`** en el bloque de portadas de `app/globals.css`:
  `.cover-bg` base + rejilla de casillas en `::after` + glifo de bomba con un dígito "3" de
  cuenta atrás y una flecha de intención en `::before` + `drop-shadow` con `--cyan`.
- **Motor por turnos**, `components/games/polvora-tactica/engine.ts`, sin `window`/`document`/
  `canvas` a nivel de módulo:
  - **Arena.** `COLS = 15`, `ROWS = 11`, `CELL = 48`; anillo de muro, pilares en `x`/`y` pares,
    bloques destructibles con probabilidad `blockDensity(wave)` salvo zonas seguras en "L" de
    cada spawn; power-ups ocultos (`POWERUP_CHANCE = 0.22`): `fuego` (+1 `range`, máx. 6) y
    `bomba` (+1 `maxBombs`, máx. 5), persistentes entre oleadas y reseteados al morir
    (`range = 2`, `maxBombs = 1`). Spawns: jugador en `(1,1)`; bots, en este orden, en
    `(13,1)`, `(1,9)`, `(13,9)`, `(7,1)`, `(7,9)`, `(13,5)`, `(7,5)` (todas con `x`/`y` impares,
    nunca pilar; siete puntos para el máximo de siete bots). Los `cazador`/`artificiero` ocupan
    primero los spawns más alejados de `(1,1)`.
  - **Acciones del jugador** (una por turno): mover una celda (flechas), plantar bomba en la
    celda actual (`Espacio`), esperar (`Z`). Una acción **inválida no consume turno**: moverse
    contra muro/pilar/bloque/bomba/bot, plantar con `maxBombs` alcanzado o sobre otra bomba.
  - **Orden de resolución de un turno** (fijo, documentado en el código):
    1. Se aplica la acción del jugador. Si pisa un power-up, lo recoge.
    2. Cada bot vivo ejecuta la intención que mostraba, en orden de índice. Si su celda
       destino quedó bloqueada (por una bomba nueva o por otro bot que ya se movió ahí),
       espera. Si su destino es la celda del jugador, el jugador muere (**contacto**).
    3. Todas las mechas bajan en 1. Las que llegan a 0 explotan; las cadenas se resuelven en
       el mismo turno por cola (BFS), con propagación en cruz hasta `range`, detenida en
       muro/pilar, destruyendo el primer bloque, y detonando bombas tocadas. Cada explosión
       hereda el `owner` de la primera bomba de su cadena. El daño es instantáneo: todo actor
       no invulnerable en una celda alcanzada muere.
    4. Se calculan y muestran las intenciones de los bots supervivientes para el turno
       siguiente.
    5. `turn += 1`; si `turn > turnLimit(wave)`, avanza el derrumbe dos celdas en espiral
       (actor, bomba o power-up en esas celdas desaparece; actor aplastado = muerte sin
       puntos).
  - **Mecha.** `FUSE_TURNS = 3`: la bomba muestra 3 al plantarse, baja en el paso 3 de ese
    mismo turno y explota al final del tercer turno contando el de plantado — el jugador
    dispone exactamente de **dos acciones** para ponerse a salvo. El dígito se dibuja sobre la
    bomba.
  - **Telegrafía de peligro.** Las celdas que explotarán al final del próximo turno (bombas con
    mecha 1, incluidas las que caerán por cadena) se tiñen con `entities.peligro`. Información
    perfecta: nada explota sin haberse avisado un turno antes.
  - **Bots** (rol VERSUS), tres tipos con forma y regla propias:
    - `rondador` (círculo): sigue recto; en un cruce o bloqueado elige al azar una dirección
      libre; nunca planta y **no evita el peligro** — carne de cadena.
    - `cazador` (triángulo orientado): un paso BFS hacia el jugador evitando terminar en celdas
      teñidas de peligro; si su celda actual está en la cruz de una bomba con mecha ≤ 2, huye
      a la celda segura más cercana.
    - `artificiero` (cuadrado con mecha): si el jugador está alineado sin obstáculos dentro de
      su `range` y existe un escape alcanzable en ≤ 2 movimientos, planta (`FUSE_TURNS` igual
      que el jugador); si no, se comporta como `cazador` pero manteniendo distancia 2-3. Nunca
      planta sin escape.
    - Composición por oleada (`composicion(wave)`, ver Modelo de datos): siempre al menos un
      `rondador`; `cazador` desde la oleada 3; `artificiero` desde la 5; total máx. 7.
  - **Oleada.** Termina al morir todos los bots: banner `OLEADA N SUPERADA` en canvas durante
    `WAVE_CLEAR_S = 1.5` (tiempo real, sin aceptar acciones), `level += 1`, arena nueva,
    `turn = 1`.
  - **Puntuación** (entero ascendente, nunca resta), solo por acciones del jugador:
    `+10` por bloque destruido por sus llamas, `+50` por power-up recogido,
    `100 × wave × cadena` por bot eliminado por explosiones de su autoría (`cadena` = bots que
    caen por explosiones del jugador en ese mismo turno), `300 × wave + 10 × turnosSobrantes`
    al superar la oleada (`turnosSobrantes = max(0, turnLimit − turn)`). Bots muertos por
    cadenas sin autoría del jugador o por el derrumbe: `0`.
  - **Vidas y estados.** `START_LIVES = 3`. Al morir: `lives -= 1`; con `lives === 0`,
    `state = "gameover"`; si no, `state = "dead"` durante `DEATH_S = 1.2` (tiempo real,
    acciones ignoradas), después se limpian bombas, los bots vuelven a sus spawns con
    intenciones recalculadas, el jugador reaparece en `(1,1)` con `INVULN_TURNS = 2` turnos de
    invulnerabilidad y `state = "playing"`. El contador de turnos **no** se reinicia (la
    presión del límite se mantiene).
  - **Animación.** Cada turno se anima `TURN_ANIM_S = 0.14` (actores se deslizan, llamas
    destellan `FLAME_VIS_S = 0.3`). Durante la animación se acepta **una** acción en búfer,
    que se resuelve al terminar; el resto se descarta.
  - **Render 100% vectorial** desde `POLVORA_TACTICA_SKINS.clasico`; fondo (muros, pilares)
    precocinado en un canvas auxiliar creado dentro de `createEngine`, repintado solo al
    generar oleada o al avanzar el derrumbe (patrón SPEC 12); `getState()` devuelve un objeto
    reutilizado.
- **Paleta** `components/games/polvora-tactica/skins.ts` con `clasico` (los `retro`/`neon` los
  añade `skin-designer` tras `/spec-impl-game`).
- **Componente canvas** `components/games/polvora-tactica/PolvoraTacticaGame.tsx`
  (`"use client"`), patrón `AsteroidsGame.tsx` (ver paso 4), con entrada **edge-triggered**.
- **Registro de motores.** Entrada `"polvora-tactica"` con `skins: []`. `JugarClient.tsx` no se
  toca.
- **Migración SQL** sembrando `polvora-tactica` en `games`.

**Casos límite del motor (todos dentro de alcance):**

- El jugador se mueve a la celda destino telegrafiada de un bot: muere por contacto en el paso
  2 (la intención estaba a la vista). Moverse a la celda **actual** de un bot es acción
  inválida y no consume turno.
- Dos bots con el mismo destino: el de menor índice se mueve, el otro espera (y su intención
  se recalcula en el paso 4 como cualquier otra).
- El jugador muere en el mismo turno en que cae el último bot: puntos de bajas y de oleada
  primero, después la vida. Con vidas restantes reaparece ya en la oleada siguiente.
- Un bot planta y en el mismo turno su bomba entra en una cadena del jugador: explota con
  autoría del jugador (la autoría la fija la primera bomba de la cadena, no el dueño de cada
  bomba).
- Bomba con mecha 1 dentro de la cruz de otra que explota este turno: explota en este turno
  (cadena), no en el siguiente; la telegrafía de peligro ya la incluía.
- Una tecla mantenida no repite turnos: se ignora `KeyboardEvent.repeat`. Pulsar dos teclas
  durante una animación: solo la primera entra al búfer.
- PAUSA durante una animación: la animación se congela y el búfer se conserva; REANUDAR la
  completa sin saltos (`lastTimeRef = null`).
- El derrumbe alcanza la celda de un bot `rondador` con intención de moverse ahí: el bot muere
  aplastado en el paso 5 del turno en que se cierra, sin puntos.
- Si el derrumbe ha cerrado `(1,1)`, el respawn usa la celda interior libre más cercana.
- `forceGameOver()` en cualquier subfase (animación, `"dead"`, banner) pasa a `"gameover"`.

**Fuera de alcance (por defecto, salvo que el usuario pida lo contrario):**

- Controles táctiles/móviles (sin entrada en `TOUCH_CONFIG`).
- Deshacer turno, previsualización de la cruz de una bomba antes de plantarla o semilla de
  arena fija/compartible.
- Power-ups adicionales y tipos de bot más allá de los tres descritos.
- Modo 2P (por turnos alternos o en el mismo teclado).
- Compartir código con `components/games/polvora/` (ver Decisiones).
- Skins `retro`/`neon`.
- Tecla `P`/`Esc` de pausa.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage` (ya no aplica; SPEC 06 retiró ese mecanismo).
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites raster.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Fila de siembra para `games`:

```sql
-- supabase/migrations/<YYYYMMDDHHMMSS>_polvora_tactica.sql

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'polvora-tactica', 'PÓLVORA TÁCTICA',
  'Cada paso es un turno: lee al enemigo y cierra la trampa.',
  'El mundo solo se mueve cuando tú te mueves. Las mechas cuentan turnos y cada bot anuncia su próximo paso: rondadores despistados, cazadores que te persiguen y artificieros que plantan sus propias bombas. Planifica cadenas que los alcancen justo donde van a estar antes de que el límite de turnos derrumbe la arena.',
  'VERSUS', 'cover-polvora-tactica', 'cyan',
  0, '0', 4
);
```

`difficulty` es `not null` **sin default** — la migración debe darlo siempre (ver
`supabase/migrations/20260914100000_games_difficulty.sql`). `cat: 'VERSUS'` y `color: 'cyan'`
ya son valores válidos por `CHECK`. El `id` con guion (`polvora-tactica`) es un slug válido:
`games.id` es `text` y las rutas `/juego/[id]` lo reciben tal cual.

Constantes del motor (`components/games/polvora-tactica/engine.ts`, internas al módulo):

```ts
const CANVAS_W = 800;
const CANVAS_H = 600;
const COLS = 15;
const ROWS = 11;
const CELL = 48;
const BOARD_W = COLS * CELL; // 720
const BOARD_H = ROWS * CELL; // 528
const OFFSET_X = (CANVAS_W - BOARD_W) / 2; // 40
const OFFSET_Y = (CANVAS_H - BOARD_H) / 2; // 36 — franja superior = TURNO n/límite + bots por tipo

const START_LIVES = 3;
const BASE_RANGE = 2;
const MAX_RANGE = 6;
const BASE_BOMBS = 1;
const MAX_BOMBS = 5;
const FUSE_TURNS = 3;
const POWERUP_CHANCE = 0.22;
const INVULN_TURNS = 2;
const DERRUMBE_CELLS_PER_TURN = 2;

const TURN_ANIM_S = 0.14; // tiempo real
const FLAME_VIS_S = 0.3; // tiempo real, solo visual
const DEATH_S = 1.2; // tiempo real
const WAVE_CLEAR_S = 1.5; // tiempo real

const SCORE_BLOCK = 10;
const SCORE_POWERUP = 50;
const SCORE_BOT = 100; // × wave × cadena
const SCORE_WAVE = 300; // × wave
const SCORE_TURN_BONUS = 10; // × turnos sobrantes

const blockDensity = (w: number) => Math.min(0.55 + 0.02 * (w - 1), 0.7);
const botTotal = (w: number) => Math.min(3 + Math.floor((w - 1) / 2), 7);
const turnLimit = (w: number) => 40 + 6 * botTotal(w);
const botRange = (w: number) => Math.min(2 + Math.floor((w - 1) / 4), 4);

/** Siempre deja al menos un rondador. */
function composicion(w: number): { rondador: number; cazador: number; artificiero: number } {
  const total = botTotal(w);
  const artificiero = w >= 5 ? Math.min(1 + Math.floor((w - 5) / 3), 2) : 0;
  const cazador = w >= 3 ? Math.min(1 + Math.floor((w - 3) / 2), total - 1 - artificiero) : 0;
  return { rondador: total - cazador - artificiero, cazador, artificiero };
}
```

Composición resultante (referencia para la prueba manual del paso 6):

| Oleada | Total | Rondador | Cazador | Artificiero | Límite de turnos |
| ------ | ----- | -------- | ------- | ----------- | ---------------- |
| 1-2    | 3     | 3        | 0       | 0           | 58               |
| 3-4    | 4     | 3        | 1       | 0           | 64               |
| 5-6    | 5     | 2        | 2       | 1           | 70               |
| 7      | 6     | 2        | 3       | 1           | 76               |
| 8      | 6     | 1        | 3       | 2           | 76               |
| 9-10   | 7     | 1        | 4       | 2           | 82               |
| 11+    | 7     | 1        | 4       | 2           | 82               |

Contrato TypeScript entre el motor y el componente:

```ts
// components/games/polvora-tactica/engine.ts
import type { SkinBaseId } from "../skins";

export type PolvoraTacticaGameState = "playing" | "dead" | "gameover";
export type Dir = "up" | "down" | "left" | "right";
export type BotKind = "rondador" | "cazador" | "artificiero";

export type TurnAction = { type: "move"; dir: Dir } | { type: "bomb" } | { type: "wait" };

export interface PolvoraTacticaEngineState {
  score: number;
  lives: number;
  level: number; // = oleada actual
  state: PolvoraTacticaGameState;
}

export interface PolvoraTacticaInputState {
  /** Edge-triggered: la acción pulsada desde el último update(), o null. update() la consume
   *  (la resuelve o la guarda en el búfer de 1 si hay animación en curso). */
  action: TurnAction | null;
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* arena, turnos, intenciones de bots, mechas, cadenas, derrumbe; fondo precocinado en un
     canvas auxiliar creado aquí dentro, nunca a nivel de módulo */
  return { update, draw, getState, forceGameOver, setSkin };
}
// update(dt: number, input: PolvoraTacticaInputState): void — anima; resuelve un turno si toca
// draw(): void
// getState(): PolvoraTacticaEngineState — mismo objeto reutilizado
// forceGameOver(): void
// setSkin(skin: SkinBaseId): void — cae a "clasico" si el id no existe; repinta el fondo
export type PolvoraTacticaEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/polvora-tactica/skins.ts
import type { SkinSet } from "../skins";

export type PolvoraTacticaRole =
  | "muro"
  | "pilar"
  | "bloque"
  | "bloqueBorde"
  | "bomba"
  | "mechaDigito"
  | "llama"
  | "llamaNucleo"
  | "peligro"
  | "jugador"
  | "rondador"
  | "cazador"
  | "artificiero"
  | "intencion"
  | "powerFuego"
  | "powerBomba"
  | "derrumbe";

export const POLVORA_TACTICA_SKINS: SkinSet<"clasico", PolvoraTacticaRole> = {
  clasico: {
    bg: "#000000",
    grid: "#11161c", // rejilla sutil: en un juego por turnos la casilla tiene que leerse
    ink: "#ffffff",
    inkDim: "#9aa0a6",
    accent: "#3ee6ff", // jugador — cian del catálogo
    danger: "#e04b4b",
    hud: "#ffffff",
    glow: null,
    entities: {
      muro: "#2b2f3a",
      pilar: "#3a3f4b",
      bloque: "#8a5a2b",
      bloqueBorde: "#b07a3f",
      bomba: "#1a1a1a",
      mechaDigito: "#ffd23f",
      llama: "#ff7a1a",
      llamaNucleo: "#fff3b0",
      peligro: "rgba(255, 90, 40, 0.28)",
      jugador: "#3ee6ff",
      rondador: "#9be15d",
      cazador: "#ff3ea5",
      artificiero: "#ffb000",
      intencion: "#ffffff",
      powerFuego: "#ff7a1a",
      powerBomba: "#39c6ff",
      derrumbe: "#5a5f6b",
    },
  },
};
export const POLVORA_TACTICA_SKIN_IDS = Object.keys(POLVORA_TACTICA_SKINS) as readonly "clasico"[];
```

```ts
// components/games/polvora-tactica/PolvoraTacticaGame.tsx
import type { SkinId } from "../skins";

export interface PolvoraTacticaGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  setSkin(skin: SkinId): void; // obligatorio por RealGameHandle
}
interface PolvoraTacticaGameProps {
  onStateChange: (state: PolvoraTacticaEngineState) => void;
  ref?: Ref<PolvoraTacticaGameHandle>; // React 19: ref como prop, sin forwardRef
}
```

```ts
// components/games/registry.ts — entrada nueva
"polvora-tactica": {
  component: PolvoraTacticaGame as ComponentType<RealGameProps>,
  skins: [],
},
```

Sin campos fuera del contrato base: Nivel = oleada en el HUD React; turno y bots por tipo van
en la franja superior del canvas. `JugarClient.tsx` no necesita ramas por `game.id`.

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Migración SQL.** Crear `supabase/migrations/<YYYYMMDDHHMMSS>_polvora_tactica.sql` con el
   `insert` de la sección anterior, literal. Aplicar con `apply_migration` del MCP de Supabase.
   Prueba manual: `list_tables` muestra la fila `polvora-tactica`; `get_advisors` no reporta
   RLS deshabilitada.
2. **Portada CSS.** `.cover-polvora-tactica` nueva en el bloque de portadas de
   `app/globals.css` (`.cover-bg` + `::after` rejilla + `::before` bomba con dígito y flecha +
   `drop-shadow` con `--cyan`). Prueba manual: `/biblioteca` muestra la tarjeta "PÓLVORA
   TÁCTICA" sin CSS roto en otras tarjetas; el chip VERSUS la incluye.
3. **Motor + paleta.** Crear `components/games/polvora-tactica/skins.ts` y
   `components/games/polvora-tactica/engine.ts`: generador de arena, `resolveTurn(action)` con
   los cinco pasos en el orden fijo de `## Alcance`, propagación de cadenas por cola con
   autoría, cálculo de intenciones por tipo de bot (BFS para `cazador`/`artificiero`, con
   simulación de la telegrafía de peligro), `composicion(wave)`, límite de turnos y derrumbe,
   puntuación, vidas/estados, búfer de una acción durante la animación y todos los casos
   límite. `draw()`: fondo precocinado, bloques en un único path, tinte de peligro, dígitos de
   mecha, intenciones (flecha/bomba/punto) sobre cada bot, formas por tipo, franja superior
   `TURNO n/límite` + bots por tipo. Sin `window`/`document`/`canvas` a nivel de módulo. Prueba
   manual: `npx tsc --noEmit` compila.
4. **Componente canvas.** `components/games/polvora-tactica/PolvoraTacticaGame.tsx`
   (`"use client"`), clonando `AsteroidsGame.tsx` en sus puntos load-bearing (`ref` como prop,
   `useImperativeHandle` con `pause/resume/forceGameOver/setSkin`, `reportIfChanged`,
   `onStateChangeRef`, `resume()` resetea `lastTimeRef.current = null`, `dt` capado a `0.05`,
   canvas 800×600 con `aspectRatio: "800 / 600"`, cleanup de RAF y listeners). Diferencia:
   solo `keydown` sobre `window`, que traduce flechas/`Espacio`/`KeyZ` a una `TurnAction` en un
   ref (ignorando `e.repeat`) que el bucle pasa a `update()` y vacía; `preventDefault` de esas
   teclas solo mientras `state !== "gameover"` y el juego no está en pausa. Prueba manual:
   montar el componente muestra la arena quieta hasta la primera pulsación; cada pulsación
   avanza exactamente un turno.
5. **Registro de motores.** Añadir la entrada `"polvora-tactica"` (ver Modelo de datos) a
   `REGISTRO_MOTORES`. `JugarClient.tsx` no se toca. Prueba manual: `npx tsc --noEmit` compila;
   los cinco motores reales existentes (y `polvora`, si ya existe) siguen igual.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/polvora-tactica/jugar`:
   - Nada se mueve sin pulsar; una acción inválida (contra un pilar) no avanza `TURNO`.
   - Una bomba muestra 3 → 2 → 1 y explota al final del tercer turno; dos acciones bastan
     para salir de su cruz doblando una esquina.
   - Las celdas teñidas de peligro coinciden exactamente con las que explotan al turno
     siguiente, incluidas las de cadena.
   - Cada bot ejecuta la intención que mostraba (salvo bloqueo → espera); un `rondador` entra
     en una cruz teñida, un `cazador` no.
   - Una cadena del jugador que alcanza a una bomba de `artificiero` y mata a dos bots suma
     `2 × 100 × wave × 2`.
   - Llegar a la oleada 5 y ver la composición de la tabla del Modelo de datos.
   - Superar el límite de turnos arranca el derrumbe (dos celdas por turno).
   - Morir pasa por `"dead"`, reaparece con 2 turnos de invulnerabilidad sin reiniciar el
     contador de turnos; perder la última vida (o FIN) abre el modal con el score real.
   - PAUSA congela animación y búfer; REANUDAR completa la animación sin saltos.
   - `GUARDAR PUNTUACIÓN` inserta en `scores` vía `guardarScoreAction`; la fila aparece en
     `/juego/polvora-tactica` y en `/salon` (tab PÓLVORA TÁCTICA) tras recargar.
   - Overlay de FPS (1440×900, skin `clasico`, 30s pulsando continuamente): ≥ 58 FPS medio,
     p95 ≤ 20ms.
   - `npx next build` sin errores. Si `next dev` reescribió el bloque `nextjs-agent-rules` de
     `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `polvora-tactica` en `games`
      con `difficulty = 4` explícita; `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra la tarjeta "PÓLVORA TÁCTICA" con la portada
      `.cover-polvora-tactica` dentro del chip VERSUS.
- [ ] `components/games/polvora-tactica/engine.ts` no referencia `window`, `document` ni
      `canvas` a nivel de módulo y no carga imágenes.
- [ ] El juego solo avanza con acciones del jugador (flechas, Espacio, Z); las acciones
      inválidas no consumen turno; las teclas mantenidas no repiten turnos.
- [ ] Las mechas cuentan `FUSE_TURNS = 3` turnos visibles y las cadenas se resuelven en el
      mismo turno con autoría de la primera bomba.
- [ ] La telegrafía de peligro y las intenciones de los bots son exactas: lo que se muestra es
      lo que ocurre en el turno siguiente (salvo bloqueo → espera).
- [ ] Los tres tipos de bot se distinguen en forma y comportamiento y aparecen según
      `composicion(wave)`.
- [ ] El límite de turnos por oleada arranca el derrumbe; los turnos sobrantes se cobran como
      bonus al superar la oleada.
- [ ] La puntuación solo crece y solo por acciones del jugador.
- [ ] Morir pasa por `"dead"` y reaparece con invulnerabilidad de 2 turnos; perder la última
      vida (o FIN) abre el modal de fin con el score real.
- [ ] PAUSA congela el canvas; REANUDAR retoma sin salto.
- [ ] `GUARDAR PUNTUACIÓN` inserta en `scores`; la fila aparece en `/juego/polvora-tactica` y
      en `/salon` tras recargar.
- [ ] Rendimiento en desktop 1440×900, skin `clasico`: ≥ 58 FPS medio y p95 ≤ 20ms en 30s.
- [ ] `components/games/registry.ts` incluye `"polvora-tactica"` con `skins: []`;
      `JugarClient.tsx` no cambia; el resto de motores reales se comporta igual.

---

## Decisiones

- **Sí:** variante por turnos como **juego de catálogo propio** (`id: "polvora-tactica"`), no
  como modo dentro de `polvora`. Sus puntuaciones no son comparables con las de la arena en
  tiempo real (sin reloj, otra fórmula de oleada); mezclarlas en una misma tabla de `scores`
  haría injusto el Salón de la Fama, y `scores` no tiene columna de modo.
- **Sí:** `cat: "VERSUS"`, `color: "cyan"`, `difficulty: 4`. `cyan` la distingue de `polvora`
  (`yellow`) si ambas conviven; dificultad 4 porque cada error es irreversible con información
  perfecta y oleadas altas exigen planificar cadenas de varios turnos contra cazadores y
  artificieros.
- **Sí:** mantener el bucle `requestAnimationFrame` + `update(dt)` aunque el juego sea por
  turnos. Respeta el contrato del reproductor sin excepciones (PAUSA, `forceGameOver`, HUD por
  `onStateChange`) y da animaciones suaves entre turnos.
- **Sí:** acción inválida = sin coste de turno. En un juego de información perfecta, perder un
  turno por un choque contra un pilar sería castigar una tecla, no una decisión.
- **Sí:** intenciones de bots y peligro telegrafiados un turno antes, y bots que ejecutan
  exactamente lo telegrafiado. Es el núcleo de la variante: convierte esquivar en tender
  trampas.
- **Sí:** el contacto mata también si el jugador entra en la celda destino anunciada de un bot.
  La información estaba en pantalla; sin esta regla, los bots no podrían cerrar nunca.
- **Sí:** tres tipos de bot introducidos por oleadas y `rondador` que no evita el peligro. Da
  objetivos fáciles para aprender a encadenar y rivales que castigan al que no planifica.
- **Sí:** límite de turnos + derrumbe de dos celdas por turno, y turnos sobrantes como bonus.
  Sustituye al reloj de la variante clásica sin introducir tiempo real en la decisión.
- **Sí:** contador de turnos que no se reinicia al morir. Si se reiniciara, morir regalaría
  turnos de bonus.
- **Sí:** `FUSE_TURNS = 3` (dos acciones de escape). Con `range = 2` siempre hay salida
  doblando una esquina desde una zona segura en "L"; con 2 no la habría en pasillos.
- **Sí:** paleta `clasico` en `skins.ts` desde el primer día y `skins: []` en el registro,
  mismo criterio que `01-clasico.md`.
- **No:** compartir módulo (`arena.ts`, propagación) con `components/games/polvora/`. Cada
  spec de este directorio debe poder implementarse sola; si se aprueban las dos, extraer lo
  común es una spec de refactor posterior.
- **No:** deshacer turno, previsualizar la cruz antes de plantar ni semilla fija. Harían el
  juego más puzle que versus y aplanarían el leaderboard (soluciones memorizables).
- **No:** tecla `P`/`Esc` de pausa ni táctil/móvil en esta spec.

---

## Riesgos

| Riesgo                                                                                          | Mitigación                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La telegrafía miente (lo mostrado no coincide con lo que pasa) y el juego se siente injusto     | Intenciones y peligro se calculan en el paso 4 con la misma función de propagación que resuelve el paso 3 del turno siguiente; el paso 6 verifica la coincidencia celda a celda.                       |
| El orden de resolución genera muertes "imposibles" (bot y jugador cruzándose en el mismo turno) | Orden fijo jugador → bots → mechas → intenciones → derrumbe; el cruce de posiciones se resuelve como contacto solo si el bot termina en la celda del jugador. Documentado en el código y en esta spec. |
| Oleadas altas resultan imposibles (cazadores + artificieros acorralan sin salida)               | `composicion` deja siempre un rondador, artificiero máx. 2, `botRange` crece despacio (cada 4 oleadas); constantes ajustables; el paso 6 exige llegar a la oleada 5.                                   |
| Un jugador muy lento no tiene penalización y el leaderboard premia la paciencia infinita        | Aceptado: el score depende de acciones, no de tiempo; el límite de turnos impide alargar oleadas, y pensar no da puntos.                                                                               |
| Las teclas repetidas por el SO consumen varios turnos sin querer                                | `e.repeat` ignorado y búfer de una sola acción durante la animación.                                                                                                                                   |
| Duplicación de código con `components/games/polvora/` si se aprueban ambas variantes            | Aceptado y documentado en Decisiones; un refactor común posterior es barato porque ambos motores usan la misma arena 15×11 y la misma regla de propagación.                                            |
| El glifo `Ó` de "PÓLVORA TÁCTICA" o el título largo no caben/renderizan en las tarjetas pixel   | Verificar en `/biblioteca` y `/salon` en el paso 6; si falla, sembrar `POLVORA TACTICA` (el `id` no cambia) y documentarlo en la migración.                                                            |
| `requestAnimationFrame` o listeners siguen vivos tras desmontar la página                       | Limpieza del `useEffect` de montaje cancela el frame pendiente y quita `keydown` (patrón `AsteroidsGame`).                                                                                             |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles y entrada en `TOUCH_CONFIG`.
- Deshacer turno, previsualización de la cruz, semilla de arena fija.
- Power-ups o tipos de bot adicionales.
- Modo 2P.
- Módulo compartido con `components/games/polvora/`.
- Skins `retro`/`neon` (trabajo de `skin-designer`).
- Tecla `P`/`Esc` de pausa.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites raster.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
