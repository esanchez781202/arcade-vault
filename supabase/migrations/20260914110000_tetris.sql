-- SPEC 07 — siembra la entrada de catálogo para TETRIS, segundo juego real
-- del catálogo tras ASTEROIDS (SPEC 05/06).

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'tetris', 'TETRIS',
  'Encaja las piezas y despeja líneas antes de que el tablero se desborde.',
  'El clásico de siempre: siete piezas caen desde arriba en un tablero de 10x20. Rota, desplaza y deja caer para completar líneas horizontales antes de que la pila llegue al techo. La velocidad aumenta con cada nivel.',
  'PUZZLE', 'cover-tetris', 'cyan',
  0, '0', 2
);
