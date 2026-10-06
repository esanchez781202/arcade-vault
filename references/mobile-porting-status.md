# Estado del porting móvil — Arcade Vault

Registro de qué ruta está adaptada a móvil y con qué verificación. Memoria de `mobile-porter`:
una ruta por invocación, nunca se procesan varias a la vez.

| Ruta                 | Media queries propias        | M1-M6 (Fase 3)     | Capturas | Fecha      |
| --------------------- | ------------------------------ | -------------------- | -------- | ---------- |
| `/`                   | 6 (980/520/1100/600/720 ×2)    | —                     | —        | —          |
| `/biblioteca`         | solo paddings 720px            | —                     | —        | —          |
| `/juego/[id]`         | 1 (900px)                      | —                     | —        | —          |
| `/juego/[id]/jugar`   | `pointer: coarse`              | parcial (ver notas)  | parcial  | 2026-09-21; 2026-10-06 (frogger) |
| `/salon`              | 2 (720px)                      | —                     | —        | —          |
| `/acceso`             | ninguna                        | —                     | —        | —          |
| `/acerca-de`          | 2 (820/900px)                  | —                     | —        | —          |

## Notas

- **Arranque (2026-09-22):** tabla sembrada a partir de una auditoría estática de
  `app/globals.css` (17 media queries, 10 breakpoints ad-hoc). Ninguna ruta tiene aún
  verificación M1-M6 con Playwright. `/juego/[id]/jugar` figura como parcial porque SPEC 10
  cubrió el D-pad táctil y el desbordamiento de `.av-nav`, pero no auditó HUD, panel de skins
  (`flex: 0 0 200px` fijo) ni el modal de fin de partida.
- **`/juego/frogger/jugar` (2026-10-06, `mobile-porter`):** re-auditoría M1-M6 específica
  para `id=frogger` (motor nuevo, HUD/skins propios) en 360×780, 390×844 y 1440×900, con
  `hasTouch`/`isMobile` emulados vía Playwright. Hallazgo crítico: `TOUCH_CONFIG` en
  `app/juego/[id]/jugar/JugarClient.tsx` no tenía entrada `frogger` — el D-pad táctil no se
  renderizaba en absoluto y el juego era injugable en móvil (sin teclado no hay forma de
  saltar). Corregido añadiendo la entrada `frogger` a `TOUCH_CONFIG` (↑↓←→ → `ArrowUp`/
  `ArrowDown`/`ArrowLeft`/`ArrowRight`, sin botones de acción — `FroggerGame.tsx` solo
  escucha esas 4 teclas, salto discreto de una celda). Es el mismo patrón de extensión que
  ya usan asteroids/tetris/arkanoid/snake, dentro del punto de extensión que define SPEC 10;
  no se tocó `engine.ts` ni `FroggerGame.tsx`. Verificado tras el fix: D-pad visible debajo
  de `.crt-screen` (no superpuesto al canvas), 52×52px por botón (M3 PASS para el D-pad en
  concreto), sin botones de acción (consistente con que Frogger no tiene más input que
  dirección). Resultado M1-M6 para `frogger`: **M1 PASS, M2 FAIL, M3 FAIL (parcial — el
  D-pad en sí pasa, los elementos que fallan son compartidos), M4 PASS, M5 FAIL, M6 PASS**
  (el fix fue solo JS/TS en `TOUCH_CONFIG`, sin tocar `app/globals.css`, así que el render
  desktop a 1440×900 es idéntico antes/después). Los FAIL de M2/M3/M5 **no son específicos
  de frogger**: aparecen igual en 1440×900 (desktop, `pointer: fine`) y afectan a elementos
  compartidos por los 4 motores reales (`.av-bg` desborda ~36-144px en los tres viewports
  pero con `overflow` recortado por el body, sin scroll real — M1 confirma
  `scrollWidth === clientWidth`; `.hud-actions button` PAUSA/FIN/SALIR miden 41px de alto,
  2-3px por debajo del umbral M3; el `<select>` de skin mide 32px de alto, igual en
  asteroids/tetris; `.av-nav .logo`/`.auth-btn`/`.hamburger` y el texto de `.crt-bottom`
  (8-9px) ya existían antes de esta corrida). No se corrigieron en esta invocación: son
  defectos de la pantalla de reproductor compartida por los 4 motores reales, ya señalados
  como pendientes en la nota de 2026-09-22 ("no auditó HUD, panel de skins ni el modal de
  fin de partida"), y arreglarlos a fondo (tocar `.btn`, `.hud-actions`, `.av-bg`,
  `.crt-bottom`, `select`) afectaría a asteroids/tetris/arkanoid/snake sin que sus propias
  corridas lo hayan pedido — queda fuera de alcance de "una ruta/un juego por invocación".
  Capturas: `.playwright-screenshots/mobile-juego-frogger-jugar-{360x780,390x844,1440x900}-despues.png`.
  Archivo editado: `app/juego/[id]/jugar/JugarClient.tsx` (solo `TOUCH_CONFIG`, ~12 líneas).
  Sin cambios en `app/globals.css`, `nav.tsx` ni `footer.tsx` en esta corrida.
- **Compartido por todas las rutas:** `app/globals.css:1694-1720` (bloque de paddings a 720px),
  `components/nav.tsx` y `components/footer.tsx` (este último sin ninguna clase CSS: todo
  inline). Un arreglo ahí afecta a las 7 rutas; anótalo aquí cuando ocurra.
