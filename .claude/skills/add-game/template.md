# Plantilla — SPEC NN: motor real + catálogo + leaderboard para `<slug>`

Esta plantilla congela la receta que SPEC 05 (motor real de ASTEROIDS) y SPEC 06 (catálogo y
leaderboard en Supabase) establecieron para dar de alta un juego jugable de verdad. Cada spec
generada por `/add-game` sigue esta estructura, con las secciones ya en castellano y las rutas
reales del repo. Sustituye `<slug>`/`<X>`/`<Titulo>` por los valores concretos del juego.

---

## Encabezado

```markdown
# SPEC NN — <Título del juego>: motor real y leaderboard

> **Estado:** Draft
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** <fecha del session context>
> **Objetivo:** <una sola frase — qué se añade y a qué coste>
```

## `## Por qué existe esta spec`

Explica de dónde viene el juego (prototipo en `references/started-games/<carpeta>/` o diseño
descrito por el usuario) y por qué merece una entrada real en el catálogo (frente a las entradas
placeholder que ya existen sin motor). Si el prototipo tiene particularidades que no encajan
directamente en el contrato actual (proporción de canvas, estados extra, assets asíncronos, HUD
auxiliar), nómbralas aquí con la decisión tomada en la fase de preguntas.

## `## Alcance`

**Dentro / Fuera**, con el mismo nivel de precisión que SPEC 05/06. Fuera de alcance, por
defecto, salvo que el usuario pida explícitamente lo contrario:

- Controles táctiles/móviles (los prototipos son sólo teclado).
- Auth real / `user_id` en `scores` (sigue sin existir en el repo).
- Migrar scores de `localStorage` (ya no aplica; SPEC 06 retiró ese mecanismo).
- Pantalla de administración del catálogo.
- Sonido/música, salvo que el prototipo los traiga y el usuario pida portarlos.
- Tests automatizados (no hay runner configurado).

## `## Modelo de datos`

Fila de siembra para `games`, en el mismo formato que usa el repo:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  '<slug>', '<TÍTULO>', '<short>', '<long>',
  '<ARCADE|PUZZLE|SHOOTER|VERSUS>', '<cover-clase>', '<cyan|magenta|yellow|green>',
  <best:int>, '<plays:string>', <difficulty:1-5>
);
```

`difficulty` es `not null` **sin default** — la migración tiene que darlo siempre (ver
`supabase/migrations/20260914100000_games_difficulty.sql`). `cat` y `color` están restringidos
por `CHECK` a los valores de arriba.

Contrato TypeScript entre el motor y el componente (mismo patrón que
`components/games/asteroids/engine.ts` + `AsteroidsGame.tsx`):

```ts
// components/games/<slug>/engine.ts
export type <X>GameState = "playing" | "dead" | "gameover"; // añade otros valores sólo si el juego los necesita

export interface <X>EngineState {
  score: number;
  lives: number;
  level: number;
  state: <X>GameState;
}

export interface <X>InputState {
  /* teclas relevantes de este juego */
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* ... */
  return { update, draw, getState, forceGameOver };
}
export type <X>Engine = ReturnType<typeof createEngine>;
```

```ts
// components/games/<slug>/<X>Game.tsx
export interface <X>GameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
}
interface <X>GameProps {
  onStateChange: (state: <X>EngineState) => void;
  ref?: Ref<<X>GameHandle>; // React 19: ref como prop, sin forwardRef
}
```

## `## Plan de implementación`

Cada paso deja `next dev` arrancando sin errores. Adapta los seis pasos siguientes con las
particularidades resueltas en las preguntas del skill; no los reordenes ni los fusiones salvo que
el juego no necesite alguno (documenta por qué si lo omites).

1. **Migración SQL.** Nuevo archivo `supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql` con el
   `insert` de la sección anterior, copiado literalmente del acuerdo tomado en las preguntas.
   Aplicar con `apply_migration` del MCP de Supabase. Aviso: la migración
   `20260914093515_games_solo_asteroids.sql` borró del catálogo todo lo que no fuera `asteroids`
   — el catálogo **no se repuebla solo**, cada juego nuevo necesita su propia fila. Prueba
   manual: `list_tables` muestra la fila nueva; `get_advisors` no reporta RLS deshabilitada.
