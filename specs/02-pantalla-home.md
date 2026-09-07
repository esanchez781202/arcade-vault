# SPEC 02 — Pantalla Home (landing) y reubicación de Biblioteca

> **Estado:** Implementada
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-07
> **Objetivo:** Portar la landing `references/templates/home-about/home.jsx` al App Router como nueva raíz `/`, mover Biblioteca a `/biblioteca` y actualizar el nav con los enlaces "Inicio" y "Acerca de".

---

## Por qué existe esta spec

SPEC 01 portó cinco pantallas del prototipo antiguo (`references/templates/`) y dejó
Biblioteca en `/`. El prototipo nuevo (`references/templates/home-about/`) añade una
**landing page** completa (`home.jsx`) y un nav revisado que separa "Inicio" de
"Biblioteca" y añade "Acerca de". Esta spec traslada esa landing 1:1 a Next.js.

Consecuencia estructural: la raíz `/` pasa a ser Home y Biblioteca se reubica en
`/biblioteca`. El logo del nav ya apuntaba a `/` en el código actual; en el prototipo
nuevo el logo lleva a Home, así que el cambio deja `/` coherente con esa intención.

`references/templates/home-about/about.jsx` (pantalla About + Contacto) **queda fuera
de esta spec**; se implementará en una spec posterior. El enlace "Acerca de" del nav
se incluye ya, apuntando a una ruta stub `/acerca-de` con contenido "PRÓXIMAMENTE".

---

## Alcance

**Dentro:**

- **Reubicar Biblioteca.** Mover la pantalla actual de `app/page.tsx` (Biblioteca:
  `Library` + `GameCard`) a `app/biblioteca/page.tsx` sin cambios de contenido, solo
  el traslado de archivo y el ajuste de comentario de cabecera.
- **Home en `/`.** Reescribir `app/page.tsx` (`"use client"`) portando `Home`,
  `FloatingSilhouettes`, `MiniCard` y `FeatureIcon` de
  `references/templates/home-about/home.jsx`. Secciones, en orden:
  1. **HERO** — `FloatingSilhouettes` (8 SVG pixel `s1`–`s8`), eyebrow con `.blink`,
     título en tres `span` (`line-1/2/3`), subtítulo, dos CTAs
     (`▶ EXPLORAR JUEGOS` → `/biblioteca`, `✦ CREAR CUENTA` → `/acceso`), indicador
     `hero-scroll`.
  2. **¿POR QUÉ ARCADE VAULT?** (`// 01`) — `feature-grid` con 4 `feature-card`
     (GAMEPAD/FREE/TROPHY/ROCKET), `transitionDelay` escalonado `i * 80ms`.
  3. **JUEGOS DISPONIBLES AHORA** (`// 02`) — `mini-rail` con `GAMES.slice(0, 6)`
     como `MiniCard`, cada una enlaza a `/juego/[id]`; botón
     `VER TODOS LOS JUEGOS →` → `/biblioteca`.
  4. **STATS** — `home-stats` con 3 `stat-block` (literales inline `12+` / `MILES` /
     `GLOBAL`).
  5. **ACTIVIDAD EN VIVO** (`// 03`) — `activity-grid` de 2 `activity-card`:
     ticker "ÚLTIMAS PUNTUACIONES" (7 filas literales inline) y "TOP JUGADORES · HOY"
     (5 filas literales inline) con botón `VER SALÓN →` → `/salon`.
  6. **PRECIOS** (`// 04`) — `pricing-grid`: `price-card` "JUGADOR VAULT" ($0) con
     `pc-list` de 6 ítems y CTA `EMPEZAR GRATIS →` → `/acceso`; `pricing-faq` con 3
     `faq-item` literales inline.
  7. **CTA FINAL** — `home-final`: `¿LISTO PARA JUGAR?` + `INSERTAR MONEDA →` →
     `/biblioteca`.
- **Hook `useReveal()`.** Reimplementar el `IntersectionObserver` del prototipo
  (`.reveal` → añade clase `.in` al entrar en viewport, `threshold: 0.12`,
  `unobserve` tras revelar, `disconnect` en cleanup). Vive en la propia
  `app/page.tsx` como hook local (`"use client"`).
