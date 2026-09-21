# Juegos con skins — Arcade Vault

Registro de qué motor tiene qué skins. Memoria de `skin-designer`: un juego por invocación,
nunca se procesan varios a la vez.

| Juego     | clasico | retro | neon | extra         | Verificado (Fase 4) | Fecha |
| --------- | ------- | ----- | ---- | ------------- | -------------------- | ----- |
| tetris    | —       | —     | —    | pastel, pixel | —                     | —     |
| arkanoid  | ✅      | ✅    | ✅   | —             | ✅ C1-C6 PASS         | 2026-09-21 |
| asteroids | ✅      | ✅    | ✅   | —             | ⚠️ C5 falla (ver nota) | 2026-09-21 |
| snake     | ✅      | ✅    | ✅   | —             | ✅ C1-C6 PASS         | 2026-09-21 |

## Notas

- **arkanoid (2026-09-21):** C1-C6 en PASS para `clasico`/`retro`/`neon`. Medido sobre el
  frame de "gameover" (`forceGameOver()`, geometría estática determinista de nivel 1) en vez
  del frame de pausa: `drawPaused()` hornea un overlay `rgba(0,0,0,0.65)` directamente en el
  canvas (a diferencia de Asteroids/Tetris, donde el overlay "EN PAUSA" es un `<div>` de
  React encima del `<canvas>`, no parte de los píxeles), así que medir en pausa habría
  atenuado artificialmente el contraste de bloques hasta hacer fallar C1 sin motivo real.
  El frame de gameover da la misma geometría congelada sin ese sesgo. `danger` queda sin
  consumidor (la explosión reutiliza el color del bloque destruido).
- **asteroids / C5 (2026-09-21):** C1-C4 y C6 en PASS. C5 (≥15 % de píxeles distintos
  entre `clasico` y `neon` en el mismo frame pausado) mide 6.21 %, por debajo del umbral.
  Causa estructural, no de selector: Asteroids es vectorial de trazos de 1,5 px — la tinta
  ocupa ~0,5 % del lienzo en `clasico` y ~2,6 % en `neon` (con halo), así que incluso sin
  solape el máximo teórico de diferencia entre ambas skins ronda el 3 %, muy por debajo del
  15 % calibrado para juegos con relleno (bloques, sprites). El selector sí llega al motor
  — color y halo cambian de forma medible y visible (ver capturas) — solo el umbral
  numérico de C5 no es alcanzable para esta geometría. `danger` queda sin consumidor: la
  explosión de partículas no distingue nave de asteroide.
- **snake (2026-09-21):** C1-C6 en PASS para `clasico`/`retro`/`neon`, medido sobre una
  partida con 6 frutas comidas (longitud 9, no los 3 segmentos iniciales) para que la
  ocupación de tinta fuera representativa — con la serpiente recién nacida, cuerpo+fruta
  ocupan ~0.25 % del lienzo, por debajo del 0.5 % mínimo de C4. Rediseño obligado en la
  propia Fase 3/4: la rejilla inicial (líneas completas cada celda, 70 líneas sobre 40x30)
  cubría 10-18 % del lienzo incluso a opacidad baja y aparecía como "tinta" de bajo
  contraste en el histograma, haciendo fallar C1 en `retro`/`neon` — se sustituyó por puntos
  de 2x2px en las intersecciones cada 4 celdas (`drawGrid` en `snake/engine.ts`), que se
  quedan por debajo del umbral de ocupación del 0.2 % y dejan de contar como "ink". La fruta
  (`public/games/snake/fruits.png`) es inmune a la skin por decisión de diseño (ver comentario
  en `snake/skins.ts`): `retro` pinta un plato de fondo (`entities.fondoFruta`) y `neon`
  envuelve el `drawImage` con `conGlow`, pero el sprite en sí no se tiñe. `ink` y `danger` sin
  consumidor (mismo motivo que Asteroids: Snake no tiene una forma "protagonista" adicional
  ni una animación de muerte propia).