2. **Portada CSS.** `.cover-<slug>` en el bloque de portadas de `app/globals.css` (línea ~667 en
   la versión actual, junto a `.cover-bricks`, `.cover-rocas`, etc.), o reutilizar una clase
   existente si así se decidió en las preguntas. Convención: `.cover-bg` base + detalle en
   `::after` + glifo opcional en `::before` + `filter: drop-shadow(...)` con la variable de color
   de `--cyan`/`--magenta`/`--yellow`/`--green`. Prueba manual: `/biblioteca` muestra la portada
   nueva sin CSS roto en otras tarjetas.
3. **Motor portado.** `components/games/<slug>/engine.ts`: lógica pura tipada, portada 1:1 del
   prototipo (mismas fórmulas/constantes), sin `window`/`document`/`canvas` a nivel de módulo —
   todo se inyecta al crear la instancia. Cualquier `drawHUD()` del prototipo se elimina del
   `draw()` portado (el HUD React del reproductor es el único HUD visible). Referencia viva para
   el patrón: `components/games/asteroids/engine.ts`. Prueba manual: `npx tsc --noEmit` compila.
4. **Componente canvas.** `components/games/<slug>/<X>Game.tsx` (`"use client"`), clonando el
   patrón de `components/games/asteroids/AsteroidsGame.tsx` en estos puntos, todos load-bearing:
   - `ref` como prop normal (`ref?: Ref<<X>GameHandle>`), no `forwardRef` (React 19).
   - `useImperativeHandle` exponiendo `pause/resume/forceGameOver`.
   - Un `reportIfChanged` que compara con el último estado reportado antes de llamar
     `onStateChange`, para no disparar un `setState` por frame a 60 fps.
   - El callback `onStateChange` guardado en un ref (`onStateChangeRef`) para que el `useEffect`
     de montaje pueda tener deps `[]`.
   - `resume()` resetea `lastTimeRef.current = null` para no acumular un `dt` gigante tras la
     pausa.
   - El bucle `requestAnimationFrame` capa `dt` a `0.05` (50 ms).
   - Listeners de teclado sobre `window` (el canvas no es focusable), con `preventDefault`
     condicionado a `state === "playing"`, registrados/desregistrados en el `useEffect` de
     montaje/desmontaje.
   - Canvas con resolución lógica fija en los atributos `width`/`height`, escalado por estilo
     inline: `position:absolute; inset:0; width:100%; height:auto; aspectRatio: "<W> / <H>"`.
   - Cleanup que cancela el `requestAnimationFrame` pendiente y quita los listeners.
     Prueba manual: montar el componente muestra el juego moviéndose y responde a los controles.
5. **Cableado en el reproductor.**
   - _Si es el primer motor real además de asteroids que introduce esta spec (`components/games/`
     ya tenía al menos uno antes de esta spec):_ refactorizar
     `app/juego/[id]/jugar/JugarClient.tsx` de su booleano `isAsteroids` a un registro genérico.
     Crear `components/games/registry.ts`:
     ```ts
     export interface RealGameHandle {
       pause(): void;
       resume(): void;
       forceGameOver(): void;
     }
     export interface RealGameProps {
       onStateChange: (state: {
         score: number;
         lives: number;
         level: number;
         state: string;
       }) => void;
       ref?: Ref<RealGameHandle>;
     }
     export const REGISTRO_MOTORES: Record<string, ComponentType<RealGameProps>> = {
       asteroids: AsteroidsGame,
       "<slug>": <X>Game,
     };
     ```
     y sustituir en `JugarClient.tsx` el booleano y sus cinco puntos de ramificación (los dos
     `useEffect` de simulación, `endGame`, `togglePause`, `restart`, el JSX del marco CRT) por
     `const MotorJuego = REGISTRO_MOTORES[game.id]`, conservando el bloque `.game-arena` simulado
     como fallback cuando `game.id` no está en el registro. El comportamiento de `asteroids` debe
     quedar idéntico tras el refactor.
   - _Si no_ (asteroids sigue siendo el único motor real antes de esta spec): añadir una rama
     condicional puntual `game.id === "<slug>"` junto a la de `isAsteroids`, exactamente en el
     mismo patrón que introdujo SPEC 05.
     Prueba manual: `npx tsc --noEmit` compila; `/juego/asteroids/jugar` sigue funcionando igual.
