# SPEC 12 — Performance del reproductor y los motores

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-10-06
> **Objetivo:** Diagnosticar y corregir los tirones/FPS bajos del reproductor en desktop — detectados en FROGGER (`components/games/frogger/`, recién mergeado) y potencialmente presentes en los otros cuatro motores — sin cambiar el aspecto visual percibido del marco CRT ni la lógica de juego.

---

## Por qué existe esta spec

El usuario reporta FPS bajos y tirones jugando FROGGER en desktop, con sospecha de que el
problema también afecta a ASTEROIDS, TETRIS, ARKANOID y SNAKE. La auditoría del código
confirma dos causas transversales en CSS que degradan los cinco motores por igual, más
cuatro causas propias del motor de FROGGER — el que más operaciones de dibujo emite por
frame (~48 entidades, cada una con varios `beginPath` independientes).

**Transversal — afecta a los cinco motores:**

1. **`mix-blend-mode: multiply` sobre el canvas** (`app/globals.css:1082-1089`,
   `.crt-screen::after`, las scanlines del monitor). Un elemento con `mix-blend-mode` se
   recompone contra su backdrop cada vez que este cambia; el backdrop es el `<canvas>`, que
   cambia 60 veces por segundo → re-rasterización del área completa de la pantalla cada
   frame. Es la causa dominante más probable.
2. **`mix-blend-mode: overlay` + animación de `background-position`**
   (`app/globals.css:100-136`, `.av-bg::before`/`::after`, montado globalmente en
   `app/layout.tsx:43`). `gridscroll` anima `background-position` (propiedad no
   compositable → repaint) sobre una capa `position: fixed` que además lleva
   `transform: perspective(600px) rotateX(60deg)` y `mask-image`. Corre siempre, incluso
   con el juego en pausa.

**Propio de FROGGER** (`components/games/frogger/engine.ts`):

3. **Fragmentación de llamadas de dibujo** (`drawVehicle`/`drawRiverEntity`, líneas
   438-486). ~12 carriles × ~4 entidades ≈ 48 entidades/frame; cada tronco emite hasta 3
   `stroke()` independientes, cada grupo de tortugas 2-3 `ellipse()` con `beginPath`+`fill`
   propios, cada vehículo `beginPath`+2 `arc`+`fill`. Total ≈ 60-80 draw calls de path por
   frame además de ~100 `fillRect`.
4. **`hexARgba()` dentro del bucle de dibujo** (línea 471). Por cada tortuga sumergida y
   por frame: 3 `parseInt` sobre substrings + construcción de un template string, para un
   resultado que solo depende de la skin activa.
5. **Rejilla redibujada entera cada frame** (`drawBackground`, líneas 407-414). 72
   `fillRect` de 2×2px por frame (activo solo en skins `retro`/`neon`), sobre contenido
   completamente estático.
6. **`getState()` aloja un objeto nuevo por frame**, en los cinco motores (equivalente de
   la línea 557 de FROGGER en `asteroids`, `tetris`, `arkanoid`, `snake`). Coste bajo,
   arreglo trivial.

**Reproductor:**

7. **`setInterval` de 220ms en juegos simulados** (`app/juego/[id]/jugar/JugarClient.tsx:258`).
   Re-renderiza el árbol completo del reproductor 4,5 veces/s en juegos de catálogo sin
   motor real.

**Lo que ya está bien y no se toca:** `reportIfChanged` en los cinco wrappers
(`FroggerGame.tsx:55`, `AsteroidsGame.tsx:57`, etc.) ya evita el re-render por frame
comparando `score`/`lives`/`level`/`state` — el patrón es correcto. `conGlow`
(`components/games/skins.ts:65`) solo activa `shadowBlur` cuando `glow !== null`; en
FROGGER eso solo ocurre en la skin `neon` (`clasico`/`retro` tienen `glow: null`), así que
no es el culpable con la skin por defecto.

---

## Alcance

**Dentro:**

- Overlay de FPS/frame-time en desarrollo, como herramienta de medición permanente.
- Medición de línea base y final de los cinco motores en desktop.
- Corrección de las dos causas transversales de CSS (`.crt-screen::after`, `.av-bg`),
  preservando el aspecto visual percibido.
- Corrección de las cuatro causas propias de FROGGER (fondo precocinado, `hexARgba` fuera
  del bucle, agrupación de paths, `getState()` sin alojar).
