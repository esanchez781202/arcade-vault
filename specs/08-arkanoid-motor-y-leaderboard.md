# SPEC 08 — Arkanoid: motor real y leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-15
> **Objetivo:** Añadir una entrada real `arkanoid` al catálogo, con motor propio portado de `references/started-games/04-arkanoid/game.js`, tercer juego jugable de verdad del sitio tras `asteroids` (SPEC 05) y `tetris` (SPEC 07), registrado en `REGISTRO_MOTORES` sin tocar el resto de `JugarClient.tsx`.

---

## Por qué existe esta spec

`references/started-games/04-arkanoid/` contiene un clon completo y jugable de Arkanoid/Breakout en Canvas/JS puro: paleta, bola, 5 niveles con patrones de bloques distintos y velocidad creciente (`levels.js`), colisiones AABB, animación de explosión por bloque destruido, HUD dibujado en canvas y una pausa con selector de nivel clicable. El catálogo mock (`references/templates/data.jsx`) ya tiene una entrada placeholder de este género (`bloque-buster`, "Rebota la pelota y destruye muros de neón"), nunca sembrada en Supabase — igual que `rocas`/`asteroids` en SPEC 05 y `caida`/`tetris` en SPEC 07, esta spec introduce el juego real con su propio `id` (`arkanoid`, no `bloque-buster`), siguiendo el precedente que fijó SPEC 07 de usar el nombre real del juego como identificador de catálogo.

Auditoría del prototipo (decisiones tomadas en la fase de preguntas del skill, ver `## Decisiones`):

- **Resolución**: 800×600, un solo canvas — encaja igual que `asteroids`/`tetris`, sin letterbox ni cambios al `aspect-ratio` de `.crt-screen`.
- **Estado extra `'win'`**: el prototipo tiene `gameState: 'playing' | 'gameover' | 'win'` (no existe un estado `'dead'` transitorio; al perder una vida se llama `initBall()` y se sigue en `'playing'`). Se decidió **extender la unión de este juego concreto** a `"playing" | "gameover" | "win"` y que el reproductor trate `'win'` igual que `'gameover'` (mismo modal de fin, mismo guardado de score).
- **HUD en canvas**: se retira (`drawHUD` inline en `draw()`), lo cubre el HUD React existente.
- **Overlay de pausa con selector de nivel**: el prototipo, en pausa, dibuja 5 botones clicables para saltar de nivel. Se decidió **portarlo**, con la adaptación de contrato descrita en el paso 4 de implementación (ver más abajo) para no desincronizar el botón PAUSA/REANUDAR del HUD React.
- **Control de paleta**: el prototipo mueve la paleta con teclado (flechas) y ratón (`mousemove`) simultáneamente. Se decidió **solo teclado**, consistente con `asteroids`/`tetris`; el control por ratón no se porta.
- **Render de bloques/paleta/bola**: el prototipo usa un spritesheet PNG (`assets/spritesheet-breakout.png`) cargado de forma asíncrona. Se decidió **redibujar con vectores canvas puros** (rectángulos de color + un burst simple para explosiones) para mantener `engine.ts` 100% síncrono, sin `Image`/`fetch` de ningún tipo, igual que `asteroids`.
- **Sonido**: `bounceSound`/`breakSound` (dos `.mp3`) no se portan (fuera de alcance por defecto, ver `## Alcance`).

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo `games`**: `id: "arkanoid"`, ver `## Modelo de datos`.
- **Motor portado a TypeScript** en `components/games/arkanoid/engine.ts`, siguiendo el patrón de `components/games/asteroids/engine.ts`: lógica pura tipada de `game.js` + `levels.js`, sin `window`/`document`/`canvas` a nivel de módulo. Render de bloques/paleta/bola con formas vectoriales (`fillRect`/`arc`), no con el spritesheet del prototipo. Los 5 niveles de `levels.js` se portan literalmente (mismos patrones de bloques y multiplicadores de velocidad `1.00 → 1.46`).
- **Componente canvas** `components/games/arkanoid/ArkanoidGame.tsx` (`"use client"`), clonando el patrón de `AsteroidsGame.tsx`, con la extensión de contrato para el selector de nivel en pausa (paso 4).
- **Extensión mínima y retrocompatible de `components/games/registry.ts`**: se añade `arkanoid: ArkanoidGame` a `REGISTRO_MOTORES` y un campo opcional `onResumeRequested?: () => void` a `RealGameProps` (no rompe `asteroids`/`tetris`, que simplemente no lo usan).
- **Ajustes puntuales en `JugarClient.tsx`**, todos gateados por `game.id === "arkanoid"` o por comportamiento genérico inocuo para el resto de juegos (detallados en el paso 5).
- **Migración SQL** sembrando `arkanoid` en `games`.

