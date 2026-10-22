// Explicit operator command. Never starts a worker, migrates a database, or generates a model response.
import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { JwtService } from '@nestjs/jwt';

const jobId = process.argv[2];
if (
  !jobId ||
  process.argv.length !== 3 ||
  (jobId !== '--list' &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      jobId,
    ))
) {
  console.error(
    'Usage: node scripts/reconcile-nodia-ai-runtime.mjs <job-uuid|--list>; provide NODIA_AI_OPERATOR_ACCESS_TOKEN in the process environment.',
  );
  process.exitCode = 1;
} else {
  const token = process.env.NODIA_AI_OPERATOR_ACCESS_TOKEN;
  delete process.env.NODIA_AI_OPERATOR_ACCESS_TOKEN;
  let database;
  try {
    if (!token) throw Error('operator_access_token_required');
    const load = async (file, name) =>
      (await import('../dist/' + file + '.js'))[name];
    const [AuthTokenService, readAuthConfig] = await Promise.all([
      load('auth/auth-token.service', 'AuthTokenService'),
      load('auth/auth.config', 'readAuthConfig'),
    ]);
    // Use the same signature, audience, issuer and access-token checks as HTTP authentication.
    await import('../dist/config/envs.config.js');
    const claims = await new AuthTokenService(
      new JwtService(),
      readAuthConfig(process.env),
    ).verify(token, 'access');
    database = (await import('../dist/config/data-source.js')).default;
    await database.initialize();
    const [
      Runtime,
      AuthStore,
      Authorize,
      Transport,
      Native,
      Validate,
      Cleanup,
      Reconcile,
    ] = await Promise.all(
      [
        ['nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService'],
        [
          'nodia-ai/nodia-ai-authorization.service',
          'NodiaAiAuthorizationService',
        ],
        [
          'nodia-ai/use-case/authorize-nodia-ai.use-case',
          'AuthorizeNodiaAiUseCase',
        ],
        [
          'nodia-ai-adapter/nodia-ai-adapter.service',
          'NodiaAiAdapterTransport',
        ],
        [
          'nodia-ai-adapter/use-case/reconcile-gemini-nodia-ai-runtime.use-case',
          'ReconcileGeminiNodiaAiRuntimeUseCase',
        ],
        [
          'nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case',
          'ValidateNodiaAiRuntimePolicyUseCase',
        ],
        [
          'nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case',
          'CleanupNodiaAiRuntimeProofsUseCase',
        ],
        [
          'nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case',
          'ReconcileNodiaAiRuntimeUseCase',
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
    const runtime = new Runtime(database),
      native = new Native(new Transport()),
      authorize = new Authorize(new AuthStore(database)),
      cleanup = new Cleanup(runtime, native, policy);
    const reconciler = new Reconcile(
      runtime,
      authorize,
      native,
      cleanup,
      policy,
    );
    const identity = { userId: claims.sub, sessionId: claims.sid };
    const result =
      jobId === '--list'
        ? { pending: await reconciler.list(identity) }
        : await reconciler.execute(identity, jobId);
    console.log(JSON.stringify(result));
    if (result.cleanup_pending) process.exitCode = 2;
  } catch (error) {
    const message =
      error instanceof Error &&
      /^(nodia_ai:[a-z_]+|operator_access_token_required|auth:session_expired)$/.test(
        error.message,
      )
        ? error.message
        : 'runtime_reconciliation_unavailable';
    console.error(JSON.stringify({ error: message }));
    process.exitCode = 1;
  } finally {
    if (database?.isInitialized) await database.destroy();
  }
}
