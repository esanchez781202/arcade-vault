# SPEC 11 — Apariencia neón de los controles táctiles

> **Estado:** Aprobado
> **Depende de:** SPEC 10
> **Fecha:** 2026-09-22
> **Objetivo:** Rediseñar visualmente el D-pad y los botones de acción de `TouchControls` (implementados en SPEC 10) para que se vean como el componente de referencia `references/gamepad-assets/gamepad.html` (flechas SVG, hub central con gema pulsante, botones A/B circulares con halo de neón), sin tocar su lógica de despacho de eventos.

---

## Por qué existe esta spec

SPEC 10 implementó `TouchControls` en `app/juego/[id]/jugar/JugarClient.tsx` con un D-pad
de 4 botones cuadrados (grid 3×3, texto `▲▼◀▶`) y hasta 2 botones de acción redondos, todos
con un estilo plano (`app/globals.css:1108-1194`) — funcional pero visualmente básico.
`references/gamepad-assets/` contiene un componente de gamepad "MK-II" ya diseñado y
autónomo (`gamepad.html` + captura `gamepad-neon.png`) con la estética neón cyan/magenta que
ya usa el resto del sitio (`--cyan: #00f5ff`, `--magenta: #ff006e`, `--pixel: "Press Start
2P"` — las mismas variables ya existen en `app/globals.css:19-28`). Esta spec porta ese
diseño al `TouchControls` real, reemplazando solo la capa visual: mismo `TOUCH_CONFIG`,
mismo `dispatchTouchKey`, mismo comportamiento de ocultamiento condicional de botones sin
`code`.

---

## Alcance

**Dentro:**

- **Rediseño completo del D-pad**, dentro de `.touch-dpad` en `app/globals.css` y del JSX de
  `TouchButton`/`TouchControls` en `JugarClient.tsx`:
  - Cada flecha (`.touch-up/down/left/right`) pasa de texto `▲▼◀▶` a un `<svg>` inline con
    forma de triángulo (mismo `viewBox="0 0 24 24"` y `path` que `gamepad.html:191-194`),
    manteniendo el `<button>` como contenedor clicable — el SVG es puramente decorativo
    (`aria-hidden`, sin cambiar `aria-label`/semántica del botón).
  - Estilo bisel 3D de `gamepad.html:74-98` portado a `.touch-dpad button`: fondo
    degradado oscuro, `border-radius`, sombra `box-shadow` de "profundidad" en reposo y
    glow cyan (`inset 0 0 16px` + `0 0 16px`) en `:active`/`.pressed`, con
    `transform: translateY(3px)` al pulsar. El SVG también gana `filter: drop-shadow(...)`
    con el cyan al presionar.
  - **Hub central decorativo**: un `<div>` nuevo (no interactivo, `aria-hidden="true"`) en
    el centro del grid del D-pad, con el rombo/gema pulsante de `gamepad.html:108-124`
    (`clip-path: polygon(...)`, `@keyframes pulse-led`). Se muestra siempre, incluso si
    falta alguna flecha (p. ej. Arkanoid sin arriba/abajo) — ocupa la celda central del
    grid 3×3 ya existente.
- **Rediseño completo de los botones de acción**, dentro de `.touch-actions`:
  - Círculos con degradado radial y borde `currentColor` de `gamepad.html:132-158`, halo
    `box-shadow` coloreado en reposo y glow ampliado en `:active`/`.pressed`
    (`transform: translateY(4px) scale(0.97)`), anillo punteado (`.ab-ring` →
    `.touch-action-ring`) que aparece al presionar.
  - **Color por posición, no por juego**: el primer botón de acción de cada `TOUCH_CONFIG`
    (el "A" — p. ej. disparo en Asteroids, rotar en Tetris) usa magenta
    (`--magenta`/`--ab-mid`/`--ab-deep` de A); el segundo ("B" — p. ej. caída total en
    Tetris) usa cyan. Como máximo 2 acciones por juego (ya garantizado por SPEC 10), así
    que "primero"/"segundo" cubre todos los casos sin lista de excepciones por `gameId`.
  - La letra dentro del círculo (ya viene de `TouchButtonConfig.label`, hoy `"A"`/`"B"`)
    mantiene `font-family: var(--pixel)` con `text-shadow` de neón coloreado a juego con el
    color de ese botón.
- **Cambios de JSX necesarios en `TouchButton`/`TouchControls`** (`JugarClient.tsx`):
  - `TouchButton` gana una prop opcional `variant?: "dpad-up" | "dpad-down" | "dpad-left" |
"dpad-right"` (o el arrow SVG se resuelve internamente a partir de `className`) para
    saber qué `<path>` de flecha dibujar; los botones de acción no la necesitan (siguen
    mostrando `label` como texto).
  - `TouchControls` añade el hub (`<div className="touch-dpad-hub" aria-hidden="true">`)
    dentro de `.touch-dpad`, y calcula el color de cada acción por índice
    (`config.actions[0]` → clase `touch-action-a`, `config.actions[1]` → `touch-action-b`).
  - `TOUCH_CONFIG` **no cambia** — mismos `code`/`label` por juego que SPEC 10.