**Fuera de alcance (por defecto, salvo indicación contraria del usuario):**

- Controles táctiles/móviles.
- Control de paleta por ratón (el prototipo lo tiene; se descarta, ver Decisiones).
- Auth real / `user_id` en `scores`.
- Sonido/música (`ball-bounce.mp3`, `break-sound.mp3` no se portan).
- Spritesheet/imágenes del prototipo (`assets/spritesheet-breakout.png`); el render se rehace en vectores.
- Pantalla de administración del catálogo.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

**Migración** (`supabase/migrations/20260915000000_arkanoid.sql`), siguiendo el patrón de `20260914110000_tetris.sql`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'arkanoid', 'ARKANOID',
  'Rebota la pelota y destruye muros de neón.',
  'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
  'ARCADE', 'cover-bricks', 'magenta',
  0, '0', 3
);
```

`short`/`long` reutilizan literalmente el texto del placeholder `bloque-buster` de `references/templates/data.jsx` (mismo patrón que SPEC 05 reutilizó el texto de `rocas` para `asteroids`). `cover: 'cover-bricks'` reutiliza la clase ya existente en `app/globals.css` (línea ~673) — no se crea `.cover-arkanoid`. `color: 'magenta'` evita coincidir con `tetris` (`cyan`) o `asteroids` (`yellow`). `best`/`plays` se siembran en `0`/`'0'`, igual que `tetris` (SPEC 07): esas columnas ya no alimentan la UI en vivo (`MEJOR GLOBAL`/`PARTIDAS` se calculan desde `scores`, SPEC 06 pasos 11-13).

**Contrato motor ↔ componente** (`components/games/arkanoid/engine.ts`):

```ts
export type ArkanoidGameState = "playing" | "gameover" | "win";

export interface ArkanoidEngineState {
  score: number;
  lives: number;
  level: number;
  state: ArkanoidGameState;
}

export interface ArkanoidInputState {
  left: boolean;
  right: boolean;
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  return {
    update, // (dt: number, input: ArkanoidInputState) => void — no-op si state !== 'playing'
    draw, // () => void — frame normal (bloques, paleta, bola, explosiones)
    drawPaused, // () => void — repinta el último frame + overlay semitransparente + 5 botones de nivel
    hitTestPauseButton, // (x: number, y: number) => number | null — x/y en coordenadas de canvas (800×600); null si el click no cae en ningún botón
    jumpToLevel, // (n: number) => void — recarga blocks/ball/paddle para el nivel n (1-5), sin tocar score/lives
    getState, // () => ArkanoidEngineState
    forceGameOver, // () => void — lives = 0, state = 'gameover'
  };
}
export type ArkanoidEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/arkanoid/ArkanoidGame.tsx
export interface ArkanoidGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}
interface ArkanoidGameProps {
  onStateChange: (state: ArkanoidEngineState) => void;
  onResumeRequested?: () => void; // ver paso 4 — solo lo usa este juego
  ref?: Ref<ArkanoidGameHandle>;
}
```

**Extensión de `components/games/registry.ts`** (retrocompatible):

```ts
export interface RealGameProps {
  onStateChange: (state: RealGameState) => void;
  onResumeRequested?: () => void; // nuevo campo opcional; asteroids/tetris no lo implementan
  ref?: Ref<RealGameHandle>;
}

