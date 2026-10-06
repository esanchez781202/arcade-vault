-- SPEC game-jam/frogger/01-frogger-core — siembra la entrada de catálogo para
-- FROGGER, quinto juego real del catálogo tras ASTEROIDS (SPEC 05/06),
-- TETRIS (SPEC 07), ARKANOID (SPEC 08) y SNAKE (SPEC 09).
-- Desviaciones respecto a la spec:
--  - color 'lime' no existe en el enum real (cyan | magenta | yellow | green);
--    se usa 'green' como el más cercano temáticamente.
--  - cover 'cover-frogger' no tiene CSS: se reutiliza 'cover-rana', ya
--    diseñado en app/globals.css para el juego de rana del catálogo mock
--    original (references/templates/data.jsx, id "ranaria").

insert into public.games (id, title, short, long, cat, cover, color, best, plays, difficulty)
values (
  'frogger', 'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE', 'cover-rana', 'green',
  0, '0', 3
);
