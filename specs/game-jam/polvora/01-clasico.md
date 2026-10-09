# GAME JAM — PÓLVORA (clásico): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-10-08
> **Objetivo:** Dar de alta `polvora` como primer juego real de la categoría VERSUS: arena de bombas en grilla destructible, en tiempo real, contra bots que también plantan bombas, con oleadas infinitas y score entero ascendente que premia las cadenas de detonación.

---

## Por qué existe esta spec

PÓLVORA es la entrada `polvora` de `references/game-suggestions-todo.md` (sección Pendientes →
VERSUS, marcada "⭐ mejor del lote VERSUS"): bombas en grilla destructible contra bots, con el
bucle **colocar → huir → encadenar** que no existe en ningún motor portado (`asteroids` es
disparo inercial, `tetris` caída de piezas, `arkanoid` rebote de paleta, `snake` serpiente en
grilla, `frogger` evasión por carriles). VERSUS sigue siendo la única categoría de `CATS`
(`lib/games.ts`) sin ningún juego real sembrado en `games`: el chip VERSUS de `/biblioteca`
devuelve lista vacía.

Esta spec es la **variante clásica** (arena en tiempo real) de PÓLVORA. En el mismo directorio,
`02-tactica.md` propone una variante alternativa e independiente (`polvora-tactica`: el mundo
solo avanza cuando el jugador actúa, bots con intención telegrafiada). Ninguna depende de la
otra; el usuario puede aprobar una, las dos o ninguna.

No parte de ningún prototipo en `references/started-games/` — el diseño se define directamente
aquí, igual que SPEC 09 hizo con `snake`. Particularidades de encaje resueltas de entrada (ver
`## Decisiones`):

- **Marco CRT 4/3.** La arena clásica es impar (15×11 celdas, para que los pilares fijos caigan
  en coordenadas pares). Con celdas de 48px ocupa 720×528, letterbox centrado dentro del canvas
  800×600 (`OFFSET_X = 40`, `OFFSET_Y = 36`) — mismo recurso que `tetris` (SPEC 07) y `frogger`.
  Sin tocar `.crt-screen`.
- **"Versus" con score ascendente.** El rival son bots dentro del motor; no hay marcador de
  victorias/derrotas (motivo por el que el TODO descartó DUELO DE PALAS). Solo lo que hace el
  jugador suma puntos: bloques, bots eliminados por sus llamas, oleadas superadas. Nunca resta.
- **Sin vidas "gratis" de oleada.** Tres vidas, estado transitorio `"dead"` entre muerte y
  respawn (igual que `asteroids`), `"gameover"` al perder la última.
- **Una franja de información dentro del canvas.** El temporizador de oleada y el contador de
  bots vivos se dibujan en la franja superior del letterbox (36px), igual que `frogger` dibuja
  su barra de tiempo. Puntuación/Vidas/Nivel siguen siendo solo del HUD React.

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo `games`.** `id: "polvora"`, `title: "PÓLVORA"`,
  `cat: "VERSUS"`, `color: "yellow"`, `difficulty: 3`, `best: 0`, `plays: "0"`,
  `cover: "cover-polvora"` (clase nueva).
- **Portada CSS nueva `.cover-polvora`** en el bloque de portadas de `app/globals.css` (junto a
  `.cover-bricks`, `.cover-rocas`, `.cover-duelo`…): `.cover-bg` base + rejilla de pilares en
  `::after` (gradientes repetidos) + glifo de bomba con chispa de mecha en `::before` +
  `filter: drop-shadow(...)` con `--yellow`. No se reutiliza `.cover-duelo` (es la portada del
  placeholder `duelo-pixel`, otra identidad).
