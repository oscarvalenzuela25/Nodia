// Non-generative diagnosis of the actual Codex observation port in the invoking OS context.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'dotenv';
assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes');
const config = parse(fs.readFileSync(process.env.NODIA_AI_LAB_API_ENV));
const selection = JSON.parse(fs.readFileSync(process.env.NODIA_AI_LAB_SELECTION_JSON, 'utf8'));
const rows = selection.rows.filter((row) => row.provider_key === 'openai' && row.is_active);
assert.equal(rows.length, 1, 'One exact observed configured Codex identity is required');
for (const name of ['NODIA_CODEX_ENABLED', 'NODIA_CODEX_PROFILE_ROOT']) if (config[name] !== undefined) process.env[name] = config[name];
process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
const { CodexRuntimeService } = await import('../dist/common/ai/codex/codex-runtime.service.js');
const runtime = new CodexRuntimeService();
const safeResult = (result) => ({ available: result.available, authenticated: result.authenticated, checked_at: result.checkedAt, reason: result.reason, quotas_observed: result.quotas !== null });
const result = { context_uid: process.getuid?.() ?? null, runtime_enabled_in_environment: process.env.NODIA_CODEX_ENABLED === 'true', profile_root_configured: Boolean(process.env.NODIA_CODEX_PROFILE_ROOT), provider_inferences: 0, account_login_or_logout_requested: false };
try {
  const started = performance.now();
  try { result.with_signal = { kind: 'status', ...safeResult(await runtime.observe(String(rows[0].connection_id), AbortSignal.timeout(15000))) }; }
  catch (error) {
    const code = error?.getResponse?.()?.code;
    result.with_signal = { kind: 'error', code: typeof code === 'string' && /^[a-z_]{1,128}$/.test(code) ? code : 'unclassified' };
  }
  result.with_signal.elapsed_ms = Math.round(performance.now() - started);
  result.without_signal = { kind: 'status', ...safeResult(await runtime.observe(String(rows[0].connection_id))) };
  if (process.env.NODIA_AI_LAB_REPORT_JSON) fs.writeFileSync(process.env.NODIA_AI_LAB_REPORT_JSON, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await runtime.onModuleDestroy(); }
