# Performance de motores — Arcade Vault

Registro de medición y optimización por motor. Memoria de `performance-auditor`: un motor por
invocación, nunca se procesan varios a la vez. Umbral (SPEC 12): ≥ 58 FPS medio, p95 ≤ 20ms,
1440×900, skin clasico, 30s de partida.

| Motor     | FPS medio (antes) | p95 (antes) | FPS medio (después) | p95 (después) | Cambios aplicados     | Fecha      |
| --------- | ----------------- | ----------- | -------------------- | -------------- | ---------------------- | ---------- |
| frogger   | —                  | —           | —                    | —              | SPEC 12 (#3,#4,#5,#6)  | 2026-10-06 |
| asteroids | —                  | —           | —                    | —              | —                      | —          |
| tetris    | —                  | —           | —                    | —              | —                      | —          |
| arkanoid  | —                  | —           | —                    | —              | —                      | —          |
| snake     | —                  | —           | —                    | —              | —                      | —          |

Nota (2026-10-07, `performance-auditor` sobre `arkanoid`): se intentó medir con Playwright en
esta invocación, pero el entorno no se consideró fiable — ver el informe de esa sesión para el
detalle (resumen: Chromium headless compartido entre 4 worktrees paralelos midió ~28 FPS medio
incluso en FROGGER, usado como control porque ya está optimizado desde SPEC 12, cuando el techo
de `requestAnimationFrame` puro del mismo navegador sin canvas es ~60 FPS). No se tocó
`components/games/arkanoid/engine.ts` ni `ArkanoidGame.tsx` por esta razón: no se optimiza a
ciegas con una medición que no se puede validar contra un baseline conocido.