- **Motor en tiempo real**, `components/games/polvora/engine.ts`, sin `window`/`document`/
  `canvas` a nivel de módulo:
  - **Arena.** `COLS = 15`, `ROWS = 11`, `CELL = 48`. Anillo exterior de muro indestructible;
    pilares indestructibles en toda celda interior con `x` e `y` pares; el resto de celdas
    interiores se rellena con bloques destructibles con probabilidad `blockDensity(wave)`,
    salvo las **zonas seguras** de cada punto de aparición (la celda de spawn + sus dos vecinas
    libres en "L"), que siempre quedan vacías.
  - **Movimiento por grilla interpolado.** Jugador y bots avanzan de celda en celda a velocidad
    constante (celdas/s); mientras se mantiene una flecha pulsada, al llegar al centro de una
    celda encadenan el siguiente paso si la celda destino es transitable. Invertir dirección a
    mitad de paso está permitido (`t = 1 - t`), para que el control no se sienta pegajoso.
    Celdas no transitables: muro, pilar, bloque, bomba (salvo la bomba que el propio actor
    acaba de plantar mientras siga pisándola).
  - **Bombas.** `Espacio` planta una bomba en la celda ocupada por el jugador (la de origen si
    `t < 0.5`, la de destino si no), si no hay ya una bomba ahí y `bombasActivas < maxBombs`.
    Mecha `BOMB_FUSE_S = 2.5`. Al explotar, la llama se propaga en cruz hasta `range` celdas:
    se detiene en muro/pilar; destruye el primer bloque que encuentra y se detiene ahí; si toca
    otra bomba, la detona en el mismo frame (**cadena**). Llamas activas `FLAME_S = 0.45`;
    cualquier actor no invulnerable que pise una celda en llamas muere.
  - **Autoría de cadena.** Cada explosión hereda el `owner` de la primera bomba de su cadena:
    si una llama del jugador detona una bomba de un bot, esa segunda explosión también cuenta
    como del jugador. Es lo que hace rentable **encadenar**.
  - **Power-ups** (ocultos en bloques, `POWERUP_CHANCE = 0.22`): `fuego` (+1 `range`, máx. 6) y
    `bomba` (+1 `maxBombs`, máx. 5). Aparecen cuando la llama que destruyó su bloque se apaga;
    una llama posterior los destruye. Persisten entre oleadas; al perder una vida, el jugador
    vuelve a `range = 2`, `maxBombs = 1`.
  - **Bots** (rol VERSUS, IA dentro del motor): `botCount(wave) = min(3 + floor((wave - 1) / 2), 6)`.
    Aparecen en las esquinas libres y, a partir del cuarto, en `(7,1)`, `(7,9)`, `(13,5)`. Cada
    bot "piensa" cada `botThinkS(wave)` segundos al llegar al centro de una celda, con
    prioridades fijas: (1) si su celda o la siguiente está en la zona de explosión proyectada
    de alguna bomba, **huir** por BFS a la celda segura más cercana; (2) si el jugador está
    alineado sin obstáculos dentro de su `range` y existe ruta de escape tras plantar, **plantar**;
    (3) si tiene un bloque adyacente y ruta de escape, **plantar** para abrir camino; (4) si no,
    con probabilidad `botAggro(wave)` dar un paso BFS hacia el jugador, y si no, deambular.
    Un bot nunca planta sin ruta de escape calculada (simula la cruz de su propia bomba), pero
    sí puede morir por bombas ajenas o por cadenas.
  - **Oleada.** Termina cuando mueren todos los bots: banner `OLEADA N SUPERADA` dibujado en el
    canvas durante `WAVE_CLEAR_S = 1.8`, `level += 1` y se genera una arena nueva (bloques y
    power-ups nuevos; el jugador conserva vidas y power-ups). Progresión indefinida.
  - **Derrumbe.** Cada oleada tiene `WAVE_TIME_S = 120`. Al llegar a 0, cada `DERRUMBE_STEP_S`
    una celda del anillo interior más externo se convierte en muro, en espiral hacia dentro;
    lo que esté en esa celda (actor, bomba, power-up) desaparece — un actor aplastado muere
    sin dar puntos. Evita oleadas eternas escondiéndose.
  - **Puntuación** (entero ascendente, nunca resta), solo por acciones del jugador:
    `+10` por bloque destruido por sus llamas, `+50` por power-up recogido,
    `100 × wave × cadena` por cada bot eliminado por sus llamas (`cadena` = número de bots que
    caen en la misma resolución de cadena), `500 × wave + 5 × segundosRestantes` al superar la
    oleada. Bots muertos por bombas de otros bots (sin participación del jugador en la cadena)
    o por el derrumbe: `0`.
  - **Vidas y estados.** `START_LIVES = 3`. Al morir: `lives -= 1`; si `lives === 0`,
    `state = "gameover"`; si no, `state = "dead"` durante `DEATH_S = 1.5` (animación de muerte,
    temporizador de oleada congelado), después se limpian bombas y llamas, los bots
    supervivientes vuelven a sus spawns, el jugador reaparece en `(1,1)` con
    `INVULN_S = 2.0` de invulnerabilidad (parpadeo) y `state = "playing"`. Los bloques
    destruidos siguen destruidos.
  - **Franja superior del letterbox** (36px, fuera de la arena): barra del temporizador de
    oleada a la izquierda (parpadea en `danger` por debajo de 10s) e iconos de bots vivos a la
    derecha. Sin puntuación/vidas/nivel en canvas (los pinta el HUD React).
  - **Render 100% vectorial**, leyendo colores de la paleta `POLVORA_SKINS.clasico`
    (`components/games/polvora/skins.ts`), nunca literales sueltos en `draw()`. Muros, pilares
    y fondo **precocinados** en un canvas auxiliar creado dentro de `createEngine` (patrón
    SPEC 12 ya usado por `snake`/`frogger`), que solo se repinta al generar oleada y en cada
    paso de derrumbe; bloques destructibles agrupados en un único `beginPath`/`fill` por frame.
    `getState()` devuelve un objeto reutilizado (sin alojar por frame).
