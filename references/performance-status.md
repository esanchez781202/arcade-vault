# Performance de motores — Arcade Vault

Registro de medición y optimización por motor. Memoria de `performance-auditor`: un motor por
invocación, nunca se procesan varios a la vez. Umbral (SPEC 12): ≥ 58 FPS medio, p95 ≤ 20ms,
1440×900, skin clasico, 30s de partida.

| Motor     | FPS medio (antes) | p95 (antes) | FPS medio (después) | p95 (después) | Cambios aplicados     | Fecha      |
| --------- | ----------------- | ----------- | -------------------- | -------------- | ---------------------- | ---------- |
| frogger   | —                  | —           | —                     | —              | SPEC 12 (#3,#4,#5,#6)  | 2026-10-06 |
| asteroids | —                  | —           | —                     | —              | —                      | —          |
| tetris    | 31 FPS             | 50ms        | 32 FPS                | 50ms           | causas #2,#3 (ver nota)| 2026-10-07 |
| arkanoid  | —                  | —           | —                     | —              | —                      | —          |
| snake     | —                  | —           | —                     | —              | —                      | —          |

## Nota — tetris (2026-10-07)

Medido con Playwright real (navegador Chromium headless y headed, dev y build de
producción — mismo resultado en ambos): FAIL antes (31 FPS medio / p95 50ms) y FAIL después
(32 FPS medio / p95 50ms) tras aplicar las causas #2 (fondo/rejilla precocinados en
`bgCanvas`, un único `drawImage()` por frame) y #3 (`hexToRgb` memoizado por color en vez de
recalculado en cada `drawBlock()` de las skins `neon`/`pixel`) de `engine.ts`.

Diagnóstico del motivo por el que el umbral sigue sin alcanzarse: con todas las animaciones y
transiciones CSS deshabilitadas (`animation/transition/backdrop-filter: none` vía
`page.addStyleTag`) el mismo recorrido de 30s sube a 43 FPS medio / p95 33.4ms — una mejora de
+12 FPS medio solo por quitar CSS. La causa dominante del FPS bajo en TETRIS (y
probablemente en los otros motores, no verificado aquí) es transversal: la rejilla animada de
fondo (`.av-bg`, `animation: gridscroll 8s linear infinite`), el parpadeo (`flicker`) y el
`backdrop-filter: blur(8px)` de `app/globals.css`, no el bucle de dibujo del canvas de
TETRIS. Por regla dura de este agente ("no repite la corrección de CSS transversal de SPEC
12"), no se tocó `app/globals.css`; queda documentado aquí para quien decida abordarlo en una
spec propia.

Cambios aplicados en `components/games/tetris/engine.ts`: `rebuildBackground()` (fondo +
borde + rejilla precocinados en un `<canvas>` auxiliar, reconstruido solo en
`setTheme()`/`setSkin()`, volcado con un único `ctx.drawImage()` por frame) y
`cachedHexToRgb()` (memoiza la conversión hex→rgb por color, antes recalculada en cada
`drawBlock()` de las skins `neon`/`pixel`). No se aplicó la causa #4 (agrupación de draw
calls por color): la skin por defecto (`retro`, equivalente a `clasico` en TETRIS) ya dibuja
cada celda con 2 `fillRect` directos, sin `beginPath()`/`stroke()` por entidad, así que el
margen de mejora era marginal frente al coste de CSS medido arriba; agrupar las 4 skins sin
romper su aspecto (glow de `neon`, crosshatch de `pixel`) habría sido un cambio extenso para
un beneficio no demostrado por la medición.
