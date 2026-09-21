# SPEC 10 — Controles táctiles para jugar en móvil

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-09-21
> **Objetivo:** Añadir un D-pad + 2 botones de acción táctiles en `/juego/[id]/jugar` (visibles solo en pantallas táctiles) que disparan los mismos `KeyboardEvent` que ya escuchan los cuatro motores reales, y corregir el desbordamiento horizontal de `.av-nav` en viewports estrechos que hoy empuja el botón de menú fuera de la pantalla.

---

## Por qué existe esta spec

Los cuatro motores reales (`asteroids`, `tetris`, `arkanoid`, `snake`) solo escuchan
`window.addEventListener("keydown"/"keyup", ...)` con `e.code` fijos (`ArrowLeft`,
`ArrowUp`, `Space`, etc.). En un dispositivo sin teclado físico no hay forma de mover
nada — la partida carga pero es injugable. Al mismo tiempo, se detectó con Playwright
(viewport 360×780 y 390×844 sobre `/juego/asteroids/jugar`) que `.av-nav` no tiene
`flex-wrap` y, por debajo de ~400px de ancho, el botón `≡` (hamburguesa) queda
empujado fuera del viewport visible (scroll horizontal), dejando el menú inaccesible
en el propio dispositivo que más lo necesita.

**Decisión de arquitectura tomada en la fase de preguntas, con justificación
técnica:** la opción inicial de que cada `<Juego>Game.tsx` renderizara sus propios
botones internos choca con que `.crt-screen` tiene `overflow: hidden` y
`aspect-ratio: 4/3` fijo (`app/globals.css:1056-1065`) — cualquier JSX que un motor
devuelva ahí queda recortado al mismo cuadro que el `<canvas>`, así que no puede
haber controles "debajo del canvas, sin taparlo" dentro de ese contenedor. La
solución elegida es que `JugarClient.tsx` monte un componente `TouchControls` **fuera**
de `.crt-screen` (entre `.crt-screen` y `.crt-bottom`) que, al presionar/soltar cada
botón, despacha `KeyboardEvent` sintéticos reales sobre `window` con el mismo `code`
que ya usa cada motor. Esto deja **intactos** `engine.ts`, `<Juego>Game.tsx` y
`RealGameHandle`/`RealGameProps` en `registry.ts` — cero motores tocados, cero
extensión del contrato compartido.

---

## Alcance

**Dentro:**

- **Detección táctil por CSS.** `TouchControls` se renderiza siempre en el DOM, pero
  el bloque completo queda oculto por defecto y solo visible bajo
  `@media (pointer: coarse)` en `app/globals.css` — sin JS de feature-detection, sin
  riesgo de desincronizar el HTML de hidratación SSR/cliente. En un desktop con mouse
  no aparece nunca; el comportamiento de teclado no cambia en absoluto.
- **Componente `TouchControls`**, definido dentro de
  `app/juego/[id]/jugar/JugarClient.tsx` (no en `registry.ts`, no en cada motor):
  - Recibe `gameId: string` y renderiza un D-pad de 4 flechas (cruz, mismo diseño
    visual para los cuatro juegos) + hasta 2 botones de acción redondos a su derecha,
    según una tabla de configuración estática `TOUCH_CONFIG: Record<string, TouchConfig>`
    indexada por `game.id` (ver Modelo de datos).
  - Cada botón (flecha o acción) mapea a un `code` de teclado. Al `pointerdown` sobre
    un botón con `code` asignado: `window.dispatchEvent(new KeyboardEvent("keydown", {
code }))`. Al `pointerup`/`pointercancel`/`pointerleave`: el `keyup` correspondiente.
    Usa Pointer Events (no touch events) con `setPointerCapture` para que soltar el
    dedo fuera del botón todavía dispare el `keyup` y para soportar multi-touch real
    (p. ej. mantener izquierda + pulsar acción a la vez en Tetris).
  - Un botón sin `code` asignado para el juego activo (p. ej. flecha arriba en
    Arkanoid, ambos botones de acción en Arkanoid/Snake) no se renderiza: el D-pad
    dibuja solo las flechas con `code` asignado para ese juego (mismo número de
    flechas visibles siempre que el juego las use; los botones de acción se ocultan
    del todo si `actions` está vacío para ese `gameId`).
  - `touch-action: none` en el contenedor para evitar scroll/zoom del navegador al
    tocar los controles; `e.preventDefault()` en `pointerdown` con el mismo criterio
    que ya usa cada motor (no interfiere, el motor ya ignora input fuera de
    `state === "playing"`).
- **Posición.** `TouchControls` se monta como hermano de `.crt-screen`, dentro de
  `.crt`, entre `.crt-screen` y `.crt-bottom` — nunca se superpone al canvas. Solo
  ocupa espacio (y se ve) en `@media (pointer: coarse)`; en desktop no reserva layout.
