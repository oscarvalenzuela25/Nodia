\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $maintenance$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname IN ('uuid-ossp', 'pg_trgm') AND n.nspname <> 'public'
  ) THEN
    RAISE EXCEPTION 'Required extension already exists outside public; no relocation or replacement was requested';
  END IF;
END
$maintenance$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

DO $maintenance$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname IN ('uuid-ossp', 'pg_trgm') AND n.nspname = 'public'
  ) <> 2 THEN
    RAISE EXCEPTION 'Required extensions were not both verified in public';
  END IF;
END
$maintenance$;
COMMIT;