- **CSS de Home.** Cherry-pick a `app/globals.css` **solo** los selectores de Home
  de `references/templates/home-about/styles.css` (ver "Modelo de datos" para la
  lista de bloques). No portar los selectores exclusivos de About. No duplicar
  reglas ya presentes (`.fade-in`, `@keyframes fadeIn`, `--gold`, `.blink`,
  `.neon-*`, `.kicker` si ya existe).
- **Nav revisado.** Actualizar `components/nav.tsx` (barra y panel móvil) según
  `references/templates/home-about/nav.jsx`:
  - Añadir enlace **"Inicio"** → `/`, activo cuando `pathname === "/"`.
  - Renombrar el destino activo de "Biblioteca": activo cuando
    `pathname === "/biblioteca"` o `pathname.startsWith("/juego")`.
  - Añadir enlace **"Acerca de"** → `/acerca-de`, activo cuando
    `pathname === "/acerca-de"`.
  - El logo sigue apuntando a `/` (ahora Home).
  - Orden de enlaces: Inicio · Biblioteca · Salón de la Fama · Acerca de (barra y
    panel móvil, igual que el prototipo).
- **Stub `/acerca-de`.** Crear `app/acerca-de/page.tsx`: pantalla mínima con la
  estética del sitio (kicker + título + "PRÓXIMAMENTE") para que el enlace del nav
  no dé 404. Sin lógica.
- **Redirigir enlaces "volver" a `/biblioteca`.** Cambiar `router.push("/")` por
  `router.push("/biblioteca")` en: `app/acceso/page.tsx` (x2, tras login y tras
  "jugar como invitado"), `app/juego/[id]/page.tsx` ("VOLVER AL VAULT"),
  `app/juego/[id]/jugar/page.tsx` ("VOLVER A LA BIBLIOTECA" del modal FIN),
  `app/salon/page.tsx` ("VOLVER A LA BIBLIOTECA").
- Navegación con `next/link` / `useRouter`; nada de router por hash.

**Fuera de alcance (para specs futuras):**

- **La pantalla About + Contacto** (`about.jsx`): formulario, terminal de éxito,
  `HighlightIcon`, `about-divider`. Solo se deja el stub `/acerca-de`.
- Portar los selectores CSS exclusivos de About (`about-hero`, `about-title`,
  `about-mission`, `highlight-row`, `contact-grid`, `contact-form`,
  `terminal-success`, `about-divider`, etc.).
- Hacer reales los datos inline de Home (ticker de puntuaciones, top jugadores,
  stats, FAQ): siguen siendo literales escritos a mano en el JSX.
- Leer `av_scores` para poblar "ÚLTIMAS PUNTUACIONES" o "TOP JUGADORES". Los datos
  reales del leaderboard van en su propia spec.
- Contador de créditos funcional (sigue como texto fijo "CRÉDITOS · 03").
- Reescribir SPEC 01. Queda como registro histórico; esta spec anota en
  "Decisiones" que supera su mapa de rutas.
- Redirección automática de `/` antiguo → `/biblioteca` (no hay tráfico ni enlaces
  externos; los enlaces internos se actualizan a mano).
- Tests automatizados (no hay runner).
- Cambios visuales sobre el prototipo: se porta 1:1.

---

## Modelo de datos

**No introduce estructuras nuevas.** Home consume `GAMES` de `lib/games.ts`
(`GAMES.slice(0, 6)` para el `mini-rail`) tal cual lo dejó SPEC 01. Todo lo demás
(ticker, top jugadores, stats, FAQ, precios) son literales inline en el JSX de
`app/page.tsx`, sin pasar por `lib/`.

No se añaden claves de `localStorage` ni se leen las existentes (`av_user`,
`av_scores`).

**Mapa de rutas tras esta spec:**