- **Mapeo de `code` por juego** (tabla completa en Modelo de datos):
  - `asteroids`: D-pad ←/→ → `ArrowLeft`/`ArrowRight` (rotar), D-pad ↑ → `ArrowUp`
    (empuje). D-pad ↓ sin `code`. Botón A → `Space` (disparo). Botón B sin `code`
    (oculto).
  - `tetris`: D-pad ←/→ → `ArrowLeft`/`ArrowRight` (mover), D-pad ↓ → `ArrowDown`
    (caída suave). D-pad ↑ sin `code`. Botón A → `ArrowUp` (rotar). Botón B →
    `Space` (caída total).
  - `arkanoid`: D-pad ←/→ → `ArrowLeft`/`ArrowRight` (mover paleta). D-pad ↑/↓ sin
    `code`. Botones A y B sin `code` (ocultos) — Arkanoid no tiene más acciones de
    teclado que mover.
  - `snake`: D-pad ←/→/↑/↓ → `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`. Botones
    A y B sin `code` (ocultos) — Snake no tiene acciones aparte de dirección.
- **Corrección de `.av-nav` en viewports estrechos.** Añadir una regla
  `@media (max-width: 480px)` en `app/globals.css` que reduce/oculta el texto del
  botón `Iniciar Sesión`/`<nombre> ▾` (o ajusta sus márgenes) lo suficiente para que
  `≡` quede siempre dentro del viewport, sin scroll horizontal. Sin cambios en
  `components/nav.tsx` — es un ajuste de CSS puro sobre reglas ya existentes
  (`app/globals.css:216-323`). Aplica a toda la web (la `Nav` es compartida), pero la
  verificación de esta spec se limita a `/juego/[id]/jugar`.
- **Verificación manual con Playwright** en los 4 juegos, usando el emulador de touch
  (`page.touchscreen` o Pointer Events sintéticos) sobre viewports 360×780 y
  390×844, guardando capturas en `.playwright-screenshots/`.

**Fuera de alcance (para specs futuras):**

- Rediseño responsive general de `/`, `/biblioteca`, `/juego/[id]`, `/salon`,
  `/acerca-de` — ya tienen sus propias media queries y no se tocan aquí.
- Vibración háptica, sonido o feedback visual avanzado al pulsar un botón táctil
  (más allá de un estado `:active`/`pressed` simple en CSS).
- Soporte de gestos (swipe, drag continuo del D-pad tipo joystick virtual analógico).
- Reordenar o rediseñar el HUD superior (`.player-hud`) más allá de lo que ya
  resuelve `flex-wrap: wrap` existente — no se tocó porque no se detectó solapamiento
  ahí, solo en `.av-nav`.
- Auth real, `user_id` en `scores`, pantalla de administración, sonido/música.
- Tests automatizados (no hay runner configurado en el repo).

---

## Modelo de datos

Este feature no introduce datos persistentes (ni tabla ni localStorage nuevos). La
única estructura nueva es la tabla de configuración estática del componente,
definida en `app/juego/[id]/jugar/JugarClient.tsx`:

```ts
interface TouchButton {
  code: string | null; // KeyboardEvent.code a despachar; null = no se renderiza
  label: string; // texto/ícono corto dentro del botón (p. ej. "A", "⤒")
}

interface TouchConfig {
  dpad: { up: TouchButton; down: TouchButton; left: TouchButton; right: TouchButton };
  actions: TouchButton[]; // 0, 1 o 2 elementos; vacío = sin botones de acción
}

const TOUCH_CONFIG: Record<string, TouchConfig> = {
  asteroids: {
    dpad: {
      up: { code: "ArrowUp", label: "▲" },
      down: { code: null, label: "▼" },
      left: { code: "ArrowLeft", label: "◀" },
      right: { code: "ArrowRight", label: "▶" },
    },
    actions: [{ code: "Space", label: "A" }],
  },
  tetris: {
    dpad: {
      up: { code: null, label: "▲" },
      down: { code: "ArrowDown", label: "▼" },
      left: { code: "ArrowLeft", label: "◀" },
      right: { code: "ArrowRight", label: "▶" },
    },
    actions: [
      { code: "ArrowUp", label: "A" },
      { code: "Space", label: "B" },
    ],
  },
  arkanoid: {
    dpad: {
      up: { code: null, label: "▲" },
      down: { code: null, label: "▼" },
      left: { code: "ArrowLeft", label: "◀" },
      right: { code: "ArrowRight", label: "▶" },
    },
    actions: [],
  },
  snake: {
    dpad: {
      up: { code: "ArrowUp", label: "▲" },
      down: { code: "ArrowDown", label: "▼" },
      left: { code: "ArrowLeft", label: "◀" },
      right: { code: "ArrowRight", label: "▶" },
    },
    actions: [],
  },
};
```