- **Paleta** `components/games/polvora/skins.ts` con `POLVORA_SKINS: SkinSet<"clasico", PolvoraRole>`
  y `POLVORA_SKIN_IDS = ["clasico"] as const`. `retro`/`neon` los añade después el agente
  `skin-designer` (que `/spec-impl-game` detona al cerrar), no esta spec.
- **Componente canvas** `components/games/polvora/PolvoraGame.tsx` (`"use client"`), clonando
  el patrón de `AsteroidsGame.tsx` (ver paso 4) e implementando `setSkin` porque
  `RealGameHandle` lo exige desde la migración de skins.
- **Registro de motores.** Entrada `polvora` en `REGISTRO_MOTORES` con `skins: []` (sin
  selector hasta que existan `retro`/`neon`). `JugarClient.tsx` no se toca.
- **Migración SQL** sembrando `polvora` en `games`.

**Casos límite del motor (todos dentro de alcance):**

- El jugador muere en la misma cadena que mata al último bot: se resuelven primero los puntos
  (bots + oleada superada), después la muerte. Si le quedaban vidas, reaparece directamente en
  la oleada siguiente; si no, `gameover` con el score ya incluyendo la oleada.
- Dos llamas cruzan la misma celda: no hay doble efecto; un bloque solo se destruye una vez y
  suma `+10` una vez.
- Un power-up recién revelado no lo destruye la misma llama que rompió su bloque (aparece al
  apagarse esa llama).
- `Espacio` mantenido no planta en ráfaga: es edge-triggered (una bomba por pulsación) y se
  ignora `KeyboardEvent.repeat`.
- Flechas simultáneas: manda la **última pulsada** que siga mantenida (pila de direcciones en
  el componente); al soltarla, vuelve a mandar la anterior.
- Plantar en una celda con bomba, o con `maxBombs` alcanzado: se ignora sin efecto.
- Un bot sin ruta de escape posible no planta; si queda encerrado por bombas ajenas, muere.
- PAUSA congela mechas, llamas, temporizador de oleada, derrumbe e IA (todo depende de `dt`);
  `dt` capado a `0.05` evita que una mecha se "salte" su explosión tras un tirón.
- `forceGameOver()` durante `"dead"` o durante el banner de oleada pasa a `"gameover"` sin
  completar la transición.
- El derrumbe nunca cierra la celda de spawn `(1,1)` mientras el jugador está en `"dead"`:
  el respawn busca la celda libre interior más cercana a `(1,1)` si esa ya es muro.

**Fuera de alcance (por defecto, salvo que el usuario pida lo contrario):**

