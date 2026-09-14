# SPEC 07 — TETRIS: motor real y leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-14
> **Objetivo:** Dar de alta `tetris` como segundo juego real del catálogo (motor portado desde `references/started-games/03-tetris/game.js`, con leaderboard en Supabase), introducir el registro genérico de motores en el reproductor porque deja de haber un único juego real, y (ampliación post-cierre, pasos 7-11) portar el toggle claro/oscuro, el selector de skins, el nivel inicial y las stats de récord/combo que el prototipo incorporó después.

---

## Por qué existe esta spec

`references/started-games/03-tetris/` es un clon completo y jugable de Tetris en Canvas/JS
puro (tablero 10×20, las 7 piezas estándar, rotación con wall-kicks, soft/hard drop, pieza
fantasma, vista previa de la siguiente pieza, puntuación y niveles clásicos). Hoy el único
juego con motor real es `asteroids` (SPEC 05/06); esta spec aplica la misma receta a Tetris
para que tenga su propia entrada de catálogo jugable y leaderboard real, en vez de la
simulación decorativa que sigue mostrando `jugar/page.tsx` para el resto de juegos.

El prototipo tiene tres particularidades que no encajan directamente en el contrato actual
(`components/games/asteroids/engine.ts` + `AsteroidsGame.tsx`), resueltas en la fase de
preguntas del skill:

- **Sin vidas.** Tetris no tiene concepto de vidas (una pieza que colisiona al generarse es
  game over directo); no existe tampoco un estado `dead` intermedio como en Asteroids.
  Decisión: el motor de Tetris solo usa `state: "playing" | "gameover"` (nunca `"dead"`) y
  reporta `lives: 0` de forma constante, sin uso real en el HUD ni en la lógica de fin.
- **Proporción de canvas distinta a 4:3.** El tablero del prototipo es 300×600 (10×20 celdas
  de 30px), proporción 1:2, mientras que `.crt-screen` es `aspect-ratio: 4/3`. Decisión:
  letterbox dentro del canvas — el `<canvas>` se declara a 800×600 (mismo tamaño lógico que
  usa Asteroids, encaja con `.crt-screen` sin tocar CSS global) y el motor dibuja el tablero
  300×600 centrado horizontalmente, con las columnas sobrantes a los lados vacías (mismo
  color de fondo que el resto del canvas).
- **HUD auxiliar de "siguiente pieza".** El prototipo tiene un segundo `<canvas id="next-canvas">`
  120×120 fuera del tablero principal. Decisión: se porta como un segundo `<canvas>` React
  dentro del HUD del reproductor (fuera del marco `.crt-screen` principal), alimentado por el
  motor a través de `getState()`.

Además, el prototipo expone `lines` (líneas completadas) como dato propio del HUD, sin
equivalente en el contrato base — se añade como campo extra en `TetrisEngineState`. Y usa la
tecla `P` como atajo de pausa además del botón "PAUSA" del reproductor — se mantiene ese
atajo, replicando el `togglePause()` del prototipo.

Como `tetris` es el **segundo** motor real (después de `asteroids`), esta spec incluye el
refactor de `JugarClient.tsx` de su booleano `isAsteroids` a un registro genérico
`components/games/registry.ts` — SPEC 05 dejó ese refactor explícitamente pendiente para
cuando existiera un segundo caso que lo justificara, y ahora existe.

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo `games`.** `id: "tetris"`, `title: "TETRIS"`,
  `cat: "PUZZLE"`, `color: "cyan"`, `difficulty: 2`, `best: 0`, `plays: "0"`, con `cover:
"cover-tetris"` (clase nueva, ver siguiente punto).
- **Portada CSS nueva `.cover-tetris`** en el bloque de portadas de `app/globals.css`, sin
  reutilizar ninguna clase existente (ninguna encaja temáticamente con la identidad visual de
  Tetris — bloques de colores sobre grid).
