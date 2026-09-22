# Estado del porting móvil — Arcade Vault

Registro de qué ruta está adaptada a móvil y con qué verificación. Memoria de `mobile-porter`:
una ruta por invocación, nunca se procesan varias a la vez.

| Ruta                 | Media queries propias        | M1-M6 (Fase 3)     | Capturas | Fecha      |
| --------------------- | ------------------------------ | -------------------- | -------- | ---------- |
| `/`                   | 6 (980/520/1100/600/720 ×2)    | —                     | —        | —          |
| `/biblioteca`         | solo paddings 720px            | —                     | —        | —          |
| `/juego/[id]`         | 1 (900px)                      | —                     | —        | —          |
| `/juego/[id]/jugar`   | `pointer: coarse`              | parcial (SPEC 10)    | parcial  | 2026-09-21 |
| `/salon`              | 2 (720px)                      | —                     | —        | —          |
| `/acceso`             | ninguna                        | —                     | —        | —          |
| `/acerca-de`          | 2 (820/900px)                  | —                     | —        | —          |

## Notas

- **Arranque (2026-09-22):** tabla sembrada a partir de una auditoría estática de
  `app/globals.css` (17 media queries, 10 breakpoints ad-hoc). Ninguna ruta tiene aún
  verificación M1-M6 con Playwright. `/juego/[id]/jugar` figura como parcial porque SPEC 10
  cubrió el D-pad táctil y el desbordamiento de `.av-nav`, pero no auditó HUD, panel de skins
  (`flex: 0 0 200px` fijo) ni el modal de fin de partida.
- **Compartido por todas las rutas:** `app/globals.css:1694-1720` (bloque de paddings a 720px),
  `components/nav.tsx` y `components/footer.tsx` (este último sin ninguna clase CSS: todo
  inline). Un arreglo ahí afecta a las 7 rutas; anótalo aquí cuando ocurra.
