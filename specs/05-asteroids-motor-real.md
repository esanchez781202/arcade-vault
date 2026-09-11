# SPEC 05 — Motor real de ASTEROIDS

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-09-11
> **Objetivo:** Añadir una entrada nueva `asteroids` al catálogo `GAMES` y sustituir la simulación de puntuación falsa del reproductor por el motor real de Asteroids (portado desde `references/started-games/02-asteroids/game.js`) únicamente para ese juego, sincronizando su estado (puntuación, vidas, nivel, pausa, fin de partida) con el HUD React existente.

---

## Por qué existe esta spec

`app/juego/[id]/jugar/page.tsx` es hoy una simulación visual: para cualquier `id` del
catálogo anima una puntuación aleatoria creciente y un HUD decorativo (naves/enemigos
CSS), sin lógica de juego real. `references/started-games/02-asteroids/` contiene un
clon completo y jugable de Asteroids en Canvas/JS puro (movimiento, colisiones,
partición de asteroides, power-up de disparo triple, partículas, vidas, niveles). El
catálogo (`lib/games.ts`) ya tiene una entrada temática de asteroides (`rocas`,
"Pulveriza asteroides en gravedad cero"), pero el juego real se quiere como una
entrada propia llamada `asteroids`, separada de `rocas`. Esta spec añade esa entrada
al catálogo, porta el motor a TypeScript, lo monta dentro del reproductor solo para
`asteroids`, y conecta su estado real al HUD y al flujo de guardado de puntuación que
ya existen — `rocas` y el resto de juegos siguen con la simulación actual, sin
cambios.

---

## Alcance

**Dentro:**

