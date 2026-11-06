-- Extensions used across the app.
-- postgis:  bars (venues) location, distance checks for verification
-- pg_trgm:  fuzzy search of users, beers and bars
-- unaccent: accent-insensitive search ("cervesa" matches "cervésa")
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
