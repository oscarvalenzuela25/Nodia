// Closed libpq connection contract, shared by configuration loading and pg_dump.
import { lstat, realpath, readFile } from 'node:fs/promises';

const fail = () => { throw Error('nodia_ai:backup_database_invalid'); };
export function validateNodiaAiBackupDatabase(database) {
  const required = ['host', 'port', 'username', 'password', 'database'];
  if (!database || typeof database !== 'object' || Array.isArray(database) ||
    required.some(key => !Object.hasOwn(database, key)) ||
    Object.keys(database).some(key => !required.includes(key) && key !== 'tls') ||
    !['host', 'username', 'password', 'database'].every(key => typeof database[key] === 'string' &&
      database[key].length > 0 && database[key].length <= 4096 && !database[key].includes('\0')) ||
    !Number.isSafeInteger(database.port) || database.port < 1 || database.port > 65535) return fail();
  // pg_dump expands --dbname URI/conninfo values and they can override TLS options.
  if (database.database.includes('=') || /^postgres(?:ql)?:/iu.test(database.database)) return fail();
  if (Object.hasOwn(database, 'tls')) {
    const tls = database.tls;
    if (!tls || typeof tls !== 'object' || Array.isArray(tls) || Object.keys(tls).length !== 2 ||
      tls.mode !== 'verify-full' || typeof tls.root_cert_file !== 'string' ||
      !tls.root_cert_file.startsWith('/') || tls.root_cert_file.length > 4096 ||
      /[\0\r\n]/u.test(tls.root_cert_file) || /[\s,@\\/]/u.test(database.host)) return fail();
  }
  return database;
}

export async function validateNodiaAiBackupDatabaseCertificate(database) {
  validateNodiaAiBackupDatabase(database);
  if (!Object.hasOwn(database, 'tls')) return;
  const path = database.tls.root_cert_file;
  try {
    if (await realpath(path) !== path) return fail();
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      ![0, process.getuid()].includes(info.uid) || (info.mode & 0o022) !== 0 ||
      info.size < 1 || info.size > 8 * 1024 ** 2) return fail();
  } catch { return fail(); }
}

export function nodiaAiBackupDumpEnvironment(database, timeoutSeconds) {
  validateNodiaAiBackupDatabase(database);
  if (!Number.isSafeInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600) return fail();
  const env = {
    PATH: '/usr/bin:/bin', LANG: 'C', PGPASSWORD: database.password,
    PGCONNECT_TIMEOUT: String(Math.min(30, timeoutSeconds)), PGAPPNAME: 'nodia-ai-encrypted-backup',
  };
  if (Object.hasOwn(database, 'tls')) {
    env.PGSSLMODE = 'verify-full';
    env.PGSSLROOTCERT = database.tls.root_cert_file;
    // libpq can prefer GSS encryption over SSL; this connection requires TLS.
    env.PGGSSENCMODE = 'disable';
  }
  return env;
}

export async function nodiaAiBackupNodeDatabaseOptions(database) {
  await validateNodiaAiBackupDatabaseCertificate(database);
  return {
    host: database.host, port: database.port, user: database.username,
    password: database.password, database: database.database,
    ...(Object.hasOwn(database, 'tls') ? { ssl: {
      rejectUnauthorized: true, ca: await readFile(database.tls.root_cert_file, 'utf8'),
    } } : {}),
  };
}
