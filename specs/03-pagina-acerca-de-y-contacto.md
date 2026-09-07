# SPEC 03 — Página Acerca de y formulario de contacto con Resend

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-09-07
> **Objetivo:** Portar `references/templates/home-about/about.jsx` 1:1 a la ruta `/acerca-de` (reemplazando el stub de SPEC 02) y hacer que su formulario de contacto envíe un correo real vía Resend con una Server Action.

---

## Por qué existe esta spec

SPEC 02 dejó `/acerca-de` como un stub "PRÓXIMAMENTE" y anotó explícitamente que la
pantalla About + Contacto (`about.jsx`) y su CSS iban en una spec posterior. Esta es
esa spec.

Diferencia con las anteriores: `about.jsx` no es sólo visual. El formulario del
prototipo es un simulacro (`setSent(form.name)` sin red). Aquí el envío es real:
una Server Action llama a la API de Resend con la clave en el servidor. Eso añade
una dependencia nueva (`resend`), variables de entorno y estados de UX (cargando /
error) que el prototipo no tiene.

---

## Alcance

**Dentro:**

- **Portar About + Contacto a `/acerca-de`.** Reescribir `app/acerca-de/page.tsx`
  (`"use client"`) portando `About` y `HighlightIcon` de
  `references/templates/home-about/about.jsx`. Se elimina por completo el stub
  "PRÓXIMAMENTE" de SPEC 02. Estructura, en orden:
  1. **Sección ABOUT** (`.about-hero`) — kicker `▸ ACERCA DE`, `.about-title`,
     `.about-mission` (texto literal inline del prototipo), `.highlight-row` con 3
     `.highlight` (HEART/BROWSER/PLANT, colores magenta/cyan/green,
     `transitionDelay` escalonado `i * 80ms`), cada uno con su `HighlightIcon`
     SVG pixel.
  2. **Divider** (`.about-divider.reveal`) — `.div-bar` + `.div-pixels` con 24
     `<span>` de `animationDelay` escalonado + `.div-bar`.
  3. **Sección CONTACTO** (`.about-contact.reveal`) — `.contact-grid` con
     `.contact-intro` (kicker `▸ CONTACTO`, `.contact-title`, `.contact-sub`,
     `.contact-tips` con 3 `.tip`) y el formulario `.contact-form`.
- **`HighlightIcon`.** Portar el componente con los tres SVG pixel (`HEART`,
  `BROWSER`, `PLANT`) tal cual, como componente local en `app/acerca-de/page.tsx`.
- **Hook `useReveal` compartido.** Extraer el `IntersectionObserver` que hoy vive
  como función local en `app/page.tsx` (`useReveal`, líneas ~13-...) a
  `components/use-reveal.ts` (`"use client"`). Comportamiento idéntico:
  `.reveal` → añade `.in` al entrar en viewport, `threshold: 0.12`, `unobserve`
  tras revelar, `disconnect` en cleanup. `app/page.tsx` pasa a importarlo;
  `app/acerca-de/page.tsx` lo usa igual.
- **Formulario de contacto con estados reales.** El `<form>` client mantiene el
  markup y las clases del prototipo (`.contact-form`, `.field`, `label`,
  `input`, `textarea`, botón `.btn.xl.press`). Cambios sobre el prototipo:
  - Estado `status`: `"idle" | "sending" | "error" | "sent"`.
  - Validación de cliente igual que el prototipo: si `nombre`, `email` o
    `mensaje` están vacíos (tras `trim`), aplicar `.shake` 400ms y no enviar.
  - En submit válido: `status = "sending"`, el botón muestra `▶  ENVIANDO…` y
    queda deshabilitado.
  - Llamada a la Server Action `enviarMensaje(datos)` (ver más abajo).
  - Respuesta `{ ok: true }` → `status = "sent"`, se muestra `.terminal-success`
    del prototipo (mismo markup: `.term-bar` con 3 `.dot`, `.term-body` con las
    líneas `[OK] …` y `> MENSAJE RECIBIDO … GRACIAS, {NOMBRE}.` + `.caret`).
    Botón `ENVIAR OTRO MENSAJE` resetea `form` y `status = "idle"`.
  - Respuesta `{ ok: false, error }` → `status = "error"`, se conserva lo escrito
    y se muestra un aviso retro (clase existente `.pixel.neon-magenta`) con el
    texto `> ERROR AL ENVIAR. INTÉNTALO DE NUEVO.`; el botón vuelve a estar
    activo.
  - **Honeypot.** Campo `<input>` oculto (`name="empresa"`, `tabIndex={-1}`,
    `autoComplete="off"`, envuelto en un `div` con `style={{position:"absolute",
    left:"-9999px"}}` o clase util equivalente). Se envía a la Server Action.