| Pantalla                 | Antes (SPEC 01) | Después (SPEC 02) |
| ------------------------ | --------------- | ----------------- |
| Home (landing)           | —               | `/`               |
| Biblioteca               | `/`             | `/biblioteca`     |
| Detalle de juego         | `/juego/[id]`   | `/juego/[id]` (sin cambio) |
| Reproductor              | `/juego/[id]/jugar` | `/juego/[id]/jugar` (sin cambio) |
| Acceso                   | `/acceso`       | `/acceso` (sin cambio) |
| Salón de la Fama         | `/salon`        | `/salon` (sin cambio) |
| Acerca de (stub)         | —               | `/acerca-de`      |

**Bloques CSS a portar** desde `references/templates/home-about/styles.css`
(rangos aproximados, verificar por selector al portar):

- Home hero y silhouettes: `.home`, `.home-hero`, `.home-hero-inner`,
  `.hero-eyebrow`, `.home-title` + `.line-1/2/3`, `.home-sub`, `.home-ctas`,
  `.hero-scroll`, `.home-silos` + `.silo` + `.s1`–`.s8`, `@keyframes float`
  (~líneas 930–986).
- Secciones y features: `.home-section`, `.section-head`, `.section-title`,
  `.section-rule`, `.feature-grid`, `.feature-card` (+ variantes de color),
  `.ft-icon`, `.ft-title`, `.ft-desc` (~988–1019).
- Mini rail: `.mini-rail`, `.mini-card`, `.mini-cover`, `.mini-meta`,
  `.mini-title`, `.mini-cat` y sus media queries (~1020–1029).
- Stats: `.home-stats`, `.stats-inner`, `.stat-block`, `.stat-n`, `.stat-u`,
  `.stat-s` (~1030–1048).
- CTA final: `.home-final` (+ `::before`/`::after`), `.final-title`, `.final-cta`,
  `.final-tag` (~1049–1067).
- Reveal: `.reveal`, `.reveal.in` (~1068–1069).
- Actividad: `.activity-grid`, `.activity-card`, `.ac-head`, `.ac-title`,
  `.lb-link`, `.ticker`, `.tick-row`, `.tk-p`, `.tk-mid`, `.tk-s`, `.tk-t`,
  `.top-list`, `.top-row` (+ `top1/2/3`), `.tp-rk`, `.tp-bar`, `.tp-fill`,
  `.tp-p`, `.tp-s` (~1622–1672).
- Precios: `.pricing-grid`, `.price-card`, `.pc-label`, `.pc-name`, `.pc-amount`
  (+ `-n`/`-u`), `.pc-tag`, `.pc-list`, `.pc-foot`, `.pc-stamp`, `.pricing-faq`,
  `.faq-item`, `.faq-q`, `.faq-a` (~1673–1725).

Antes de anexar cada regla, comprobar con `grep` que el selector no está ya en
`app/globals.css` (SPEC 01 portó el CSS antiguo, que comparte `.blink`, `.neon-*`,
`.btn`, `.pixel`, `.cover-*`, `--gold`, `.fade-in`, `@keyframes fadeIn`).

---

## Plan de implementación

Cada paso deja la app arrancando (`next dev`) sin errores.

1. **Mover Biblioteca a `/biblioteca`.** Crear `app/biblioteca/page.tsx` con el
   contenido actual de `app/page.tsx` (ajustar solo el comentario de cabecera).
   Dejar `app/page.tsx` temporalmente como un placeholder mínimo (`export default
   function Home() { return null; }`) para que compile. Prueba manual: `/biblioteca`
   muestra el grid de 8 juegos, filtro por texto y chips como antes.
2. **Actualizar enlaces "volver".** En `app/acceso/page.tsx` (x2),
   `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx` y
   `app/salon/page.tsx`, cambiar `router.push("/")` → `router.push("/biblioteca")`.
   Prueba manual: desde `/acceso`, enviar el formulario redirige a `/biblioteca`;
   "VOLVER A LA BIBLIOTECA" en `/salon` va a `/biblioteca`.
3. **Stub `/acerca-de`.** Crear `app/acerca-de/page.tsx` con kicker + título +
   "PRÓXIMAMENTE" usando clases existentes (`.kicker`, `.pixel`, `.neon-*`).
   Prueba manual: `/acerca-de` renderiza sin 404 ni errores de consola.
4. **CSS de Home.** Anexar a `app/globals.css` los bloques de Home listados en
   "Modelo de datos", verificando selector por selector que no estén ya presentes.
   Prueba manual: `next dev` arranca sin errores de PostCSS.