---

## Plan de implementación

Cada paso deja `next dev` arrancando sin errores.

1. **Diagnóstico y fix de `.av-nav`.** Añadir `@media (max-width: 480px)` en
   `app/globals.css` (junto a la regla existente de `840px`, `app/globals.css:310-323`)
   que reduce el botón de auth (texto más corto o padding menor) para que `≡` nunca
   quede fuera del viewport. Prueba manual: capturas de Playwright en 360×780 y
   390×844 sobre `/` y `/juego/asteroids/jugar` sin scroll horizontal
   (`document.documentElement.scrollWidth === document.documentElement.clientWidth`).
2. **CSS de `TouchControls`.** Añadir en `app/globals.css` las clases
   `.touch-controls`, `.touch-dpad`, `.touch-dpad button`, `.touch-actions`,
   `.touch-actions button`, todas dentro de `@media (pointer: coarse) { ... }` para
   que no aparezcan nunca en desktop. Cruz de 4 flechas + columna de hasta 2 botones
   redondos a la derecha, estética coherente con `.btn`/`.pixel` existentes. Prueba
   manual: forzar el media query en devtools (emulación táctil) y ver el bloque
   debajo del `crt-screen` sin tocar el canvas.
3. **Componente `TouchControls` en `JugarClient.tsx`.** Definir `TOUCH_CONFIG` (ver
   Modelo de datos) y el componente `TouchControls({ gameId }: { gameId: string })`
   que renderiza el D-pad + botones de acción, usando `onPointerDown`/`onPointerUp`/
   `onPointerCancel`/`onPointerLeave` para despachar `KeyboardEvent` sintéticos vía
   `window.dispatchEvent`, con `e.currentTarget.setPointerCapture(e.pointerId)` en
   `pointerdown`. Prueba manual: `npx tsc --noEmit` compila.
4. **Montaje en el reproductor.** Renderizar `<TouchControls gameId={game.id} />`
   como hermano de `.crt-screen`, antes de `.crt-bottom`, solo cuando `MotorJuego`
   existe (juegos sin motor real simulado no lo necesitan). Prueba manual: en
   emulación táctil, D-pad visible bajo el canvas en los 4 juegos reales; en
   `/juego/<mock>/jugar` (juego simulado) no aparece.
