# TODO de sugerencias de juegos — Arcade Vault

Memoria persistente del agente `game-planner` (`.claude/agents/game-planner.md`). Se actualiza
en cada invocación: el agente lee este archivo antes de proponer nada y añade aquí todos los
candidatos de la ronda, no solo el recomendado.

Editable a mano: mover una entrada entre secciones es una decisión válida del humano.
Un juego pasa a "Implementados" cuando su spec queda en estado `Implementado` y su motor está
en `components/games/`.

## Pendientes

<!-- - [ ] **TITULO** (`slug`) — CAT · color · dif N/5 · esfuerzo N/5 — por qué encaja. _Sugerido: YYYY-MM-DD_ -->

### VERSUS

- [ ] **COMBATE** (`combate`) — VERSUS · magenta · dif 3/5 · esfuerzo 3/5 — único candidato que llena la
      categoría VERSUS, hoy vacía (el chip de `/biblioteca` devuelve lista vacía). Duelo de tanques en
      arena con muros y balas que rebotan; campaña 1P contra CPU que alimenta el leaderboard con un
      entero ascendente y modo 2P en el mismo teclado. _Sugerido: 2026-09-16_ ⭐ recomendado
- [ ] **PÓLVORA** (`polvora`) — VERSUS · yellow · dif 3/5 · esfuerzo 3/5 — bombas por turnos en grilla
      destructible con bots; el bucle colocar/huir/encadenar no existe en ningún motor portado y la
      puntuación escala sola con las oleadas. Canvas puro. _Sugerido: 2026-09-16_ ⭐ mejor del lote VERSUS
- [ ] **EMPUJE** (`empuje`) — VERSUS · green · dif 2/5 · esfuerzo 5/5 — sumo de discos en un anillo que se
      encoge; el port más barato del lote, canvas puro y 2P inmediato al mismo teclado.
      _Sugerido: 2026-09-16_
- [ ] **ASEDIO** (`asedio`) — VERSUS · yellow · dif 3/5 · esfuerzo 4/5 — duelo de artillería por turnos con
      viento y terreno destructible; puntuación por precisión, sin assets. _Sugerido: 2026-09-16_
- [ ] **JUSTA** (`justa`) — VERSUS · cyan · dif 4/5 · esfuerzo 3/5 — vuelo a aleteos donde el choque lo gana
      quien esté más alto; el enfrentamiento más puro del lote, pero pide sprites y física de ajuste fino.
      _Sugerido: 2026-09-16_
- [ ] **ESTELA** (`estela`) — VERSUS · magenta · dif 3/5 · esfuerzo 5/5 — motos de luz que dejan muro
      permanente; barato y muy legible en CRT, pero su bucle de grilla con rastro se solapa con SNAKE.
      _Sugerido: 2026-09-16_

### PUZZLE

- [ ] **CERCO** (`cerco`) — PUZZLE · green · dif 4/5 · esfuerzo 3/5 — captura de territorio trazando líneas:
      el único bucle del catálogo que no es rejilla, rebote ni disparo; vectorial puro y con puntuación por
      área × riesgo asumido. El score debe definirse como celdas/área acumuladas entre niveles, nunca como
      porcentaje del nivel. _Sugerido: 2026-09-16_ ⭐ mejor del lote PUZZLE
- [ ] **CADENA** (`cadena`) — PUZZLE · magenta · dif 3/5 · esfuerzo 3/5 — pila que asciende y cursor que
      intercambia pares: emparejado sin piezas que caen, con cascadas que dan la mejor curva de leaderboard
      del lote. _Sugerido: 2026-09-16_
- [ ] **BURBUJAS** (`burbujas`) — PUZZLE · cyan · dif 2/5 · esfuerzo 3/5 — cañón de ángulo y rejilla
      hexagonal: el candidato más accesible y el de mejor lectura en CRT, con bonus por racimos desprendidos.
      _Sugerido: 2026-09-16_
- [ ] **CANTERA** (`cantera`) — PUZZLE · yellow · dif 4/5 · esfuerzo 2/5 — excavar con gravedad por casillas
      y cuevas procedurales por semilla; mecánica única en el catálogo, pero el port más caro del lote.
      _Sugerido: 2026-09-16_
- [ ] **TUBERÍAS** (`tuberias`) — PUZZLE · magenta · dif 3/5 · esfuerzo 4/5 — montar el conducto antes de que
      llegue el fluido; motor pequeño y sin assets, aunque su curva de puntuación es la más plana de los
      cinco. _Sugerido: 2026-09-16_

### SHOOTER

- [ ] **RASANTE** (`rasante`) — SHOOTER · cyan · dif 4/5 · esfuerzo 3/5 — scroll horizontal forzado sobre
      desfiladero procedural con combustible que se agota: gestión de recursos + colisión contra relieve,
      ambas inéditas en el catálogo. _Sugerido: 2026-09-16_ ⭐ mejor del lote SHOOTER
