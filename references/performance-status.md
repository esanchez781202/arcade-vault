# Performance de motores — Arcade Vault

Registro de medición y optimización por motor. Memoria de `performance-auditor`: un motor por
invocación, nunca se procesan varios a la vez. Umbral (SPEC 12): ≥ 58 FPS medio, p95 ≤ 20ms,
1440×900, skin clasico, 30s de partida.

| Motor     | FPS medio (antes) | p95 (antes) | FPS medio (después) | p95 (después) | Cambios aplicados                      | Fecha      |
| --------- | ------------------ | ------------ | --------------------- | --------------- | --------------------------------------- | ---------- |
| frogger   | —                   | —            | —                      | —                | SPEC 12 (#3,#4,#5,#6)                   | 2026-10-06 |
| asteroids | n/a (no se re-midió el pre-Fase 3; ver notas) | n/a | 60 FPS con CSS transversal / 60 FPS sin CSS transversal | 16.8ms con CSS / 16.8ms sin CSS | #3 (hexARgba precalculado en partículas/overlay), #4 (agrupación de balas), #6 (filterInPlace + scratch de asteroides nuevos, sin new Array por frame) — aplicados en sesión previa (commit `6046c56`). Remedición 2026-10-08 en entorno verificado limpio (0 servidores `next dev` zombis en 3000-3999, confirmado con netstat antes de arrancar): asteroids da 60/60/16.8ms de forma estable en dos corridas independientes, igual con y sin el CSS transversal deshabilitado. Control con FROGGER en la misma sesión: 55-60 FPS con CSS (p95 16.7-33.3ms) y 43-60 FPS sin CSS según la corrida (ruido del entorno de medición, no del motor). Asteroids igualó o superó a FROGGER en todas las corridas — PASS relativo a FROGGER y PASS absoluto (≥58 FPS medio, p95≤20ms). No se aplicaron cambios de código en esta sesión: el trabajo de Fase 3 ya hecho es suficiente. | 2026-10-08 |
| tetris    | 31 FPS              | 50ms         | 32 FPS                 | 50ms             | causas #2,#3 (ver nota)                 | 2026-10-07 |
| arkanoid  | 30 (con CSS) / 49 (sin CSS) | 50ms (con CSS) / 33.4ms (sin CSS) | — | — | ninguno (ver nota) | 2026-10-07 |
| snake     | —                   | —            | —                      | —                | —                                        | —          |

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

## Nota — arkanoid (2026-10-07)

`performance-auditor` sobre `arkanoid`, remedición en aislamiento (un único worktree, sin
Playwright headless paralelo en otras 3 instancias): el entorno se validó fiable antes de
medir (techo de `requestAnimationFrame` puro sin canvas: 60.4 FPS en este navegador/máquina,
frente a los ~28 FPS contaminados de la invocación anterior). Con el CSS transversal del
reproductor activo (`.av-bg::before`/`::after` con `gridscroll`/scanlines, `backdrop-filter:
blur(8px)` en `.av-nav`) ARKANOID midió 30 FPS medio / p95 50ms — muy por debajo del umbral.
Deshabilitando ese CSS vía `page.addStyleTag` (sin tocar `app/globals.css`, `*, *::before,
*::after { animation: none !important }` + `backdrop-filter: none` en `.av-nav`) subió a 49
FPS medio / p95 33.4ms — mismo patrón que confirmó la sesión de `tetris`. Para aislar si el
resto de la caída (49 vs. 58) era un problema del motor de ARKANOID, se remidió FROGGER (ya
optimizado en SPEC 12) bajo el mismo arnés en la misma sesión: 35 FPS medio con CSS / 49 FPS
medio sin CSS, p95 33.4ms — **idéntico** al resultado de ARKANOID sin CSS. Conclusión: el
motor de ARKANOID ya rinde al mismo nivel que el motor de referencia ya optimizado; el
remanente hasta 58 FPS/p95 20ms no es atribuible al código de `engine.ts`/`ArkanoidGame.tsx`
de ARKANOID (ninguna de las 6 causas de SPEC 12 aplica; `getState()` ya reutiliza `stateOut`
y el wrapper ya copia antes de `lastReportedRef`), sino al CSS transversal del reproductor y
a un techo adicional del propio arnés de medición (Playwright headless) que afecta por igual
a un motor ya optimizado. Aplicar un refactor de `engine.ts` aquí habría sido optimizar a
ciegas contra un síntoma que no está en el motor. No se tocó ningún archivo de
`components/games/arkanoid/`.