- **Server Action `enviarMensaje`.** Nuevo archivo `app/acerca-de/actions.ts`
  (`"use server"`). Firma: `enviarMensaje(input: ContactoInput):
  Promise<ContactoResult>` (tipos en "Modelo de datos"). Lógica:
  1. Si `input.empresa` (honeypot) tiene contenido → devolver `{ ok: true }` sin
     enviar nada (bot silenciado).
  2. Revalidar en servidor: `nombre`, `email`, `mensaje` no vacíos tras `trim`;
     `email` con formato válido (regex simple). Si falla → `{ ok: false,
     error: "validacion" }`.
  3. Si `process.env.RESEND_API_KEY` no está definida → `{ ok: false,
     error: "config" }` (error controlado, sin lanzar).
  4. Enviar con Resend (ver `lib/email.ts`). Si la llamada lanza o Resend
     devuelve error → `catch` → `{ ok: false, error: "envio" }`.
  5. Éxito → `{ ok: true }`.
- **Wrapper `lib/email.ts`.** Módulo servidor (sin `"use client"`) que exporta
  `enviarCorreoContacto({ nombre, email, mensaje })`. Instancia
  `new Resend(process.env.RESEND_API_KEY)` y llama a `resend.emails.send` con:
  - `from`: `process.env.CONTACT_FROM_EMAIL`
  - `to`: `process.env.CONTACT_TO_EMAIL`
  - `replyTo`: `email` (el del visitante)
  - `subject`: `` `[Arcade Vault] Mensaje de ${nombre}` ``
  - `text`: versión en texto plano con nombre, email y mensaje.
  - `html`: versión HTML mínima (sin plantilla elaborada) con los mismos datos.
- **Dependencia `resend`.** Añadir `resend` a `dependencies` en `package.json`
  fijado a una versión exacta (sin `^`), coherente con `next`/`react` que ya
  están clavados. Ejecutar `npm install` para actualizar `package-lock.json`.
- **Variables de entorno.** Crear `.env.example` con las tres claves y valores
  placeholder:
  ```
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
  CONTACT_FROM_EMAIL=Arcade Vault <contacto@tu-dominio-verificado.com>
  CONTACT_TO_EMAIL=equipo@tu-dominio.com
  ```
  Añadir a `.gitignore` la excepción `!.env.example` (hoy `.env*` lo ignora
  todo). El `.env.local` real lo crea el humano y **no** se commitea.
- **CSS de About.** Anexar a `app/globals.css` **sólo** los selectores de About
  de `references/templates/home-about/styles.css` (líneas ~1073-1146; lista
  exacta en "Modelo de datos"), incluido `@keyframes shake`. No portar nada más.
- **Nav.** Sin cambios de código. `components/nav.tsx` ya enlaza `/acerca-de` y
  marca `isAbout` con `pathname === "/acerca-de"` desde SPEC 02.

**Fuera de alcance (para specs futuras):**

- Plantilla HTML de correo elaborada (branding, logos, componentes React Email).
  El `html` es un bloque mínimo inline.
- Rate-limiting / captcha / servicio anti-abuso. Sólo honeypot + revalidación.
- Guardar los mensajes de contacto en algún almacén (DB, `localStorage`, fichero).
  Sólo se envía el correo; no se persiste nada.
- Correo de auto-respuesta al visitante ("hemos recibido tu mensaje").
- Internacionalización de los textos del correo (van en castellano, fijos).
- Página de éxito/error en ruta propia. Todo ocurre in-place en `/acerca-de`.
- Tests automatizados (no hay runner).
- Cambios visuales sobre el prototipo (se porta 1:1, salvo los estados
  cargando/error que el prototipo no contempla).
- Reescribir SPEC 02: el stub se sustituye y se anota aquí.

---

## Modelo de datos

**No hay estructuras persistentes nuevas.** No se añaden claves de `localStorage`
ni se leen las existentes (`av_user`, `av_scores`). El único "dato" son los tipos
que cruzan la frontera cliente → Server Action:

```ts
// app/acerca-de/actions.ts
interface ContactoInput {
  nombre: string;
  email: string;
  mensaje: string;
  empresa: string; // honeypot: siempre "" en envíos legítimos
}

type ContactoResult =
  | { ok: true }
  | { ok: false; error: "validacion" | "config" | "envio" };
```