6. **Verificación de juego completo.** Jugar una partida real en `/juego/<slug>/jugar`: HUD React
   (Puntuación/Vidas/Nivel) en tiempo real, PAUSA congela el canvas, REANUDAR retoma, FIN o la
   derrota natural abren el modal con el score real, `GUARDAR PUNTUACIÓN` escribe en `scores` vía
   `guardarScoreAction` (`app/juego/[id]/jugar/actions.ts`, sin tocar). Confirmar que
   `/juego/<slug>` (Server Component) y `/salon` (tab `<slug>`) reflejan esa fila tras recargar —
   ninguna de las dos pantallas necesita cambios, ya leen `obtenerJuegos`/`obtenerJuego`/
   `obtenerMejoresScores`/`obtenerConteoScores`/`obtenerMejoresScoresPorJuego` de `lib/data/`
   genéricamente por `game.id`. Ejecutar `npx next build` y corregir errores. Si `next dev`
   reescribió el bloque `nextjs-agent-rules` de `AGENTS.md`, incluirlo en el commit.

## `## Criterios de aceptación`

Incluye siempre, más los específicos de este juego (estados extra, HUD auxiliar, assets):

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` tiene una migración nueva que siembra `<slug>` en `games` con
      `difficulty` explícita; `get_advisors` no reporta RLS deshabilitada.
- [ ] `/biblioteca` muestra una tarjeta nueva para `<slug>`, con portada y datos correctos.
- [ ] `components/games/<slug>/engine.ts` no referencia `window`, `document` ni `canvas` a nivel
      de módulo.
- [ ] `/juego/<slug>/jugar` muestra el juego real jugable con teclado; el HUD React refleja el
      estado real del motor, no una simulación.
- [ ] PAUSA congela el canvas; REANUDAR retoma sin salto de tiempo.
- [ ] Perder (o ganar, si aplica) o pulsar FIN abre el modal de fin con el score real;
      `GUARDAR PUNTUACIÓN` inserta en `scores` vía la Server Action existente.
- [ ] La fila guardada aparece en `/juego/<slug>` (mini-tabla) y en `/salon` (tab `<slug>`) tras
      recargar.
- [ ] `/juego/asteroids/jugar` y el resto de juegos ya reales siguen comportándose exactamente
      igual que antes de esta spec.
- [ ] (Si esta spec introduce el registro de motores) `components/games/registry.ts` existe;
      `JugarClient.tsx` ya no tiene el booleano `isAsteroids`; el comportamiento de `asteroids`
      es idéntico al de antes del refactor.

## `## Decisiones`

Documenta aquí, en formato Sí/No con justificación breve, cada respuesta que el usuario dio en
la fase de preguntas del skill (identidad de catálogo, portada, encaje de resolución, estados
extra, assets, HUD auxiliar) — igual que SPEC 05/06 documentan las suyas.

## `## Riesgos`

Tabla riesgo/mitigación. Incluye siempre, si aplica a este juego:

| Riesgo                                                                                                                  | Mitigación                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| El motor portado a TS introduce una regresión sutil de física/colisiones respecto al prototipo                          | El paso 3 copia la lógica 1:1 (mismas constantes y fórmulas); el paso 6 verifica jugando una partida completa.                               |
| `requestAnimationFrame` sigue corriendo tras desmontar la página                                                        | El `useEffect` de `<X>Game` cancela el frame pendiente y limpia listeners en su función de limpieza (mismo patrón que `AsteroidsGame`).      |
| (Si aplica) La proporción del prototipo no es 4:3 y desalinea el marco CRT                                              | Resuelto en la fase de preguntas del skill; documentar aquí la solución elegida (letterbox / resolución adaptada / `aspect-ratio` relajado). |
| (Si esta spec introduce el registro de motores) El refactor de `JugarClient.tsx` rompe el comportamiento de `asteroids` | El paso 5 exige que el comportamiento de `asteroids` quede idéntico tras el refactor; se verifica explícitamente en el paso 6.               |

## `## Lo que **no** entra en esta spec`

Lista corta, en espejo de `## Alcance` → Fuera de alcance.
