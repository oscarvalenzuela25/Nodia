// Operator-only offline restore preparation. No AppModule, configured DB, HTTP listener or adapter.
import 'reflect-metadata';
import { readFile, stat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { AssertNodiaAiOperationModeUseCase } from '../dist/nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case.js';

let db;
try {
new AssertNodiaAiOperationModeUseCase().execute(process.env, 'restore');
const args = process.argv.slice(2);
if (args.length !== 5 || args[0] !== '--execute') throw Error('nodia_ai:restore_arguments_invalid');
const [targetPath, metadataPath, manifestPath, headPath] = args.slice(1);
if (new Set(await Promise.all(args.slice(1).map(path => realpath(path)))).size !== 4) throw Error('nodia_ai:restore_arguments_invalid');
async function readBounded(path, limit) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > limit) throw Error('nodia_ai:restore_file_invalid');
  const bytes = await readFile(path);
  if (bytes.byteLength > limit) throw Error('nodia_ai:restore_file_invalid');
  return bytes.toString('utf8');
}
const target = JSON.parse(await readBounded(targetPath, 16_384));
const fields = ['host', 'port', 'username', 'password', 'database'];
if (!target || Object.keys(target).length !== fields.length || fields.some(field => !Object.hasOwn(target, field)) ||
  !['host', 'username', 'password', 'database'].every(field => typeof target[field] === 'string' && target[field].length > 0 && target[field].length <= 4096) ||
  !Number.isSafeInteger(target.port) || target.port < 1 || target.port > 65535 ||
  !/^nodia_restore_[a-z0-9_]{1,48}$/u.test(target.database)) throw Error('nodia_ai:restore_target_invalid');
const metadata = JSON.parse(await readBounded(metadataPath, 16_384));
if (!metadata || Object.keys(metadata).length !== 2 || !Object.hasOwn(metadata, 'backup') || !Object.hasOwn(metadata, 'quarantined_at')) throw Error('nodia_ai:restore_arguments_invalid');
const input = { operationMode: 'quarantine', ...metadata, manifest: await readBounded(manifestPath, 8 * 1024 * 1024), journalHead: JSON.parse(await readBounded(headPath, 16_384)) };
const load = async (file, name) => (await import('../dist/' + file + '.js'))[name];
const [ValidatePolicy, Validate, Prepare, Expire, Conversations, Attachments] = await Promise.all([
  ['nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase'],
  ['nodia-ai-recovery/use-case/validate-nodia-ai-restore.use-case', 'ValidateNodiaAiRestoreUseCase'],
  ['nodia-ai-recovery/use-case/prepare-nodia-ai-restore.use-case', 'PrepareNodiaAiRestoreUseCase'],
  ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase'],
  ['nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService'],
  ['nodia-ai-attachment/nodia-ai-attachment.service', 'NodiaAiAttachmentService'],
].map(([file, name]) => load(file, name)));
const policy = new ValidatePolicy().execute(JSON.parse(await readFile(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')));
db = new DataSource({ type: 'postgres', ...target, synchronize: false, entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))] });
  await db.initialize();
  const expire = new Expire(new Conversations(db), policy, new Attachments(db, policy));
  const result = await new Prepare(db, policy, expire, new Validate()).execute(input);
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (error) {
  // No driver errors, credentials, paths, journal identifiers or personal data are printed.
  const code = error instanceof Error && /^nodia_ai:[a-z0-9_]{1,100}$/u.test(error.message) ? error.message : 'nodia_ai:restore_failed';
  process.stderr.write(code + '\n');
  process.exitCode = 1;
} finally {
  if (db?.isInitialized) await db.destroy();
}