Estado del formulario en `app/acerca-de/page.tsx` (en memoria, `useState`):

```ts
const [form, setForm] = useState({ nombre: "", email: "", mensaje: "", empresa: "" });
const [status, setStatus] = useState<"idle" | "sending" | "error" | "sent">("idle");
const [shake, setShake] = useState(false);
const [sentName, setSentName] = useState(""); // nombre mostrado en la terminal
```

**Variables de entorno** (todas de servidor, nunca expuestas al cliente):

| Clave | Uso |
| ----- | --- |
| `RESEND_API_KEY` | Autenticación con Resend. Si falta → `error: "config"`. |
| `CONTACT_FROM_EMAIL` | Remitente. Debe ser de un dominio verificado en Resend. |
| `CONTACT_TO_EMAIL` | Destinatario (buzón del equipo). |

**Bloques CSS a portar** desde `references/templates/home-about/styles.css`
(verificar selector por selector con `grep` en `app/globals.css` antes de anexar):

- `.about-hero`, `.about-hero .kicker`, `.about-title`, `.about-mission`
  (~1073-1081).
- `.highlight-row` (+ media query 820px), `.highlight`, `.highlight.cyan/.magenta/.green`,
  `.highlight:hover`, `.highlight .hl-icon`, `.highlight .hl-text` (~1082-1094).
- `.about-divider`, `.div-bar`, `.div-pixels`, `.div-pixels span` (+ `:nth-child`)
  (~1096-1101).
- `.about-contact`, `.contact-grid` (+ media query 900px), `.contact-intro .kicker`,
  `.contact-title`, `.contact-sub`, `.contact-tips`, `.contact-tips .tip`,
  `.contact-tips .tip-led` (+ `.y` / `.m`) (~1104-1114).
- `.contact-form`, `.contact-form::before`, `.contact-form.shake`,
  `@keyframes shake`, `.contact-form textarea` (+ `:focus` + `::placeholder`)
  (~1116-1130).
- `.terminal-success`, `.term-bar` (+ `.dot` + `.dot.r/.y/.g` + `.term-title`),
  `.term-body` (+ `.line` + `.prompt` + `.dim` + `.success` + `.caret`)
  (~1134-1146).

Ya presentes en `app/globals.css` desde SPEC 01 — **no** duplicar: `.field`,
`.field label`, `.field input` (+ `:focus`) (líneas 846-857), `@keyframes blink`
(línea 311, lo reusa `.term-body .caret`), `.btn`, `.pixel`, `.neon-*`, `.kicker`,
`.fade-in`, `@keyframes fadeIn`.

---

## Plan de implementación

Cada paso deja la app arrancando (`next dev`) sin errores.

1. **Dependencia + entorno.** Añadir `resend` (versión exacta) a `package.json`,
   `npm install`. Crear `.env.example` con las 3 claves placeholder. Añadir
   `!.env.example` a `.gitignore`. Prueba manual: `npm ls resend` lo resuelve;
   `git status` muestra `.env.example` como archivo nuevo rastreable.
2. **Hook `useReveal` compartido.** Crear `components/use-reveal.ts` (`"use client"`)
   con el cuerpo de la función `useReveal` actual de `app/page.tsx`. En
   `app/page.tsx` borrar la función local y añadir el `import`. Prueba manual: `/`
   sigue revelando secciones al hacer scroll igual que antes.
3. **CSS de About.** Anexar a `app/globals.css` los bloques listados en "Modelo
   de datos", comprobando selector por selector que no estén ya. Prueba manual:
   `next dev` arranca sin errores de PostCSS.
4. **Wrapper `lib/email.ts`.** Crear el módulo con `enviarCorreoContacto`.
   Instancia `Resend` y `emails.send` con `from`/`to`/`replyTo`/`subject`/`text`/`html`.
   Prueba manual: `npx tsc --noEmit` compila.
5. **Server Action `app/acerca-de/actions.ts`.** Crear con `"use server"`,
   `enviarMensaje(input)`: honeypot → `{ ok: true }`; revalidación →
   `error: "validacion"`; sin `RESEND_API_KEY` → `error: "config"`;
   `try/catch` sobre `enviarCorreoContacto` → `error: "envio"`; éxito →
   `{ ok: true }`. Prueba manual: `npx tsc --noEmit` compila.