export const REGISTRO_MOTORES: Record<string, ComponentType<RealGameProps>> = {
  asteroids: AsteroidsGame as ComponentType<RealGameProps>,
  tetris: TetrisGame as ComponentType<RealGameProps>,
  arkanoid: ArkanoidGame as ComponentType<RealGameProps>,
};
```

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Migración SQL.** Crear `supabase/migrations/20260915000000_arkanoid.sql` con el `insert` de la sección anterior y aplicarlo con `apply_migration` del MCP de Supabase. Prueba manual: `list_tables` muestra `arkanoid` en `games` (junto a `asteroids` y `tetris`, sin tocarlos); `get_advisors` no reporta RLS deshabilitada.

2. **Portada.** No requiere CSS nuevo: `.cover-bricks` ya existe en `app/globals.css`. Prueba manual: `/biblioteca` muestra la tarjeta "ARKANOID" con esa portada, sin romper el resto de tarjetas.

3. **Motor portado.** Crear `components/games/arkanoid/engine.ts`, tipado, sin `window`/`document`/`canvas` a nivel de módulo — todo se inyecta al crear la instancia (`createEngine(ctx)`).

   - **Física y colisiones**: copiar 1:1 desde `game.js` (recuperar con `git show HEAD:references/started-games/04-arkanoid/game.js` si no está en el working tree) — `PADDLE_SPEED = 400`, `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`, colisión AABB pelota/bloque (`collideAABB`), rebote en paredes izquierda/derecha/arriba, rebote en paleta (con el margen de tolerancia `+8` del original), un bloque destruido por frame (`break`), inversión de `vy` al golpear un bloque, pérdida de vida al salir la pelota por abajo (`ball.y > canvas.height`), `initBall()`/`loadLevel()` reposicionan pelota y paleta.
   - **Niveles**: portar `LEVELS` de `levels.js` (5 niveles, `BLOCK_COLS=10`, `BLOCK_ROWS=6`, `BLOCK_W=64`, `BLOCK_H=24`, offsets `BLOCKS_ORIGIN_X`/`BLOCKS_ORIGIN_Y=80`) como constante interna del módulo (no hace falta archivo separado). Al limpiar el nivel 5, `state = 'win'` (en vez de `gameState = 'win'` del original); al limpiar niveles 1-4, `jumpToLevel`/`loadLevel` interno avanza al siguiente automáticamente (comportamiento actual del prototipo, sin cambios).
   - **Render vectorial** (sustituye al spritesheet): bloques como `fillRect` con un color por nombre (`red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`, `gray` — mapear a valores hex legibles sobre fondo negro, p. ej. los mismos tonos neón que ya usa el sitio para `--cyan`/`--magenta`/`--yellow`/`--green`, más un rosa y un gris de relleno para `hotpink`/`gray`), paleta y bola como `fillRect`/`arc` blancos o con un color de acento fijo. Explosión: en vez de los 4 frames del spritesheet, un burst simple (p. ej. un cuadrado que crece y se desvanece en opacidad durante `EXPLOSION_DURATION = 150` ms, reutilizando el color del bloque destruido) — mismo campo `explosions[]`/`elapsed` que el original, solo cambia cómo se pinta.
   - **HUD retirado**: el bloque de `draw()` que pinta `Score`/`Nivel`/vidas y los overlays `drawOverlay('GAME OVER')`/`drawOverlay('¡Completaste el juego!')` se eliminan — los sustituye el HUD React (`score`/`lives`/`level`/`state` vía `getState()`) y el modal de fin ya existente en `JugarClient.tsx`.
   - **`drawPaused()`**: repinta el último frame (bloques/paleta/bola en su posición actual, sin avanzar física) más un overlay semitransparente (`rgba(0,0,0,0.65)`) con los 5 botones de "saltar a nivel N" — mismo layout que `drawPauseOverlay()` del original (`PAUSE_BTN_W=60`, `PAUSE_BTN_H=40`, `PAUSE_BTN_GAP=12`, fila centrada), resaltando el botón del nivel actual. No incluye el texto "PAUSA" (lo cubre el overlay "EN PAUSA" del reproductor para el resto de juegos, pero ver paso 5 — en `arkanoid` ese overlay genérico se suprime a favor de este).
   - **`hitTestPauseButton(x, y)`**: reimplementación pura (sin `addEventListener`) de la comprobación de rects del `click` listener original — recibe coordenadas ya en espacio de canvas (800×600) y devuelve el número de nivel (1-5) si `x`/`y` caen dentro de algún botón, o `null`.
   - **`jumpToLevel(n)`**: equivalente a `loadLevel(n)` del original — recarga `blocks`/`explosions`/posición de `ball` para el nivel `n`, sin tocar `score`/`lives`.
     Prueba manual: `npx tsc --noEmit` compila.

4. **Componente canvas.** Crear `components/games/arkanoid/ArkanoidGame.tsx` (`"use client"`), clonando `AsteroidsGame.tsx` en todos sus puntos load-bearing (`ref` como prop, `useImperativeHandle`, `reportIfChanged`, `onStateChangeRef`, `resume()` resetea `lastTimeRef`, `dt` capado a `0.05`, canvas 800×600 escalado por `aspectRatio` inline, cleanup de RAF y listeners), con estas diferencias:

   - **Input**: solo `ArrowLeft`/`ArrowRight` (sin ratón). `preventDefault` mientras `state === 'playing'`.
   - **Click en el canvas durante la pausa** (selector de nivel): un listener de `click` sobre el propio `<canvas>` (no `window`), registrado en el mismo `useEffect` de montaje. Al recibir un click: si `pausedRef.current` es `false`, ignorar. Si es `true`, convertir las coordenadas del evento a espacio de canvas (mismo cálculo `scaleX`/`scaleY` que el prototipo, usando `canvas.getBoundingClientRect()`) y llamar `engine.hitTestPauseButton(x, y)`. Si devuelve un nivel `n`: llamar `engine.jumpToLevel(n)`, ejecutar la misma lógica interna que expone `resume()` (poner `pausedRef.current = false`, `lastTimeRef.current = null`, `rafRef.current = requestAnimationFrame(loop)`) — para no duplicar código, extraer esa lógica a una función local `resumeInternal()` reutilizada tanto por `useImperativeHandle().resume` como por este handler — y por último invocar `onResumeRequestedRef.current?.()` (ref al último `onResumeRequested` recibido, mismo patrón que `onStateChangeRef`) para que el padre sincronice su propio estado `paused` a `false`.
   - **`pause()` imperativo**: además de cancelar el RAF (igual que `asteroids`), llama a `engineRef.current?.drawPaused()` una vez, para que el frame congelado incluya el overlay y los botones de nivel.
     Prueba manual: montar el componente muestra el juego (paleta, bola, bloques) moviéndose y respondiendo a las flechas; en pausa, aparecen los 5 botones y clicar uno cambia de nivel y reanuda.

5. **Cableado en `JugarClient.tsx`** (registro ya existe desde SPEC 07 — solo se añade la entrada, sin refactor):

   - Añadir `arkanoid: ArkanoidGame` a `REGISTRO_MOTORES` (paso previo/paralelo en `registry.ts`, ver `## Modelo de datos`).
   - `handleGameStateChange`: cambiar `if (s.state === "gameover") setOver(true);` por `if (s.state === "gameover" || s.state === "win") setOver(true);`. Cambio genérico, no gateado por `game.id` — inocuo para `asteroids`/`tetris`, que nunca reportan `'win'`.
   - Pasar el nuevo prop al montar el motor: `<MotorJuego key={gameKey} ref={gameRef} onStateChange={handleGameStateChange} onResumeRequested={() => { gameRef.current?.resume(); setPaused(false); }} />`. Solo `ArkanoidGame` lo invoca; el resto lo recibe y lo ignora.
   - **Suprimir el overlay genérico "EN PAUSA"** para `arkanoid`: cambiar la condición `{paused && ( ... )}` del bloque `.crt-content` (overlay oscuro con "EN PAUSA" / "PULSA REANUDAR PARA CONTINUAR") a `{paused && game.id !== "arkanoid" && ( ... )}`. Para `arkanoid`, el propio canvas ya dibuja su overlay de pausa con los botones de nivel (paso 4); dejar ambos overlays superpuestos duplicaría el mensaje y el overlay genérico (un `<div>` posicionado encima) bloquearía los clics sobre el canvas.
   - **Tecla P/Esc para pausar**, igual que el `useEffect` ya existente para `tetris` (líneas ~166-174 de `JugarClient.tsx`): añadir un efecto equivalente gateado por `game.id === "arkanoid"` que llama a `togglePause()` en `KeyP`/`Escape` mientras no `over`. Replica el comportamiento del prototipo (`if ((e.key==='p'||e.key==='P'||e.key==='Escape') && gameState==='playing') isPaused = !isPaused`).
     Prueba manual: `npx tsc --noEmit` compila; `/juego/asteroids/jugar` y `/juego/tetris/jugar` siguen funcionando exactamente igual que antes de esta spec.