- **Verificación visual con Playwright** (emulación táctil, viewport 390×844) en los 4
  juegos: captura de `/juego/asteroids/jugar`, `/juego/tetris/jugar`,
  `/juego/arkanoid/jugar`, `/juego/snake/jugar` con `TouchControls` visible, comparando
  cualitativamente contra `references/gamepad-assets/gamepad-neon.png` (mismo lenguaje
  visual: bisel, glow, hub, A magenta/B cyan). Capturas guardadas en
  `.playwright-screenshots/`.

**Fuera de alcance (para specs futuras):**

- Cualquier cambio a `TOUCH_CONFIG`, `dispatchTouchKey`, o qué botones se muestran/ocultan
  por juego — eso es contrato funcional de SPEC 10, intocable aquí.
- Cambios a `engine.ts`, `<Juego>Game.tsx` o `registry.ts` de cualquier motor.
- El fix de `.av-nav` — ya resuelto en SPEC 10, no se toca de nuevo.
- Animaciones adicionales no presentes en `gamepad.html` (p. ej. partículas, sonido al
  pulsar, vibración háptica).
- Rediseño de otros controles de la pantalla de juego (`PAUSA`/`FIN`/`SALIR`, selector de
  skin, modal de fin de partida) — siguen con su estilo `.btn`/`.pixel` actual.
- Soporte de gestos (swipe, joystick analógico por drag) — sigue fuera de alcance, igual
  que en SPEC 10.

---

## Modelo de datos

Este feature no introduce datos persistentes ni estructuras nuevas. `TouchButtonConfig` y
`TouchConfig` (definidos en SPEC 10, `JugarClient.tsx`) no cambian de forma; como mucho
`TouchButton` gana una prop interna opcional para resolver qué ícono SVG dibujar, sin tocar
`TOUCH_CONFIG`.

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **CSS del D-pad neón.** Reescribir `.touch-dpad button` en `app/globals.css` con el
   bisel 3D, sombra de profundidad y glow en `:active`/`.pressed` de `gamepad.html:74-102`,
   adaptando tamaños a los ya usados (52px). Añadir `.touch-dpad-hub` y
   `.touch-dpad-hub-gem` con `@keyframes pulse-led` (o reutilizar un nombre de keyframe que
   no choque con otros ya definidos en `globals.css`). Prueba manual: emulación táctil en
   devtools sobre `/juego/asteroids/jugar`, ver bisel y hub sin flechas rotas de layout.
2. **JSX de flechas SVG + hub.** En `JugarClient.tsx`, reemplazar el `label` de texto de las
   4 flechas del D-pad por `<svg>` inline (mismo `path` que `gamepad.html:191-194`, uno por
   dirección), y montar `<div className="touch-dpad-hub" aria-hidden="true"><span
className="touch-dpad-hub-gem" /></div>` dentro de `.touch-dpad`, en la celda central del
   grid. Prueba manual: `npx tsc --noEmit` compila; el hub se ve centrado en los 4 juegos
   (incluido Arkanoid, con solo 2 flechas visibles).
3. **CSS de botones A/B neón.** Reescribir `.touch-actions button` con el degradado radial,
   borde y glow de `gamepad.html:132-170`, añadiendo clases `.touch-action-a` (magenta) y
   `.touch-action-b` (cyan) con sus variables `--ab-mid`/`--ab-deep`/`--ab-glow` propias.
   Prueba manual: emulación táctil en Tetris (2 botones) — A magenta, B cyan, ambos con
   halo visible en reposo y glow ampliado en `:active`.
4. **JSX de color por posición.** En `TouchControls`, al mapear `config.actions`, asignar
   `className="touch-action-a"` al primer elemento y `"touch-action-b"` al segundo (o único
   `"touch-action-a"` si solo hay uno, como Asteroids). Prueba manual: Asteroids muestra 1
   botón magenta; Tetris muestra magenta + cyan; Arkanoid/Snake no muestran ninguno (sin
   cambios de SPEC 10).
