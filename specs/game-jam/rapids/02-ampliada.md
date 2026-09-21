# GAME JAM — RAPIDS (ampliada): motor real y leaderboard

> **Estado:** Draft — propuesta de game jam, sin número de spec asignado
> **Depende de:** SPEC 05, SPEC 06, `specs/game-jam/rapids/01-core.md`
> **Fecha:** 2026-09-21
> **Objetivo:** Extender RAPIDS con power-ups de disparo, jefes de tramo (represas de
> troncos), combo de destrucción y stats de récord/racha en el modal de fin.

---

## Por qué existe esta spec

`01-core.md` entrega RAPIDS jugable de principio a fin con dos tipos de obstáculo y disparo
simple de cooldown fijo. Esta ampliación añade los tres extras que dan más profundidad táctica
al bucle destruir/esquivar sin tocar el contrato base del motor — mismo tipo de extensión que
SPEC 07 (pasos 7-11) hizo sobre Tetris.

Los tres extras, en orden de dependencia:

- **Power-ups de disparo**, que modifican temporalmente el cooldown o el patrón de bala.
- **Represas** (jefes de tramo periódicos): un bloque de varios troncos que ocupa varios
  carriles a la vez y requiere varios impactos repartidos para abrirse paso completo.
- **Combo de destrucción + récord/racha**, premiando destruir troncos sin fallar el disparo ni
  chocar, comparado contra el mejor score real de Supabase.

---

## Alcance

**Dentro:**

- **Power-up "disparo rápido".** Ítem que aparece ocasionalmente en un carril libre; al
  recogerlo (la balsa lo atraviesa), reduce `FIRE_COOLDOWN_MS` a la mitad durante
  `POWERUP_DURATION_MS = 8000`. Solo un power-up activo a la vez.
- **Power-up "disparo doble".** Alternativa al anterior (aparecen con la misma probabilidad,
  nunca los dos a la vez): mientras está activo, cada disparo cubre el carril actual y los dos
  adyacentes de forma simultánea, misma duración `POWERUP_DURATION_MS`.
- **Represas (jefes de tramo).** Cada `DAM_INTERVAL` unidades de distancia recorrida, en vez
  de la generación aleatoria normal de obstáculos aparece una represa: un bloque de troncos que
  ocupa entre 3 y 5 carriles a la vez, cada segmento con su propia vida (2 impactos en vez de
  1). Solo tras destruir todos los segmentos de una represa se reanuda la generación normal de
  obstáculos; mientras tanto, los carriles bloqueados por la represa cuentan como obstáculo
  indestructible temporal para efectos de colisión.
- **Combo de destrucción + récord/racha.** `engine.ts` añade `combo` (se incrementa por cada
  tronco/segmento de represa destruido sin fallar un disparo contra una roca ni chocar
  mientras tanto; se resetea a 0 al perder una vida) y `maxCombo` a `RapidsEngineState`.
  `app/juego/[id]/jugar/page.tsx` pasa `mejorGlobal` (vía `obtenerMejoresScores("rapids", 1)`)
  a `JugarClient`; el modal de fin muestra "¡NUEVO RÉCORD!" cuando `score > mejorGlobal` y
  siempre "Combo máximo: N".

**Fuera de alcance (por defecto):**

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales (RAPIDS se mantiene 100% vectorial — su identidad es la claridad de lectura
  de carriles/obstáculos en el CRT, no una ilustración).
- Tests automatizados.

---

## Modelo de datos

Reutiliza el contrato TypeScript de `01-core.md` (`RapidsGameState`, `RapidsInputState`,
`RapidsGameHandle`, `RapidsGameProps`) sin cambios de forma — esta ampliación añade tipos y
campos nuevos:

```ts
// components/games/rapids/engine.ts (ampliación)
export type RapidsPowerup = "rapid-fire" | "double-shot" | null;

export interface RapidsEngineState {
  score: number;
  lives: number;
  level: number;
  state: RapidsGameState;
  distance: number;
  activePowerup: RapidsPowerup; // ampliación
  combo: number; // ampliación
  maxCombo: number; // ampliación
}

export function createEngine(ctx: CanvasRenderingContext2D) {
  /* ... */
  return { update, draw, getState, forceGameOver };
}
```

```ts
// components/games/rapids/RapidsGame.tsx (ampliación)
// Sin cambios de props ni de ref — activePowerup/combo/maxCombo se leen del mismo
// onStateChange existente, mismo patrón que "lines" en Tetris (SPEC 07).
```

---

## Plan de implementación

Continúa la numeración del plan de `01-core.md` (pasos 1-6 ya completados ahí).

7. **Power-ups de disparo.** `engine.ts` añade generación periódica de un power-up
   (`"rapid-fire"` o `"double-shot"`, aleatorio, nunca dos activos a la vez), recogida por
   colisión balsa-ítem, y su efecto temporal sobre `FIRE_COOLDOWN_MS` o el patrón de disparo.
   `activePowerup` se expone en `RapidsEngineState` para que el HUD lo muestre (gateado por
   `game.id === "rapids"`). Prueba manual: recoger cada power-up cambia visiblemente el
   comportamiento del disparo durante `POWERUP_DURATION_MS` y luego vuelve a la normalidad.