6. **Verificación de juego completo.** Jugar una partida real en `/juego/arkanoid/jugar`:

   - El HUD React (Puntuación/Vidas/Nivel) refleja el estado real del motor.
   - Mover con flechas izquierda/derecha; clic de ratón no mueve la paleta.
   - PAUSA congela el canvas y muestra el overlay con los 5 botones de nivel (sin el overlay genérico "EN PAUSA" duplicado encima); clicar un botón salta a ese nivel y reanuda automáticamente (el botón del HUD pasa a mostrar "PAUSA" de nuevo, no "REANUDAR").
   - REANUDAR (botón del HUD, sin clicar ningún nivel) retoma sin salto de tiempo.
   - Perder las 3 vidas abre el modal de fin con el score real; completar los 5 niveles (`state: 'win'`) también abre el mismo modal con el score real.
   - Tecla P/Esc alterna pausa igual que el botón del HUD.
   - `GUARDAR PUNTUACIÓN` escribe en `scores` vía `guardarScoreAction` (sin tocar `actions.ts`).
   - `/juego/arkanoid` (mini-tabla) y `/salon` (tab ARKANOID) reflejan esa fila tras recargar — ninguna de las dos pantallas necesita cambios, ya leen genéricamente por `game.id`.
   - `/juego/asteroids/jugar` y `/juego/tetris/jugar` se comportan exactamente igual que antes de esta spec.
     Ejecutar `npx next build` y corregir errores. Si `next dev` reescribió el bloque `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `arkanoid` en `games` con `difficulty = 3` explícita; `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra una tarjeta nueva "ARKANOID" con la portada `cover-bricks`, junto a "ASTEROIDS" y "TETRIS" sin alterarlas.
