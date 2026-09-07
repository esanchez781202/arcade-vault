# SPEC 01 — MVP de pantallas visuales de Arcade Vault

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-09-07
> **Objetivo:** Portar las cinco pantallas del prototipo de `references/templates/` al App Router de Next.js como capa puramente visual, sin implementar ningún juego.

---

## Por qué existe esta spec

El código de `app/` es todavía el scaffold de `create-next-app`. El prototipo
autónomo de `references/templates/` (HTML + React 18 + Babel standalone) es la
fuente de verdad visual/UX y no está conectado al build. Esta spec traslada ese
prototipo a rutas reales de Next.js manteniendo su estética 1:1, para tener una
base navegable sobre la que construir features posteriores (juegos reales,
backend, auth real, leaderboard persistente).

Los tokens de tema y las fuentes ya están portados: `app/globals.css` tiene la
paleta y `@theme inline`, y `app/layout.tsx` carga Press Start 2P / JetBrains
Mono / Courier Prime vía `next/font/google`. Falta el resto del CSS y todas las
pantallas.

---

## Alcance

**Dentro:**

- Portar el resto de `references/templates/styles.css` (todo lo que va después de
  los tokens `:root`) a `app/globals.css`, tal cual, como CSS global.
- Portar `references/templates/data.jsx` a `lib/games.ts` con tipos TypeScript:
  exporta `GAMES`, `CATS`, `seededScores` y una interfaz `Game`.
- Crear un `SessionProvider` client (`"use client"`) y un hook `useSession()` que
  expongan `user`, `login(u)` y `signOut()`, hidratando desde `localStorage`
  clave `av_user`.
- Portar la barra de navegación completa (`nav.jsx`) a `components/nav.tsx`,
  incluyendo el panel móvil deslizante, el backdrop y el botón hamburguesa.
- Portar el footer del prototipo (`app.jsx` líneas 43-45) a
  `components/footer.tsx`.
- Pantalla **Biblioteca** (`biblioteca.jsx`) → `app/page.tsx`: hero, buscador,
  chips de categoría, grid de `GameCard` con efecto tilt, estado "sin
  resultados".
- Pantalla **Detalle** (`detalle.jsx`) → `app/juego/[id]/page.tsx`: portada,
  tags, descripción larga, `stat-strip`, acciones, leaderboard lateral con
  `seededScores`.
- Pantalla **Reproductor** (`reproductor.jsx`) → `app/juego/[id]/jugar/page.tsx`:
  HUD con puntuación auto-incremental (`setInterval`), vidas, nivel, pausa, botón
  FIN, marco CRT con arena decorativa, y modal "FIN DEL JUEGO" con input de
  nombre y guardado en `localStorage` clave `av_scores`.
- Pantalla **Acceso** (`auth.jsx`) → `app/acceso/page.tsx`: tarjeta con pestañas
  Iniciar Sesión / Crear Cuenta, campos usuario/correo/contraseña, botón "jugar
  como invitado", botones sociales inertes. El submit hace `login()` falso y
  navega a `/`.
- Pantalla **Salón de la Fama** (`salon.jsx`) → `app/salon/page.tsx`: cabecera,
  chips por juego, podio de 3, tabla completa con `seededScores`, fila "tú"
  simulada cuando hay `user`.
- Navegación entre rutas con `next/link` / `useRouter` en lugar del router por
  hash del prototipo.
- Reemplazar `app/page.tsx` scaffold y eliminar `public/next.svg` y
  `public/vercel.svg`.
- Adaptar `app/layout.tsx` para montar `SessionProvider`, `Nav` y `Footer`
  alrededor de `children`, conservando los `div.av-bg` y `div.av-noise`.

**Fuera de alcance (para specs futuras):**

- Cualquier juego real o lógica de gameplay. El reproductor solo simula.
- Backend, base de datos y API. Todo es mock en cliente.
- Autenticación real, registro, OAuth Google/GitHub. Los botones sociales quedan
  inertes y el login es falso.
- Leaderboard persistente y real. `seededScores` sigue generando datos
  deterministas; `av_scores` se escribe pero **no** se lee en ninguna vista.
- Contador de créditos funcional (queda como texto fijo "CRÉDITOS · 03").
- Tests automatizados (no hay runner configurado).
- Rediseño o mejoras visuales sobre el prototipo: se porta 1:1.
- Modo claro / theming alternativo.

---

## Modelo de datos

Portado de `references/templates/data.jsx`, sin cambios de contenido.