- Corrección del `setInterval` de 220ms en `JugarClient.tsx` para juegos simulados.
- `getState()` sin alojar objeto nuevo en los otros cuatro motores (ASTEROIDS, TETRIS,
  ARKANOID, SNAKE), con la verificación correspondiente en `reportIfChanged`.
- Añadir `@media (prefers-reduced-motion: reduce)` a las animaciones infinitas de
  `app/globals.css`, que hoy no lo respetan.
- Auditoría medida (no especulativa) de los otros cuatro motores tras los pasos anteriores;
  si alguno sigue por debajo del umbral, se le aplica el mismo patrón validado en FROGGER.

**Fuera:**

- Reescribir algún motor a WebGL o a un bucle de física de paso fijo.
- Manejo de `devicePixelRatio` en el canvas — es una mejora de nitidez, no de FPS; merece su
  propia spec.
- Performance en móvil (el reporte es de desktop). Si la medición de
  `prefers-reduced-motion` destapa algo en móvil, se anota para el agente `mobile-porter`,
  no se corrige aquí.
- Optimizar el `shadowBlur` de la skin `neon` o el de `tetris/engine.ts`, salvo que la
  medición del paso de auditoría lo señale como necesario.
- Performance de rutas que no son `/juego/[id]/jugar` (`/`, `/biblioteca`, `/salon`).
- Tocar `reportIfChanged` en su forma de comparación, o el contrato `RealGameHandle` de
  `components/games/registry.ts`.

---

## Modelo de datos

Esta spec no introduce estructuras de datos nuevas ni cambios de esquema en Supabase.

---

## Línea base (paso 2)

No se pudo medir: tanto el MCP de Playwright como la extensión `claude-in-chrome` fallaron
al conectar durante la implementación (ambos con error de conexión, no de configuración).
Por decisión del usuario, se omite la tabla numérica de línea base y se avanza con el resto
del plan; la verificación de los umbrales de FPS/frame-time queda pendiente para cuando
alguna herramienta de navegador esté disponible (paso 8, verificación final), o para medición
manual por el usuario con el overlay del paso 1 (`?fps=1` en producción, o directo en
`npm run dev`).

## Auditoría del paso 7

