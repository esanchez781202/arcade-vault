# SPEC 06 — Leaderboard y catálogo de juegos reales en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 04
> **Fecha:** 2026-09-14
> **Objetivo:** Mover el catálogo `GAMES` y el leaderboard de `/salon` y `/juego/[id]` de datos mock/`localStorage` a dos tablas nuevas en Supabase (`games` sembrada por migración, `scores` alimentada por partidas reales), retirando `seededScores`, `av_scores` y la ruta temporal `/diagnostico-supabase`.

---

## Por qué existe esta spec

SPEC 04 dejó el cableado de Supabase listo pero sin tablas, y documentó explícitamente
como deuda pendiente: "Leaderboard real: tablas `scores`/`profiles`, lectura de
`av_scores` en `/salon` o `/juego/[id]`, retirar `seededScores`" y "Mover el catálogo
`GAMES` de `lib/games.ts` a una tabla `games`". Esta spec cierra ambos puntos a la vez
porque comparten la misma dependencia (el cliente de servidor de SPEC 04) y el mismo
momento de madurez del proyecto: sin ellos, ni `/biblioteca` ni `/salon` pueden mostrar
datos reales. No hay auth real todavía (sigue fuera de SPEC 04), así que el leaderboard
identifica a cada score por un nombre de texto libre, no por un usuario autenticado.

---

## Alcance

**Dentro:**

- **Tabla `games`.** Nueva tabla en el esquema `public`, sembrada por migración SQL
  únicamente con `asteroids` (SPEC 05), el único juego del array `GAMES` de
  `lib/games.ts` que tiene motor real implementado hasta el momento. Los otros 8
  juegos del array (bloque-buster, caída, serpentina, glotón, invasores, rocas,
  ranaria, duelo-pixel) no se siembran en esta spec — se añadirán a `games` en la
  spec que implemente el motor real de cada uno, siguiendo el mismo patrón que
  SPEC 05 estableció para asteroids. RLS: `SELECT` público para todos (`anon` y
  `authenticated`); sin policy de `INSERT`/`UPDATE`/`DELETE` — el catálogo solo se
  modifica vía migración SQL, no hay pantalla de administración en esta spec.
- **Tabla `scores`.** Nueva tabla vacía en `public`, con `game_id` como FK a
  `games.id` y `player_name` como columna de texto libre (no `user_id`/FK a
  `auth.users`, porque no existe auth real todavía). RLS: `SELECT` público para todos;
  `INSERT` público para todos (sin auth, cualquiera puede registrar un score, igual de
  permisivo que el `localStorage.av_scores` actual); sin policy de `UPDATE`/`DELETE`.
- **`lib/games.ts` pasa a solo tipos.** Se retira el array `GAMES` y la función
  `seededScores` (y su array `PLAYERS` de nombres simulados). El archivo conserva (o
  mueve a un archivo nuevo si hace falta, ver plan) solo la interfaz `Game` y el tipo
  `ScoreRow`, que pasan a describir filas leídas de Supabase en vez de datos mock.
- **Capa de acceso a datos.** Nuevo `lib/data/games.ts` con funciones de servidor
  (`obtenerJuegos(): Promise<Game[]>`, `obtenerJuego(id: string): Promise<Game |
null>`) que consultan la tabla `games` vía `crearClienteSupabaseServidor()` de SPEC 04. Nuevo `lib/data/scores.ts` con `obtenerMejoresScores(gameId: string, limite:
number): Promise<ScoreRow[]>` (consulta `scores` filtrada por `game_id`, ordenada por
  `score` descendente, `limit(limite)`) y `guardarScore(entry: { gameId: string; name:
string; score: number }): Promise<void>` (hace `INSERT` en `scores`).
- **`/biblioteca` (Server Component) lee `games` vía `obtenerJuegos()`** en vez de
  importar `GAMES`. Mismo render de tarjetas que hoy.
- **`/juego/[id]` lee el juego vía `obtenerJuego(id)`** (`notFound()` si no existe) y
  su mini-tabla de 10 filas vía `obtenerMejoresScores(id, 10)` en vez de
  `seededScores`. Pasa a ser un Server Component (hoy es `"use client"` solo por
  `use(params)`/`useRouter`; el botón "JUGAR" que navega puede quedar como un
  `<Link>` o un pequeño componente hijo `"use client"` para el `onClick`, sin cambiar
  el resto a cliente).
