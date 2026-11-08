// Synthetic descriptor contract only; no runtime, SDK, profile, DB or account calls.
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateContenderInput } from './nodia-ai-ai40-recovery-contenders-r01.mjs';
const fixture = () => ({ schema_version: 1, release_root: '/opt/nodia/releases/nodia-server-ai40-r07', case: 'chat',
  selection: { connection_id: '1', mode: 'token_plan_agentic', model_id: 'synthetic-selected-model', effort_id: null },
  provider: { is_active: true, catalog_active: true, use_token_plan_agentic: true, can_use_token_plan_agentic: true,
    updated_at: '2026-10-23T00:00:00.000Z', agentic_fields: {} },
  owner_identity: { engine: 'agentic', attemptId: '11111111-1111-4111-8111-111111111111', operationRef: '11111111-1111-4111-8111-111111111111',
    resourceKey: 'codex-profile:' + 'a'.repeat(64), sessionGeneration: 'b'.repeat(32),
    adapterIdentity: { providerKey: 'openai', contractVersion: 'nodia-ai-codex-chat/1', connectionId: '1' } } });
test('a closed fixture descriptor preserves the supplied object and dynamic model', () => { const v = fixture(); assert.equal(validateContenderInput(v), v); });
test('unknown fields cannot enable extra behavior', () => { assert.throws(() => validateContenderInput({ ...fixture(), authorize_generation: true })); });
test('another release or connection cannot escape the package/profile scope', () => {
  const v = fixture(); v.release_root += '-other'; assert.throws(() => validateContenderInput(v));
  const c = fixture(); c.selection.connection_id = '2'; assert.throws(() => validateContenderInput(c));
});
test('a missing model never receives a fallback', () => { const v = fixture(); v.selection.model_id = ''; assert.throws(() => validateContenderInput(v)); });
test('operation and attempt must refer to the same exact owner', () => { const v = fixture(); v.owner_identity.operationRef = '22222222-2222-4222-8222-222222222222'; assert.throws(() => validateContenderInput(v)); });
test('OCR cannot run without an isolated database descriptor', () => { const v = fixture(); v.case = 'ocr'; assert.throws(() => validateContenderInput(v)); });
const databaseFixture = () => ({ schema_version: 1, container_name: 'template_ai40_123_abcdef01',
  options: { type: 'postgres', host: '127.0.0.1', port: 15432, username: 'ai40', password: 'c'.repeat(40), database: 'ai40', synchronize: false,
    entities: ['/opt/nodia/releases/nodia-server-ai40-r07/dist/**/*.entity.js'], migrations: ['/opt/nodia/releases/nodia-server-ai40-r07/dist/migrations/*.js'] },
  identities: [1, 2, 3].map(n => ({ userId: String(n), sessionId: `${n}`.repeat(8) + '-1111-4111-8111-111111111111' })) });
test('logout accepts only an isolated fixture database and cannot target the configured port', () => {
  const v = { ...fixture(), case: 'logout', provided_fixture: databaseFixture() }; assert.equal(validateContenderInput(v), v);
  v.provided_fixture.options.port = 5432; assert.throws(() => validateContenderInput(v));
});
test('blocked login requires a separate parent-pinned request identity', () => {
  const v = { ...fixture(), case: 'login_start', provided_fixture: databaseFixture(), login_request_id: '44444444-4444-4444-8444-444444444444' };
  assert.equal(validateContenderInput(v), v); v.login_request_id = v.owner_identity.attemptId; assert.throws(() => validateContenderInput(v));
});
