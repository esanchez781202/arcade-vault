# Performance de motores — Arcade Vault

Registro de medición y optimización por motor. Memoria de `performance-auditor`: un motor por
invocación, nunca se procesan varios a la vez. Umbral (SPEC 12): ≥ 58 FPS medio, p95 ≤ 20ms,
1440×900, skin clasico, 30s de partida.

| Motor     | FPS medio (antes) | p95 (antes) | FPS medio (después) | p95 (después) | Cambios aplicados                      | Fecha      |
| --------- | ------------------ | ------------ | --------------------- | --------------- | --------------------------------------- | ---------- |
| frogger   | —                   | —            | —                      | —                | SPEC 12 (#3,#4,#5,#6)                   | 2026-10-06 |
| asteroids | ~27 FPS (sesión paralela anterior, contaminada) | ~50-83ms (contaminada) | 34 FPS normal / 32 FPS sin CSS transversal (remedición serie, entorno aún contaminado — ver informe) | 50ms / 50ms | #3 (hexARgba precalculado en partículas/overlay), #4 (agrupación de balas), #6 (filterInPlace + scratch de asteroides nuevos, sin new Array por frame). Remedición 2026-10-07: sin cambios de código adicionales — el control con FROGGER en la misma sesión dio 24-25 FPS (muy por debajo de su ~43-49 FPS documentado), confirmando que el entorno sigue contaminado (3 servidores `next dev` adicionales corriendo en paralelo, puertos 3000/3001/3103) y no es representativo del umbral. | 2026-10-07 |
| tetris    | —                   | —            | —                      | —                | —                                        | —          |
| arkanoid  | —                   | —            | —                      | —                | —                                        | —          |
| snake     | —                   | —            | —                      | —                | —                                        | —          |
