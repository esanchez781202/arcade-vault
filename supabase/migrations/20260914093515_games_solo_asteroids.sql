-- SPEC 06 (corrección durante la implementación, paso 8) — deja `games` solo
-- con 'asteroids', el único juego con motor real implementado hasta el
-- momento (SPEC 05). Los otros 8 juegos del array GAMES original no tienen
-- motor jugable todavía; se añadirán a `games` en la spec que lo implemente.
-- Ver sección "Decisiones" de specs/06-leaderboard-y-catalogo-supabase.md.

delete from public.games where id <> 'asteroids';