8. **Represas.** `engine.ts` sustituye la generación normal de obstáculos por una represa cada
   `DAM_INTERVAL` unidades de distancia: bloque de 3-5 carriles, cada segmento con 2 impactos
   de vida. La generación normal se reanuda solo tras destruir todos los segmentos. Prueba
   manual: al llegar a una represa, los carriles bloqueados no se pueden cruzar hasta destruir
   sus segmentos; tras despejarla, el río vuelve a generar troncos/rocas sueltos.
9. **Combo de destrucción.** `engine.ts` añade `combo`/`maxCombo`: se incrementa en cada
   destrucción exitosa (tronco o segmento de represa) sin que, desde la última destrucción, la
   balsa haya chocado; se resetea a 0 al perder una vida. Prueba manual: encadenar varias
   destrucciones sin chocar sube el combo visible en el HUD; chocar lo resetea a 0.
10. **Récord + racha (combo).** `page.tsx` pasa `mejorGlobal` a `JugarClient`; el modal de fin
    muestra "¡NUEVO RÉCORD!" cuando `score > mejorGlobal` y siempre "Combo máximo: N". Ejecutar
    `npx next build` y corregir errores.

---

## Criterios de aceptación

- [ ] Los power-ups "disparo rápido" y "disparo doble" aparecen de forma ocasional (nunca
      simultáneamente), se pueden recoger, y su efecto dura exactamente
      `POWERUP_DURATION_MS` antes de revertir al comportamiento base.
- [ ] Cada `DAM_INTERVAL` de distancia aparece una represa de 3-5 carriles con segmentos de 2
      impactos cada uno; la generación normal de obstáculos se pausa hasta despejarla por
      completo.
- [ ] El motor expone `combo`/`maxCombo`; `combo` se resetea a 0 al perder una vida y sube con
      cada destrucción exitosa sin choque intermedio.
- [ ] El modal de fin muestra "¡NUEVO RÉCORD!" solo cuando `score > mejorGlobal` (dato real de
      Supabase) y siempre "Combo máximo: N".
- [ ] `npx next build` termina sin errores ni warnings de TypeScript tras los cuatro pasos.
- [ ] El core de `01-core.md` (carriles fijos, disparo base, dos tipos de obstáculo,
      puntuación por distancia/impacto, guardado de score) sigue funcionando exactamente igual
      que antes de esta ampliación.

---

## Decisiones

- **Sí:** dos power-ups mutuamente excluyentes (nunca ambos a la vez) en vez de un sistema de
  inventario/acumulación. Mantiene la decisión táctica simple (qué power-up tengo activo ahora
  mismo) sin introducir gestión de inventario ajena al resto del catálogo.
- **Sí:** represas como jefes de tramo periódicos por distancia, no por tiempo. Ata la
  dificultad de los jefes al progreso real del jugador (mismo criterio que el nivel del core),
  en vez de a un reloj independiente que penalizaría a quien juega con cautela.
- **Sí:** `combo`/`maxCombo` como stats de sesión mostradas en el modal de fin, sin nueva
  columna en `scores`. Mismo patrón que `maxCombo` en Tetris (SPEC 07, paso 10).
- **No:** más de dos tipos de power-up en esta ampliación. Mantiene el alcance acotado; nuevos
  power-ups irían en una spec futura si el usuario los pide tras jugar esta versión.

---

## Riesgos

| Riesgo                                                                                                              | Mitigación                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una represa aparece justo cuando un power-up sigue activo, desbalanceando el tramo                                  | Aceptado como parte de la variabilidad del juego; el paso 8 verifica que el tramo, incluso en el peor caso, siga siendo despejable dentro del tiempo disponible antes de que la balsa la alcance. |
| El combo se vuelve trivial de mantener si "chocar" no lo resetea correctamente tras una represa                     | El paso 9 verifica explícitamente que chocar contra un segmento de represa no destruido cuenta como choque a efectos de resetear el combo, igual que con troncos/rocas sueltos.                   |
| Los segmentos de represa con 2 impactos hacen que el disparo doble los limpie de forma desproporcionadamente rápida | Aceptado como sinergia intencional entre power-up y jefe de tramo; el paso 7-8 lo prueba junto para confirmar que sigue siendo un reto, no un trivializador total.                                |

---

## Lo que **no** entra en esta spec

- Controles táctiles/móviles.
- Auth real / `user_id` en `scores`.
- Migrar scores de `localStorage`.
- Pantalla de administración del catálogo.
- Sonido/música.
- Sprites reales.
- Más de dos tipos de power-up.
- Tests automatizados.

Cada uno de esos, si llega, va en su propia spec.