- **Motor portado a TypeScript**, en `components/games/tetris/`:
  - `engine.ts`: lógica pura portada de `game.js` (tablero `ROWS×COLS`, las 7 piezas,
    `rotateCW`/wall-kicks, `collide`, `clearLines`, `ghostY`, soft/hard drop, `LINE_SCORES`,
    progresión de nivel/velocidad), sin `window`/`document`/`canvas` a nivel de módulo — todo
    inyectado al crear la instancia (incluye el `CanvasRenderingContext2D` del tablero y el
    del canvas "next", ambos inyectados por el componente). `state` limitado a
    `"playing" | "gameover"`; `lives` fijo en `0`.
  - `TetrisGame.tsx` (`"use client"`): monta el `<canvas>` principal 800×600 (tablero 300×600
    dibujado centrado, letterbox) y el `<canvas>` "next" 120×120, crea el motor en un
    `useEffect`, arranca/cancela el bucle `requestAnimationFrame`, expone `pause()` /
    `resume()` / `forceGameOver()` vía `ref`, y llama a `onStateChange` con
    `{ score, lives: 0, level, lines, state }`.
  - El HUD que hoy pinta `game.js` en el sidebar DOM (`#score`/`#lines`/`#level`) se retira:
    el HUD React del reproductor pasa a mostrar Puntuación/Nivel/Líneas, alimentado por
    `onStateChange`. El canvas "next" sigue siendo un `<canvas>` (no se convierte a HTML/CSS),
    pero se monta dentro del HUD React, no dentro del `.crt-screen` del tablero.
- **Registro genérico de motores.** Nuevo `components/games/registry.ts` con
  `REGISTRO_MOTORES: Record<string, ComponentType<RealGameProps>>` mapeando `asteroids` →
  `AsteroidsGame` y `tetris` → `TetrisGame`. Refactor de
  `app/juego/[id]/jugar/JugarClient.tsx`: sustituir el booleano `isAsteroids` y sus puntos de
  ramificación (los `useEffect` de simulación, `endGame`, `togglePause`, `restart`, el JSX del
  marco CRT) por `const MotorJuego = REGISTRO_MOTORES[game.id]`, conservando el bloque
  `.game-arena` simulado como fallback para cualquier `id` fuera del registro. El
  comportamiento de `asteroids` debe quedar idéntico tras el refactor.
- **Tecla `P` como atajo de pausa**, además del botón "PAUSA" del HUD, activo solo mientras
  `TetrisGame` está montado y `state === "playing"`.
- **Migración SQL.** Nuevo archivo en `supabase/migrations/` que siembra `tetris` en `games`.

**Fuera de alcance (por defecto, salvo que el usuario pida lo contrario):**

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage` (ya no aplica, SPEC 06 retiró ese mecanismo).
- Pantalla de administración del catálogo.
- Sonido/música (el prototipo no lo trae).
- Sistema de "hold piece" o "7-bag randomizer" — el prototipo usa selección puramente
  aleatoria (`Math.floor(Math.random() * 8) + 1`, incluye la pieza N/tuerca de 9 tipos según
  `PIECES`), se porta tal cual sin mejoras de generación.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Fila de siembra para `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'tetris', 'TETRIS',
  'Encaja las piezas y despeja líneas antes de que el tablero se desborde.',
  'El clásico de siempre: siete piezas caen desde arriba en un tablero de 10x20. Rota, desplaza y deja caer para completar líneas horizontales antes de que la pila llegue al techo. La velocidad aumenta con cada nivel.',
  'PUZZLE', 'cover-tetris', 'cyan',
  0, '0', 2
);
```

`difficulty` es `not null` **sin default** — la migración debe darlo siempre (ver
`supabase/migrations/20260914100000_games_difficulty.sql`). `cat` y `color` están
restringidos por `CHECK` a los valores ya existentes; `PUZZLE` y `cyan` ya son valores válidos.

Contrato TypeScript entre el motor y el componente:

```ts
// components/games/tetris/engine.ts
export type TetrisGameState = "playing" | "gameover"; // sin "dead": Tetris no tiene vidas
export type TetrisTheme = "dark" | "light"; // ampliación paso 7
export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel"; // ampliación paso 8

export interface TetrisEngineState {
  score: number;
  lives: 0; // constante, sin uso real; se mantiene por compatibilidad con RealGameProps
  level: number;
  lines: number; // campo propio de Tetris, fuera del contrato base
  maxCombo: number; // ampliación paso 10
  state: TetrisGameState;
}