- Controles táctiles/móviles (sin entrada en `TOUCH_CONFIG` de `JugarClient.tsx`; queda para
  `mobile-porter`/una spec posterior).
- Modo 2P local en el mismo teclado.
- Power-ups adicionales (velocidad, detonador remoto, patear bombas, atravesar bloques).
- Tipos de bot diferenciados por comportamiento (la variante clásica usa un único tipo cuyos
  parámetros escalan con la oleada).
- Skins `retro`/`neon` (las aplica `skin-designer` después).
- Tecla `P`/`Esc` de pausa (solo el botón PAUSA del HUD, como `asteroids`/`snake`/`frogger`).
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage` (ya no aplica; SPEC 06 retiró ese mecanismo).
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites raster (render 100% vectorial).
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Fila de siembra para `games`:

```sql
-- supabase/migrations/<YYYYMMDDHHMMSS>_polvora.sql

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'polvora', 'PÓLVORA',
  'Planta, huye y encadena antes de que la arena te encierre.',
  'Una arena de muros y bloques de pólvora contra bots que también saben plantar bombas. Abre camino, acorrala a tus rivales y encadena detonaciones para multiplicar la puntuación. Cada oleada trae más bots, más rápidos, y un reloj que, al agotarse, derrumba la arena desde los bordes.',
  'VERSUS', 'cover-polvora', 'yellow',
  0, '0', 3
);
```

`difficulty` es `not null` **sin default** — la migración debe darlo siempre (ver
`supabase/migrations/20260914100000_games_difficulty.sql`). `cat: 'VERSUS'` y `color: 'yellow'`
ya son valores válidos por `CHECK`. `best`/`plays` en `0`/`'0'`, igual que `tetris`/`arkanoid`/
`snake`/`frogger`: `MEJOR GLOBAL`/`PARTIDAS` se calculan en vivo desde `scores` (SPEC 06).

Constantes del motor (`components/games/polvora/engine.ts`, internas al módulo):

```ts
const CANVAS_W = 800;
const CANVAS_H = 600;
const COLS = 15;
const ROWS = 11;
const CELL = 48;
const BOARD_W = COLS * CELL; // 720
const BOARD_H = ROWS * CELL; // 528
const OFFSET_X = (CANVAS_W - BOARD_W) / 2; // 40
const OFFSET_Y = (CANVAS_H - BOARD_H) / 2; // 36 — franja superior = temporizador + bots vivos

const START_LIVES = 3;
const PLAYER_SPEED = 4.2; // celdas/s
const BASE_RANGE = 2;
const MAX_RANGE = 6;
const BASE_BOMBS = 1;
const MAX_BOMBS = 5;
const BOMB_FUSE_S = 2.5;
const FLAME_S = 0.45;
const POWERUP_CHANCE = 0.22;
const DEATH_S = 1.5;
const INVULN_S = 2.0;
const WAVE_CLEAR_S = 1.8;
const WAVE_TIME_S = 120;
const DERRUMBE_STEP_S = 0.3;

const SCORE_BLOCK = 10;
const SCORE_POWERUP = 50;
const SCORE_BOT = 100; // × wave × cadena
const SCORE_WAVE = 500; // × wave
const SCORE_TIME_BONUS = 5; // × segundos restantes de la oleada

// Escalado por oleada (wave >= 1)
const blockDensity = (w: number) => Math.min(0.55 + 0.02 * (w - 1), 0.7);
const botCount = (w: number) => Math.min(3 + Math.floor((w - 1) / 2), 6);
const botSpeed = (w: number) => Math.min(2.6 + 0.15 * (w - 1), 4.0); // celdas/s
const botThinkS = (w: number) => Math.max(0.35 * Math.pow(0.93, w - 1), 0.15);
const botAggro = (w: number) => Math.min(0.35 + 0.08 * (w - 1), 0.85);
const botRange = (w: number) => Math.min(2 + Math.floor((w - 1) / 3), 4);
const botMaxBombs = (w: number) => (w >= 4 ? 2 : 1);
```

Contrato TypeScript entre el motor y el componente:

```ts
// components/games/polvora/engine.ts
import type { SkinBaseId } from "../skins";