- **`/salon` lee scores reales vía `obtenerMejoresScores(tab, 12)`** por cada tab de
  juego, y la lista de tabs desde `obtenerJuegos()` en vez de `GAMES`. Sigue siendo
  `"use client"` (usa `useState` para la tab activa y `useSession()`), pero la carga
  de datos por tab se hace en un `useEffect` que llama a una Server Action o Route
  Handler (`app/salon/actions.ts`, `"use server"`) que envuelve
  `obtenerMejoresScores`, ya que un Client Component no puede usar
  `crearClienteSupabaseServidor()` directamente.
- **Estado vacío en `/salon`.** Cuando `obtenerMejoresScores` devuelve un array vacío
  para el `tab` activo, se oculta el bloque `.podium` (top 3) y `.hall-table` muestra
  una única fila de mensaje: "AÚN NADIE HA REGISTRADO PUNTUACIÓN EN ESTE JUEGO", con la
  estética `.pixel`/`.neon-*` ya existente. La fila "tú" (amarilla, condicionada a
  `user`) tampoco se muestra en ese caso (no hay ranking real sobre el que insertarla
  falsamente).
- **`GUARDAR PUNTUACIÓN` en `app/juego/[id]/jugar/page.tsx` escribe en Supabase.** El
  botón invoca una Server Action `guardarScoreAction` (nuevo `app/juego/[id]/jugar/
actions.ts`, `"use server"`) que llama a `guardarScore({ gameId, name, score })`. Se
  retira `saveScore()` y toda lectura/escritura de `localStorage.av_scores`. El
  `name` sigue viniendo del mismo input de iniciales que existe hoy (prellenado con
  `user.name` si hay sesión, editable, por defecto `"INVITADO"`).
- **Retirar `app/diagnostico-supabase/`.** Cumple la nota dejada por SPEC 04: esta es
  la primera spec con funcionalidad real contra Supabase, así que la ruta de
  diagnóstico deja de hacer falta (`/biblioteca` y `/salon` ya verifican la conexión
  de forma visible).
- **Migración SQL.** Un único archivo en `supabase/migrations/` (carpeta nueva, no
  existe hoy) que crea ambas tablas, sus policies de RLS y siembra `games` con los 9
  juegos actuales, aplicado vía el MCP de Supabase (`apply_migration`).

**Fuera de alcance (para specs futuras):**

- Autenticación real. `player_name` sigue siendo texto libre; no hay `user_id`, FK a
  `auth.users` ni restricción de quién puede insertar un score.
- Contador exacto de partidas iniciadas (a diferencia de guardadas). `PARTIDAS` en
  `/juego/[id]` sí pasó a calcularse en vivo en la ampliación (paso 13), pero como
  proxy (`COUNT(scores)`), no como conteo exacto de partidas jugadas; ver
  Decisiones. Un contador real de partidas iniciadas (independiente de si se
  guarda score) queda pendiente para una spec futura.
- Pantalla de administración del catálogo (crear/editar/borrar juegos desde la UI).
  `games` solo se modifica vía SQL/migraciones.
- Paginación o "cargar más" en `/salon`. Sigue siendo top 12 fijo por juego.
- Borrar o moderar scores (sin `UPDATE`/`DELETE` en las policies de `scores`).
- Migrar los scores ya guardados en `localStorage.av_scores` de usuarios existentes
  hacia la tabla `scores`. Ese `localStorage` queda huérfano; no se lee ni se borra
  activamente.
- Tipos generados desde el esquema (`database.types.ts`). Se sigue tipando a mano
  (`Game`, `ScoreRow`) como hasta ahora.
- Tests automatizados (no hay runner configurado en el repo).

---

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_games_y_scores.sql

create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best integer not null,
  plays text not null,
  difficulty integer not null check (difficulty between 1 and 5) -- añadida en la ampliación (paso 9)
);

alter table public.games enable row level security;
create policy "games_select_publico" on public.games for select using (true);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on public.scores (game_id, score desc);

alter table public.scores enable row level security;
create policy "scores_select_publico" on public.scores for select using (true);
create policy "scores_insert_publico" on public.scores for insert with check (true);

insert into public.games (id, title, short, long, cat, cover, color, best, plays) values
  ('asteroids', 'ASTEROIDS', '…', '…', 'SHOOTER', 'cover-rocas', 'yellow', 41200, '15.6K');
  -- único juego sembrado: es el único con motor real implementado (SPEC 05).
  -- El resto de entradas de lib/games.ts se añaden en la spec que implemente
  -- su motor correspondiente.