export interface TetrisInputState {
  left: boolean;
  right: boolean;
  softDrop: boolean;
  rotate: boolean; // ArrowUp o KeyX
  hardDrop: boolean; // Space
}

export function createEngine(ctx: CanvasRenderingContext2D, nextCtx: CanvasRenderingContext2D) {
  /* ... */
  return { update, draw, getState, forceGameOver, setTheme, setSkin, setStartLevel };
}
export type TetrisEngine = ReturnType<typeof createEngine>;
```

```ts
// components/games/tetris/TetrisGame.tsx
export interface TetrisGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  setTheme(theme: TetrisTheme): void; // ampliación paso 7, aplica en vivo
  setSkin(skin: TetrisSkin): void; // ampliación paso 8, aplica en vivo
}
interface TetrisGameProps {
  onStateChange: (state: TetrisEngineState) => void;
  ref?: Ref<TetrisGameHandle>; // React 19: ref como prop, sin forwardRef
}
```

El nivel inicial (ampliación paso 9) **no** se expone como método del `ref`: `TetrisGame` lo
lee de `localStorage` (`tetris-start-level`) dentro de su propio efecto de montaje, junto con
`tetris-theme`/`tetris-skin`, para que el ajuste no dependa del orden de efectos entre
componentes (ver Decisiones y paso 11).

```ts
// components/games/registry.ts
export interface RealGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  /** Solo implementado por TetrisGame (ampliaciones de los pasos 7-8). */
  setTheme?(theme: "dark" | "light"): void;
  setSkin?(skin: "retro" | "neon" | "pastel" | "pixel"): void;
}
export interface RealGameProps {
  onStateChange: (state: { score: number; lives: number; level: number; state: string }) => void;
  ref?: Ref<RealGameHandle>;
}
export const REGISTRO_MOTORES: Record<string, ComponentType<RealGameProps>> = {
  asteroids: AsteroidsGame,
  tetris: TetrisGame,
};
```

`TetrisEngineState` reporta un `lines` extra que `RealGameProps.onStateChange` no tipa —
`TetrisGame` lo expone igualmente en el callback (el tipo genérico del registro admite campos
adicionales); el HUD del reproductor lo lee de forma específica cuando `game.id === "tetris"`.

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Migración SQL.** Nuevo archivo `supabase/migrations/<YYYYMMDDHHMMSS>_tetris.sql` con el
   `insert` de la sección anterior. Aplicar con `apply_migration` del MCP de Supabase. Prueba
   manual: `list_tables` muestra la fila nueva junto a `asteroids`; `get_advisors` no reporta
   RLS deshabilitada.
2. **Portada CSS.** `.cover-tetris` nueva en el bloque de portadas de `app/globals.css`,
   siguiendo la convención `cover-bg` base + detalle en `::after` + glifo en `::before` +
   `filter: drop-shadow(...)` con `--cyan`. Prueba manual: `/biblioteca` muestra la portada
   nueva sin CSS roto en otras tarjetas.
3. **Motor portado.** `components/games/tetris/engine.ts`: lógica pura tipada, portada 1:1 del
   prototipo (mismas constantes `COLS`/`ROWS`/`BLOCK`/`COLORS`/`PIECES`/`LINE_SCORES`, mismas
   fórmulas de wall-kick, `clearLines`, `ghostY`, progresión de `dropInterval`), sin
   `window`/`document`/`canvas` a nivel de módulo. El dibujo del tablero se traslada al offset
   de letterbox (centrado en el `<canvas>` 800×600); el dibujo de la pieza siguiente va al
   `nextCtx` inyectado. `drawHUD()` no existe como tal en el original (el HUD ya estaba en DOM
   fuera del canvas), así que no hay HUD que retirar del `draw()`. Prueba manual:
   `npx tsc --noEmit` compila.
4. **Componente canvas.** `components/games/tetris/TetrisGame.tsx` (`"use client"`), clonando
   el patrón de `components/games/asteroids/AsteroidsGame.tsx`: `ref` como prop
   (`ref?: Ref<TetrisGameHandle>`), `useImperativeHandle` con `pause/resume/forceGameOver`,
   `reportIfChanged` para no disparar `setState` cada frame, `onStateChange` guardado en ref,
   `resume()` resetea `lastTimeRef.current = null`, `dt` capado a `0.05`, listeners de teclado
   sobre `window` con `preventDefault` condicionado a `state === "playing"` (incluye la tecla
   `P` para pausa, invocando el mismo método que el botón "PAUSA" del HUD), canvas con
   resolución lógica fija 800×600 escalado por estilo inline
   (`aspectRatio: "800 / 600"`), y un segundo `<canvas>` "next" 120×120 sin escalado (fuera del
   `.crt-screen`). Cleanup que cancela el `requestAnimationFrame` pendiente y quita los
   listeners. Prueba manual: montar el componente muestra el tablero letterboxed y el "next"
   moviéndose, responde a los controles y a `P`.
5. **Registro de motores.** Crear `components/games/registry.ts` con `REGISTRO_MOTORES` (ver
   Modelo de datos). Refactorizar `app/juego/[id]/jugar/JugarClient.tsx`: sustituir el
   booleano `isAsteroids` y sus cinco puntos de ramificación (los dos `useEffect` de
   simulación, `endGame`, `togglePause`, `restart`, el JSX del marco CRT) por
   `const MotorJuego = REGISTRO_MOTORES[game.id]`, conservando el bloque `.game-arena`
   simulado como fallback cuando `game.id` no está en el registro. El HUD añade la fila
   "LÍNEAS" solo cuando `game.id === "tetris"` (lee `lines` del último estado reportado).
   Prueba manual: `npx tsc --noEmit` compila; `/juego/asteroids/jugar` sigue funcionando
   exactamente igual que antes del refactor.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/tetris/jugar`: HUD
   React (Puntuación/Nivel/Líneas) en tiempo real, canvas "next" mostrando la siguiente pieza,
   PAUSA (botón y tecla `P`) congela el canvas, REANUDAR retoma, una pieza que colisiona al
   generarse abre el modal de fin con el score real, `GUARDAR PUNTUACIÓN` escribe en `scores`
   vía `guardarScoreAction` (sin tocar). Confirmar que `/juego/tetris` y `/salon` (tab
   `tetris`) reflejan esa fila tras recargar — ninguna de las dos pantallas necesita cambios.
   Confirmar también que `/juego/asteroids/jugar` sigue idéntico tras el refactor del paso 5.
   Ejecutar `npx next build` y corregir errores. Si `next dev` reescribió el bloque
   `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

### Ampliación post-cierre (pasos 7-11)

Añadida a petición del usuario tras completar el paso 6, al detectar que
`references/started-games/03-tetris/` había sido reescrito con tres funcionalidades nuevas
(`requirements.md`: menú de pausa completo, tabla de records local, selector de skins) que no
estaban en el prototipo auditado en la Fase 2 del skill `/add-game` ni en el alcance original
de esta spec. Las tres se implementaron, adaptadas a la arquitectura ya existente de Arcade
Vault en vez de portarse literalmente:

7. **Toggle claro/oscuro** (portado tal cual del prototipo, botón ☾/☀). Añadido primero, a
   petición directa del usuario, antes de detectarse las otras tres funcionalidades.
   - `engine.ts`: `TetrisTheme = "dark" | "light"`, `THEME_COLORS` con los mismos valores
     `--canvas-bg`/`--grid-line` del prototipo, método `setTheme()`. Afecta tablero y canvas
     "next"; las barras de letterbox se quedan negras siempre (marco CRT).
   - `TetrisGame.tsx`: `setTheme` en el ref imperativo, redibuja al instante aunque esté en
     pausa.
   - `JugarClient.tsx`: botón ☾/☀ junto al panel lateral, persistido en `localStorage`
     (`tetris-theme`, misma clave que el prototipo).
8. **Selector de skins** (Retro/Neon/Pastel/Pixel Art, portado del bloque `SKINS` de
   `game.js`, incluido el glow `shadowBlur` de Neon). Cada skin trae su propia paleta y su
   propio `drawBlock`; `boardBg` fijo (si existe) ignora el tema claro/oscuro — la rejilla
   sigue siempre el tema, igual que el original. `engine.ts` expone `setSkin()`; select en el
   panel lateral de `JugarClient.tsx`, persistido en `localStorage` (`tetris-skin`).
9. **Nivel inicial + controles**, adaptado del menú de pausa del prototipo al patrón de HUD
   compartido de Arcade Vault en vez de un overlay propio (ver Decisiones): selector −/+
   (1-15) en el panel lateral que aplica solo en la _próxima_ partida, persistido en
   `localStorage` (`tetris-start-level`); botón "REINICIAR" nuevo en el HUD (`game.id ===