5. **Verificación visual y de build, los 4 motores.** Con Playwright en viewport 390×844 y
   emulación táctil, capturar `/juego/<id>/jugar` para `asteroids`, `tetris`, `arkanoid`,
   `snake` con `TouchControls` visible, guardando en `.playwright-screenshots/`. Confirmar
   por inspección que el resultado es coherente con `gamepad-neon.png` (bisel, hub, glow,
   colores A/B). Repetir la prueba funcional de SPEC 10 (jugar cada motor 100% por touch)
   para confirmar que ningún `code` ni comportamiento de despacho cambió. Confirmar en
   paralelo que en viewport desktop (mouse) ningún control táctil se renderiza, igual que
   antes. Ejecutar `npx next build` y corregir errores. Si `next dev` reescribió el bloque
   `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] Bajo `@media (pointer: coarse)`, el D-pad de los 4 juegos muestra flechas SVG (no
      texto `▲▼◀▶`) con bisel 3D y un hub central con gema, visualmente alineado con
      `references/gamepad-assets/gamepad-neon.png`.
- [ ] Al presionar una flecha del D-pad (`:active`/`.pressed`), el botón se hunde
      (`translateY`) y brilla en cyan (SVG + `box-shadow`), igual que en `gamepad.html`.
- [ ] Los botones de acción son círculos con degradado y halo de neón; en juegos con 2
      acciones (Tetris) el primero es magenta y el segundo cyan; en juegos con 1 acción
      (Asteroids) es magenta.
- [ ] Al presionar un botón de acción, se hunde y escala ligeramente, con el halo ampliado
      y el anillo punteado visible, igual que en `gamepad.html`.
- [ ] El hub central del D-pad se muestra en los 4 juegos, incluso cuando faltan flechas
      (Arkanoid: solo ←/→ visibles, hub igual presente en el centro).
- [ ] `TOUCH_CONFIG` no cambió: mismos `code` por juego, mismos botones ocultos
      (Arkanoid/Snake sin acciones, Asteroids sin ↓, Tetris sin ↑) que en SPEC 10.
- [ ] Los 4 motores siguen siendo 100% jugables por touch (mismo criterio funcional que
      SPEC 10, verificado de nuevo tras el cambio visual).
- [ ] En viewport desktop (mouse), ningún control táctil se renderiza — sin cambios
      respecto a SPEC 10.
- [ ] Ningún archivo dentro de `components/games/` (`engine.ts`, `<Juego>Game.tsx`,
      `registry.ts`) cambia como parte de esta spec.
- [ ] `TOUCH_CONFIG`, `dispatchTouchKey` y la lógica de `onPointerDown`/`onPointerUp`/
      `onPointerCancel`/`onPointerLeave` de `TouchButton` no cambian — solo el JSX
      decorativo (SVG, hub) y las clases CSS aplicadas.

---

## Decisiones

- **Sí:** portar el diseño completo del asset (SVG + hub decorativo), no solo su paleta de
  colores — decisión explícita del usuario en la fase de preguntas, buscando fidelidad
  visual al componente de referencia ya diseñado en `references/gamepad-assets/`.
- **Sí:** A magenta / B cyan siguiendo el asset de referencia, coloreando por **posición**
  (primer botón de acción vs. segundo) y no por `gameId` — evita una tabla de excepciones
  nueva y es consistente con que `TOUCH_CONFIG` ya ordena `actions` como `[A, B]` por
  convención (ver `label: "A"`/`"B"` en SPEC 10).
- **Sí:** mantener el comportamiento de ocultamiento condicional de SPEC 10 (un botón sin
  `code` no se renderiza) en vez de mostrar siempre las 4 flechas y 2 botones como hace el
  asset standalone — decisión explícita del usuario para no revertir el contrato funcional
  ya implementado y verificado en SPEC 10.
- **Sí:** aplicar el rediseño a los 4 juegos con motor real de una sola vez, reutilizando el
  mismo `TouchControls`/CSS compartido — es un cambio de estilo sobre un componente ya
  compartido, no requiere tocar `TOUCH_CONFIG` por juego.
- **No:** cambiar `TOUCH_CONFIG`, `dispatchTouchKey`, o cualquier lógica de despacho de
  eventos — esta spec es puramente visual, igual que su alcance declarado.
- **No:** portar el resto de `gamepad.html` (su propio manejo de teclado standalone, su
  `<script>` de demo) — `TouchControls` ya tiene su propio mecanismo de despacho vía
  `dispatchTouchKey`, mejor integrado con los motores reales que el keyMap de demostración
  del asset.

---

## Riesgos

| Riesgo                                                                                                                                                | Mitigación                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El nuevo bisel/glow con sombras múltiples degrada el rendimiento en dispositivos táctiles de gama baja                                                | Los `box-shadow`/`filter` son CSS puro sin JS adicional, igual coste que cualquier otro estilo ya usado en `globals.css`; se verifica visualmente, no hay medición de FPS en esta spec. |
| Un `@keyframes pulse-led` nuevo choca de nombre con otra animación ya definida en `globals.css`                                                       | Se revisa `globals.css` antes de añadirlo (paso 1) y se renombra si hace falta (p. ej. `touch-hub-pulse`).                                                                              |
| El hub central decorativo, al ocupar la celda central del grid 3×3, interfiere con el `touch-action: none` o el área táctil de las flechas adyacentes | El hub es `aria-hidden` y no interactivo (`pointer-events: none`), sin listeners — no puede capturar ni bloquear eventos de las flechas.                                                |

---

## Lo que **no** entra en esta spec

- Cambios a `TOUCH_CONFIG`, `dispatchTouchKey` o qué botones se ocultan por juego.
- Cambios en `engine.ts`, `<Juego>Game.tsx` o `registry.ts` de cualquier motor.
- El fix de `.av-nav` (ya resuelto en SPEC 10).
- Gestos, vibración háptica, sonido.
- Rediseño de `PAUSA`/`FIN`/`SALIR`, selector de skin o modal de fin de partida.

Cada uno de esos, si llega, va en su propia spec.
