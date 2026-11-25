import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import type { AiSelection } from '../../ai-generation/ai-selection.js';
import {
  agenticHash,
  agenticHex,
  agenticTextHash,
} from '../../ai-generation/agentic-text-contract.js';
import { CODEX_TEACHER_SOURCE_COMMIT } from '../../ai-generation/codex-teacher-text-transport.js';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';

const CATALOG_VERSION = '0.171.0';
const HOST_POLICY =
  'cv-tailoring/1;tool-policy=empty;isolation=isolated;environments=empty;dynamic-tools=empty;attachments=empty;extensions=response-firewall;one-turn;retries=0;prompt=131072;result=32768;catalog=verified-codex-cli-0.171.0-exact';
const MAX_CATALOG_BYTES = 1024 * 1024;
const MAX_MODEL_BYTES = 96_000;
const run = promisify(execFile);
const require = createRequire(import.meta.url);

export const CODEX_CV_HOST_CAPABILITIES = Object.freeze({
  protocol: 'nodia-cv-codex-host/1',
  purpose: 'cv-tailoring/1',
  source_commit: CODEX_TEACHER_SOURCE_COMMIT,
  policy_hash: agenticTextHash(HOST_POLICY),
  compiled_native: true,
  provider_id: 'nodia_codex',
  tools: [],
  attachments: [],
  maximum_prompt_utf8_bytes: 131_072,
  maximum_result_utf8_bytes: 32_768,
  maximum_request_frame_bytes: 800_000,
  maximum_terminal_frame_bytes: 262_144,
  retries: 0,
  qualification: 'required_per_selection_and_epoch',
});

export interface CodexCvHostMetadata {
  path: string;
  sha512: string;
  runtimeHash: string;
  capabilities: typeof CODEX_CV_HOST_CAPABILITIES;
  modelMetadata: string;
}

type HostSelection = Pick<AiSelection, 'model_id' | 'effort_id'>;

export class CodexCvHostSelectionError extends Error {
  constructor(
    readonly reason:
      | 'codex_model_unavailable'
      | 'codex_effort_unavailable'
      | 'codex_model_incompatible',
  ) {
    super(reason);
  }
}

const hostError = () => Error('cv:codex_host_unverified');

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Bundled ModelInfo is compatibility input. Live account observation must authorize the same selection. */
export function selectCvCodexModelMetadata(
  catalog: unknown,
  selection: HostSelection,
): string {
  const models = object(catalog)?.models;
  if (
    !Array.isArray(models) ||
    models.length > 1000 ||
    models.some((model) => typeof object(model)?.slug !== 'string')
  )
    throw hostError();
  const matches = models.filter(
    (model) => object(model)?.slug === selection.model_id,
  );
  if (matches.length > 1) throw hostError();
  if (!matches.length)
    throw new CodexCvHostSelectionError('codex_model_unavailable');
  const model = object(matches[0]);
  if (!model) throw hostError();
  const levels = model.supported_reasoning_levels;
  if (
    !Array.isArray(levels) ||
    levels.length > 24 ||
    levels.some((level) => typeof object(level)?.effort !== 'string')
  )
    throw hostError();
  if (
    selection.effort_id !== null &&
    !levels.some((level) => object(level)?.effort === selection.effort_id)
  )
    throw new CodexCvHostSelectionError('codex_effort_unavailable');
  const metadata = JSON.stringify(model);
  if (Buffer.byteLength(metadata) > MAX_MODEL_BYTES) throw hostError();
  return metadata;
}

async function verifyExecutable(
  path: string,
  expected: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (!isAbsolute(path) || (await realpath(path)) !== path) throw hostError();
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const digest = createHash('sha512');
  try {
    const before = await handle.stat();
    if (
      !before.isFile() ||
      ![0, process.getuid?.()].includes(before.uid) ||
      (before.mode & 0o022) !== 0 ||
      (before.mode & 0o111) === 0
    )
      throw hostError();
    const stream = handle.createReadStream({ autoClose: false });
    for await (const chunk of stream) {
      signal.throwIfAborted();
      digest.update(chunk);
    }
    const after = await handle.stat();
    const current = await lstat(path);
    if (
      before.ino !== after.ino ||
      before.dev !== after.dev ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      current.isSymbolicLink() ||
      current.ino !== after.ino ||
      current.dev !== after.dev ||
      current.mtimeMs !== after.mtimeMs ||
      current.ctimeMs !== after.ctimeMs ||
      digest.digest('hex') !== expected
    )
      throw hostError();
  } finally {
    await handle.close();
  }
}

export async function codexCvHostMetadata(
  signal: AbortSignal,
  selection: HostSelection,
): Promise<CodexCvHostMetadata> {
  signal.throwIfAborted();
  const {
    NODIA_CODEX_CV_HOST: path,
    NODIA_CODEX_CV_HOST_SHA512: hostHash,
    NODIA_CODEX_CV_CATALOG_SHA512: cliHash,
  } = process.env;
  if (
    process.platform !== 'linux' ||
    process.arch !== 'x64' ||
    !path ||
    !agenticHex(hostHash, 128) ||
    !agenticHex(cliHash, 128)
  )
    throw hostError();

  const manifestPath = require.resolve('@openai/codex-linux-x64/package.json');
  const cli = join(
    dirname(manifestPath),
    'vendor/x86_64-unknown-linux-musl/bin/codex',
  );
  await Promise.all([
    verifyExecutable(path, hostHash, signal),
    verifyExecutable(cli, cliHash, signal),
  ]);
  const options = {
    encoding: 'utf8' as const,
    cwd: '/',
    env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
    timeout: 5000,
    maxBuffer: 16_384,
    signal,
  };
  const [caps, version] = await Promise.all([
    run(path, ['--capabilities'], options),
    run(cli, ['--version'], options),
  ]);
  if (
    version.stdout.trim() !== `codex-cli ${CATALOG_VERSION}` ||
    agenticHash(parseNodiaAiStrictJson(caps.stdout)) !==
      agenticHash(CODEX_CV_HOST_CAPABILITIES)
  )
    throw hostError();
  const bundled = await run(cli, ['debug', 'models', '--bundled'], {
    ...options,
    maxBuffer: MAX_CATALOG_BYTES,
  });
  const modelMetadata = selectCvCodexModelMetadata(
    parseNodiaAiStrictJson(bundled.stdout),
    selection,
  );
  // Validate exactly what the older SDK will consume, with no connection or prompt.
  try {
    const checked = await run(
      path,
      [
        '--check-model',
        selection.model_id,
        JSON.stringify(selection.effort_id),
        '--model-metadata-json',
        modelMetadata,
      ],
      options,
    );
    if (
      agenticHash(parseNodiaAiStrictJson(checked.stdout)) !==
      agenticHash({
        model_id: selection.model_id,
        effort_id: selection.effort_id,
      })
    )
      throw hostError();
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof Error && 'code' in error && error.code === 1)
      throw new CodexCvHostSelectionError('codex_model_incompatible');
    throw hostError();
  }
  return {
    path,
    sha512: hostHash,
    capabilities: CODEX_CV_HOST_CAPABILITIES,
    modelMetadata,
    runtimeHash: agenticHash({
      host: hostHash,
      source_cli: cliHash,
      source_cli_version: CATALOG_VERSION,
      capabilities: CODEX_CV_HOST_CAPABILITIES,
      model_metadata_sha256: agenticTextHash(modelMetadata),
    }),
  };
}