No se pudo realizar: igual que en el paso 2, ni el MCP de Playwright ni la extensión
`claude-in-chrome` conectaron durante la implementación. Por la decisión explícita de la
spec ("No se optimiza a ciegas ASTEROIDS/TETRIS/ARKANOID/SNAKE... se descartó porque no hay
evidencia de que lo necesiten"), **no se les aplicó preventivamente el patrón de FROGGER**
sin medición que lo justifique. Los cuatro motores quedan sin tocar en esta spec; la
auditoría queda pendiente para cuando haya navegador disponible, o para medición manual del
usuario con el overlay del paso 1.

## Plan de implementación

1. **Instrumentación.** Componente nuevo `components/games/fps-overlay.tsx`: mide con
   `requestAnimationFrame` propio y muestra FPS instantáneo, media y frame time p95. Se
   monta en `JugarClient.tsx` solo si `process.env.NODE_ENV === "development"` o si la
   query string trae `?fps=1`. No se monta en producción sin el flag. Queda en el repo como
   herramienta permanente.
2. **Línea base.** Medir los cinco juegos en desktop (1440×900), skin `clasico`, ~30s de
   partida. Registrar FPS medio y p95 en una tabla dentro de esta misma spec. Screenshot del
   reproductor en `.playwright-screenshots/` como referencia visual previa al cambio.
3. **CSS transversal (causas #1 y #2).**
   - `.crt-screen::after`: quitar `mix-blend-mode: multiply`, lograr el mismo oscurecimiento
     con `rgba()` directo en el `repeating-linear-gradient` ajustando el alpha.
   - `.av-bg::before`: pasar `gridscroll` de animar `background-position` a animar
     `transform: translate3d(...)` sobre un pseudo-elemento sobredimensionado (vive en el
     compositor). `.av-bg::after`: quitar `mix-blend-mode: overlay`, bajar el alpha de las
     scanlines para compensar.
   - Añadir `@media (prefers-reduced-motion: reduce)` que detenga las animaciones infinitas.
   - Screenshot comparativo + medición con el overlay tras cada cambio.
4. **FROGGER (causas #3, #4, #5).**
   - #5 primero (más barato): pintar la rejilla y las bandas de zona una sola vez en un
     canvas fuera del DOM al crear el motor y al cambiar de skin; `drawBackground()` pasa a
     un único `drawImage()`.
   - #4: precalcular el color de tortuga sumergida al resolver la paleta (una vez por skin),
     en vez de llamar a `hexARgba` en el bucle de dibujo.
   - #3: agrupar por tipo y color dentro de `drawLanes` — un `beginPath()` por carril para
     ruedas, uno para líneas de tronco, uno para tortugas no sumergidas; mover
     `fillStyle`/`strokeStyle`/`lineWidth` fuera de los bucles por entidad.
   - Re-medir tras cada sub-paso.
5. **`getState()` sin alojar (causa #6).** En los cinco motores, mantener un único objeto
   de estado mutable interno y devolverlo desde `getState()`. Punto delicado: verificar que
   `reportIfChanged` guarda una copia en `lastReportedRef` y no la referencia — si guardara
   la referencia, `prev` y `state` serían el mismo objeto reutilizado y la comparación
   siempre daría igual, congelando el HUD en silencio.
6. **`setInterval` del reproductor (causa #7).** Sustituir el `setInterval` de
   `JugarClient.tsx:255-260` por una referencia mutable + `requestAnimationFrame`, o aislar
   el score simulado en un componente hijo propio para que el re-render no arrastre el árbol
   completo del reproductor.
7. **Auditoría medida de los otros cuatro motores.** Con el overlay activo y el CSS
   corregido, volver a medir ASTEROIDS, TETRIS, ARKANOID y SNAKE. Si alguno sigue por debajo
   del umbral, aplicarle el patrón de fondo precocinado y agrupación de paths validado en
   FROGGER. Si todos cumplen, anotarlo y no tocarlos.
8. **Verificación final.** Tabla antes/después de los cinco juegos en esta spec, screenshots
   comparativos del marco CRT, `npm run lint` y `npm run build` en verde.

---

## Implementación realizada

Resumen técnico de lo que se encontró y cómo se resolvió, paso a paso, para referencia
futura (p. ej. al auditar un motor nuevo o al revisar por qué el CSS quedó así).

**Paso 1 — Overlay de FPS.** `components/games/fps-overlay.tsx` (nuevo): mide con su propio
`requestAnimationFrame`, lleva una ventana móvil de 120 frames y calcula FPS instantáneo,
FPS medio y p95 de frame time. Se muestra solo si `NODE_ENV === "development"` o
`?fps=1` en la URL (`debeMostrarOverlay()`). Montado en `JugarClient.tsx` dentro de
`.crt-screen`, antes del motor/arena. Deliberadamente aislado: su `setState` por frame
solo re-renderiza este componente, no el árbol del reproductor — mismo problema que
después resolvimos para el score simulado (paso 6).

**Paso 3 — CSS transversal (`app/globals.css`).**

- `.crt-screen::after` (scanlines del CRT): se quitó `mix-blend-mode: multiply`. Hallazgo
  clave: para una fuente de color negro puro `(0,0,0)`, la fórmula de `multiply` colapsa
  exactamente a la del alpha-blend normal — `resultado = (1-a)·backdrop` en ambos casos —
  así que quitar el blend mode no cambia un solo píxel. No fue necesario tocar el alpha.
- `.av-bg::before` (grid de piso con perspectiva, montada globalmente en `app/layout.tsx`):
  la animación `gridscroll` pasó de animar `background-position` (repaint) a animar
  `transform: translate3d(...)` (compositor), manteniendo `perspective`/`rotateX` fijos en
  el mismo valor del `transform` de las keyframes. El desplazamiento de 60px coincide con
  el tile del fondo (60px), así que el salto del loop ("to" → "from") sigue siendo
  imperceptible, igual que antes con `background-position`. El overhang existente
  (`left/right/bottom: -10%`) ya cubría el margen necesario para que la traslación no
  expusiera bordes vacíos.
- `.av-bg::after` (scanlines del fondo global): se quitó `mix-blend-mode: overlay` (este sí
  es matemáticamente distinto del alpha-blend normal para blanco sobre fondo variable) y se
  compensó subiendo el alpha interno del gradiente (0.03 → 0.06) y bajando la opacidad
  externa (0.6 → 0.35) — aproximación visual, no equivalencia exacta.
- Se encontró un **bug latente** en `.game-arena .grid-floor` (fallback de juegos
  simulados dentro del reproductor): reusaba el mismo `@keyframes gridscroll` que
  `.av-bg::before` pese a tener geometría distinta (`perspective(300px) rotateX(70deg)`,
  tile de 40px) — el desplazamiento de 60px no coincidía con su propio tile de 40px. Se le
  dio su propio `@keyframes gridscroll-arena` con desplazamiento de 40px, geometría
  correcta y loop seamless (corrección, no solo paridad con el original).
- Nuevo bloque global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
animation-play-state: paused !important; } }` — pausa cualquier animación infinita del
  sitio sin tocar transiciones de hover.
- **Decisión de alcance tomada en la sesión:** el criterio "ninguna animación infinita anima
  background-position/box-shadow/..." se acotó a las animaciones que corren dentro de
  `/juego/[id]/jugar` (`.av-bg::before` por estar montada globalmente, y
  `.game-arena .grid-floor`). Quedaron **sin tocar** `@keyframes pulse` (`box-shadow`,
  usada por `.btn.pulse` en Home/ficha de juego) y `@keyframes caret` (`border-color`, en
  `/acerca-de`) porque no corren en el reproductor y la spec excluye explícitamente
  performance de otras rutas.

**Paso 4 — FROGGER (`components/games/frogger/engine.ts`).**

- _Fondo precocinado (causa #5):_ `drawBackground()` ya no repinta ~86 `fillRect` por
  frame. Ahora pinta una vez (o al cambiar de skin) en un `<canvas>` fuera del DOM vía
  `paintBackground()`, cacheado en `bgCanvas`/`bgCanvasSkin`, y `draw()` hace un único
  `ctx.drawImage(bgCanvas, 0, 0)`.
- _`hexARgba` fuera del bucle (causa #4):_ se precalcula `turtleSubmergedColor` una sola
  vez por cambio de skin, dentro de `setSkin()` (y al crear el motor, llamando
  `setSkin(skin)` antes de `initGame()`), en vez de llamar `hexARgba()` por cada tortuga
  sumergida y por frame dentro de `drawRiverEntity`.
- _Agrupación de paths (causa #3):_ `drawLanes()` se separó en cuerpo-por-entidad
  (`drawVehicleBody`, `drawLogBody` — colores distintos por entidad, no agrupables sin
  perder esa distinción) y trazos agrupables por carril: `drawLaneWheels` (un
  `beginPath`+`fill` para todas las ruedas del carril), `drawLaneLogLines` (un
  `beginPath`+`stroke` para todas las líneas divisorias de troncos) y `drawLaneTurtles`
  (un `beginPath`+`fill` por carril y por estado sumergido/visible, ya que el `fillStyle`
  difiere entre ambos). `fillStyle`/`strokeStyle`/`lineWidth` se fijan una vez por carril,
  fuera del bucle de entidades.

**Paso 5 — `getState()` sin alojar, en los cinco motores + hallazgo crítico en los
wrappers.** Cada `engine.ts` (`frogger`, `asteroids`, `tetris`, `arkanoid`, `snake`) pasó de
`return { score, lives, level, state }` (objeto nuevo cada llamada) a mantener un `stateOut`
único creado una vez en `createEngine()`, actualizado campo por campo en cada `getState()` y
devuelto siempre por referencia.

**Hallazgo que confirmó el riesgo ya anotado en la spec:** los cinco wrappers
(`*Game.tsx`) hacían `lastReportedRef.current = state;` — guardaban la **referencia**, no
una copia. Con `getState()` devolviendo siempre el mismo objeto, `prev` y `state` habrían
sido literalmente el mismo objeto en la siguiente comparación de `reportIfChanged`,
congelando el HUD sin ningún error visible. Se corrigió en los cinco wrappers a
`lastReportedRef.current = { ...state };` (copia superficial, suficiente porque los campos
son todos primitivos).

**Paso 6 — `setInterval` del reproductor (`app/juego/[id]/jugar/JugarClient.tsx`).** El
`setInterval` de 220ms que llamaba `setScore`/`setLevel` (re-renderizando todo el árbol del
reproductor 4,5 veces/s) se sustituyó por: refs mutables (`simScoreRef`, `simLevelRef`) +
`requestAnimationFrame` con throttle manual a 220ms, que escribe `textContent` directo en
dos `<div ref={...} />` (`scoreElRef`, `levelElRef`) **sin ninguna expresión de React como
hijo** — truco deliberado: al no tener hijos declarados en JSX, React nunca reconcilia el
contenido de esos divs en renders posteriores, así que la escritura manual del DOM
persiste. `score`/`level` de React (`useState`) solo se sincronizan desde las refs en dos
puntos de transición: `endGame()` (para el modal de fin de partida) y `restart()` (para
reiniciar la visualización). El JSX de "Puntuación"/"Nivel" se bifurca: reactivo cuando hay
motor real, basado en ref cuando el juego es simulado.

---

## Limitación de entorno (medición) y excepciones documentadas

Durante toda la implementación, tanto el MCP de Playwright como la extensión
`claude-in-chrome` fallaron al conectar (error de conexión, no de configuración). Por
decisión del usuario (ver pasos 2 y 7) se omitieron las mediciones numéricas de FPS y los
screenshots comparativos, y **no se tocó** ninguno de los otros cuatro motores
(ASTEROIDS/TETRIS/ARKANOID/SNAKE) sin evidencia medida — consistente con la decisión "no se
optimiza a ciegas" de esta misma spec.

Como consecuencia, dos criterios de aceptación no se pudieron verificar en esta sesión y
quedan pendientes de medición manual (overlay del paso 1, `npm run dev` o `?fps=1` en
producción):

- FROGGER ≥ 58 FPS medio / p95 ≤ 20ms en 30s de partida.
- Equivalencia visual del marco CRT antes/después del cambio de CSS (paso 3).

Además, el criterio de `hexARgba` tiene dos excepciones conocidas y deliberadas en
`components/games/asteroids/engine.ts`, fuera del alcance de los motores tocados por esta
spec (decisión del usuario: documentar, no tocar sin medición):

- `Particle.draw()` (línea ~329): `hexARgba(p.inkDim, alpha)` — `alpha` depende de
  `this.ttl / this.life`, cambia cada frame y por partícula; no es cacheable por skin como
  el caso de FROGGER sin rediseñar el cálculo del fundido.
- `drawOverlay()` (línea ~498): `hexARgba(p.hud, 0.65)` — solo se dibuja en la pantalla de
  game over; sí sería cacheable con el mismo patrón que FROGGER, pero no se tocó por no
  haber evidencia medida de que ASTEROIDS lo necesite.

## Criterios de aceptación

- [ ] El overlay de FPS aparece en `/juego/[id]/jugar` con `npm run dev` y no aparece en
      build de producción sin `?fps=1`. — **Implementado**, no verificado en vivo (sin
      navegador disponible); revisión de código confirma la condición.
- [ ] FROGGER en desktop 1440×900, skin `clasico`: ≥ 58 FPS medio y frame time p95 ≤ 20ms
      en 30s de partida. — **No verificable en esta sesión**, ver limitación de entorno
      arriba.
- [ ] Los otros cuatro motores cumplen el mismo umbral, o la spec documenta explícitamente
      por qué uno no puede. — Documentado: no se midieron ni se tocaron (ver paso 7).
- [x] `drawBackground()` de FROGGER emite una sola llamada de dibujo (`drawImage`) en lugar
      de ≥ 86 `fillRect`.
- [ ] `hexARgba` no se invoca desde ninguna función de dibujo en ningún motor (verificable
      con `grep`). — Cumple en FROGGER (motor tocado por esta spec); dos excepciones
      documentadas arriba en ASTEROIDS, fuera de alcance.
- [x] `grep -rn "mix-blend-mode" app/globals.css` no devuelve coincidencias en
      `.crt-screen::after` ni en `.av-bg::after`.
- [x] Ninguna animación infinita de `app/globals.css` anima `background-position`,
      `box-shadow`, `filter`, `width`, `height`, `top` o `left`; solo `transform` y
      `opacity`. — Alcance acotado a las animaciones que corren en el reproductor
      (`.av-bg::before`, `.game-arena .grid-floor`); `.btn.pulse`/`caret` quedan fuera por
      decisión del usuario (no corren en `/juego/[id]/jugar`).
- [x] Existe un bloque `@media (prefers-reduced-motion: reduce)` que detiene las
      animaciones infinitas.
- [x] `JugarClient.tsx` no contiene ningún `setInterval` que llame a un setter de
      `useState` del propio `JugarClient`.
- [ ] El HUD (score, vidas, nivel) sigue actualizándose correctamente en los cinco juegos
      tras el cambio de `getState()`. — Verificado por revisión de código (`reportIfChanged`
      copia el objeto antes de guardarlo en `lastReportedRef`, ver paso 5); no verificado en
      vivo por falta de navegador.
- [ ] Screenshots antes/después guardados en `.playwright-screenshots/`; cualquier
      diferencia visual del marco CRT queda descrita en esta spec. — No se pudieron tomar,
      ver limitación de entorno arriba. La equivalencia del CSS del paso 3 se razonó
      matemáticamente en el código (comentarios en `app/globals.css`), no se verificó
      visualmente.
- [x] `npm run lint` y `npm run build` pasan sin errores. — `build` en verde. `lint` tiene
      30 errores preexistentes en `references/templates/` (prototipo HTML/JSX sin build,
      no afectado por esta spec) y 19 warnings preexistentes, sin cambios desde antes de
      esta spec; ningún archivo tocado por esta spec introduce un error nuevo.

---

## Decisiones

- **Equivalencia visual del CRT, no intocabilidad total.** Se permite sustituir
  `mix-blend-mode` y la animación de `background-position` por técnicas más baratas,
  siempre que el resultado se vea casi igual. Alternativa descartada: no tocar el CSS y
  limitar la spec a los motores — se descartó porque las causas #1/#2 son, por evidencia de
  código, las de mayor impacto potencial (afectan a los cinco juegos en todo momento,
  incluso en pausa) y dejarlas fuera arriesgaba una mejora marginal.
- **Medir antes de optimizar.** Se construye un overlay de FPS permanente en vez de fiarse
  de la sensación de "va mal". Alternativa descartada: medir ad-hoc con el panel
  Performance de Chrome sin dejar instrumentación en el repo — se descartó porque no deja
  un criterio de aceptación verificable por quien revise la spec después.
- **El `setInterval` de juegos simulados entra en el alcance**, aunque solo afecte a juegos
  de catálogo sin motor real, porque es un re-render de árbol completo fácilmente evitable
  y barato de arreglar en la misma spec.
- **No se optimiza a ciegas ASTEROIDS/TETRIS/ARKANOID/SNAKE.** Solo se tocan si la medición
  del paso 7 (tras corregir el CSS transversal) los sitúa por debajo del umbral. Alternativa
  descartada: aplicarles preventivamente el mismo refactor de FROGGER — se descartó porque
  no hay evidencia de que lo necesiten y añadiría riesgo sin beneficio medido.

---

## Riesgos

- **El CSS puede no ser la causa dominante.** El paso de línea base existe precisamente
  para no optimizar a ciegas; si al quitar los `mix-blend-mode` la mejora es marginal, el
  esfuerzo se redirige al refactor de FROGGER.
- **`getState()` reutilizando objeto puede romper `reportIfChanged`** si no se verifica que
  `lastReportedRef` guarda una copia y no la referencia — es un bug silencioso (HUD
  congelado, sin error en consola). El criterio de aceptación del HUD cubre este riesgo.
- **La equivalencia visual del marco CRT es subjetiva.** Mitigación: screenshots
  comparativos explícitos en la spec, y el cambio de CSS es independiente de los demás
  pasos — se puede revertir solo, si el resultado no convence.
- **El MCP de Playwright falló al conectar en la sesión en que se escribió esta spec**
  (`CONNECT_TIMEOUT`). Si sigue caído durante la implementación, los screenshots se toman a
  mano y se anota en esta spec.

---

## Lo que **no** entra en esta spec

- Reescribir algún motor a WebGL o a un bucle de física de paso fijo.
- Manejo de `devicePixelRatio` en el canvas.
- Performance en móvil.
- Optimizar `shadowBlur` de la skin `neon` o de `tetris/engine.ts`, salvo necesidad medida.
- Performance de rutas distintas a `/juego/[id]/jugar`.
- Tocar `reportIfChanged` en su forma de comparación o el contrato `RealGameHandle`.
