# Performance de motores — Arcade Vault

Registro de medición y optimización por motor. Memoria de `performance-auditor`: un motor por
invocación, nunca se procesan varios a la vez. Umbral (SPEC 12): ≥ 58 FPS medio, p95 ≤ 20ms,
1440×900, skin clasico, 30s de partida.

| Motor     | FPS medio (antes) | p95 (antes) | FPS medio (después) | p95 (después) | Cambios aplicados     | Fecha      |
| --------- | ----------------- | ----------- | -------------------- | -------------- | ---------------------- | ---------- |
| frogger   | —                  | —           | —                    | —              | SPEC 12 (#3,#4,#5,#6)  | 2026-10-06 |
| asteroids | —                  | —           | —                    | —              | —                      | —          |
| tetris    | —                  | —           | —                    | —              | —                      | —          |
| arkanoid  | 30 (con CSS) / 49 (sin CSS) | 50ms (con CSS) / 33.4ms (sin CSS) | — | — | ninguno (ver nota) | 2026-10-07 |
| snake     | —                  | —           | —                    | —              | —                      | —          |

Nota (2026-10-07, `performance-auditor` sobre `arkanoid`, remedición en aislamiento — un único
worktree, sin Playwright headless paralelo en otras 3 instancias): el entorno se validó fiable
antes de medir (techo de `requestAnimationFrame` puro sin canvas: 60.4 FPS en este navegador/
máquina, frente a los ~28 FPS contaminados de la invocación anterior). Con el CSS transversal
del reproductor activo (`.av-bg::before`/`::after` con `gridscroll`/scanlines, `backdrop-filter:
blur(8px)` en `.av-nav`) ARKANOID midió 30 FPS medio / p95 50ms — muy por debajo del umbral.
Deshabilitando ese CSS vía `page.addStyleTag` (sin tocar `app/globals.css`, `*, *::before,
*::after { animation: none !important }` + `backdrop-filter: none` en `.av-nav`) subió a 49 FPS
medio / p95 33.4ms — mismo patrón que confirmó la sesión de `tetris`. Para aislar si el resto de
la caída (49 vs. 58) era un problema del motor de ARKANOID, se remidió FROGGER (ya optimizado en
SPEC 12) bajo el mismo arnés en la misma sesión: 35 FPS medio con CSS / 49 FPS medio sin CSS,
p95 33.4ms — **idéntico** al resultado de ARKANOID sin CSS. Conclusión: el motor de ARKANOID ya
rinde al mismo nivel que el motor de referencia ya optimizado; el remanente hasta 58 FPS/p95
20ms no es atribuible al código de `engine.ts`/`ArkanoidGame.tsx` de ARKANOID (ninguna de las 6
causas de SPEC 12 aplica; `getState()` ya reutiliza `stateOut` y el wrapper ya copia antes de
`lastReportedRef`), sino al CSS transversal del reproductor y a un techo adicional del propio
arnés de medición (Playwright headless) que afecta por igual a un motor ya optimizado. Aplicar
un refactor de `engine.ts` aquí habría sido optimizar a ciegas contra un síntoma que no está en
el motor. No se tocó ningún archivo de `components/games/arkanoid/`.