- **Entrada nueva en el catálogo.** En `lib/games.ts`, añadir al array `GAMES` un
  objeto `Game` con `id: "asteroids"`, `title: "ASTEROIDS"`, mismos `short`/`long`
  que `rocas` ("Pulveriza asteroides en gravedad cero." / "Tu nave triangular flota
  en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más
  pequeños. Cuidado con los OVNIs en el horizonte."), `cat: "SHOOTER"`,
  `cover: "cover-rocas"` (reutiliza la clase CSS ya existente en `globals.css`, sin
  CSS nuevo), `color: "yellow"`, `best: 41200`, `plays: "15.6K"`. La entrada `rocas`
  existente no se toca ni se elimina.
- **Motor portado a TypeScript**, en `components/games/asteroids/`:
  - `engine.ts`: lógica pura del juego portada de `game.js` (clases `Bullet`,
    `Asteroid`, `Ship`, `Particle`, `PowerUp`, funciones `update`/`draw`, constantes
    `RADII`/`SPEEDS`/`POINTS`/`POWERUP_*`). Mismo comportamiento de juego (física,
    colisiones, partición de asteroides, power-up de disparo triple, wrap toroidal,
    invencibilidad al reaparecer) que el original, tipado con TS. Sin `window`/`document`
    globales de nivel de módulo — el canvas y el input se inyectan, para que el
    módulo se pueda instanciar/destruir de forma controlada por React (evita fugas
    entre montajes/desmontajes de la página).
  - `AsteroidsGame.tsx` (`"use client"`): componente que monta un `<canvas
width={800} height={600}>`, crea una instancia del motor en un `useEffect`, arranca
    el bucle `requestAnimationFrame` y lo cancela al desmontar. Expone el estado del
    motor (`score`, `lives`, `level`, `state: 'playing' | 'dead' | 'gameover'`) al
    padre vía props de callback (`onStateChange`), y un método imperativo (`ref`)
    para `pause()` / `resume()` / `forceGameOver()`, para que `jugar/page.tsx` los
    dispare desde los botones del HUD existente.
  - El HUD que hoy dibuja `game.js` directamente en el canvas (SCORE/NIVEL/vidas
    con `drawHUD()`) se retira del `draw()` portado — el HUD React de la pantalla
    reproductor es el único HUD visible, alimentado por `onStateChange`.
  - CSS: el `<canvas>` se escala con `max-width: 100%`, `height: auto` y
    `aspect-ratio: 800 / 600` dentro del contenedor `.crt-screen`, manteniendo 800×600
    de resolución lógica interna (coordenadas del juego sin cambios).
- **Pausa real.** `pause()` detiene el bucle (`cancelAnimationFrame`, no se vuelve a
  llamar `update()`/`draw()`); `resume()` lo retoma desde donde quedó (`lastTime` se
  resetea a `null` en el primer frame tras reanudar, igual que hace hoy el motor
  original al arrancar, para no acumular un `dt` gigante). El canvas queda congelado
  en el último frame dibujado mientras está en pausa — no se dibuja overlay dentro
  del canvas; el overlay "EN PAUSA" ya existente en `jugar/page.tsx` (superpuesto al
  `.crt-screen`) cubre esa necesidad tal cual está.
- **Botón FIN como game over forzado.** Para `asteroids`, "FIN" invoca
  `forceGameOver()` en el motor (pone `lives = 0` y `state = 'gameover'`), reutilizando
  el mismo modal de fin y el mismo `score` que un game over natural (tres vidas
  perdidas), en vez de la ruta separada `endGame()` que usa la simulación hoy.
- **Integración condicional en `jugar/page.tsx`.** Cuando `game.id === 'asteroids'`,
  la página monta `<AsteroidsGame />` en vez del bloque `.game-arena` simulado y del
  `setInterval` que anima el score falso; el resto del layout (HUD superior, marco
  CRT, botones PAUSA/FIN/SALIR, modal de fin con input de iniciales y
  `GUARDAR PUNTUACIÓN` sobre `localStorage.av_scores`) se conserva sin cambios,
  alimentado ahora por el estado real vía `onStateChange`. Para cualquier otro
  `id` del catálogo (incluido `rocas`), la página sigue exactamente igual que hoy
  (simulación).
- **Captura de teclado.** Mientras `AsteroidsGame` está montado y el estado es
  `'playing'`, `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` llaman `preventDefault()`
  en el listener de `keydown` para que el navegador no haga scroll de página con la
  barra espaciadora ni desplace el foco. El listener se registra/desregistra en el
  `useEffect` de montaje/desmontaje de `AsteroidsGame` (no queda activo en otras
  pantallas).
- **Disparo automático al llegar a `gameover`.** Igual que hace hoy la simulación al
  detectar el umbral de score, cuando `onStateChange` reporta `state === 'gameover'`,
  `jugar/page.tsx` pone `over = true` y muestra el modal de fin existente con el
  `score` real recibido.

**Fuera de alcance (para specs futuras):**

- Controles táctiles/en pantalla para móvil. `asteroids` con motor real queda
  limitado a teclado (igual que el prototipo original); no se añade ningún botón
  táctil.
- Cualquier otro juego del catálogo (`rocas`, `bloque-buster`, `caida`, `serpentina`,
  `gloton`, `invasores`, `ranaria`, `duelo-pixel`) recibiendo un motor real. Siguen
  con la simulación de `jugar/page.tsx` sin cambios. En particular, `rocas` no se
  fusiona ni se elimina en favor de `asteroids`.
- Un mecanismo genérico de "registro de motores por id" reutilizable. Esta spec
  resuelve `asteroids` con una rama condicional puntual
  (`if (game.id === 'asteroids')`); un registro genérico se diseña cuando exista un
  segundo juego real que lo justifique.
- Leaderboard real / lectura de Supabase. El guardado sigue escribiendo en
  `localStorage.av_scores` exactamente como hoy; ninguna vista lee ese valor todavía
  (deuda ya documentada en SPEC 04).
- Una clase de portada CSS propia (`cover-asteroids`). Se reutiliza `cover-rocas`
  tal cual existe en `globals.css`.
- Sonido/música.
- Tests automatizados (no hay runner configurado en el repo).

---

## Modelo de datos

**Catálogo.** Se añade una entrada al array `GAMES` existente en `lib/games.ts`
(interfaz `Game` sin cambios):

```ts
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Pulveriza asteroides en gravedad cero.",
  long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

**Persistencia.** No introduce estructuras nuevas. `localStorage.av_scores` sigue
recibiendo el mismo objeto que hoy (`{ game, score, name, at }`), ahora con `score`
proveniente del motor real y `game: 'asteroids'`.

**Contrato entre `AsteroidsGame` y `jugar/page.tsx`:**

```ts
// components/games/asteroids/AsteroidsGame.tsx
export interface AsteroidsEngineState {
  score: number;
  lives: number;
  level: number;
  state: "playing" | "dead" | "gameover";
}

export interface AsteroidsGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}