"tetris"` únicamente) que reinicia sin pasar por game over; panel "VER CONTROLES" plegable.
   `engine.ts`: `initGame(startLevel)` ahora acepta el nivel inicial (antes fijo en 1).
10. **Récord y stats de combo/líneas**, adaptado de la tabla de records local del prototipo
    (`localStorage`) a comparar contra el mejor score **real de Supabase** (ver Decisiones):
    `app/juego/[id]/jugar/page.tsx` pasa `mejorGlobal` (vía `obtenerMejoresScores(id, 1)`) a
    `JugarClient`; el modal de fin muestra "¡NUEVO RÉCORD!" cuando `score > mejorGlobal` y las
    stats "Líneas: X · Combo máximo: Y". `engine.ts` añade tracking de combo (`maxCombo`,
    portado de `clearLines()` del prototipo) y lo expone en `TetrisEngineState`.
11. **Dos bugs encontrados y corregidos durante la verificación de los pasos 7-10:**
    - **Condición de carrera con React Strict Mode (solo dev).** Un efecto en `JugarClient`
      reaplicaba tema/skin/nivel sobre la instancia de motor recién creada en `TetrisGame`,
      pero Strict Mode desmonta y remonta cada componente una vez más al montar (dev only) —
      el efecto padre corría contra la instancia transitoria, y el ajuste se perdía en la
      instancia final tras un REINICIAR. Solución: `TetrisGame` lee tema/skin/nivel
      directamente de `localStorage` dentro de su propio efecto de montaje (`createEngine` +
      aplicar ahí mismo), sin depender de que un efecto externo lo reaplique después.
    - **Desincronización del estado de pausa.** `P`/`Escape` pausaban el motor dentro de
      `TetrisGame` sin avisar a `JugarClient`, dejando el botón PAUSA/REANUDAR y el overlay
      "EN PAUSA" (estado de `JugarClient`) desactualizados. Solución: `P`/`Escape` se maneja
      centralmente en `JugarClient` (única fuente de verdad de `paused`); `TetrisGame` solo
      bloquea inputs de juego mientras `pause()` (llamado por ref) esté activo.
      Prueba manual de ambos: REINICIAR con skin/nivel distintos al default aplica
      correctamente en la instancia final (verificado leyendo el píxel del canvas vía
      `getImageData`); `Escape` sincroniza el botón/overlay de pausa igual que el botón HUD.

---

## Criterios de aceptación

- [x] `npx next build` termina sin errores ni warnings de TypeScript.
- [x] `supabase/migrations/` tiene una migración nueva que siembra `tetris` en `games` con
      `difficulty` explícita; `get_advisors` no reporta RLS deshabilitada.
- [x] `/biblioteca` muestra una tarjeta nueva para `tetris`, con portada `.cover-tetris` propia
      y datos correctos.
- [x] `components/games/tetris/engine.ts` no referencia `window`, `document` ni `canvas` a
      nivel de módulo.
- [x] `/juego/tetris/jugar` muestra el juego real jugable con teclado: tablero letterboxed
      dentro del marco CRT, canvas "next" con la pieza siguiente, HUD React con
      Puntuación/Nivel/Líneas reflejando el estado real del motor.
- [x] Rotación (↑/X con wall-kicks), movimiento lateral, soft drop y hard drop funcionan;
      Espacio no hace scroll de la página mientras `state === "playing"`.
- [x] PAUSA (botón del HUD y tecla `P`/`Esc`) congela el canvas; REANUDAR retoma sin salto de
      tiempo. (Ampliación paso 11: la pausa por teclado se centralizó en `JugarClient` para no
      desincronizar el botón/overlay del estado real del motor.)
- [x] Una pieza que colisiona al generarse (game over) abre el modal de fin con el score real;
      `GUARDAR PUNTUACIÓN` inserta en `scores` vía la Server Action existente.
- [x] La fila guardada aparece en `/juego/tetris` (mini-tabla) y en `/salon` (tab `tetris`)
      tras recargar.
- [x] `/juego/asteroids/jugar` se comporta exactamente igual que antes de esta spec, tras el
      refactor a `REGISTRO_MOTORES`.
- [x] `components/games/registry.ts` existe; `JugarClient.tsx` ya no tiene el booleano
      `isAsteroids`.

**Ampliación (pasos 7-11):**

- [x] El botón ☾/☀ cambia el tema del tablero y del canvas "next" en vivo, persistido en
      `localStorage` (`tetris-theme`); no afecta a ningún otro juego ni pantalla del sitio.
- [x] El selector de skin (Retro/Neon/Pastel/Pixel Art) cambia el render del tablero en vivo
      (incluido el glow de Neon), persistido en `localStorage` (`tetris-skin`).
- [x] El selector "Nivel inicial" (−/+, 1-15) y el botón "REINICIAR" solo aparecen para
      `game.id === "tetris"`; el nivel elegido se aplica en la partida siguiente (verificado:
      HUD "NIVEL" refleja el valor elegido tras REINICIAR, no antes).
- [x] "VER CONTROLES" muestra/oculta la lista de teclas sin afectar el estado del juego.
- [x] El modal de fin muestra "¡NUEVO RÉCORD!" solo cuando `score > mejorGlobal` (dato real de
      Supabase, no de `localStorage`) y siempre muestra "Líneas: X · Combo máximo: Y" para
      `tetris`.
- [x] Tras un REINICIAR, la instancia final del motor (post doble-montaje de Strict Mode en
      dev) queda con el tema/skin/nivel elegidos — verificado leyendo el píxel del canvas.
- [x] `Escape` (o `P`) alterna pausa y mantiene el botón PAUSA/REANUDAR y el overlay "EN PAUSA"
      sincronizados con el estado real del motor.

---

## Decisiones

- **Sí:** `state` de Tetris limitado a `"playing" | "gameover"`, sin `"dead"`; `lives` fijo en
  `0`, sin uso real. Tetris no tiene vidas en el prototipo original; forzar un valor ficticio
  de vidas sería inventar una mecánica que no existe. El reproductor solo reacciona a
  `gameover`, así que no perder el estado `dead` no rompe ningún flujo existente.
- **Sí:** letterbox del tablero 300×600 dentro de un `<canvas>` 800×600 (mismo tamaño lógico
  que Asteroids), en vez de relajar el `aspect-ratio: 4/3` de `.crt-screen`. Mantiene el marco
  CRT consistente entre todos los juegos sin CSS condicional por juego.
- **Sí:** segundo `<canvas>` React para la pieza "next", montado en el HUD fuera del
  `.crt-screen` principal. Es una mecánica jugable real del prototipo (vista previa), no
  decorativa; ocultarla degradaría el juego respecto al original.
- **Sí:** campo `lines` como extensión propia de `TetrisEngineState`, mostrado en el HUD solo
  para `game.id === "tetris"`. Es un dato central de Tetris sin equivalente en el contrato
  base; forzarlo a encajar en `level`/`score` perdería información.
- **Sí:** mantener `P`/`Esc` como atajo de pausa, además del botón "PAUSA" del HUD. Fiel al
  prototipo original. Manejado centralmente en `JugarClient` (no dentro de `TetrisGame`, ver
  paso 11) para que el botón/overlay de pausa nunca se desincronicen de una pausa disparada
  por teclado.
- **Sí:** crear `.cover-tetris` nueva en vez de reutilizar una clase existente. Ninguna
  portada actual (`cover-rocas`, `cover-bricks`, etc.) representa temáticamente a Tetris.
- **Sí:** introducir `components/games/registry.ts` en esta spec, refactorizando
  `JugarClient.tsx`. `tetris` es el segundo motor real; SPEC 05 dejó este refactor
  explícitamente pendiente para este momento.
- **No:** hold piece, 7-bag randomizer, ni ninguna mejora sobre la generación puramente
  aleatoria del prototipo original. Fuera del alcance de portar el juego tal cual existe.

**Decisiones de la ampliación (pasos 7-11):**

- **Sí:** implementar las tres funcionalidades nuevas del prototipo reescrito (toggle,
  skins, menú de pausa, records) en esta misma rama, a petición explícita del usuario, en vez
  de abrir una spec nueva. Se adaptaron a la arquitectura existente en vez de portarse
  literalmente (ver las tres decisiones siguientes).
- **No:** portar el menú de pausa del prototipo (overlay propio con Reanudar/Reiniciar/Ver
  controles/Nivel inicial) tal cual. Habría duplicado el botón PAUSA/REANUDAR y el flujo
  "JUGAR DE NUEVO" que ya existen en el HUD compartido de `JugarClient` (con Asteroids). Se
  adaptó a piezas sueltas dentro del patrón existente: nivel inicial y "ver controles" en el
  panel lateral, un botón "REINICIAR" nuevo en el HUD, sin overlay propio.
- **No:** portar la tabla de records local (`localStorage`) del prototipo. SPEC 06 retiró
  explícitamente ese mecanismo a favor de Supabase como única fuente de verdad del
  leaderboard; una tabla de records paralela en `localStorage` lo habría contradicho y
  duplicado lo que ya muestran `/juego/tetris` y `/salon`. Se adaptó a comparar el score final
  contra `mejorGlobal` (Supabase, vía `obtenerMejoresScores`) para el badge "¡NUEVO RÉCORD!",
  y a mostrar líneas/combo máximo como stats de sesión en el modal de fin (sin persistirlos en
  `scores`, que no tiene esas columnas — no se modificó el esquema).
- **Sí:** que `TetrisGame` lea tema/skin/nivel inicial de `localStorage` en su propio efecto de
  montaje, en vez de que `JugarClient` se los reaplique con un efecto externo tras cada
  (re)montaje. La segunda forma sufría una condición de carrera real con el doble-montaje de
  Strict Mode en desarrollo (ver paso 11): el efecto externo solo corre una vez y podía
  aplicar los ajustes sobre la instancia de motor transitoria que Strict Mode descarta.
- **Sí:** centralizar el manejo de `P`/`Esc` en `JugarClient` en vez de dentro de `TetrisGame`.
  Evita la desincronización real detectada en el paso 11 entre el estado interno del motor y
  el botón/overlay de pausa del HUD, que vive en `JugarClient`.

---

## Riesgos

| Riesgo                                                                                                                             | Mitigación                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El motor portado a TS introduce una regresión sutil de colisiones/wall-kicks respecto al prototipo                                 | El paso 3 copia la lógica 1:1 (mismas constantes y fórmulas); el paso 6 verifica jugando una partida completa.                                                                                                                                     |
| `requestAnimationFrame` sigue corriendo tras desmontar la página                                                                   | El `useEffect` de `TetrisGame` cancela el frame pendiente y limpia listeners en su función de limpieza (mismo patrón que `AsteroidsGame`).                                                                                                         |
| El letterbox del tablero 300×600 dentro de un canvas 800×600 desalinea las coordenadas de dibujo respecto al prototipo original    | Resuelto en la fase de preguntas: el offset de centrado se calcula una vez a partir de las constantes `COLS`/`ROWS`/`BLOCK` y se aplica de forma consistente en `draw()`; el paso 6 verifica visualmente que el tablero se ve completo y centrado. |
| El refactor de `JugarClient.tsx` a `REGISTRO_MOTORES` rompe el comportamiento de `asteroids`                                       | El paso 5 exige que el comportamiento de `asteroids` quede idéntico tras el refactor; se verifica explícitamente en el paso 6.                                                                                                                     |
| El campo extra `lines` de `TetrisEngineState` no encaja limpiamente en el tipo genérico `RealGameProps.onStateChange` del registro | El registro tipa el caso común (`score`/`lives`/`level`/`state`); `JugarClient.tsx` lee `lines` de forma específica para `game.id === "tetris"` sin forzar el tipo genérico a incluirlo.                                                           |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Hold piece, 7-bag randomizer o cualquier mejora sobre el prototipo original.
- Tabla de records en `localStorage` tal cual la trae el prototipo reescrito (ver Decisiones
  de la ampliación) — se adaptó a comparar contra el mejor score real de Supabase.
- Nuevas columnas en `scores` (`lines`/`combo`) para persistir esas stats por partida guardada
  — quedan solo como stats de sesión en el modal de fin, sin cambio de esquema.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