- [ ] **EL POZO** (`el-pozo`) — SHOOTER · magenta · dif 4/5 · esfuerzo 2/5 — tube shooter vectorial: recorres
      el borde de un pozo de carriles y disparas hacia la profundidad; el mejor encaje estético con el CRT de
      neón. _Sugerido: 2026-09-16_
- [ ] **PROFUNDIDAD** (`profundidad`) — SHOOTER · cyan · dif 3/5 · esfuerzo 5/5 — cargas que caen con retardo
      sobre submarinos en carriles: disparo por anticipación en vez de puntería, motor diminuto y canvas
      puro. _Sugerido: 2026-09-16_
- [ ] **HORDA** (`horda`) — SHOOTER · yellow · dif 5/5 · esfuerzo 3/5 — twin-stick reducido a teclado (WASD
      mueve, flechas disparan) en arena cerrada con bonus creciente por rescate; la mejor curva de
      leaderboard del lote. _Sugerido: 2026-09-16_
- [ ] **INVASIÓN** (`invasion`) — SHOOTER · green · dif 2/5 · esfuerzo 5/5 — formación de invasores que
      desciende por oleadas; motor mínimo, canvas puro, marcador clásico. Repite categoría con ASTEROIDS.
      _Sugerido: 2026-09-16_
- [ ] **CIEMPIÉS** (`ciempies`) — SHOOTER · magenta · dif 4/5 · esfuerzo 3/5 — enemigo serpenteante que se
      parte en segmentos al recibir impactos, nave confinada a la franja inferior. Tercer SHOOTER del
      catálogo. _Sugerido: 2026-09-16_
- [ ] **BARRACA** (`barraca`) — SHOOTER · green · dif 2/5 · esfuerzo 5/5 — galería de tiro con cargador
      finito: las dianas que escapan te quitan munición en vez de matarte. El más barato de portar, pero el
      más cercano a INVASIÓN: si INVASIÓN se prioriza, es el primero a sacrificar. _Sugerido: 2026-09-16_

### ARCADE

- [ ] **ASFALTO** (`asfalto`) — ARCADE · magenta · dif 2/5 · esfuerzo 5/5 — único overhead driving del
      catálogo: velocidad bajo control del jugador y carretera procedural, canvas puro, score = distancia ×
      velocidad, infinito. _Sugerido: 2026-09-16_ ⭐ mejor del lote ARCADE
- [ ] **EXCAVA** (`excava`) — ARCADE · yellow · dif 3/5 · esfuerzo 3/5 — terreno destructible: el jugador
      fabrica el laberinto al cavar, algo que no hace ningún ARCADE portado ni pendiente; rocas en cadena dan
      combos y curva sin techo. _Sugerido: 2026-09-16_
- [ ] **REDIL** (`redil`) — ARCADE · cyan · dif 3/5 · esfuerzo 3/5 — único juego de control indirecto: no
      mueves al rebaño, lo asustas, y el resultado emerge de su IA de flocking; canvas puro, bonus de manada
      acumulativo sin techo. Riesgo del port: calibrar las constantes del flocking. _Sugerido: 2026-09-16_
- [ ] **CRUCE** (`cruce`) — ARCADE · cyan · dif 3/5 · esfuerzo 4/5 — esquivar carriles de tráfico y saltar
      troncos hasta la orilla; mecánica de evasión por carriles, ninguna parecida entre los motores
      portados. Categoría ARCADE ya poblada. _Sugerido: 2026-09-16_
- [ ] **PIRÁMIDE** (`piramide`) — ARCADE · green · dif 3/5 · esfuerzo 4/5 — movimiento diagonal sobre
      cuadrícula isométrica y muerte por caída al vacío; motor pequeño y canvas puro, pero curva algo
      escalonada. _Sugerido: 2026-09-16_
- [ ] **LABERINTO** (`laberinto`) — ARCADE · yellow · dif 4/5 · esfuerzo 2/5 — comecocos con cuatro
      perseguidores de IA distinta; excelente curva de leaderboard pero un port caro
      (mapa + cuatro comportamientos + modo huida). _Sugerido: 2026-09-16_
- [ ] **ANDAMIOS** (`andamios`) — ARCADE · yellow · dif 4/5 · esfuerzo 2/5 — única plataforma de pantalla
      única: aporta gravedad, salto y escaleras, ejes ausentes del catálogo; a cambio es el port más caro del
      lote y quizá pida sprite. _Sugerido: 2026-09-16_

## Descartados

<!-- - [ ] **TITULO** — motivo del descarte. _YYYY-MM-DD_ -->

