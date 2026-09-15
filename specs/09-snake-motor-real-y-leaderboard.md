# SPEC 09 — SNAKE: motor real y leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-15
> **Objetivo:** Añadir una entrada real `snake` al catálogo con un motor de Snake jugable por grilla (mover, comer fruta, crecer, morir al chocar contra pared o contra su propia cola), usando sprites reales de fruta portados desde `references/source-assets/snake-assets/`, integrado en el reproductor y en el registro de motores existente.

---

## Por qué existe esta spec

No existe ningún prototipo jugable de Snake bajo `references/started-games/` (a
diferencia de asteroids/tetris/arkanoid, que partieron de un `game.js` completo). Lo
que sí existe es `references/source-assets/snake-assets/` con dos archivos:
`fruits.png` (sprite sheet real de 21 frutas, fondo transparente, 3790×442px) y
`sprites.js` (coordenadas `{x, y, w, h}` de cada fruta dentro de la hoja, pensadas
para `ctx.drawImage` con recorte). El diseño del juego en sí no viene de un
prototipo — se define en esta spec directamente, a partir del objetivo dado por el
usuario ("conseguir la puntuación más alta posible comiendo la mayor cantidad de
comida sin chocar contra las paredes ni contra el cuerpo de la propia serpiente").

El catálogo mock retirado por SPEC 06 ya tenía una entrada placeholder para este
juego (`id: "serpentina"`, en `references/templates/data.jsx`), con su propia clase
de portada `.cover-snake` en `app/globals.css` — heredada del prototipo de diseño y
sin usar hasta ahora porque ningún motor real la reclamó. Esta spec la reutiliza tal
cual, sin CSS nuevo.

**Dato del prototipo de referencia que no encaja directamente en el contrato
actual:** ningún motor real existente (`asteroids`, `tetris`, `arkanoid`) carga
imágenes — `createEngine(ctx)` es síncrono y dibuja todo con formas de canvas. Snake
es el primer motor que necesita un asset raster (`fruits.png`) para dibujar la
comida. Decisión tomada en la fase de preguntas: `SnakeGame.tsx` precarga la imagen
(`new Image()` + `onload`) **antes** de instanciar el motor, mostrando un estado de
carga breve en el canvas; `createEngine` recibe la imagen ya cargada como segundo
argumento (`createEngine(ctx, spriteImage)`), ampliando ligeramente la firma que
usan los otros motores pero manteniendo el resto del contrato (`update`, `draw`,
`getState`, `forceGameOver`) idéntico. La comida sortea aleatoriamente uno de los 21
frutos del atlas en cada aparición (no siempre el mismo).

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo (Supabase).** Fila `id: "snake"` en `public.games`,
  sembrada por migración: `title: "SNAKE"`, `cat: "ARCADE"`, `cover: "cover-snake"`,
  `color: "green"`, `best: 0`, `plays: "0"` (igual que `tetris`/`arkanoid`: el valor
  real se calcula en vivo desde `scores`, ver SPEC 06 pasos 11-13), `difficulty: 2`.
- **Portada.** Ninguna clase CSS nueva — se reutiliza `.cover-snake`, ya presente en
  `app/globals.css` (línea ~711).
- **Assets de fruta portados.**
  - `references/source-assets/snake-assets/fruits.png` se copia a
    `public/games/snake/fruits.png` (primer uso de `public/` para un asset de juego
    en este repo).
  - Las coordenadas de `references/source-assets/snake-assets/sprites.js` se portan
    como una constante TypeScript tipada `FRUIT_ATLAS` dentro de
    `components/games/snake/`, en vez de depender del `window.SPRITE_ATLAS` global
    que usaba el archivo original (prohibido por el contrato: sin globals de módulo).
- **Motor de Snake por grilla**, en `components/games/snake/`:
  - `engine.ts`: lógica pura tipada. Grilla lógica de 40×30 celdas de 20px sobre un
    canvas de 800×600 (mismo patrón de resolución fija que `asteroids`). Estado:
    posición de la serpiente (array de celdas, cabeza primero), dirección actual y
    dirección pendiente (para no permitir giro de 180° instantáneo), posición y
    fruto sorteado de la comida actual, `score`, `level` (sube cada 5 frutas
    comidas), `state`. Movimiento por _tick_ de tiempo fijo que se acorta con el
    `level` (la serpiente acelera progresivamente, igual que el Snake clásico), no
    por frame — `update(dt, input)` acumula `dt` y avanza un paso de grilla solo
    cuando el acumulador supera el intervalo del tick actual.
  - Colisión: chocar contra cualquiera de los 4 bordes de la grilla o contra su
    propio cuerpo pone `state = "gameover"` inmediatamente (sin estado intermedio
    `"dead"` — Snake no tiene vidas que perder, igual que `tetris`, ver
    `components/games/tetris/engine.ts:15-25`).
  - `createEngine(ctx: CanvasRenderingContext2D, spriteImage: HTMLImageElement)`:
    única variación de firma respecto al resto de motores, para poder dibujar la
    fruta con `ctx.drawImage(spriteImage, atlasEntry.x, atlasEntry.y, atlasEntry.w,
atlasEntry.h, dx, dy, cellSize, cellSize)`. El cuerpo de la serpiente se dibuja
    con formas de canvas (segmentos redondeados en `--green`), no con sprites.
  - `getState(): SnakeEngineState` con `lives` fijo en `0` (sin concepto de vidas).
  - `forceGameOver()`: fuerza `state = "gameover"` inmediatamente, mismo patrón que
    los otros tres motores.
- **Componente canvas** `SnakeGame.tsx` (`"use client"`):
  - Precarga `public/games/snake/fruits.png` con `new Image()` en un `useEffect` de
    montaje; mientras la imagen no ha cargado (`onload`), el canvas muestra un
    mensaje `CARGANDO...` centrado con la estética `.pixel` existente, sin crear el
    motor todavía. Al cargar, instancia `createEngine(ctx, spriteImage)` y arranca el
    bucle `requestAnimationFrame`.
  - Clona el resto del patrón de `AsteroidsGame.tsx`/`TetrisGame.tsx`: `ref` como
    prop (`ref?: Ref<SnakeGameHandle>`, sin `forwardRef`), `useImperativeHandle` con
    `pause/resume/forceGameOver`, `reportIfChanged` antes de `onStateChange`,
    `onStateChangeRef` para mantener el `useEffect` de montaje con deps `[]`,
    `resume()` resetea `lastTimeRef.current = null`, `dt` capado a `0.05`, listeners
    de teclado en `window` con `preventDefault` condicionado a
    `state === "playing"`, cleanup que cancela el frame pendiente y quita listeners.
  - Controles: flechas (↑↓←→) cambian la dirección pendiente de la serpiente; una
    tecla que invertiría la dirección actual 180° se ignora (no mata a la serpiente
    contra sí misma por un input accidental), igual que el Snake clásico.
  - Canvas 800×600 escalado por estilo inline (`position:absolute; inset:0;
width:100%; height:auto; aspectRatio:"800/600"`) dentro de `.crt-screen`, mismo
    patrón que los otros tres motores — sin cambios en `globals.css`.
- **Registro de motores.** Añadir `snake: SnakeGame` a
  `REGISTRO_MOTORES` en `components/games/registry.ts`. `JugarClient.tsx` no
  necesita ningún cambio (el registro genérico ya existe desde SPEC 07).

**Fuera de alcance (para specs futuras):**

- Controles táctiles/en pantalla para móvil. Solo teclado, igual que el resto de
  motores reales.
- Auth real / `user_id` en `scores`. Sigue sin existir en el repo.
- Migrar scores de `localStorage`. Ya no aplica — SPEC 06 retiró ese mecanismo.
- Pantalla de administración del catálogo.
- Sonido/música.
- Obstáculos, power-ups, múltiples frutas simultáneas o modos de dificultad
  seleccionables — el diseño de esta spec es Snake clásico de una sola fruta.
- Tests automatizados (no hay runner configurado en el repo).

---

## Modelo de datos

```sql
-- supabase/migrations/<YYYYMMDDHHMMSS>_snake.sql

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'snake', 'SNAKE',
  'Crece sin morder tu propia cola.',
  'Una serpiente de luz recorre la grilla buscando fruta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso contra la pared o contra tu propia cola termina la partida.',
  'ARCADE', 'cover-snake', 'green',
  0, '0', 2
);
```

Contrato TypeScript entre el motor y el componente:

```ts
// components/games/snake/engine.ts
export type SnakeGameState = "playing" | "gameover";

export interface SnakeEngineState {
  score: number;
  lives: 0;
  level: number;
  state: SnakeGameState;
}

export interface SnakeInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUIT_ATLAS: Record<string, FruitSprite> = {
  /* portado 1:1 de references/source-assets/snake-assets/sprites.js */
};

export function createEngine(ctx: CanvasRenderingContext2D, spriteImage: HTMLImageElement) {
  /* ... */
  return { update, draw, getState, forceGameOver };
}
export type SnakeEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/snake/SnakeGame.tsx
export interface SnakeGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}
interface SnakeGameProps {
  onStateChange: (state: SnakeEngineState) => void;
  ref?: Ref<SnakeGameHandle>;
}
```

---

## Plan de implementación

Cada paso deja la app arrancando (`next dev`) sin errores.

1. **Migración SQL.** Crear `supabase/migrations/<YYYYMMDDHHMMSS>_snake.sql` con el
   `insert` de la sección anterior. Aplicar con `apply_migration` del MCP de
   Supabase. Prueba manual: `list_tables` muestra la fila `snake` en `games`;
   `get_advisors` no reporta RLS deshabilitada.
2. **Assets.** Copiar `references/source-assets/snake-assets/fruits.png` a
   `public/games/snake/fruits.png`. Portar las coordenadas de
   `references/source-assets/snake-assets/sprites.js` a la constante tipada
   `FRUIT_ATLAS` (ver Modelo de datos), sin depender de `window.SPRITE_ATLAS`.
   Prueba manual: el archivo existe en `public/games/snake/fruits.png` y se sirve en
   `http://localhost:3000/games/snake/fruits.png`.
3. **Motor.** Crear `components/games/snake/engine.ts`: grilla 40×30 celdas de
   20px sobre canvas 800×600, movimiento por tick temporizado (se acorta con
   `level`), colisión contra bordes/cuerpo propio → `gameover` inmediato, comida con
   fruto aleatorio del `FRUIT_ATLAS` dibujado vía `ctx.drawImage` con recorte,
   cuerpo dibujado con formas de canvas en `--green`. Sin `window`/`document`/
   `canvas` a nivel de módulo — todo se inyecta al crear la instancia
   (`createEngine(ctx, spriteImage)`). Prueba manual: `npx tsc --noEmit` compila.
4. **Componente canvas.** Crear `components/games/snake/SnakeGame.tsx`
   (`"use client"`) con precarga de `fruits.png` (estado `CARGANDO...` en el canvas
   mientras `onload` no dispara), instancia del motor tras la carga, bucle
   `requestAnimationFrame`, listeners de flechas con `preventDefault` condicionado a
   `state === "playing"` (ignorando giros de 180°), `ref` imperativo
   (`pause/resume/forceGameOver`), y el resto de puntos load-bearing listados en
   `Alcance`. Prueba manual: montar el componente en una página de prueba temporal
   muestra la serpiente moviéndose por la grilla, come fruta con sprite real, y
   responde a las flechas.
5. **Registro de motores.** Añadir `snake: SnakeGame as ComponentType<RealGameProps>`
   a `REGISTRO_MOTORES` en `components/games/registry.ts`. `JugarClient.tsx` no se
   toca (el registro genérico ya existe desde SPEC 07). Prueba manual: `npx tsc
--noEmit` compila; `/juego/asteroids/jugar`, `/juego/tetris/jugar` y
   `/juego/arkanoid/jugar` siguen funcionando igual.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/snake/jugar`:
   la fruta carga y se ve como sprite real (no un cuadrado de color), el HUD React
   (Puntuación/Nivel) refleja el estado real en tiempo real, PAUSA congela el canvas,
   REANUDAR retoma sin salto de velocidad, chocar contra la pared o contra la propia
   cola abre el modal de fin con el score real, `GUARDAR PUNTUACIÓN` inserta en
   `scores` vía la Server Action existente. Confirmar que `/juego/snake` (mini-tabla)
   y `/salon` (tab SNAKE) reflejan esa fila tras recargar. Ejecutar `npx next build`
   y corregir errores. Si `next dev` reescribió el bloque `nextjs-agent-rules` de
   `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `snake` en `games`
      con `difficulty` explícita (`2`); `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra una tarjeta nueva "SNAKE" con la portada `.cover-snake`.
- [ ] `public/games/snake/fruits.png` existe y se sirve correctamente.
- [ ] `components/games/snake/engine.ts` no referencia `window`, `document` ni
      `canvas` a nivel de módulo (todo se inyecta al crear la instancia, incluida la
      imagen del sprite).
- [ ] `/juego/snake/jugar` muestra la serpiente jugable con teclado (flechas), la
      fruta se dibuja con un sprite real del atlas (no una forma de color plano), y
      el HUD React refleja el estado real del motor.
- [ ] Un giro de 180° instantáneo contra la propia dirección de movimiento se ignora
      (no mata a la serpiente contra sí misma).
- [ ] PAUSA congela el canvas; REANUDAR retoma sin salto de velocidad.
- [ ] Chocar contra un borde o contra el propio cuerpo, o pulsar FIN, abre el modal
      de fin con el score real; `GUARDAR PUNTUACIÓN` inserta en `scores` vía la
      Server Action existente.
- [ ] La fila guardada aparece en `/juego/snake` (mini-tabla) y en `/salon` (tab
      SNAKE) tras recargar.
- [ ] `/juego/asteroids/jugar`, `/juego/tetris/jugar` y `/juego/arkanoid/jugar`
      siguen comportándose exactamente igual que antes de esta spec.
- [ ] `components/games/registry.ts` incluye `snake` en `REGISTRO_MOTORES`;
      `JugarClient.tsx` no cambia.

---

## Decisiones

- **Sí:** id de catálogo `snake` (no `serpentina`). Sigue el patrón en inglés que ya
  establecieron `asteroids`/`tetris`/`arkanoid` para los motores reales; no hay fila
  `serpentina` sembrada en Supabase con la que colisionar ni historial que perder —
  el catálogo mock que usaba ese id fue retirado por SPEC 06.
- **Sí:** reutilizar `.cover-snake` tal cual existe en `app/globals.css`, sin crear
  una clase nueva. Ya está diseñada temáticamente para este juego y no la usaba
  ningún motor real todavía; evita CSS duplicado.
- **Sí:** color `green` en el catálogo. Es el único de los cuatro colores
  (`cyan`/`magenta`/`yellow`/`green`) que ningún otro motor real usa todavía
  (asteroids=yellow, tetris=cyan, arkanoid=magenta) y coincide con el color que ya
  tenía el placeholder `serpentina`.
- **Sí:** portar `fruits.png`/`sprites.js` a sprites reales y variados en vez de
  formas de canvas planas. El usuario pidió explícitamente usar
  `references/source-assets/snake-assets` y copiar lo necesario a la carpeta del
  juego; descartar el asset e ir con un cuadrado de color habría ignorado esa
  petición.
- **Sí:** `SnakeGame.tsx` precarga la imagen antes de instanciar el motor
  (`createEngine(ctx, spriteImage)`), ampliando la firma respecto a los otros tres
  motores. Es la opción más simple para mantener `update`/`draw` síncronos sin
  reescribir el bucle de juego para manejar un estado de "cargando" dentro del
  propio motor.
- **Sí:** `lives` fijo en `0` y sin estado intermedio `"dead"` (solo
  `"playing"`/`"gameover"`). Snake no tiene concepto de vidas — chocar termina la
  partida de inmediato — mismo patrón que ya usa `tetris`
  (`components/games/tetris/engine.ts`).
- **Sí:** movimiento por grilla con tick temporizado que se acelera con el nivel, no
  movimiento continuo por píxel. Es la mecánica estándar de Snake y la que pidió el
  usuario (crecer comiendo fruta, morir contra pared/cola propia).
- **No:** power-ups, obstáculos, múltiples frutas o selector de dificultad. El
  usuario describió el objetivo clásico de Snake (fruta, crecer, no chocar); añadir
  mecánicas nuevas sería alcance no pedido.
- **No:** soporte táctil/móvil en esta spec. Ningún motor real lo tiene todavía.

---

## Riesgos

| Riesgo                                                                                                                            | Mitigación                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fruits.png` no carga a tiempo (red lenta) y el jugador ve el canvas en blanco antes del mensaje `CARGANDO...`                    | El paso 4 exige mostrar `CARGANDO...` desde el primer render de `SnakeGame`, antes de que exista siquiera el `<img>`, no solo mientras se espera `onload`.                                                                                                                          |
| Colisión de la serpiente detectada un tick tarde permite que la cabeza "atraviese" visualmente un segmento del cuerpo             | La detección de colisión ocurre en el mismo paso de grilla que actualiza la posición de la cabeza, antes de dibujar el frame — mismo orden `update` → `draw` que usan los otros tres motores.                                                                                       |
| `requestAnimationFrame` sigue corriendo tras desmontar la página                                                                  | El `useEffect` de `SnakeGame` cancela el frame pendiente y limpia listeners en su función de limpieza (mismo patrón que `AsteroidsGame`/`TetrisGame`).                                                                                                                              |
| La firma ampliada `createEngine(ctx, spriteImage)` diverge del resto de motores y complica un futuro tipado genérico del registro | Aceptado: `registry.ts` tipa por componente (`SnakeGame`), no por la firma de `createEngine`; el componente es quien absorbe la diferencia, igual que `TetrisGame`/`ArkanoidGame` ya exponen métodos opcionales distintos (`setTheme`, `onResumeRequested`) sin romper el registro. |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles para `snake`.
- Auth real ni `user_id` en `scores`.
- Migración de scores de `localStorage` (ya no aplica).
- Pantalla de administración del catálogo.
- Power-ups, obstáculos, múltiples frutas simultáneas o selector de dificultad.
- Sonido o música.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