```

**TypeScript (`lib/games.ts`, solo tipos tras esta spec):**

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
  difficulty: number; // 1-5, añadido en la ampliación (paso 9)
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // formateada desde created_at, "DD/MM/YYYY"
}
```

```ts
// lib/data/games.ts
export async function obtenerJuegos(): Promise<Game[]>;
export async function obtenerJuego(id: string): Promise<Game | null>;

// lib/data/scores.ts
export async function obtenerMejoresScores(gameId: string, limite: number): Promise<ScoreRow[]>;
export async function guardarScore(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void>;
```

---

## Plan de implementación

Cada paso deja la app arrancando (`next dev`) sin errores.

1. **Migración.** Escribir `supabase/migrations/<timestamp>_games_y_scores.sql` con
   las tablas, policies e `insert` de siembra (únicamente `asteroids`, copiado
   literalmente de `lib/games.ts`). Aplicarla vía `apply_migration` del MCP de
   Supabase. Prueba manual: `list_tables` del MCP muestra `games` con 1 fila y
   `scores` vacía; `get_advisors` no reporta RLS deshabilitado en ninguna de las dos.
2. **Capa de datos.** Crear `lib/data/games.ts` y `lib/data/scores.ts` con las
   funciones de la sección anterior, usando `crearClienteSupabaseServidor()` de SPEC 04. Reducir `lib/games.ts` a solo las interfaces `Game`/`ScoreRow` (retirar
   `GAMES`, `seededScores`, `PLAYERS`). Prueba manual: `npx tsc --noEmit` compila
   (fallará hasta el paso 3, que actualiza los imports que usaban `GAMES`).
3. **`/biblioteca`.** Cambiar el import de `GAMES` por `await obtenerJuegos()` en el
   Server Component. Prueba manual: `/biblioteca` muestra 1 tarjeta (asteroids), con
   los mismos datos que tenía en `GAMES`.
4. **`/juego/[id]`.** Convertir a Server Component: `await obtenerJuego(id)` (con
   `notFound()` si es `null`) y `await obtenerMejoresScores(id, 10)` para la
   mini-tabla. Extraer el botón "JUGAR" (navegación con `useRouter`) a un componente
   hijo `"use client"` si hace falta. Prueba manual: `/juego/asteroids` carga con los
   mismos datos de antes; la mini-tabla muestra scores reales (vacía al principio,
   salvo los que se guarden en el paso 6). `/juego/rocas` (no sembrado en `games`,
   ver Decisiones) devuelve `notFound()`.
5. **`/salon`.** Crear `app/salon/actions.ts` (`"use server"`) que exporta una
   función envolviendo `obtenerJuegos()` y `obtenerMejoresScores`. Cambiar
   `HallOfFame` para cargar juegos y scores del tab activo vía esas acciones en un
   `useEffect`, sustituyendo `GAMES`/`seededScores`. Añadir el estado vacío
   (mensaje sin podio) cuando `rows.length === 0`. Prueba manual: `/salon` muestra
   el mensaje de vacío para todos los juegos (todavía sin scores reales).
6. **Guardado real de score.** Crear `app/juego/[id]/jugar/actions.ts`
   (`"use server"`) con `guardarScoreAction` envolviendo `guardarScore`. Cablear el
   botón `GUARDAR PUNTUACIÓN` de `jugar/page.tsx` a esa acción, retirando
   `saveScore()`/`localStorage.av_scores`. Prueba manual: jugar una partida de
   `asteroids`, guardar con un nombre, y ver la fila nueva reflejada en
   `/juego/asteroids` y `/salon` (tab ASTEROIDS) tras recargar.
7. **Retirar diagnóstico.** Borrar `app/diagnostico-supabase/`. Prueba manual:
   navegar a `/diagnostico-supabase` devuelve 404.
8. **Cierre.** Ejecutar `npx next build` y corregir errores de tipos o de framework.
   Si `next dev` reescribió el bloque `nextjs-agent-rules` de `AGENTS.md`, incluirlo
   en el commit.

### Ampliación post-cierre (paso 9)

Añadido durante la implementación, a petición del usuario, tras completar el paso 8:

9. **Portada clicable en `/juego/[id]`.** La portada (`.detail-cover`) del juego
   pasa a navegar a `/juego/[id]/jugar`, la misma ruta que el botón "JUGAR AHORA",
   envolviéndola en el mismo `<Link>`. Prueba manual: click en la portada de
   `/juego/asteroids` navega al reproductor.
10. **`DIFICULTAD` real en `/juego/[id]`.** `PARTIDAS` (`game.plays`) y
    `MEJOR GLOBAL` (`game.best`) ya se leían de `games` desde el paso 4; falta
    `DIFICULTAD`, hoy fija en el JSX (`★ ★ ★ ☆ ☆`, 3 de 5). Se añade una columna
    `difficulty` (`integer`, `check (difficulty between 1 and 5)`, `not null`) a
    `games` vía nueva migración, sembrada con `3` para `asteroids` (mismo valor
    visual que hoy). `Game.difficulty: number` en `lib/games.ts`;
    `obtenerJuegos()`/`obtenerJuego()` la traen igual que el resto de columnas.
    El render calcula `★` rellenas según `game.difficulty` en vez de un string fijo.
    Prueba manual: `/juego/asteroids` sigue mostrando 3 estrellas rellenas (mismo
    valor, ahora desde Supabase); cambiar la columna en Supabase y recargar cambia
    la UI.
11. **`MEJOR GLOBAL` en vivo en `/juego/[id]`.** El usuario reportó que "PARTIDAS y
    MEJOR GLOBAL no se toman de la Base de datos"; en realidad ya se leían
    (`game.plays`/`game.best`, paso 10), pero como columnas fijas sembradas, no
    calculadas desde la actividad real — decisión explícita del paso original de
    esta spec (ver "Fuera de alcance" y "Decisiones"). Se acordó con el usuario
    revertir esa decisión solo para `MEJOR GLOBAL` de `/juego/[id]` (no para
    `PARTIDAS`, que se queda fija): pasa a `MAX(scores.score)` real para ese
    juego, derivado del primer elemento de `obtenerMejoresScores(id, 10)` (ya
    viene ordenado desc, así que el primer elemento es el máximo real exista o no
    entre los 10 mostrados), con fallback a `0` si el juego no tiene scores.
    Prueba manual: `/juego/asteroids` muestra como "Mejor global" el máximo real
    de `scores` (verificable con `select max(score) from scores where
game_id='asteroids'`), no el `41200` sembrado.
12. **`MEJOR PUNTUACIÓN` en vivo en `/biblioteca`.** La tarjeta de `/biblioteca`
    mostraba el mismo `game.best` fijo en su badge "MEJOR PUNTUACIÓN"; para evitar
    que dos pantallas muestren el mismo concepto con valores distintos (una en
    vivo, otra fija), se migra también a datos reales. Nueva función
    `obtenerMejoresScoresPorJuego(gameIds): Promise<Record<string, number>>` en
    `lib/data/scores.ts` (una sola consulta a `scores` para todos los juegos, en
    vez de N consultas) llamada desde `app/biblioteca/page.tsx` (Server Component)
    y pasada como prop `mejoresGlobales` a `BibliotecaClient`, que la usa en el
    badge de cada tarjeta con fallback a `0`. Prueba manual: `/biblioteca` muestra
    el mismo "mejor global" que `/juego/asteroids` para el mismo juego.
13. **`PARTIDAS` en vivo en `/juego/[id]`.** El usuario pidió que `PARTIDAS` también
    dejara de ser el `game.plays` sembrado. Hoy no existe ningún contador real de
    "partida iniciada" (solo se guarda un score al terminar, y no siempre); se
    acordó con el usuario usar como proxy el número de scores guardados:
    `PARTIDAS = COUNT(scores)` para ese juego (nueva función
    `obtenerConteoScores(gameId): Promise<number>` en `lib/data/scores.ts`, con
    `select(..., { count: "exact", head: true })`). No es un conteo exacto de
    partidas jugadas (una partida sin guardar puntuación no cuenta), limitación
    aceptada explícitamente. El resultado se formatea con el mismo estilo `"1.2K"`
    que tenía `game.plays` (número tal cual por debajo de 1000). `games.plays`
    queda sin uso en la UI tras este paso (se mantiene la columna, sin lectores).
    Prueba manual: `/juego/asteroids` muestra en `PARTIDAS` el número real de filas
    en `scores` para `asteroids` (verificable con `select count(*) from scores
where game_id='asteroids'`), no el `"15.6K"` sembrado.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `supabase/migrations/` contiene una migración que crea `games` y `scores` con
      RLS habilitada en ambas.
