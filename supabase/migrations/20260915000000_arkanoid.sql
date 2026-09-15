-- SPEC 08 — siembra la entrada de catálogo para ARKANOID, tercer juego real
-- del catálogo tras ASTEROIDS (SPEC 05/06) y TETRIS (SPEC 07).

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'arkanoid', 'ARKANOID',
  'Rebota la pelota y destruye muros de neón.',
  'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
  'ARCADE', 'cover-bricks', 'magenta',
  0, '0', 3
);