interface AsteroidsGameProps {
  onStateChange: (state: AsteroidsEngineState) => void;
}
// AsteroidsGame se referencia con useRef<AsteroidsGameHandle>
```

---

## Plan de implementación

Cada paso deja la app arrancando (`next dev`) sin errores.

1. **Catálogo.** Añadir la entrada `asteroids` al array `GAMES` en `lib/games.ts`
   con los datos de la sección anterior. Prueba manual: `/biblioteca` muestra una
   tarjeta nueva "ASTEROIDS" junto a "ROCAS", ambas visibles y distintas; su ficha
   en `/juego/asteroids` carga con `notFound()` resuelto correctamente.
2. **Portar el motor.** Crear `components/games/asteroids/engine.ts` copiando la
   lógica de `references/started-games/02-asteroids/game.js` (recuperar el archivo
   primero con `git show HEAD:references/started-games/02-asteroids/game.js` si no
   está en el working tree), tipado en TS, sin `window`/`document`/`canvas` globales
   de módulo: una función/clase `createEngine(ctx: CanvasRenderingContext2D)` que
   encapsula `ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`,
   `lives`, `level`, `state`, con métodos `update(dt, inputState)`, `draw()`,
   `getState(): AsteroidsEngineState`, `forceGameOver()`. `drawHUD()` se elimina de
   `draw()`. Prueba manual: `npx tsc --noEmit` compila.
3. **Componente canvas.** Crear `components/games/asteroids/AsteroidsGame.tsx`
   (`"use client"`) con el `<canvas>` 800×600 escalado por CSS, el bucle
   `requestAnimationFrame` propio (monta/desmonta con `useEffect`), el listener de
   teclado con `preventDefault` condicionado a `state === 'playing'`, y el `ref`
   imperativo (`useImperativeHandle`) con `pause`/`resume`/`forceGameOver`. Llama a
   `onStateChange` cada vez que cambia `score`/`lives`/`level`/`state`. Prueba
   manual: montar el componente en una página de prueba temporal muestra la nave y
   los asteroides moviéndose, responde a flechas/espacio.
4. **Cablear en el reproductor.** En `app/juego/[id]/jugar/page.tsx`, cuando
   `game.id === 'asteroids'`: reemplazar el bloque `.game-arena` simulado y el
   `setInterval` de score falso por `<AsteroidsGame onStateChange={...} ref={...}
/>`; los botones PAUSA/FIN llaman a `pause()`/`resume()`/`forceGameOver()` sobre el
   ref en vez de tocar el `setInterval`; `over`/`score`/`lives`/`level` del HUD
   pasan a leer el último `AsteroidsEngineState` recibido. El resto de `id` (incluido
   `rocas`) sigue el camino actual sin cambios. Prueba manual: `npx tsc --noEmit`
   compila.
5. **Verificación de juego completo.** Navegar a `/juego/asteroids/jugar`: jugar una
   partida real (mover, disparar, partir asteroides, perder las 3 vidas), confirmar
   que el HUD React (Puntuación/Vidas/Nivel) refleja el estado real en tiempo real,
   que PAUSA congela el canvas y REANUDAR lo retoma, que FIN fuerza el modal de fin
   con el score actual, y que GUARDAR PUNTUACIÓN escribe la entrada en
   `localStorage.av_scores` con `game: 'asteroids'`.
6. **Cierre.** Confirmar que `/juego/rocas/jugar` y cualquier otro id siguen
   mostrando la simulación sin cambios de comportamiento. Ejecutar `npx next build`
   y corregir errores de tipos o de framework. Si `next dev` reescribió el bloque
   `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `lib/games.ts` incluye una entrada `id: "asteroids"` en `GAMES`; la entrada
      `id: "rocas"` sigue presente y sin cambios.
- [ ] `/biblioteca` muestra tarjetas separadas para "ASTEROIDS" y "ROCAS".
- [ ] `components/games/asteroids/engine.ts` no referencia `window`, `document` ni
      `canvas` a nivel de módulo (todo se inyecta al crear la instancia).
- [ ] `/juego/asteroids/jugar` muestra el juego real de Asteroids en el `<canvas>`
      dentro del marco CRT: nave, asteroides, disparo, partículas de explosión.
- [ ] Las flechas izquierda/derecha rotan la nave, arriba propulsa, espacio dispara;
      espacio no hace scroll de la página mientras `state === 'playing'`.
- [ ] El HUD React superior (Puntuación, Vidas, Nivel) cambia en tiempo real acorde
      al estado real del motor, no a valores simulados.
- [ ] PAUSA congela el canvas (no se mueve nada); REANUDAR retoma el juego desde
      donde quedó.
- [ ] Al perder las 3 vidas (game over natural) o al pulsar FIN, aparece el modal de
      fin existente con el `score` real de la partida.
- [ ] `GUARDAR PUNTUACIÓN` en el modal escribe en `localStorage.av_scores` una
      entrada con `game: 'asteroids'` y el `score` real.
- [ ] `/juego/rocas/jugar` y `/juego/<otro-id>/jugar` (p.ej. `bloque-buster`) se
      comportan exactamente igual que antes de esta spec (simulación de score, HUD
      decorativo).
- [ ] Ningún otro juego del catálogo monta `AsteroidsGame` ni el motor de
      `asteroids`.

---

## Decisiones

- **Sí:** entrada nueva `asteroids` en el catálogo, separada de `rocas`. El usuario
  pidió explícitamente ese nombre; `rocas` se deja intacta para no perder su
  historial de `best`/`plays` ni romper enlaces existentes hacia ella.