- [ ] La tabla `games` tiene exactamente 1 fila tras la migración: `asteroids`
      (único juego con motor real implementado hasta el momento).
- [ ] `lib/games.ts` ya no exporta `GAMES`, `seededScores` ni `PLAYERS`; solo las
      interfaces `Game` y `ScoreRow`.
- [ ] `/biblioteca` muestra 1 tarjeta (asteroids) leída de la tabla `games`.
- [ ] `/juego/asteroids` carga datos del juego desde Supabase; `/juego/rocas` (y
      cualquier otro `id` no sembrado en `games`) muestra `notFound()`.
- [ ] `/salon` muestra, para un juego sin scores, el mensaje de tabla vacía sin
      podio, en vez de filas simuladas.
- [ ] Jugar una partida de `asteroids`, pulsar `GUARDAR PUNTUACIÓN` con un nombre, y
      recargar `/salon` (tab ASTEROIDS) muestra esa fila nueva con el score real.
- [ ] La misma fila guardada aparece también en la mini-tabla de `/juego/asteroids`.
- [ ] `localStorage.av_scores` ya no se escribe ni se lee en ningún archivo del
      repo.
- [ ] `app/diagnostico-supabase/` no existe; navegar a esa ruta da 404.
- [ ] `get_advisors` del MCP de Supabase no reporta ninguna tabla `public` sin RLS
      habilitada.
- [ ] Insertar un score vía el cliente de navegador (sin sesión) funciona (RLS
      pública de `scores` confirmada); intentar un `UPDATE`/`DELETE` sobre `scores`
      o un `INSERT`/`UPDATE`/`DELETE` sobre `games` desde el cliente falla por RLS.
- [ ] (Ampliación) Click en la portada de `/juego/asteroids` navega a
      `/juego/asteroids/jugar`, igual que "JUGAR AHORA".
- [ ] (Ampliación) `games.difficulty` existe (`integer`, `check` 1-5, `not null`),
      `asteroids` tiene `difficulty = 3`, y `/juego/asteroids` pinta las estrellas
      de `DIFICULTAD` a partir de esa columna, no de un string fijo.
- [ ] (Ampliación) "Mejor global" en `/juego/asteroids` y "MEJOR PUNTUACIÓN" en la
      tarjeta de `/biblioteca` coinciden entre sí y con `MAX(scores.score)` real
      para `asteroids`, no con la columna `games.best` sembrada.
- [ ] (Ampliación) `PARTIDAS` en `/juego/asteroids` coincide con `COUNT(scores)`
      real para `asteroids`, no con la columna `games.plays` sembrada.

---

## Decisiones

- **Sí:** sembrar `games` únicamente con `asteroids`, no con los 9 juegos del array
  `GAMES`. Decisión tomada durante la implementación (paso 8), corrigiendo el
  alcance original de esta spec: `asteroids` es el único juego con motor real
  implementado (SPEC 05); el resto son placeholders visuales sin motor jugable.
  Sembrar el catálogo real con juegos que no se pueden jugar de verdad sería
  engañoso. Cada juego se añade a `games` en la spec que implemente su motor.
- **Sí:** una sola spec para `games` y `scores` en vez de dos separadas, decisión
  explícita del usuario en la fase de preguntas, aunque ambas tablas son dominios
  independientes. Quedan documentadas como dos migraciones lógicas dentro del mismo
  archivo SQL para que una revisión futura pueda separarlas si hace falta.
- **Sí:** `scores.player_name` como texto libre, no `user_id` con FK a
  `auth.users`. No existe auth real todavía (SPEC 04 la dejó fuera); bloquear el
  guardado de scores hasta que exista dejaría el leaderboard vacío indefinidamente.
- **No:** deshabilitar `GUARDAR PUNTUACIÓN` hasta que haya auth real. Contradice el
  objetivo de la spec (leaderboard real y usable ya).
- **Sí:** RLS de `scores` con `INSERT` público (sin restricción). Mismo nivel de
  confianza que el `localStorage.av_scores` actual, que cualquiera podía escribir
  desde la consola del navegador; no es una regresión de seguridad.
