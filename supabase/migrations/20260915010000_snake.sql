-- SPEC 09 — siembra la entrada de catálogo para SNAKE, cuarto juego real
-- del catálogo tras ASTEROIDS (SPEC 05/06), TETRIS (SPEC 07) y ARKANOID (SPEC 08).

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'snake', 'SNAKE',
  'Crece sin morder tu propia cola.',
  'Una serpiente de luz recorre la grilla buscando fruta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso contra la pared o contra tu propia cola termina la partida.',
  'ARCADE', 'cover-snake', 'green',
  0, '0', 2
);
