-- SPEC 06 (ampliación post-cierre, paso 9) — añade `difficulty` a `games` para
-- que la sección DIFICULTAD de /juego/[id] deje de estar fija en el JSX.

alter table public.games
  add column difficulty integer not null default 3 check (difficulty between 1 and 5);

alter table public.games alter column difficulty drop default;

update public.games set difficulty = 3 where id = 'asteroids';