- **Sí:** `games` con `SELECT` público y sin ninguna policy de escritura desde el
  cliente. El catálogo es contenido editorial, no generado por usuarios; solo se
  modifica vía migración.
- **No (revertida en los pasos 11-13):** originalmente `best`/`plays` de `games` se
  quedaban como columnas fijas sembradas, sin calcularse en vivo desde `scores`
  ("se pospone", ver más abajo). El usuario pidió revertirlo, primero para `best`:
  "Mejor global" en `/juego/[id]` y "MEJOR PUNTUACIÓN" en `/biblioteca` pasan a
  `MAX(scores.score)` real (fallback `0` sin scores), para que ambas pantallas
  muestren el mismo dato real y no diverjan como columnas fijas vs. reales. Después
  también para `PARTIDAS` (paso 13): pasa a `COUNT(scores)` real, aceptando
  explícitamente que es un proxy (partidas guardadas, no iniciadas) porque hoy no
  existe un contador de partidas iniciadas. `games.plays`/`games.best` se quedan
  en el esquema como columnas sembradas pero ya sin lectores en la UI.
- **Sí:** `/salon` sin podio ni filas cuando un juego no tiene scores reales, en vez
  de rellenar con `seededScores()` como hoy. Mostrar datos simulados junto a reales
  sería engañoso una vez el leaderboard es real.
- **Sí:** la mini-tabla de `/juego/[id]` también pasa a datos reales (top 10), no se
  queda simulada. Dos pantallas mostrando el mismo dato (scores de un juego) de
  fuentes distintas sería inconsistente.
- **Sí:** `/juego/[id]` pasa de Client Component a Server Component para poder
  hacer `await` directo sobre `obtenerJuego`/`obtenerMejoresScores`, sin pasar por
  una Server Action. `/salon` sigue siendo Client Component (necesita `useState`
  para la tab activa) y por eso sí necesita una Server Action intermedia.
- **Sí:** borrar `app/diagnostico-supabase/` en esta spec. Cumple literalmente la
  nota dejada por SPEC 04 ("se borra en la primera spec que implemente
  funcionalidad real").
- **No:** migrar los scores existentes en `localStorage.av_scores` de usuarios
  actuales hacia `scores`. No hay forma de leer el `localStorage` de otros
  navegadores desde el servidor; ese dato queda huérfano y se documenta como tal.
- **No:** generar `database.types.ts` en esta spec. Las interfaces `Game`/`ScoreRow`
  tipadas a mano siguen siendo suficientes; se puede introducir generación de tipos
  como mejora futura independiente.
- **No:** paginación en `/salon`. Se mantiene el límite de 12 filas fijo que ya
  existía con `seededScores(seed, 12)`.

---

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSERT` público en `scores` permite spam de puntuaciones falsas desde la consola del navegador              | Mismo nivel de exposición que el `localStorage.av_scores` actual; se acepta explícitamente en las decisiones, y queda documentado para cuando exista auth real.                                                 |
| La migración de siembra de `games` se desincroniza con los datos que hoy tiene `lib/games.ts` (copia manual) | El paso 1 copia el registro de `asteroids` literalmente del archivo actual antes de borrarlo en el paso 2; la prueba manual del paso 1 verifica 1 fila.                                                         |
| `/salon` hace una llamada por cada tab en vez de traer todo de una vez, generando más round-trips            | Aceptado: son como máximo tantos juegos como tenga `games` (hoy 1, crecerá con futuras specs), cada consulta es un `select … limit 12` indexado por `game_id`; no justifica una consulta agregada más compleja. |
| Convertir `/juego/[id]` de Client a Server Component rompe el botón "JUGAR" que hoy usa `useRouter`          | El paso 4 extrae explícitamente ese botón a un componente hijo `"use client"` antes de tocar el resto de la página.                                                                                             |

---

## Lo que **no** entra en esta spec

- Autenticación real ni `user_id` en `scores`.
- Contador exacto de partidas iniciadas (`best` y `PARTIDAS` sí se calculan en vivo
  desde SPEC 06, pasos 11-13; `PARTIDAS` es un proxy vía `COUNT(scores)`, no un
  conteo exacto de partidas jugadas).
- Pantalla de administración del catálogo de juegos.
- Paginación o "cargar más" en `/salon`.
- Borrado o moderación de scores.
- Migración de los scores existentes en `localStorage.av_scores`.
- Tipos generados desde el esquema (`database.types.ts`).
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
