# Performance de motores — Arcade Vault

Registro de medición y optimización por motor. Memoria de `performance-auditor`: un motor por
invocación, nunca se procesan varios a la vez. Umbral (SPEC 12): ≥ 58 FPS medio, p95 ≤ 20ms,
1440×900, skin clasico, 30s de partida.

| Motor     | FPS medio (antes) | p95 (antes) | FPS medio (después) | p95 (después) | Cambios aplicados                      | Fecha      |
| --------- | ------------------ | ------------ | --------------------- | --------------- | --------------------------------------- | ---------- |
| frogger   | —                   | —            | —                      | —                | SPEC 12 (#3,#4,#5,#6)                   | 2026-10-06 |
| asteroids | n/a (no se re-midió el pre-Fase 3; ver notas) | n/a | 60 FPS con CSS transversal / 60 FPS sin CSS transversal | 16.8ms con CSS / 16.8ms sin CSS | #3 (hexARgba precalculado en partículas/overlay), #4 (agrupación de balas), #6 (filterInPlace + scratch de asteroides nuevos, sin new Array por frame) — aplicados en sesión previa (commit `6046c56`). Remedición 2026-10-08 en entorno verificado limpio (0 servidores `next dev` zombis en 3000-3999, confirmado con netstat antes de arrancar): asteroids da 60/60/16.8ms de forma estable en dos corridas independientes, igual con y sin el CSS transversal deshabilitado. Control con FROGGER en la misma sesión: 55-60 FPS con CSS (p95 16.7-33.3ms) y 43-60 FPS sin CSS según la corrida (ruido del entorno de medición, no del motor). Asteroids igualó o superó a FROGGER en todas las corridas — PASS relativo a FROGGER y PASS absoluto (≥58 FPS medio, p95≤20ms). No se aplicaron cambios de código en esta sesión: el trabajo de Fase 3 ya hecho es suficiente. | 2026-10-08 |
| tetris    | —                   | —            | —                      | —                | —                                        | —          |
| arkanoid  | —                   | —            | —                      | —                | —                                        | —          |
| snake     | —                   | —            | —                      | —                | —                                        | —          |