6. **Portar About a `/acerca-de`.** Reescribir `app/acerca-de/page.tsx`
   (`"use client"`) con `About` + `HighlightIcon`, usando `useReveal()`. Portar
   secciones ABOUT y divider 1:1. El formulario, de momento, sólo con la
   validación de cliente y la `.terminal-success` local (sin llamar aún a la
   acción). Prueba manual: `/acerca-de` muestra ABOUT, highlights, divider y el
   formulario; ya no aparece "PRÓXIMAMENTE"; el nav marca "Acerca de" activo.
7. **Conectar el formulario a la Server Action.** Añadir `status`, honeypot,
   botón `▶  ENVIANDO…`, rama `error` con el aviso retro y rama `sent` con la
   terminal. En submit válido: `setStatus("sending")` → `await enviarMensaje(...)`
   → despachar según el resultado. Prueba manual (con `.env.local` real): enviar
   el formulario con datos válidos muestra ENVIANDO, luego la terminal, y llega
   el correo al buzón `CONTACT_TO_EMAIL`.
8. **Rutas de fallo.** Prueba manual: (a) renombrar `RESEND_API_KEY` en
   `.env.local` y reenviar → se muestra el aviso de error, no un 500; (b)
   rellenar el honeypot vía devtools y enviar → se muestra la terminal de éxito
   pero **no** llega correo; (c) enviar con un campo vacío → `.shake`, sin
   llamada de red.
9. **Cierre.** Si `next dev` regeneró el bloque `nextjs-agent-rules` de
   `AGENTS.md`, dejarlo incluido. Ejecutar `npx next build` y corregir errores de
   tipos o de framework. Revisar `/acerca-de` contra el prototipo abierto desde
   `references/templates/home-about/arcade-vault-standalone.html`.

---

## Criterios de aceptación

- [ ] `npx next build` termina sin errores ni warnings de TypeScript.
- [ ] `/acerca-de` renderiza la sección ABOUT (título, misión, 3 highlights con
      icono pixel), el divider y la sección CONTACTO. Ya no aparece el texto
      "PRÓXIMAMENTE".
- [ ] `app/acerca-de/page.tsx` no contiene ya el stub de SPEC 02.
- [ ] Enviar el formulario con `nombre`, `email` o `mensaje` vacío aplica la
      animación `.shake` y **no** hace ninguna petición de red.
- [ ] Con los tres campos rellenos y `.env.local` configurado, al enviar: el
      botón muestra `▶  ENVIANDO…` y se deshabilita; después aparece
      `.terminal-success` con `GRACIAS, {NOMBRE EN MAYÚSCULAS}.`.
- [ ] Tras un envío correcto llega un correo a `CONTACT_TO_EMAIL` con asunto
      `[Arcade Vault] Mensaje de {nombre}` y `replyTo` = email del visitante.
- [ ] Pulsar `ENVIAR OTRO MENSAJE` en la terminal limpia los campos y vuelve al
      formulario vacío.
- [ ] Con `RESEND_API_KEY` ausente, enviar muestra el aviso
      `> ERROR AL ENVIAR. INTÉNTALO DE NUEVO.` y conserva lo escrito; no se
      produce un error 500 sin capturar.
- [ ] Si el campo honeypot (`empresa`) llega con contenido, `enviarMensaje`
      devuelve `{ ok: true }` y **no** se envía ningún correo.
- [ ] `package.json` lista `resend` en `dependencies` con versión exacta (sin
      `^` ni `~`).
- [ ] `.env.example` existe y está rastreado por git; `.gitignore` contiene
      `!.env.example`.
- [ ] `components/use-reveal.ts` exporta `useReveal`; `app/page.tsx` lo importa y
      ya no define la función localmente; `/` sigue revelando secciones al hacer
      scroll.
- [ ] El divider y la sección CONTACTO reciben la clase `.in` al entrar en
      viewport.
- [ ] `app/globals.css` contiene los selectores de About
      (`.about-hero`, `.contact-form`, `.terminal-success`, `@keyframes shake`,
      …) y no duplica `.field` ni `@keyframes blink`.
- [ ] El aspecto de `/acerca-de` coincide con `about.jsx` del prototipo abierto
      desde `references/templates/home-about/arcade-vault-standalone.html`.
- [ ] `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` y `CONTACT_TO_EMAIL` no aparecen en
      ningún bundle de cliente (sólo se leen en `actions.ts` / `lib/email.ts`).

---

## Decisiones

- **Sí:** Server Action (`app/acerca-de/actions.ts`) para el envío. Es lo
  idiomático en App Router de Next 16, no necesita endpoint aparte y mantiene la
  API key sólo en el servidor. Consultar `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`
  antes de escribirla.