- [ ] **DUELO DE PALAS** (pong) — doble incumplimiento: el bucle de rebote pala/pelota duplica el motor de
      ARKANOID, y su marcador natural es victorias/derrotas, no el entero único ascendente que asumen
      `scores` y el Salón de la Fama. _2026-09-16_
- [ ] **BUSCAMINAS** — exige ratón continuo (clic izquierdo/derecho por casilla) y se mide en tiempo:
      incumple el filtro de controles y el de puntuación. _2026-09-16_
- [ ] **LLUVIA DE MISILES** (missile command) — su mecánica central es apuntar con el cursor; sin ratón
      continuo el juego deja de ser el que es. _2026-09-16_
- [ ] **ALMACÉN** (sokoban) — niveles finitos y solución óptima determinista: el leaderboard tendría techo
      plano y empates masivos en la puntuación máxima. _2026-09-16_
- [ ] **ASCENSO** (saltos en plataformas infinitas verticales) — pide un lienzo vertical estrecho; el marco
      `.crt-screen` es `aspect-ratio: 4 / 3` con un único canvas de 800×600 lógicos. _2026-09-16_
- [ ] **AIRE Y HIELO** — ratón continuo y duplica el bucle de rebote de ARKANOID. _2026-09-16_
- [ ] **VOLEA** — marcador por sets, no entero único ascendente. _2026-09-16_
- [ ] **PISTOLEROS** — se mide en tiempo de reacción, no en puntuación acumulativa. _2026-09-16_
- [ ] **CAZA** — duplica el disparo inercial vectorial de ASTEROIDS. _2026-09-16_
- [ ] **BALUARTE** (warlords) — duplica el motor de rebote de ARKANOID. _2026-09-16_
- [ ] **TIRA Y AFLOJA** — sin curva de puntuación: techo plano inmediato. _2026-09-16_
- [ ] **DOJO** (lucha 1v1) — pasa el filtro duro, pero descartado por coste: sprites animados por estado e
      hitboxes por fotograma. _2026-09-16_
- [ ] **ATERRIZAJE** (lunar lander) — duplica el bucle inercial de ASTEROIDS y puntúa por combustible
      restante. _2026-09-16_
- [ ] **ESCALADOR** — lienzo vertical estrecho, mismo motivo que ASCENSO. _2026-09-16_
- [ ] **CATA-BOMBAS** — exige control analógico continuo. _2026-09-16_
- [ ] **HIELO** (pengo) — solapa con ALMACÉN (ya descartado) y con LABERINTO (pendiente). _2026-09-16_
- [ ] **COCINA** (BurgerTime) — mismo subgénero que ANDAMIOS, con recetas finitas que aplanan la curva.
      _2026-09-16_
- [ ] **PICADO** — duplica INVASIÓN (pendiente). _2026-09-16_
- [ ] **RÍO** — lienzo vertical, incumple el 4:3 de `.crt-screen`. _2026-09-16_
- [ ] **CARAMBOLA** — el rebote de proyectiles es el núcleo de COMBATE (pendiente). _2026-09-16_
- [ ] **BÚNKER** — solapa con HORDA (pendiente). _2026-09-16_
- [ ] **ÓRBITA** — solapa con EL POZO (pendiente). _2026-09-16_
- [ ] **VECTOR 3D** — coste alto y solapa con COMBATE. _2026-09-16_
- [ ] **CASTILLO** — bucle inercial de ASTEROIDS. _2026-09-16_
- [ ] **CRONO** — bucle inercial de ASTEROIDS. _2026-09-16_
- [ ] **SINISTAR** — su radar exige un segundo lienzo permanente. _2026-09-16_
- [ ] **COLUMNAS / MEDICINA** — clon del bucle de caída de piezas de TETRIS. _2026-09-16_
- [ ] **JOYAS** (match-3 de arrastre) — exige ratón continuo. _2026-09-16_
- [ ] **PUZZNIC / ATOMIX** — niveles finitos deterministas, leaderboard con techo plano. _2026-09-16_
- [ ] **PERFORADORA** (Mr. Driller) — lienzo vertical estrecho. _2026-09-16_
- [ ] **KLAX** — solapa a la vez con ARKANOID y TETRIS. _2026-09-16_
- [ ] **APAGÓN** (Lights Out) — se mide en número de movimientos. _2026-09-16_
- [ ] **2048** — no es tiempo real, no tiene vidas ni niveles, y la estrategia conocida aplana el ranking.
      _2026-09-16_
- [ ] **MURALLA** (Rampart) — exige cursor; además su eje natural es VERSUS, no PUZZLE. _2026-09-16_

## Implementados

- [x] **ASTEROIDS** (`asteroids`) — SHOOTER — SPEC 05
- [x] **TETRIS** (`tetris`) — PUZZLE — SPEC 07
- [x] **ARKANOID** (`arkanoid`) — ARCADE — SPEC 08
- [x] **SNAKE** (`snake`) — ARCADE — SPEC 09
