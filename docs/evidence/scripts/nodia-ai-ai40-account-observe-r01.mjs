// Operator-only live account/catalog observation. No generation, login or credential export.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH, quiet: true });
const runtimePath = process.env.AI40_OBSERVE_RUNTIME;
const connection = process.env.AI40_OBSERVE_CONNECTION;
if (!runtimePath?.startsWith('/opt/nodia/verification/ai39-worker-integration-') || !/^[1-9]\d{0,18}$/.test(connection ?? ''))
  throw Error('Explicit observed runtime/connection required');
const { CodexRuntimeService } = await import(pathToFileURL(path.join(runtimePath, 'nodia-server/dist/common/ai/codex/codex-runtime.service.js')).href);
const subject = new CodexRuntimeService();
try {
  const session = await subject.observe(connection, AbortSignal.timeout(25000));
  const models = session.available && session.authenticated
    ? await subject.listModels(connection, AbortSignal.timeout(25000)) : [];
  console.log(JSON.stringify({ stage: 'AI40', status: 'native_account_observed',
    connection_id: connection, runtime_path: runtimePath,
    session: { available: session.available, authenticated: session.authenticated,
      reason: session.reason, checked_at: session.checkedAt },
    models: models.map(model => ({ id: model.id, supported_reasoning_efforts: model.supportedReasoningEfforts })),
    provider_generations: 0, account_or_model_requests: true, credential_values_emitted: false }));
} catch (error) {
  console.log(JSON.stringify({ stage: 'AI40', status: 'native_observation_failed',
    connection_id: connection, error_type: error?.constructor?.name,
    code: typeof error?.code === 'string' && /^codex_[a-z_]+$/.test(error.code) ? error.code : null,
    raw_details_emitted: false, provider_generations: 0 }));
  process.exitCode = 1;
} finally { await subject.onModuleDestroy(); }