5. **Hook `useReveal()` + Home.** Reescribir `app/page.tsx` (`"use client"`)
   portando `Home`, `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` y el hook
   `useReveal()`. Sustituir `navigate({name, id})` por `next/link` / `useRouter`
   según el mapa de rutas. `MiniCard` enlaza a `/juego/${game.id}`. Prueba manual:
   `/` muestra las 7 secciones en orden y las tarjetas del `mini-rail` navegan a
   `/juego/<id>`.
6. **Nav revisado.** Actualizar `components/nav.tsx` (barra y panel móvil): añadir
   "Inicio" (→ `/`) y "Acerca de" (→ `/acerca-de`), recalcular `isLibrary` con
   `pathname === "/biblioteca" || pathname.startsWith("/juego")`, añadir flags
   `isHome` e `isAbout`. Orden: Inicio · Biblioteca · Salón de la Fama · Acerca de.
   Prueba manual: en `/` el enlace "Inicio" está activo; en `/biblioteca` y
   `/juego/caida` lo está "Biblioteca"; el panel móvil abre/cierra y refleja los
   mismos activos.
7. **Animación reveal.** Comprobar en el navegador que al hacer scroll por `/` las
   secciones con `.reveal` pasan de opacidad 0 a visible (clase `.in` añadida).
8. **Cierre.** Si `next dev` regeneró el bloque `nextjs-agent-rules` de
   `AGENTS.md`, dejarlo incluido. Ejecutar `npx next build` y corregir errores de
   tipos o de framework (p. ej. `Suspense` si algún client usa `useSearchParams`).
   Revisar `/` contra el prototipo abierto desde
   `references/templates/home-about/arcade-vault-standalone.html`.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `/` renderiza la landing Home con las 7 secciones en orden: HERO, ¿POR QUÉ
      ARCADE VAULT?, JUEGOS DISPONIBLES AHORA, STATS, ACTIVIDAD EN VIVO, PRECIOS,
      CTA FINAL.
- [ ] `app/page.tsx` ya no contiene el componente `Library`/`GameCard`.
- [ ] `/biblioteca` muestra el grid de 8 juegos, filtra por texto y por chip de
      categoría, y muestra "NO HAY RESULTADOS" igual que antes.
- [ ] En Home, el `mini-rail` muestra exactamente 6 tarjetas (`GAMES.slice(0, 6)`)
      y pulsar una navega a `/juego/<id>`.
- [ ] En Home, "▶ EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →"
      navegan a `/biblioteca`.
- [ ] En Home, "✦ CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/acceso`.
- [ ] En Home, "VER SALÓN →" navega a `/salon`.
- [ ] Al hacer scroll por `/`, las secciones marcadas `.reveal` reciben la clase
      `.in` y pasan de invisibles a visibles.
- [ ] El nav muestra los cuatro enlaces en orden Inicio · Biblioteca · Salón de la
      Fama · Acerca de, en la barra y en el panel móvil.
- [ ] En `/` el enlace "Inicio" tiene la clase `active`; en `/biblioteca` y en
      `/juego/caida` la tiene "Biblioteca"; en `/acerca-de` la tiene "Acerca de".
- [ ] El logo del nav navega a `/` (Home).
- [ ] `/acerca-de` renderiza el stub "PRÓXIMAMENTE" sin 404 ni errores de consola.
- [ ] En `/acceso`, enviar el formulario o pulsar "jugar como invitado" redirige a
      `/biblioteca`.
- [ ] En `/juego/caida`, "VOLVER AL VAULT" navega a `/biblioteca`.
- [ ] En el modal FIN del reproductor, "VOLVER A LA BIBLIOTECA" navega a
      `/biblioteca`.
- [ ] En `/salon`, "VOLVER A LA BIBLIOTECA" navega a `/biblioteca`.
- [ ] No hay ningún `router.push("/")` ni `href="/"` residual apuntando a la
      antigua Biblioteca (salvo el logo del nav, que ahora es Home).
- [ ] El aspecto de `/` coincide con `home.jsx` del prototipo abierto desde
      `references/templates/home-about/arcade-vault-standalone.html`.