```ts
// lib/games.ts
export interface Game {
  id: string;        // slug, p.ej. "bloque-buster"
  title: string;
  short: string;     // descripción corta (tarjeta)
  long: string;      // descripción larga (detalle)
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;     // clase CSS de portada, p.ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;     // texto ya formateado, p.ej. "12.4K"
}

export const GAMES: Game[];
export const CATS: string[];              // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;      // "DD/MM/2026"
}
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Sesión (en memoria vía Context, hidratada de `localStorage`):

```ts
interface SessionUser { name: string; }   // name en mayúsculas, máx. 10 chars
// useSession(): { user: SessionUser | null; login(u: SessionUser | null): void; signOut(): void }
```

Claves de `localStorage`:

- `av_user` — JSON de `SessionUser` o ausente. La escribe/borra `SessionProvider`.
- `av_scores` — array JSON de `{ game, score, name, at }`. Solo se escribe desde
  el modal del reproductor. Ninguna vista la lee en esta spec.

Mapa de rutas (prototipo → App Router):

| Prototipo (`route.name`) | Ruta Next |
| ------------------------ | --------- |
| `biblioteca`             | `/` |
| `detalle` (`id`)         | `/juego/[id]` |
| `player` (`id`)          | `/juego/[id]/jugar` |
| `auth`                   | `/acceso` |
| `salon`                  | `/salon` |

---

## Plan de implementación

1. **Datos.** Crear `lib/games.ts` portando `GAMES`, `CATS`, `seededScores` y los
   tipos `Game` / `ScoreRow`. Módulo plano, sin `"use client"`. Prueba manual:
   `import`arlo desde una página y hacer `console.log(GAMES.length)` → 8.
2. **CSS.** Anexar a `app/globals.css` todo `references/templates/styles.css`
   desde la línea posterior al bloque `:root` hasta el final. No duplicar los
   tokens ya presentes. Prueba manual: `next dev` arranca sin errores de PostCSS.
3. **Sesión.** Crear `components/session-provider.tsx` (`"use client"`) con el
   Context, la hidratación desde `av_user` y el hook `useSession()`. Montarlo en
   `app/layout.tsx` envolviendo `children`. Prueba manual: la app sigue
   renderizando el scaffold.
4. **Nav + Footer.** Crear `components/nav.tsx` (`"use client"`) portando
   `nav.jsx` — enlaces con `next/link`, activo según `usePathname()`, panel móvil
   con estado `open`, botón de sesión que usa `useSession()`. Crear
   `components/footer.tsx`. Montar ambos en `app/layout.tsx` alrededor de
   `<main className="av-main">{children}</main>`. Prueba manual: el nav aparece
   en todas las rutas y el panel móvil abre/cierra.
5. **Biblioteca.** Reescribir `app/page.tsx` (`"use client"`) portando `Library`
   y `GameCard`. Buscador y chips con `useState`, filtrado con `useMemo`, tilt
   con `ref`. Cada tarjeta enlaza a `/juego/[id]`. Borrar `public/next.svg` y
   `public/vercel.svg`. Prueba manual: `/` muestra el grid de 8 juegos, filtra
   por texto y categoría, y muestra "NO HAY RESULTADOS" cuando procede.
6. **Detalle.** Crear `app/juego/[id]/page.tsx` (`"use client"`) portando
   `GameDetail`. Resolver `id` desde params, buscar en `GAMES`, generar
   leaderboard con `seededScores`. Botón "JUGAR AHORA" navega a
   `/juego/[id]/jugar`; "VOLVER AL VAULT" a `/`. `id` inexistente → `notFound()`.
   Prueba manual: `/juego/caida` muestra la ficha y el leaderboard lateral.
7. **Reproductor.** Crear `app/juego/[id]/jugar/page.tsx` (`"use client"`)
   portando `GamePlayer`. HUD, `setInterval` de puntuación, pausa, nivel por
   umbral, marco CRT, modal de fin con input de nombre y `onSaveScore` que
   escribe en `av_scores`. Nombre inicial = `user?.name ?? "INVITADO"` vía
   `useSession()`. Prueba manual: la puntuación sube, PAUSA la congela, FIN abre
   el modal y GUARDAR muestra el toast.
8. **Acceso.** Crear `app/acceso/page.tsx` (`"use client"`) portando `Auth`.
   Pestañas, campos, submit que llama `login({ name })` y navega a `/`; "jugar
   como invitado" llama `login(null)` y navega a `/`. Prueba manual: enviar el
   formulario deja el nav con la sesión iniciada.
9. **Salón.** Crear `app/salon/page.tsx` (`"use client"`) portando `HallOfFame`.
   Chips por juego, podio, tabla con `seededScores`, fila "tú" simulada cuando
   `useSession().user` no es `null`. Botón "VOLVER A LA BIBLIOTECA" a `/`. Prueba
   manual: `/salon` muestra podio y tabla, y la fila amarilla "tú" aparece solo
   con sesión.
10. **Cierre.** Si `next dev` regeneró el bloque `nextjs-agent-rules` de
    `AGENTS.md`, dejarlo incluido en los cambios. Ejecutar `npx next build` y
    corregir errores de tipos o de framework.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `app/page.tsx` ya no contiene nada del scaffold de `create-next-app`.
- [ ] `public/next.svg` y `public/vercel.svg` no existen.
- [ ] Las rutas `/`, `/juego/caida`, `/juego/caida/jugar`, `/acceso` y `/salon`
      renderizan sin errores en consola.
- [ ] `lib/games.ts` exporta 8 juegos y `CATS` con 5 entradas.
- [ ] En `/`, escribir "serp" en el buscador deja solo la tarjeta SERPENTINA.
- [ ] En `/`, el chip "PUZZLE" deja solo la tarjeta CAÍDA.
- [ ] En `/`, una búsqueda sin coincidencias muestra el bloque "NO HAY
      RESULTADOS".
- [ ] Pulsar una tarjeta navega a `/juego/<id>` con la URL correspondiente.
- [ ] `/juego/<id-inexistente>` responde con la página 404 de Next.
- [ ] En `/juego/caida`, "JUGAR AHORA" navega a `/juego/caida/jugar`.
- [ ] En el reproductor, la puntuación del HUD aumenta sola mientras no está en
      pausa.
- [ ] Pulsar "PAUSA" detiene el incremento y muestra el overlay "EN PAUSA".
- [ ] Pulsar "FIN" abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] En el modal, "GUARDAR PUNTUACIÓN" añade una entrada a `av_scores` en
      `localStorage` y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] En `/acceso`, enviar el formulario con usuario "px_kai" deja el nav
      mostrando "PX_KAI ▾" y redirige a `/`.
- [ ] Tras iniciar sesión, recargar cualquier ruta mantiene la sesión (leída de
      `av_user`).
- [ ] Pulsar el botón de sesión en el nav cierra la sesión y borra `av_user`.
- [ ] En `/salon`, sin sesión no aparece la fila "tú"; con sesión aparece la fila
      amarilla con el nombre del usuario.
- [ ] El botón hamburguesa abre el panel móvil y el backdrop lo cierra.
- [ ] El aspecto de cada pantalla coincide con el prototipo abierto desde
      `references/templates/Arcade Vault.html`.

---

## Decisiones

- **Sí:** rutas en castellano (`/juego/[id]`, `/acceso`, `/salon`). Coherente con
  la UI y los nombres del prototipo.
- **No:** replicar el router por hash del prototipo en una única página client.
  No es idiomático en App Router y complica el enlazado.
- **Sí:** portar `styles.css` entero a `app/globals.css` tal cual. Es la fuente
  de verdad visual y los tokens ya están ahí; es lo más rápido y fiel.
- **No:** CSS Modules por pantalla ni reconstrucción con utilidades Tailwind.
  Mucho trabajo de reorganización y riesgo alto de desviación visual.
- **Sí:** `SessionProvider` client con Context + `useSession()`. Mantiene nav y
  pantallas sincronizadas sin recargar.
- **No:** que cada componente lea `localStorage` por su cuenta. Estado
  desincronizado.
- **Sí:** persistir `av_user` en `localStorage`. Da la sensación de sesión al
  navegar entre rutas.
- **Sí:** escribir `av_scores` desde el modal pero **no** leerlo en ninguna
  vista. Deja el gancho listo para la spec del leaderboard real.
- **No:** leer `av_scores` en Salón/Detalle. El leaderboard real va en otra spec.
- **Sí:** mantener la simulación completa del reproductor (`setInterval`, modal
  de fin). Es parte de la experiencia visual y no necesita juego real.
- **Sí:** `lib/games.ts` con interfaz `Game` tipada. Da tipado a las pantallas.
- **Sí:** portar el nav completo, incluido el panel móvil. Está en el prototipo y
  en el CSS que se porta.
- **Sí:** eliminar los SVG del scaffold. No se usan y ensucian `public/`.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `localStorage` no disponible (modo privado / SSR) | El `SessionProvider` envuelve accesos en `try/catch` e hidrata en `useEffect`; sin `localStorage` la sesión vive solo en memoria. |
| Selectores globales de `styles.css` chocan con utilidades de Tailwind | Se porta el CSS tal cual y se revisa visualmente cada pantalla contra el prototipo en el paso de cierre. |
| Componentes client que usan `useSearchParams`/`useRouter` sin `Suspense` | Envolver donde Next 16 lo exija; consultar `node_modules/next/dist/docs/` antes de escribir código de framework (según `AGENTS.md`). |
| `next dev` reescribe el bloque `nextjs-agent-rules` de `AGENTS.md` | Incluir ese cambio en el commit en lugar de revertirlo (indicado en `CLAUDE.md`). |
| Hidratación: HTML del servidor difiere del cliente por leer `localStorage` en el primer render | Render inicial siempre con `user = null`; aplicar el valor de `av_user` en `useEffect` tras el montaje. |

---

## Lo que **no** entra en esta spec

- Ningún juego real ni lógica de gameplay.
- Backend, base de datos, API.
- Autenticación real, registro, OAuth.
- Leaderboard persistente y real (lectura de `av_scores`).
- Contador de créditos funcional.
- Tests automatizados.
- Cambios visuales sobre el prototipo.

Cada uno de esos, si llega, va en su propia spec.