- **No:** Route Handler `app/api/contacto/route.ts`. Añade boilerplate (fetch,
  parseo, códigos HTTP) sin beneficio aquí; no hay otro consumidor del endpoint.
- **Sí:** estados `sending` / `error` además del `sent` del prototipo. El
  prototipo simula el envío; con red real el usuario necesita feedback de espera
  y de fallo.
- **No:** mantener el formulario 1:1 fire-and-forget. Ocultaría fallos de envío y
  daría falso positivo de "mensaje recibido".
- **Sí:** revalidación en servidor + honeypot. Barato y suficiente para un form
  público de bajo tráfico.
- **No:** captcha / rate-limiting / servicio anti-abuso. Sobredimensionado para
  este proyecto; va en su spec si el spam aparece.
- **No:** persistir los mensajes. El correo es el canal; guardar en DB es otra
  feature con su propio almacenamiento.
- **Sí:** `from`, `to` y `api key` en variables de entorno + `.env.example`. No
  fija direcciones reales en el repo y permite configurar por entorno.
- **No:** destinatario fijo como constante en el código. Acopla el repo a un
  buzón concreto y complica los despliegues.
- **Sí:** error controlado si falta `RESEND_API_KEY` (`error: "config"` →
  aviso). Evita un 500 en local sin configurar; el criterio de aceptación lo
  exige.
- **Sí:** extraer `useReveal` a `components/use-reveal.ts`. Lo usan Home y About;
  duplicar el `IntersectionObserver` en dos sitios es deuda inmediata.
- **Sí:** `HighlightIcon` como componente local en la página. Igual que
  `FeatureIcon` en `app/page.tsx` (SPEC 02); son SVG específicos de una pantalla.
- **Sí:** correo con `html` + `text` y `replyTo` al visitante. `text` para
  clientes sin HTML; `replyTo` permite responder directo desde el buzón.
- **No:** plantilla de correo con branding. Un bloque HTML mínimo cumple; el
  diseño del correo es otra spec si hace falta.
- **Sí:** el `html` del correo se escribe inline con interpolación de strings,
  escapando el contenido del usuario (`<`, `>`, `&`). Evita inyección de markup
  en el correo sin traer una librería de plantillas.

---

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `.gitignore` ignora `.env*`, así que `.env.example` no se rastrea | Añadir la excepción `!.env.example`; el criterio de aceptación verifica que git lo rastrea. |
| La API key se filtra a un bundle de cliente por un import mal ubicado | `RESEND_API_KEY` sólo se lee en `actions.ts` (`"use server"`) y `lib/email.ts` (sin `"use client"`, nunca importado desde componentes client); criterio de aceptación lo comprueba. |
| Contenido del usuario inyecta markup en el `html` del correo | Escapar `<`, `>`, `&` en `nombre`/`email`/`mensaje` antes de interpolar en el `html`. |
| Resend rechaza el envío porque `CONTACT_FROM_EMAIL` no es de un dominio verificado | `.env.example` documenta que el `from` debe ser de dominio verificado; en dev se puede usar `onboarding@resend.dev`. |
| `next dev` reescribe el bloque `nextjs-agent-rules` de `AGENTS.md` | Incluir ese cambio en el commit en lugar de revertirlo (indicado en `CLAUDE.md`). |
| Portar CSS de About pisa reglas compartidas (`.field`, `.kicker`, `.reveal`, `@keyframes blink`) de SPEC 01/02 | Portar selector por selector comprobando con `grep` en `app/globals.css`; revisión visual de `/acerca-de` y de las pantallas previas en el cierre. |
| API de Server Actions distinta a la del conocimiento previo del modelo | Leer `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` antes de escribir `actions.ts`, según obliga `AGENTS.md`. |
| Doble submit mientras `status === "sending"` | El botón se deshabilita en `sending` y el handler ignora el submit si `status === "sending"`. |

---

## Lo que **no** entra en esta spec

- Plantilla de correo con branding / React Email.
- Captcha, rate-limiting o servicio anti-abuso (sólo honeypot).
- Persistir los mensajes de contacto en cualquier almacén.
- Correo de auto-respuesta al visitante.
- Página de éxito/error en ruta propia.
- Tests automatizados.
- Cambios visuales sobre el prototipo más allá de los estados cargando/error.
- Reescritura de SPEC 02.

Cada uno de esos, si llega, va en su propia spec.
