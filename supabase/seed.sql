insert into public.game_catalog (slug, kind, title, status, sort_order, thumbnail_url)
values
  ('royal-heist', 'slot', 'Royal Heist', 'active', 1, null),
  ('neon-comet', 'slot', 'Neon Comet', 'active', 2, null),
  ('sunset-scarabs', 'slot', 'Sunset Scarabs', 'active', 3, null),
  ('rocket-x', 'crash', 'Rocket X', 'active', 4, null),
  ('vault-mines', 'mines', 'Vault Mines', 'active', 5, null)
on conflict (slug) do nothing;