- [ ] No se ha portado CSS exclusivo de About (`about-hero`, `contact-grid`,
      `terminal-success`, etc.) a `app/globals.css`.

---

## Decisiones

- **Sí:** Home en `/`, Biblioteca en `/biblioteca`. Es lo más fiel al prototipo
  nuevo (el logo lleva a Home y "Inicio"/"Biblioteca" son enlaces distintos).
  Supera el mapa de rutas de SPEC 01 en ese punto.
- **No:** reescribir SPEC 01. Queda como registro histórico; el cambio de rutas se
  documenta aquí.
- **No:** redirección `/` → `/biblioteca` para tráfico antiguo. No hay enlaces
  externos; los internos se actualizan a mano en esta spec.
- **Sí:** dejar `/juego/[id]` y `/juego/[id]/jugar` donde están. Moverlas a
  `/biblioteca/juego/...` sería churn sin beneficio; solo cambian los enlaces
  "volver".
- **Sí:** incluir ya el enlace "Acerca de" con un stub `/acerca-de` "PRÓXIMAMENTE".
  Mantiene el nav completo como el prototipo sin dejar un enlace muerto a 404.
- **No:** implementar `about.jsx` (formulario de contacto, terminal de éxito). Es
  una pantalla con lógica propia; va en su spec.
- **Sí:** cherry-pick solo el CSS de Home. El archivo nuevo mezcla Home y About;
  portar About entero dejaría ~550 líneas de CSS muerto.
- **Sí:** `useReveal()` como hook client reimplementando el `IntersectionObserver`.
  Es fiel al prototipo y el efecto de aparición al hacer scroll es parte de la UX.
- **No:** dejar `.reveal` siempre visible. Perdería la animación intencionada.
- **Sí:** mantener ticker, top jugadores, stats y FAQ como literales inline en el
  JSX. Están así en el prototipo y su realismo (datos reales) es otra spec.
- **Sí:** enlaces post-login y "volver" a `/biblioteca` (no a Home). Coincide con
  el prototipo, donde `auth` navega a `biblioteca`.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Portar CSS de Home arrastra o pisa reglas de About / SPEC 01 con selectores compartidos (`.kicker`, `.section-head`, `.reveal`) | Portar selector por selector comprobando con `grep` en `app/globals.css` antes de anexar; revisión visual de `/` y de las pantallas de SPEC 01 en el paso de cierre. |
| Enlaces a la antigua Biblioteca (`/`) olvidados en alguna pantalla | El criterio de aceptación exige un `grep` sin resultados de `router.push("/")` / `href="/"` fuera del logo del nav. |
| `IntersectionObserver` corre en SSR o antes del montaje | El hook `useReveal()` solo toca el DOM dentro de `useEffect`; en navegadores sin soporte, degradar dejando las secciones visibles (fallback: si no hay `IntersectionObserver`, añadir `.in` a todas). |
| Hidratación: el hook añade `.in` en cliente y el HTML del servidor no lo tiene | `.reveal` parte de `opacity: 0` en ambos; la clase `.in` se añade siempre tras el montaje, sin divergencia de markup en el primer render. |
| `next dev` reescribe el bloque `nextjs-agent-rules` de `AGENTS.md` | Incluir ese cambio en el commit en lugar de revertirlo (indicado en `CLAUDE.md`). |
| Mover `app/page.tsx` deja imports colgando (`lib/games`, componentes) | Paso 1 traslada el archivo íntegro a `app/biblioteca/page.tsx`; el alias `@/*` mantiene los imports válidos sin tocarlos. |

---

## Lo que **no** entra en esta spec

- La pantalla About + Contacto (`about.jsx`) y su CSS.
- Datos reales para el ticker, top jugadores, stats y FAQ de Home.
- Lectura de `av_scores` para poblar la sección "ACTIVIDAD EN VIVO".
- Contador de créditos funcional.
- Redirección automática de rutas antiguas.
- Reescritura de SPEC 01.
- Tests automatizados.
- Cambios visuales sobre el prototipo.

Cada uno de esos, si llega, va en su propia spec.
