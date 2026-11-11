BEGIN READ ONLY;

SELECT json_build_object(
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'wal_level', current_setting('wal_level'),
  'in_recovery', pg_is_in_recovery(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'backend_tls', (
    SELECT json_build_object('ssl', ssl, 'version', version, 'cipher', cipher, 'bits', bits)
    FROM pg_stat_ssl
    WHERE pid = pg_backend_pid()
  ),
  'user_table_count', (
    SELECT count(*)
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE relation.relkind IN ('r', 'p', 'f')
      AND namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
  )
);

ROLLBACK;