- [ ] `components/games/arkanoid/engine.ts` no referencia `window`, `document` ni `canvas` a nivel de módulo, y no carga ninguna imagen (`Image`/`fetch`) — render 100% vectorial.
- [ ] `/juego/arkanoid/jugar` muestra el juego real jugable con las flechas del teclado; el HUD React refleja el estado real del motor.
- [ ] PAUSA congela el canvas y muestra el selector de nivel (5 botones); clicar un botón cambia de nivel, reanuda la partida y el botón del HUD vuelve a decir "PAUSA" (no queda desincronizado en "REANUDAR").
- [ ] REANUDAR (sin clicar ningún botón de nivel) retoma sin salto de tiempo.
- [ ] Perder las 3 vidas o completar el nivel 5 (`state: 'win'`) abre el modal de fin con el score real; `GUARDAR PUNTUACIÓN` inserta en `scores` vía la Server Action existente.
- [ ] La fila guardada aparece en `/juego/arkanoid` (mini-tabla) y en `/salon` (tab ARKANOID) tras recargar.
- [ ] Tecla P/Esc alterna pausa en `/juego/arkanoid/jugar`, igual que el botón del HUD.
- [ ] `/juego/asteroids/jugar` y `/juego/tetris/jugar` siguen comportándose exactamente igual que antes de esta spec (incluido su overlay genérico "EN PAUSA", que sigue apareciendo para ellos).
- [ ] `components/games/registry.ts` incluye `arkanoid` en `REGISTRO_MOTORES`; el campo nuevo `onResumeRequested` es opcional y no rompe el tipado de `AsteroidsGame`/`TetrisGame`.

---

## Decisiones

