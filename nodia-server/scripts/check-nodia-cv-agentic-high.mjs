import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const providers = ['openai', 'gemini'];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const code = /^(?:nodiaCv:)?[a-z_]{1,64}$/;
const connectionId = /^[1-9][0-9]{0,18}$/;
const ongoing = ['queued', 'running'];
const usage = `Check CV Agentic High over the ordinary Nodia CV API.
Set NODIA_CV_QA_ACCESS_TOKEN to an authorized Nodia access token.
  --api <origin> [--connections <id,id>]   List catalog candidates, without mutations.
  --api <origin> --connections <id,id> --run --offer <text-file> --max-generations <n>
    Create a synthetic QA profile and run each candidate at most once. JSONL contains no CV or offer text.
    Optional: --language <es|en> (default es). The QA profile can be reused for review.`;

function emit(row) {
  process.stdout.write(`${JSON.stringify(row)}\n`);
}

function localOrSecureOrigin(value) {
  const origin = URL.parse(value ?? '');
  if (
    !origin ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/'
  )
    throw Error('invalid_api_origin');
  if (origin.protocol === 'https:') return origin.origin;
  if (
    origin.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  )
    return origin.origin;
  throw Error('invalid_api_origin');
}

function api(origin, token) {
  return async (route, body) => {
    const response = await fetch(`${origin}/api/v1/nodia-cv/${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(55_000),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      const error = Error(
        code.test(value?.message ?? '') ? value.message : 'request_failed',
      );
      error.status = response.status;
      throw error;
    }
    if (!value || typeof value !== 'object')
      throw Error('invalid_http_response');
    return value;
  };
}

async function candidates(request, connectionIds) {
  const result = new Map();
  const cursors = new Set();
  let cursor = null;
  do {
    const page = await request(
      `ai-selection/catalog${cursor ? `?after=${cursor}` : ''}`,
    );
    if (!Array.isArray(page.items)) throw Error('invalid_catalog_response');
    for (const item of page.items) {
      if (
        !item.is_active ||
        !providers.includes(item.provider_key) ||
        !connectionId.test(item.connection_id) ||
        (connectionIds.size && !connectionIds.has(item.connection_id))
      )
        continue;
      const mode = item.modes?.find((value) => value.mode === 'agentic');
      if (
        !mode ||
        mode.configuration === 'disabled' ||
        mode.cv_transport !== 'available'
      )
        continue;
      for (const model of mode.models) {
        if (!model.efforts.some((effort) => effort.effort_id === 'high'))
          continue;
        const selection = {
          connection_id: item.connection_id,
          mode: 'agentic',
          model_id: model.model_id,
          effort_id: 'high',
        };
        result.set(JSON.stringify(selection), {
          provider: item.provider_key,
          selection,
        });
      }
    }
    cursor = page.next_cursor;
    if (cursor !== null && (!connectionId.test(cursor) || cursors.has(cursor)))
      throw Error('invalid_catalog_cursor');
    cursors.add(cursor);
  } while (cursor !== null);
  return [...result.values()];
}

function sameSelection(actual, expected) {
  return Object.entries(expected).every(
    ([key, value]) => actual?.[key] === value,
  );
}

function summarize(error) {
  return {
    error_code: code.test(error?.message ?? '')
      ? error.message
      : 'transport_error',
    ...(error?.status && { http_status: error.status }),
  };
}

async function waitForGeneration(request, generation, key) {
  const until = Date.now() + 720_000;
  for (;;) {
    if (generation && !uuid.test(generation.id))
      throw Error('invalid_generation_reference');
    if (generation && !ongoing.includes(generation.state)) return generation;
    if (Date.now() >= until) throw Error('status_timeout');
    await delay(2_500);
    try {
      const route = generation?.id
        ? `generations/${generation.id}`
        : `generations/requests/${key}`;
      generation = await request(route);
    } catch (error) {
      if (
        error.status >= 400 &&
        error.status < 500 &&
        (generation || error.status !== 404)
      )
        throw error;
    }
  }
}

async function verifyOne(request, candidate, input) {
  const { selection } = candidate;
  const check = await request(
    `ai-selection/eligibility?${new URLSearchParams(selection)}`,
  );
  if (!sameSelection(check.selection, selection))
    throw Error('eligibility_selection_mismatch');
  if (!check.eligible)
    return { state: 'ineligible', reason_code: check.reason_code };

  const request_key = randomUUID();
  emit({ phase: 'dispatch', ...candidate, request_key });
  let generation = null;
  try {
    generation = await request('generations', {
      ...input,
      selection,
      request_key,
    });
  } catch (error) {
    if (error.status >= 400 && error.status < 500)
      return { state: 'admission_rejected', request_key, ...summarize(error) };
    // Recover an ambiguous HTTP start by request key using GET only.
    emit({
      phase: 'reconcile',
      ...candidate,
      request_key,
      ...summarize(error),
    });
  }

  try {
    generation = await waitForGeneration(request, generation, request_key);
  } catch (error) {
    return { state: 'status_unresolved', request_key, ...summarize(error) };
  }
  if (
    !uuid.test(generation.id) ||
    !sameSelection(generation.selection, selection) ||
    generation.profile_id !== input.profile_id ||
    generation.profile_revision !== input.profile_revision
  )
    throw Error('generation_identity_mismatch');

  const evidence = {
    generation_id: generation.id,
    request_key,
    state: generation.state,
  };
  if (generation.state !== 'ready')
    return {
      ...evidence,
      error_code: code.test(generation.error_code ?? '')
        ? generation.error_code
        : null,
    };
  if (
    !Number.isSafeInteger(generation.review?.revision) ||
    generation.review.revision < 1 ||
    !Array.isArray(generation.draft?.requirements) ||
    !Array.isArray(generation.draft?.selectedFacts)
  )
    throw Error('invalid_ready_generation');
  return {
    ...evidence,
    requirements: generation.draft.requirements.length,
    selected_facts: generation.draft.selectedFacts.length,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      api: { type: 'string' },
      connections: { type: 'string' },
      run: { type: 'boolean' },
      offer: { type: 'string' },
      'max-generations': { type: 'string' },
      language: { type: 'string', default: 'es' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    process.stdout.write(`${usage}\n`);
    return;
  }
  const origin = localOrSecureOrigin(values.api);
  const token = process.env.NODIA_CV_QA_ACCESS_TOKEN;
  if (!token || !/^[A-Za-z0-9_.-]+$/.test(token))
    throw Error('access_token_required');
  const connectionIds = new Set(values.connections?.split(',') ?? []);
  if ([...connectionIds].some((id) => !connectionId.test(id)))
    throw Error('invalid_connection_id');
  const max = Number(values['max-generations']);
  if (
    values.run &&
    (!connectionIds.size ||
      !values.offer ||
      !Number.isSafeInteger(max) ||
      max < 1 ||
      !['es', 'en'].includes(values.language))
  )
    throw Error('invalid_run_arguments');

  const request = api(origin, token);
  const matrix = await candidates(request, connectionIds);
  for (const candidate of matrix) emit({ phase: 'candidate', ...candidate });
  if (!values.run) return;
  if (
    matrix.length > max ||
    !providers.every((provider) =>
      matrix.some((candidate) => candidate.provider === provider),
    )
  )
    throw Error('matrix_budget_or_providers_incomplete');

  const offer_text = (await readFile(values.offer, 'utf8')).trim();
  const offerBytes = Buffer.byteLength(offer_text);
  if (!offerBytes || offerBytes > 24 * 1024) throw Error('invalid_offer_size');
  const request_key = randomUUID();
  const profile = {
    profile_name: `CV QA High ${request_key.slice(0, 8)}`,
    full_name: 'Camila Torres QA',
    professional_title: 'Full Stack Developer',
    contact: { email: 'qa-candidate@example.invalid' },
    main_stack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    experiences: [
      {
        company: 'Example QA Systems',
        position: 'Full Stack Developer',
        status: 'finished',
        start_month: '2022-07',
        end_month: '2025-11',
        highlights: [
          'Built internal platforms and third-party API integrations.',
          'Designed, tested and deployed web applications.',
        ],
        technologies: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      },
    ],
  };
  emit({
    phase: 'profile_create',
    request_key,
    offer_sha256: createHash('sha256').update(offer_text).digest('hex'),
    offer_bytes: offerBytes,
  });
  const saved = await request('profiles', { request_key, profile });
  if (
    !uuid.test(saved.id) ||
    saved.revision !== 1 ||
    saved.full_name !== profile.full_name ||
    saved.profile_name !== profile.profile_name
  )
    throw Error('synthetic_profile_identity_mismatch');
  const input = {
    profile_id: saved.id,
    profile_revision: saved.revision,
    language: values.language,
    offer_text,
  };
  emit({
    phase: 'profile_ready',
    profile_id: saved.id,
    profile_revision: saved.revision,
  });

  for (const candidate of matrix) {
    const result = await verifyOne(request, candidate, input).catch(
      (error) => ({ state: 'check_failed', ...summarize(error) }),
    );
    emit({ phase: 'result', ...candidate, ...result });
    if (result.state !== 'ready') process.exitCode = 1;
    if (result.state === 'status_unresolved') return;
  }
}

await main().catch((error) => {
  emit({ phase: 'error', ...summarize(error) });
  process.exitCode = 1;
});
