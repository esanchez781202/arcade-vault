# Performance de motores — Arcade Vault

Registro de medición y optimización por motor. Memoria de `performance-auditor`: un motor por
invocación, nunca se procesan varios a la vez. Umbral (SPEC 12): ≥ 58 FPS medio, p95 ≤ 20ms,
1440×900, skin clasico, 30s de partida.

| Motor     | FPS medio (antes) | p95 (antes) | FPS medio (después) | p95 (después) | Cambios aplicados                                      | Fecha      |
| --------- | ------------------ | ----------- | -------------------- | -------------- | ------------------------------------------------------- | ---------- |
| frogger   | —                  | —           | —                    | —              | SPEC 12 (#3,#4,#5,#6)                                    | 2026-10-06 |
| asteroids | —                  | —           | —                    | —              | —                                                        | —          |
| tetris    | —                  | —           | —                    | —              | —                                                        | —          |
| arkanoid  | —                  | —           | —                    | —              | —                                                        | —          |
| snake     | 60                 | 16.9ms      | 60                   | 16.9ms         | fondo+rejilla precocinados, draw calls agrupados por color (c71f2b7); remedición limpia confirma PASS, sin cambios de código adicionales | 2026-10-08 |