- **Sí:** `id: "arkanoid"` / `title: "ARKANOID"`, no `bloque-buster`. Sigue el precedente de SPEC 07 (`caida` → `tetris`): el nombre real del juego es más reconocible que el codename del placeholder mock.
- **Sí:** reutilizar `short`/`long`/`cat: "ARCADE"`/`cover: "cover-bricks"` del placeholder `bloque-buster` de `references/templates/data.jsx`. Mismo patrón que SPEC 05 reutilizó el texto/portada de `rocas` para `asteroids`: cero contenido ni CSS nuevo que inventar, la temática ya coincide exactamente.
- **Sí:** `color: "magenta"`, no `cyan` (el color pensado originalmente para `bloque-buster`, pero ya usado por `tetris`). Evita que dos tarjetas del catálogo compartan acento de color.
- **Sí:** `best: 0`, `plays: '0'` sembrados, igual que `tetris` (SPEC 07), no números falsos altos como los que se usaron para `asteroids`/`rocas`. Esas columnas ya no alimentan la UI en vivo desde SPEC 06 (pasos 11-13).
- **Sí:** `difficulty: 3`. Cinco niveles con patrones de bloques cada vez más densos y velocidad de bola creciente (`1.00× → 1.46×`) es más exigente que `tetris` (`difficulty: 2`) pero no requiere la profundidad táctica de `asteroids`.
- **Sí:** extender el estado del motor a `"playing" | "gameover" | "win"` (solo para este juego) y que el reproductor trate ambos como fin de partida. Es fiel al comportamiento del prototipo (5 niveles tienen un final real) sin inventar una condición de derrota artificial al completarlos.
- **Sí:** portar el selector de nivel en pausa, con la extensión de contrato (`onResumeRequested`, `drawPaused`, `hitTestPauseButton`, `jumpToLevel`) descrita en el plan, en vez de descartarlo como hizo SPEC 05 con el overlay de pausa de `asteroids`. A diferencia de `asteroids` (que no tenía nada dibujado en su pausa), este selector es una función jugable explícita del prototipo que el usuario pidió conservar; se acepta la complejidad adicional de sincronizar el botón PAUSA/REANUDAR del HUD con una reanudación disparada desde dentro del canvas.
- **Sí:** suprimir el overlay genérico "EN PAUSA" de `JugarClient.tsx` solo para `game.id === "arkanoid"`. Ese overlay es un `<div>` posicionado encima del `.crt-screen`; dejarlo visible bloquearía los clics sobre los botones de nivel dibujados en el canvas, y además duplicaría visualmente el mensaje de pausa que ya dibuja el propio motor.
- **Sí:** control de paleta solo por teclado (flechas), sin ratón. Consistente con `asteroids`/`tetris`, los dos motores reales existentes; el prototipo soporta ambos pero el repo no ha introducido controles de ratón/touch en ningún juego real todavía.
- **Sí:** render vectorial (rectángulos/arcos de color) en vez de portar el spritesheet PNG. Mantiene `engine.ts` síncrono (mismo patrón que `asteroids`, sin `Image`/`fetch`/estado de carga) y es consistente con la estética retro-neón vectorial que ya tienen `asteroids` y el resto del sitio, en vez de introducir el único motor con arte bitmap.
- **No:** sonido. `bounceSound`/`breakSound` no se portan; no hay precedente de audio en ningún motor real del repo todavía.
- **No:** control táctil/móvil, tal como en `asteroids` y `tetris`.
- **No:** un nuevo refactor del registro de motores. `components/games/registry.ts` ya existe desde SPEC 07; esta spec solo añade una entrada.

---

## Riesgos

| Riesgo                                                                                                                                 | Mitigación                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El motor portado a TS introduce una regresión sutil de física/colisiones respecto al prototipo                                         | El paso 3 copia la lógica 1:1 (mismas constantes y fórmulas de `game.js`/`levels.js`); el paso 6 verifica jugando una partida completa, incluidas las 3 vidas y los 5 niveles.                                                    |
| El selector de nivel en pausa desincroniza el botón PAUSA/REANUDAR del HUD (el canvas reanuda internamente sin que el padre se entere) | El contrato `onResumeRequested` (paso 4-5) obliga a que cualquier reanudación disparada desde dentro del canvas notifique explícitamente a `JugarClient.tsx`, que actualiza su propio estado `paused` a `false` en el mismo tick. |
| Suprimir el overlay genérico "EN PAUSA" solo para `arkanoid` rompe por error la pausa de `asteroids`/`tetris`                          | El cambio en `JugarClient.tsx` es una condición explícita (`game.id !== "arkanoid"`), no una eliminación del bloque; el paso 6 verifica textualmente que `asteroids`/`tetris` conservan su overlay genérico sin cambios.          |
| `requestAnimationFrame` sigue corriendo tras desmontar la página, o el listener de `click` del canvas queda activo entre partidas      | El `useEffect` de `ArkanoidGame` cancela el frame pendiente y quita tanto los listeners de teclado como el de `click` en su función de limpieza (mismo patrón que `AsteroidsGame`).                                               |
| El render vectorial (sin spritesheet) hace que `arkanoid` se vea visualmente distinto al prototipo original                            | Aceptado explícitamente en las decisiones: prioriza consistencia estética con el resto del sitio y un motor 100% síncrono sobre una réplica pixel-perfect del sprite art original.                                                |

---

## Lo que **no** entra en esta spec

- Control de paleta por ratón/touch.
- Auth real / `user_id` en `scores`.
- Sonido o música (`ball-bounce.mp3`, `break-sound.mp3`).
- El spritesheet original (`assets/spritesheet-breakout.png`) ni ninguna carga de imagen asíncrona en el motor.
- Pantalla de administración del catálogo.
- Un nuevo refactor de `components/games/registry.ts` (ya existe desde SPEC 07).
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
