// Plan90 retires the Web login/viewer/logout transport. This successor proves the
// former routes are absent on the real compiled controller, for both aliases.
// Current login ownership/auth/cancel and bounded transport guarantees remain in
// agentic-cli.integration.mjs and codex-http.integration.mjs; no old viewer action is replayed.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./not-an-env-file', import.meta.url));
const { AiProviderController } = await import('../dist/ai-provider/ai-provider.controller.js');
const dependencies = Reflect.getMetadata('design:paramtypes', AiProviderController);
const compiled = await Test.createTestingModule({
  controllers: [AiProviderController],
  providers: dependencies.map(provide => ({ provide, useValue: Object.freeze({}) })),
}).compile();
const app = compiled.createNestApplication({ logger: false });
let checks = 0;
try {
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  for (const alias of ['ai-provider', 'ai-providers']) {
    for (const [suffix, method] of [
      ['/gemini-login/start', 'POST'], ['/gemini-login/' + 'a'.repeat(32), 'GET'],
      ['/gemini-login/' + 'a'.repeat(32) + '/frame', 'GET'],
      ['/gemini-login/' + 'a'.repeat(32) + '/input', 'POST'],
      ['/gemini-login/' + 'a'.repeat(32) + '/cancel', 'POST'],
      ['/gemini-session/logout', 'POST'], ['/42/web/session', 'GET'],
      ['/42/web/login', 'POST'],
    ]) {
      const response = await fetch(base + '/' + alias + suffix, {
        method, headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
      });
      assert.equal(response.status, 404, `${method} ${alias}${suffix} must stay retired`);
      checks++;
    }
  }
  console.log(JSON.stringify({ scope: 'compiled_retired_web_routes', checks,
    database_calls: 0, provider_inferences: 0, provider_transport: 'not_instantiated' }));
} finally {
  await app.close();
}