5. **Verificación de juego completo por touch, los 4 motores.** Con Playwright en
   viewport 390×844 y emulación de puntero táctil (`pointerType: "touch"`), jugar
   cada uno sin usar teclado: Asteroids (rotar+empuje+disparo), Tetris (mover+caída
   suave+rotar+caída total), Arkanoid (mover paleta), Snake (4 direcciones).
   Confirmar que el HUD refleja el estado real, `PAUSA`/`FIN`/`SALIR` (botones
   normales, ya táctiles) siguen funcionando, el modal de fin abre y
   `GUARDAR PUNTUACIÓN` inserta en Supabase. Confirmar en paralelo que
   `/juego/asteroids/jugar`, `/juego/tetris/jugar`, `/juego/arkanoid/jugar`,
   `/juego/snake/jugar` en un viewport desktop (mouse) no muestran ningún control
   táctil y el teclado se comporta exactamente igual que antes de esta spec.
   Ejecutar `npx next build` y corregir errores. Si `next dev` reescribió el bloque
   `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

---

## Criterios de aceptación

- [x] `npx next build` termina sin errores ni warnings de TypeScript.
- [x] En viewport ≤480px, `.av-nav` no produce scroll horizontal y el botón `≡`
      (menú) es siempre visible y clicable, en `/` y en `/juego/[id]/jugar`.
- [x] Bajo `@media (pointer: coarse)`, `/juego/asteroids/jugar`,
      `/juego/tetris/jugar`, `/juego/arkanoid/jugar` y `/juego/snake/jugar` muestran
      un D-pad + botones de acción debajo del `crt-screen`, sin superponerse al
      canvas.
- [x] En un viewport/dispositivo sin `pointer: coarse` (desktop con mouse), ningún
      control táctil se renderiza visualmente y el teclado sigue funcionando
      idéntico a antes de esta spec.
- [x] Asteroids es jugable de punta a punta solo con touch: rotar, empuje y disparo
      responden al D-pad/botón A.
- [x] Tetris es jugable de punta a punta solo con touch: mover, caída suave (D-pad),
      rotar (botón A) y caída total (botón B) responden correctamente.
- [x] Arkanoid es jugable de punta a punta solo con touch: la paleta se mueve con
      el D-pad izquierda/derecha; el selector de nivel en pausa (click sobre canvas)
      sigue funcionando con tap.
- [x] Snake es jugable de punta a punta solo con touch: las 4 direcciones del D-pad
      cambian el rumbo de la serpiente sin permitir giros de 180°.
- [x] En Arkanoid y Snake no se renderiza ningún botón de acción (0 botones); en
      Asteroids se renderiza 1; en Tetris se renderizan 2.
- [x] `GUARDAR PUNTUACIÓN` tras una partida jugada 100% por touch inserta
      correctamente en `scores` y la fila aparece en `/salon` tras recargar.
- [x] Ningún archivo dentro de `components/games/` (`engine.ts`, `<Juego>Game.tsx`,
      `registry.ts`) cambia como parte de esta spec.

---

## Decisiones

- **Sí:** `TouchControls` despacha `KeyboardEvent` sintéticos sobre `window` en vez
  de que cada motor exponga un método nuevo en `RealGameHandle` o renderice sus
  propios botones. Es la opción que no toca ningún `engine.ts`/`<Juego>Game.tsx`
  existente ni el contrato de `registry.ts`, y resuelve limpio el conflicto con
  `overflow: hidden` de `.crt-screen` (ver "Por qué existe esta spec").
- **Sí:** detección por `@media (pointer: coarse)`, no por ancho de viewport ni
  JS `matchMedia`. Nunca aparece en desktop con mouse, sin riesgo de
  desincronizar la hidratación SSR/cliente (decisión explícita del usuario sobre
  las alternativas evaluadas).
- **Sí:** diseño uniforme (D-pad de 4 flechas + hasta 2 botones redondos) en los 4
  juegos, ocultando el/los botón(es) que un motor no usa (Arkanoid y Snake sin
  botones de acción) en vez de mostrarlos inertes. Mantiene el layout reconocible
  entre juegos sin confundir al jugador con controles que no hacen nada.
- **Sí:** controles debajo del canvas (hermano de `.crt-screen`, nunca superpuesto),
  no un overlay semitransparente sobre el juego. Decisión explícita del usuario tras
  ver que el mockup inicial (overlay sobre el canvas) tapaba parte del área jugable.
- **Sí:** Pointer Events con `setPointerCapture`, no Touch Events ni solo mouse
  events. Soporta multi-touch real (mantener una dirección y pulsar una acción a la
  vez) y sigue funcionando si el dedo se desliza fuera del botón antes de soltarlo.
- **Sí:** arreglar el desbordamiento de `.av-nav` en esta misma spec, aunque
  `Nav` sea compartida por todo el sitio. Es la misma pantalla de juego que se está
  tocando y un menú inalcanzable bloquea igual de duro la meta de "poder jugar en
  móvil" que la falta de controles — decisión explícita del usuario.
- **No:** tocar el resto del layout responsive del sitio (`/`, `/biblioteca`,
  `/salon`, `/acerca-de`) — ya tienen media queries propias y no se detectó ningún
  problema equivalente al de `.av-nav`/controles de juego.
- **No:** gestos tipo joystick analógico (swipe/drag) ni feedback háptico — el
  usuario pidió específicamente un D-pad + 2 botones, no una reinterpretación de
  los controles.

---

## Riesgos

| Riesgo                                                                                                     | Mitigación                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `KeyboardEvent` sintético no dispara `preventDefault()` de forma idéntica a uno real en algún navegador | Los 4 motores ya condicionan `preventDefault()` a `state === "playing"` y no dependen de que el evento sea "trusted"; se verifica manualmente en el paso 5 con Playwright touch.    |
| Soltar el dedo fuera del botón (deslizar) deja una tecla "pegada" (`keydown` sin `keyup` correspondiente)  | `setPointerCapture` en `pointerdown` + listeners de `pointerup`/`pointercancel`/`pointerleave` en el mismo elemento capturan la liberación aunque el puntero salga del botón.       |
| `@media (pointer: coarse)` no cubre 100% de laptops táctiles (p. ej. Surface con mouse conectado)          | Aceptado: es la señal más fiable sin JS; un caso raro (laptop táctil + mouse) simplemente ve ambos controles disponibles, sin romper ninguno.                                       |
| El fix de `.av-nav` en `@media (max-width: 480px)` reduce el texto de auth y afecta la legibilidad ahí     | Se verifica visualmente con captura de Playwright en 360×780 antes de cerrar el paso 1; si el texto reducido no es legible, se ajusta el breakpoint o el contenido, no el objetivo. |

---

## Lo que **no** entra en esta spec

- Rediseño responsive general de `/`, `/biblioteca`, `/juego/[id]`, `/salon`,
  `/acerca-de`.
- Gestos (swipe, joystick analógico por drag), vibración háptica, sonido.
- Cambios en `.player-hud` más allá de lo ya cubierto por `flex-wrap: wrap`.
- Cambios en `engine.ts`, `<Juego>Game.tsx` o `registry.ts` de cualquier motor.
- Auth real, `user_id` en `scores`, pantalla de administración.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