- **Sí:** reutilizar la clase CSS `cover-rocas` para la portada de `asteroids` en vez
  de crear `cover-asteroids`. Ambas comparten temática visual y evita CSS
  duplicado; se puede diferenciar en una spec de diseño futura si hace falta.
- **Sí:** rama condicional puntual (`if (game.id === 'asteroids')`) en
  `jugar/page.tsx` en vez de un registro genérico de motores por id. Con un solo
  juego real, un registro genérico sería especulación sin un segundo caso que
  valide su forma.
- **Sí:** portar el motor a TypeScript, no dejarlo como JS suelto. Consistente con
  el resto del repo (100% TS/TSX) y permite tipar el contrato
  `AsteroidsEngineState` que consume el HUD React.
- **Sí:** HUD React sincronizado vía `onStateChange`, HUD propio del canvas
  eliminado. Duplicar el HUD (uno en React, otro dibujado en canvas) confundiría
  visualmente y el HUD React ya tiene la estética retro-CRT del resto del sitio.
- **Sí:** canvas de resolución lógica fija 800×600 escalado por CSS
  (`max-width:100%`, `aspect-ratio`). Cambiar la resolución lógica exigiría
  reescalar toda la física/constantes del motor portado; escalar visualmente es
  cambio cero de comportamiento de juego.
- **Sí:** `preventDefault` en flechas/espacio solo mientras `state === 'playing'` y
  solo mientras `AsteroidsGame` está montado. Evita que el juego rompa el scroll
  normal de la página fuera de la partida activa.
- **Sí:** FIN reutiliza el mismo camino de `gameover` que la derrota natural
  (`forceGameOver()` fuerza `lives = 0`), en vez de una ruta de fin separada.
  Un solo camino de "fin de partida" es menos código y menos casos que probar.
- **Sí:** mantener el flujo de guardado de puntuación (iniciales + botón GUARDAR)
  tal cual existe hoy, sin guardado automático. No cambia el comportamiento que ya
  conocen los demás juegos simulados.
- **No:** soporte táctil/móvil en esta spec. El prototipo original es solo teclado;
  añadir controles táctiles es una decisión de diseño de UI propia que merece su
  spec.
- **No:** tocar `rocas` ni ningún otro juego del catálogo más allá de añadir la
  entrada `asteroids`. Sin motor real para ellos todavía, cambiar su comportamiento
  no aporta nada y aumenta el riesgo de esta spec.

---

## Riesgos

| Riesgo                                                                                                                                          | Mitigación                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El motor portado a TS introduce una regresión sutil de física/colisiones respecto al original en JS                                             | El paso 2 copia la lógica 1:1 (mismas constantes `RADII`/`SPEEDS`/`POINTS`, mismas fórmulas), solo cambia tipado y la forma de inyectar `canvas`/input; la verificación manual del paso 5 juega una partida completa. |
| `requestAnimationFrame` sigue corriendo tras desmontar la página (fuga de memoria / trabajo en segundo plano)                                   | `useEffect` de `AsteroidsGame` cancela el frame pendiente (`cancelAnimationFrame`) y limpia listeners de teclado en su función de limpieza.                                                                           |
| El listener de teclado con `preventDefault` interfiere con otras pantallas o quedan teclas "pegadas" entre partidas                             | Se registra/desregistra en el ciclo de vida de `AsteroidsGame`, condicionado a `state === 'playing'`; solo existe mientras el canvas de `asteroids` está montado.                                                     |
| Pausar en mitad de una invencibilidad/explosión y reanudar produce un salto visual grande por un `dt` acumulado                                 | Igual que el arranque original, `lastTime` se resetea a `null` al reanudar para que el primer `dt` tras `resume()` sea `0`, no el tiempo transcurrido en pausa.                                                       |
| El canvas escalado por CSS desalinea las coordenadas del ratón/touch si se añaden en el futuro                                                  | Fuera de alcance de esta spec (solo teclado); se documenta aquí para la spec que añada controles táctiles.                                                                                                            |
| Reutilizar `cover-rocas` hace que "ASTEROIDS" y "ROCAS" se vean visualmente idénticos en `/biblioteca`, confundiendo a quien navega el catálogo | Aceptado explícitamente en las decisiones; sus títulos y `id` distintos bastan para diferenciarlos en esta spec, una portada propia queda para una spec de diseño futura.                                             |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles para `asteroids`.
- Motor real para `rocas` o cualquier otro juego del catálogo.
- Fusión, renombrado o eliminación de la entrada `rocas`.
- Un registro genérico de motores de juego por id.
- Leaderboard real / lectura de `av_scores` desde Supabase.
- Una clase de portada CSS propia para `asteroids`.
- Sonido o música.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