export type PolvoraGameState = "playing" | "dead" | "gameover";
export type Dir = "up" | "down" | "left" | "right";

export interface PolvoraEngineState {
  score: number;
  lives: number;
  level: number; // = oleada actual
  state: PolvoraGameState;
}

export interface PolvoraInputState {
  dir: Dir | null; // última flecha pulsada que sigue mantenida (pila en el componente)
  bomb: boolean; // edge-triggered: true solo el frame siguiente a pulsar Espacio; update() lo consume
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* arena, actores, bombas, llamas, IA de bots, derrumbe; fondo precocinado en un canvas
     auxiliar creado aquí dentro, nunca a nivel de módulo */
  return { update, draw, getState, forceGameOver, setSkin };
}
// update(dt: number, input: PolvoraInputState): void — no-op si state === "gameover"
// draw(): void
// getState(): PolvoraEngineState — mismo objeto reutilizado, mutado en sitio
// forceGameOver(): void — state = "gameover" inmediato
// setSkin(skin: SkinBaseId): void — aplica POLVORA_SKINS[skin] si existe, si no "clasico"; repinta el fondo precocinado
export type PolvoraEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/polvora/skins.ts
import type { SkinSet } from "../skins";

export type PolvoraRole =
  | "muro"
  | "pilar"
  | "bloque"
  | "bloqueBorde"
  | "bomba"
  | "mecha"
  | "llama"
  | "llamaNucleo"
  | "jugador"
  | "bot"
  | "botOjo"
  | "powerFuego"
  | "powerBomba"
  | "derrumbe";

export const POLVORA_SKINS: SkinSet<"clasico", PolvoraRole> = {
  clasico: {
    bg: "#000000",
    grid: "transparent",
    ink: "#ffffff",
    inkDim: "#9aa0a6",
    accent: "#ffd23f", // jugador — amarillo del catálogo
    danger: "#e04b4b", // muerte, temporizador bajo
    hud: "#ffffff",
    glow: null,
    entities: {
      muro: "#2b2f3a",
      pilar: "#3a3f4b",
      bloque: "#8a5a2b",
      bloqueBorde: "#b07a3f",
      bomba: "#1a1a1a",
      mecha: "#ffb000",
      llama: "#ff7a1a",
      llamaNucleo: "#fff3b0",
      jugador: "#ffd23f",
      bot: "#ff3ea5",
      botOjo: "#ffffff",
      powerFuego: "#ff7a1a",
      powerBomba: "#39c6ff",
      derrumbe: "#5a5f6b",
    },
  },
};
export const POLVORA_SKIN_IDS = Object.keys(POLVORA_SKINS) as readonly "clasico"[];
```

```ts
// components/games/polvora/PolvoraGame.tsx
import type { SkinId } from "../skins";

export interface PolvoraGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  setSkin(skin: SkinId): void; // obligatorio por RealGameHandle; delega en engine.setSkin
}
interface PolvoraGameProps {
  onStateChange: (state: PolvoraEngineState) => void;
  ref?: Ref<PolvoraGameHandle>; // React 19: ref como prop, sin forwardRef
}
```

```ts
// components/games/registry.ts — entrada nueva, sin tocar las existentes
polvora: { component: PolvoraGame as ComponentType<RealGameProps>, skins: [] },
```

`PolvoraEngineState` no añade campos fuera del contrato base: el HUD React muestra
Puntuación/Vidas/Nivel tal cual (Nivel = oleada) y `JugarClient.tsx` no necesita ninguna rama
`game.id === "polvora"`.

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Migración SQL.** Crear `supabase/migrations/<YYYYMMDDHHMMSS>_polvora.sql` con el `insert`
   de la sección anterior, literal. Aplicar con `apply_migration` del MCP de Supabase. Aviso:
   `20260914093515_games_solo_asteroids.sql` vació el catálogo; cada juego necesita su propia
   fila. Prueba manual: `list_tables` muestra la fila `polvora` junto a los cinco juegos
   existentes; `get_advisors` no reporta RLS deshabilitada.
2. **Portada CSS.** `.cover-polvora` nueva en el bloque de portadas de `app/globals.css`
   (convención `.cover-bg` + `::after` rejilla de pilares + `::before` bomba con chispa +
   `drop-shadow` con `--yellow`). Prueba manual: `/biblioteca` muestra la tarjeta "PÓLVORA"
   sin CSS roto en otras tarjetas; el chip VERSUS deja de devolver lista vacía.
3. **Motor + paleta.** Crear `components/games/polvora/skins.ts` (paleta `clasico` del Modelo
   de datos) y `components/games/polvora/engine.ts` con: generador de arena por oleada (muro,
   pilares, bloques con zonas seguras, power-ups ocultos), movimiento interpolado por grilla,
   bombas/llamas/cadenas con autoría heredada, IA de bots por prioridades con BFS de huida y
   de escape previo a plantar, oleadas, derrumbe en espiral, puntuación, vidas/estados y los
   casos límite de `## Alcance`. `draw()` lee siempre de la paleta activa; fondo precocinado
   en canvas auxiliar creado dentro de `createEngine`; franja superior con temporizador y
   bots vivos. Sin `window`/`document`/`canvas` a nivel de módulo. Prueba manual:
   `npx tsc --noEmit` compila.
