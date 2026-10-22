// Dedicated child worker for synthetic PostgreSQL crash/concurrency checks. Credentials arrive over IPC.
import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';

process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
const load = async (file, name) =>
  (await import('../dist/' + file + '.js'))[name];
let db, claim;
process.on('message', async (message) => {
  try {
    if (message.command === 'start') {
      db = await new DataSource({
        ...message.database,
        synchronize: false,
        entities: [
          fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
        ],
      }).initialize();
      const [
        Runtime,
        AuthStore,
        Authorize,
        Validate,
        Claim,
        Checkpoint,
        Reserve,
      ] = await Promise.all(
        [
          [
            'nodia-ai-runtime/nodia-ai-runtime.service',
            'NodiaAiRuntimeService',
          ],
          [
            'nodia-ai/nodia-ai-authorization.service',
            'NodiaAiAuthorizationService',
          ],
          [
            'nodia-ai/use-case/authorize-nodia-ai.use-case',
            'AuthorizeNodiaAiUseCase',
          ],
          [
            'nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case',
            'ValidateNodiaAiRuntimePolicyUseCase',
          ],
          [
            'nodia-ai-runtime/use-case/claim-nodia-ai-job.use-case',
            'ClaimNodiaAiJobUseCase',
          ],
          [
            'nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case',
            'CheckpointNodiaAiJobUseCase',
          ],
          [
            'nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case',
            'ReserveNodiaAiRuntimeSlotUseCase',
          ],
        ].map(([file, name]) => load(file, name)),
      );
      const policy = new Validate().execute(
        JSON.parse(
          await readFile(
            new URL(
              '../dist/nodia-ai-runtime/config/runtime-policy.json',
              import.meta.url,
            ),
            'utf8',
          ),
        ),
      );
      const runtime = new Runtime(db),
        authorize = new Authorize(new AuthStore(db));
      claim = await new Claim(runtime, authorize, policy).execute(
        message.workerId,
        [message.catalog],
      );
      if (claim && message.arm) {
        const checkpoint = new Checkpoint(runtime, authorize, policy);
        const reservation = await new Reserve(checkpoint, policy).execute(
          claim,
          message.resourceKey,
          claim.attempt.id,
        );
        await checkpoint.armDispatch(claim, undefined, reservation);
      }
      process.send?.({
        event: 'claimed',
        claim: claim
          ? {
              jobId: claim.job.id,
              fence: claim.job.fence,
              attemptId: claim.attempt.id,
            }
          : null,
      });
    } else if (message.command === 'close') {
      if (db?.isInitialized) await db.destroy();
      process.disconnect();
    }
  } catch {
    process.send?.({ event: 'fixture_error' });
    if (db?.isInitialized) await db.destroy();
    process.exitCode = 1;
    process.disconnect();
  }
});
process.send?.({ event: 'ready' });