4. **Componente canvas.** `components/games/polvora/PolvoraGame.tsx` (`"use client"`),
   clonando `AsteroidsGame.tsx` en sus puntos load-bearing: `ref` como prop,
   `useImperativeHandle` con `pause/resume/forceGameOver/setSkin`, `reportIfChanged` antes de
   `onStateChange`, `onStateChangeRef` (efecto de montaje con deps `[]`), `resume()` resetea
   `lastTimeRef.current = null`, `dt` capado a `0.05`, listeners `keydown`/`keyup` sobre
   `window` con `preventDefault` de flechas y `Espacio` solo mientras `state === "playing"`
   o `"dead"`, pila de direcciones mantenidas para resolver `dir`, `bomb` edge-triggered
   ignorando `e.repeat`, canvas 800×600 escalado por estilo inline (`position:absolute;
inset:0; width:100%; height:auto; aspectRatio:"800 / 600"`), cleanup que cancela el RAF
   pendiente y quita listeners. Prueba manual: montar el componente muestra la arena, el
   jugador se mueve con flechas, planta con Espacio, las bombas encadenan y los bots huyen y
   plantan.
5. **Registro de motores.** Añadir la entrada `polvora` (ver Modelo de datos) a
   `REGISTRO_MOTORES` en `components/games/registry.ts`. `JugarClient.tsx` no se toca (el
   registro genérico existe desde SPEC 07; `skins: []` desactiva el selector y el efecto de
   `setSkin` del reproductor). Prueba manual: `npx tsc --noEmit` compila;
   `/juego/asteroids/jugar`, `/juego/tetris/jugar`, `/juego/arkanoid/jugar`,
   `/juego/snake/jugar` y `/juego/frogger/jugar` siguen funcionando igual.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/polvora/jugar`:
   - HUD React (Puntuación/Vidas/Nivel) en tiempo real; franja superior del canvas con
     temporizador y bots vivos.
   - Una cadena que mata a dos bots suma `2 × 100 × wave × 2`; un bot muerto por la bomba de
     otro bot sin intervención del jugador no suma.
   - Morir resta una vida, pasa por `"dead"` y reaparece invulnerable; perder la última abre
     el modal de fin con el score real.
   - Dejar agotar el temporizador arranca el derrumbe en espiral y aplasta lo que pilla.
   - Superar al menos 3 oleadas: más bots, más rápidos, arena nueva cada vez.
   - PAUSA congela mechas, llamas, temporizador y bots; REANUDAR retoma sin salto de tiempo.
   - `GUARDAR PUNTUACIÓN` inserta en `scores` vía `guardarScoreAction` (sin tocar
     `actions.ts`); la fila aparece en `/juego/polvora` (mini-tabla) y en `/salon` (tab
     PÓLVORA) tras recargar — ninguna de las dos pantallas necesita cambios.
   - Medir con el overlay de `components/games/fps-overlay.tsx` (1440×900, skin `clasico`,
     30s con 6 bots y cadenas activas): ≥ 58 FPS medio, p95 ≤ 20ms (umbral de SPEC 12).
   - Ejecutar `npx next build` y corregir errores. Si `next dev` reescribió el bloque
     `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `polvora` en `games` con
      `difficulty = 3` explícita; `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra una tarjeta "PÓLVORA" con la portada `.cover-polvora`; el chip
      VERSUS deja de devolver lista vacía.
- [ ] `components/games/polvora/engine.ts` no referencia `window`, `document` ni `canvas` a
      nivel de módulo y no carga ninguna imagen — render 100% vectorial desde la paleta.
- [ ] `/juego/polvora/jugar` es jugable solo con teclado (flechas + Espacio); Espacio y
      flechas no hacen scroll de la página mientras se juega.
- [ ] La arena es 15×11 letterboxed dentro del marco CRT 4/3, con pilares fijos, bloques
      destructibles y zonas seguras en cada spawn.
- [ ] Las bombas explotan a los 2.5s en cruz, se detienen en pilares/bloques y detonan otras
      bombas en cadena; la autoría de la cadena se hereda de su primera bomba.
- [ ] La puntuación solo crece y solo por acciones del jugador (bloques, power-ups, bots
      eliminados por sus cadenas con multiplicador, oleadas superadas con bonus de tiempo).
- [ ] Los bots huyen de explosiones proyectadas, plantan solo con ruta de escape y persiguen
      al jugador con más agresividad en oleadas altas.
- [ ] Al agotarse el temporizador de oleada, el derrumbe en espiral cierra la arena y aplasta
      actores, bombas y power-ups.
- [ ] Morir pasa por `"dead"` (1.5s) y reaparece con 2s de invulnerabilidad; perder la última
      vida (o pulsar FIN) abre el modal de fin con el score real.
- [ ] PAUSA congela todo el motor; REANUDAR retoma sin salto de tiempo.
- [ ] `GUARDAR PUNTUACIÓN` inserta en `scores`; la fila aparece en `/juego/polvora` y en
      `/salon` (tab PÓLVORA) tras recargar.
- [ ] Rendimiento en desktop 1440×900, skin `clasico`: ≥ 58 FPS medio y p95 ≤ 20ms en 30s.
- [ ] `components/games/registry.ts` incluye `polvora` con `skins: []`; `JugarClient.tsx` no
      cambia; el resto de motores reales se comporta exactamente igual que antes.

---

## Decisiones

- **Sí:** `id: "polvora"`, `title: "PÓLVORA"`. Es el slug ya registrado en el TODO de
  `game-planner`; no es un juego con marca reconocible (el género es "bomber en grilla"), así
  que el nombre propio del catálogo es la identidad, como `gridlock` en otra ronda del jam.
- **Sí:** `cat: "VERSUS"`, `color: "yellow"`, `difficulty: 3`. Tal cual el TODO. `yellow`
  coincide con `asteroids`, pero con cinco juegos y cuatro colores la repetición es
  inevitable; se prioriza la identidad "pólvora/mecha" del amarillo.
- **Sí:** tiempo real con movimiento por grilla interpolado (no libre por píxel). Mantiene
  colisiones y propagación de llamas en enteros de celda, que es lo que hace legibles las
  cadenas en un CRT de 800×600.
- **Sí:** arena 15×11 de 48px con letterbox (40/36px). Las dimensiones impares son las que
  dejan un pilar sí/no alternado simétrico; ajustar a 16×12 para llenar 800×600 rompería el
  patrón. Precedente: `tetris` y `frogger`.
- **Sí:** autoría de cadena heredada de la primera bomba. Sin ella, "encadenar" bombas de
  bots no daría puntos y el bucle central del juego no tendría recompensa.
- **Sí:** multiplicador `× cadena` y `× wave` en las bajas. Es lo que separa a jugadores
  buenos de excelentes en el leaderboard y da curva sin techo.
- **Sí:** derrumbe en espiral al agotarse el reloj. Sin él, esconderse en una esquina
  congelaría la partida indefinidamente; con él, cada oleada tiene un final garantizado.
- **Sí:** IA de bots por prioridades fijas (huir > atacar > abrir > perseguir/deambular) con
  BFS. Barata, determinista salvo el `botAggro`, ajustable por constantes y suficiente para un
  rival que "juega al mismo juego" que el jugador.
- **Sí:** power-ups `fuego`/`bomba` persistentes entre oleadas y reseteados al morir. Da
  progresión dentro de una vida y castigo real al perderla, sin power-ups que rompan el juego
  (nada de inmunidad a llamas propias).
- **Sí:** franja superior del letterbox con temporizador y bots vivos. Son dos datos jugables
  sin hueco en el HUD React compartido; añadirlos al HUD exigiría ramas en `JugarClient.tsx`.
  Precedente: barra de tiempo en canvas de `frogger`.
- **Sí:** paleta `clasico` en `skins.ts` desde el primer día y `skins: []` en el registro.
  Evita que `skin-designer` tenga que extraer literales después; el selector aparecerá cuando
  existan `retro`/`neon`.
- **No:** tecla `P`/`Esc` de pausa. No hay prototipo que la traiga; sin ella `JugarClient.tsx`
  queda intacto (las de `tetris`/`arkanoid` vinieron de sus prototipos).
- **No:** modo 2P local, más power-ups o tipos de bot diferenciados. Alcance mínimo de la
  variante clásica; la diferenciación de bots por comportamiento es justo el eje de
  `02-tactica.md`.
- **No:** táctil/móvil en esta spec.

---

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La IA de bots es suicida (se autoencierra) o injugable (acorrala siempre en la oleada 1)       | El escape previo a plantar es obligatorio y simula la cruz completa; `botAggro`/`botThinkS`/`botSpeed` son funciones de constantes ajustables; el paso 6 exige superar 3 oleadas jugando.                                  |
| La propagación de cadenas en el mismo frame entra en bucle o detona una bomba dos veces        | Resolución por cola (BFS) con marca `exploded` por bomba; cada bomba entra en la cola una sola vez por frame.                                                                                                              |
| El movimiento interpolado deja al jugador "entre celdas" y plantar cae en una celda inesperada | La celda ocupada se define explícitamente (`t < 0.5` origen, si no destino) y se usa la misma regla para colisión con llamas y bots.                                                                                       |
| BFS de varios bots por frame baja los FPS en oleadas de 6 bots                                 | Los bots solo piensan al llegar al centro de una celda y como mucho cada `botThinkS`; la grilla interior es 13×9 (117 celdas). El paso 6 mide con el overlay de FPS contra el umbral de SPEC 12.                           |
| El repintado del fondo por frame (muros + pilares) supera el presupuesto de frame              | Fondo precocinado en canvas auxiliar, repintado solo al generar oleada o al avanzar el derrumbe (patrón validado en `snake`/`frogger`, SPEC 12).                                                                           |
| `requestAnimationFrame` o listeners siguen vivos tras desmontar la página                      | El `useEffect` de `PolvoraGame` cancela el frame pendiente y quita `keydown`/`keyup` en su limpieza (mismo patrón que `AsteroidsGame`).                                                                                    |
| El glifo `Ó` de "PÓLVORA" no existe en la fuente pixel de las tarjetas                         | Verificar en `/biblioteca` y `/salon` en el paso 6; si la fuente no la trae, el título se siembra como `POLVORA` (el `id` no cambia) y se documenta en la migración, igual que la de `frogger` documentó sus desviaciones. |
| `RealGameHandle.setSkin` obligatorio choca con un motor de una sola paleta                     | `setSkin` existe y cae a `clasico` si el id no está en `POLVORA_SKINS`; con `skins: []` el reproductor ni siquiera lo invoca.                                                                                              |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles y entrada en `TOUCH_CONFIG`.
- Modo 2P local.
- Power-ups adicionales (velocidad, detonador, patada, atravesar bloques).
- Tipos de bot con comportamientos distintos.
- Skins `retro`/`neon` (trabajo de `skin-designer`).
- Tecla `P`/`Esc` de pausa.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites raster.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
