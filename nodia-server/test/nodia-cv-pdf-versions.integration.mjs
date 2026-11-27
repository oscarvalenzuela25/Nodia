import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DataSource } from 'typeorm';
import { ApiTextGenerationService } from '../dist/ai-generation/api-text-generation.service.js';
import { AuthGuard } from '../dist/auth/auth.guard.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { AuthTokenService } from '../dist/auth/auth-token.service.js';
import { AuthenticateRequestUseCase } from '../dist/auth/use-case/authenticate-request.use-case.js';
import { ModuleAccessGuard } from '../dist/authorization/module-access.guard.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { SaveNodiaCvVersionAnalysis1794060000000 } from '../dist/migrations/1794060000000-SaveNodiaCvVersionAnalysis.js';
import { ExpandNodiaCvPdfTemplates1794110000000 } from '../dist/migrations/1794110000000-ExpandNodiaCvPdfTemplates.js';
import {
  buildCvDraft,
  prepareCvTailoring,
} from '../dist/nodia-cv/engine/index.js';
import {
  NODIA_CV_HTTP_PATH,
  nodiaCvBodyParser,
} from '../dist/nodia-cv/nodia-cv-body-parser.js';
import { NodiaCvModule } from '../dist/nodia-cv/nodia-cv.module.js';

const url = new URL(process.env.NODIA_CV_TEST_DATABASE_URL ?? 'invalid:');
assert.ok(
  url.protocol === 'postgresql:' &&
    url.hostname === '127.0.0.1' &&
    /^\/nodia_cv_test_[a-z0-9_]+$/.test(url.pathname) &&
    !url.search &&
    !url.hash,
  'Use an empty disposable loopback PostgreSQL database named nodia_cv_test_*.',
);
const dist = fileURLToPath(new URL('../dist/', import.meta.url)).replaceAll(
  '\\',
  '/',
);
const settings = {
  type: 'postgres',
  url: url.href,
  synchronize: false,
  entities: [dist + '**/*.entity.js'],
  migrations: [dist + 'migrations/*.js'],
};
const db = new DataSource(settings);
const owner = '9007199254740921';
const other = '9007199254740922';
const unassigned = '9007199254740923';
const sessions = new Map();
const authorizations = new Map();
const offer = 'Required: C++. Preferred: Kubernetes.';
const vacancy = 'Ingeniería de plataformas';
const github =
  'https://example.invalid/portafolio/candidatura-sintetica/compilacion-portable-y-despliegues';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const normalized = (value) =>
  value.normalize('NFC').replace(/\s+/gu, ' ').trim();
let app;
let base;
let providerCalls = 0;

class IsolatedCacheModule {}
Global()(IsolatedCacheModule);
Module({
  providers: [
    {
      provide: RedisService,
      useValue: {
        get() {
          throw new Error('Unexpected navigation cache read');
        },
        set() {
          throw new Error('Unexpected navigation cache write');
        },
      },
    },
  ],
  exports: [RedisService],
})(IsolatedCacheModule);

async function seedAuthority() {
  const [{ id: group }] = await db.query(
    "INSERT INTO module_groups(key,sort_order) VALUES('cv_pdf_lab',99) RETURNING id",
  );
  const [{ id: module }] = await db.query(
    "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'nodia_cv','/nodia-cv',0) RETURNING id",
    [group],
  );
  for (const id of [owner, other, unassigned]) {
    const sessionId = randomUUID();
    sessions.set(id, sessionId);
    await db.query(
      "INSERT INTO users(id,email,name) VALUES($1,$2,'CV PDF fixture')",
      [id, 'cv-pdf-' + id + '@example.invalid'],
    );
    await db.query(
      "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [sessionId, id, digest(sessionId)],
    );
  }
  await db.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$3,true),($2,$3,true)',
    [owner, other, module],
  );
  return module;
}

async function openHttp() {
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot(settings),
      IsolatedCacheModule,
      NodiaCvModule,
    ],
  })
    .overrideProvider(ApiTextGenerationService)
    .useValue({
      execute() {
        providerCalls += 1;
        throw new Error('PDF and versions must never dispatch IA');
      },
    })
    .compile();
  app = module.createNestApplication({ logger: false, bodyParser: false });
  const reflector = new Reflector();
  const tokens = new AuthTokenService(new JwtService(), {
    secret: randomBytes(48).toString('hex'),
    issuer: 'nodia-cv-pdf-lab',
    accessAudience: 'nodia-cv-pdf-lab:api',
    refreshAudience: 'nodia-cv-pdf-lab:refresh',
    accessSeconds: 900,
  });
  app.setGlobalPrefix('api/v1');
  app.use(NODIA_CV_HTTP_PATH, nodiaCvBodyParser);
  app.useGlobalGuards(
    new AuthGuard(
      reflector,
      new AuthenticateRequestUseCase(new AuthService(db), tokens),
    ),
    new ModuleAccessGuard(reflector, new CheckModuleAccessUseCase(db)),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + NODIA_CV_HTTP_PATH;
  for (const [id, sessionId] of sessions) {
    const user = {
      id,
      name: 'CV PDF fixture',
      email: 'cv-pdf-' + id + '@example.invalid',
      image_url: null,
    };
    const { response } = await tokens.issue(
      user,
      sessionId,
      new Date(Date.now() + 3_600_000),
    );
    authorizations.set(id, 'Bearer ' + response.token);
  }
}

function request(method, path, actor = owner, body) {
  const headers = actor ? { Authorization: authorizations.get(actor) } : {};
  if (body === undefined) return fetch(base + path, { method, headers });
  assert.ok(method === 'POST' || method === 'PUT');
  headers['Content-Type'] = 'application/json';
  return fetch(base + path, {
    method: method === 'PUT' ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function json(response, status, code) {
  const result = await response;
  const body = result.status === 204 ? null : await result.json();
  assert.equal(result.status, status, JSON.stringify(body));
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  if (code) assert.equal(body.message, 'nodiaCv:' + code);
  return body;
}

async function readyDraft(language, multiPage) {
  const experiences = multiPage
    ? Array.from({ length: 8 }, (_, index) => ({
        company: 'Equipo sintético ' + (index + 1),
        position: 'Ingeniería de software',
        status: 'finished',
        start_month: '2021-01',
        end_month: '2022-12',
        highlights: Array.from(
          { length: 4 },
          (_, line) =>
            index +
            1 +
            '.' +
            (line + 1) +
            ' Diseñé documentación y pruebas para compilaciones de C++ y C# en estaciones de trabajo. ' +
            'Revisé configuraciones, registré incidencias y comparé el comportamiento del sistema en un entorno de integración.',
        ),
      }))
    : [
        {
          company: 'Equipo Ñandú',
          position: 'Ingeniería de software',
          status: 'finished',
          start_month: '2023-01',
          end_month: '2024-12',
          highlights: ['Diseñé pruebas de compilación en C++ y C#.'],
        },
      ];
  const profile = await json(
    request('POST', '/profiles', owner, {
      request_key: randomUUID(),
      profile: {
        profile_name: multiPage ? 'Perfil largo QA' : 'Perfil corto QA',
        full_name: 'Inés Ñúñez',
        professional_title: 'Ingeniería de software',
        main_stack: ['C++', 'C#'],
        contact: multiPage
          ? {
              email: 'cv-lab@example.invalid',
              phone: '+56 9 1111 2222',
              github_url: github,
            }
          : { email: 'cv-lab@example.invalid' },
        experiences,
      },
    }),
    201,
  );
  const prepared = prepareCvTailoring({ profile, offer, locale: language });
  const cpp = prepared.evidence.find((fact) => fact.text === 'C++');
  assert.ok(cpp);
  const draft = buildCvDraft(
    prepared,
    JSON.stringify({
      requirements: [
        {
          quote: 'C++',
          kind: 'required',
          relation: 'direct',
          evidenceIds: [cpp.id],
        },
        {
          quote: 'Kubernetes',
          kind: 'preferred',
          relation: 'absent',
          evidenceIds: [],
        },
      ],
      selectedEvidenceIds: prepared.evidence.map((fact) => fact.id),
    }),
  );
  const review = {
    included_fact_ids: draft.selectedFacts.map((fact) => fact.id),
    evidence: [],
  };
  const generationId = randomUUID();
  // Seed only the terminal source used by PDF/history. No provider, queue or credentials.
  await db.query(
    'INSERT INTO nodia_cv_generations(id,owner_user_id,auth_session_public_id,profile_id,profile_revision,request_key,request_hash,' +
      'state,language,purpose_version,prompt_version,profile_snapshot,offer_text,vacancy_title,vacancy_company,selection_snapshot,' +
      'configuration_generation,session_generation,resource_key,scope_hash,draft,review,review_revision,queue_expires_at,expires_at) ' +
      "VALUES($1,$2,$3,$4,$5,$6,$7,'ready',$8,'cv_tailoring','cv-tailoring/1',$9::jsonb,$10,$11,'QA Nodia',$12::jsonb," +
      "'fixture','fixture','fixture',$7,$13::jsonb,$14::jsonb,1,now(),now()+interval '1 hour')",
    [
      generationId,
      owner,
      sessions.get(owner),
      profile.id,
      profile.revision,
      randomUUID(),
      digest(generationId),
      language,
      JSON.stringify(profile),
      offer,
      vacancy,
      JSON.stringify({
        connection_id: '501',
        mode: 'api_key',
        model_id: 'synthetic-unused',
        effort_id: null,
      }),
      JSON.stringify(draft),
      JSON.stringify(review),
    ],
  );
  return { generationId, profile, draft, review, language };
}

const draftPdf = (generationId) => '/drafts/' + generationId + '/pdf';
const prepare = (generationId, template, revision = 1) =>
  json(
    request('POST', draftPdf(generationId), owner, { revision, template }),
    200,
  );
const bodyFor = (artifact, requestKey = randomUUID()) => ({
  request_key: requestKey,
  generation_id: artifact.generation_id,
  revision: artifact.revision,
  artifact_id: artifact.id,
  sha256: artifact.sha256,
});
const versionPath = (version) => '/versions/' + version.id;
const save = (body) => json(request('POST', '/versions', owner, body), 201);

async function readPdf(path, expectedSha) {
  const response = await request('GET', path);
  assert.equal(response.status, 200, 'PDF download failed at ' + path);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(
    response.headers.get('content-type'),
    /^application\/pdf(?:$|;)/i,
  );
  assert.match(
    response.headers.get('content-disposition'),
    /^(?:inline|attachment);\s*filename/i,
  );
  assert.equal(response.headers.get('x-content-sha256'), expectedSha);
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal(digest(buffer), expectedSha);
  return buffer;
}

async function readPdfWithPdfJs(buffer) {
  const task = getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    useWasm: false,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
  });
  try {
    const pdf = await task.promise;
    const text = [];
    const links = [];
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      assert.ok(Math.abs(viewport.width - 595.28) < 0.5);
      assert.ok(Math.abs(viewport.height - 841.89) < 0.5);
      const content = await page.getTextContent();
      text.push(
        content.items
          .filter((item) => 'str' in item)
          .map((item) => item.str)
          .join(' '),
      );
      for (const link of await page.getAnnotations())
        if (link.url) links.push(link.url);
    }
    return {
      pages: pdf.numPages,
      text: normalized(text.join(' ')),
      pageTexts: text.map(normalized),
      links,
    };
  } finally {
    await task.destroy();
  }
}

async function simulateLostSaveReply(body) {
  const expectedInput = JSON.stringify(body);
  const proxy = createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      assert.equal(incoming.method, 'POST');
      assert.equal(incoming.url, '/versions');
      assert.equal(Buffer.concat(chunks).toString('utf8'), expectedInput);
      const response = await request('POST', '/versions', owner, body);
      assert.equal(response.status, 201);
      await response.arrayBuffer(); // The commit completed before the caller's connection was cut.
      outgoing.destroy();
    } catch (error) {
      outgoing.writeHead(500).end(String(error));
    }
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(
      fetch('http://127.0.0.1:' + proxy.address().port + '/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expectedInput,
      }),
      /fetch failed/,
    );
  } finally {
    await new Promise((resolve) => proxy.close(resolve));
  }
}

try {
  await db.initialize();
  const [{ count }] = await db.query(
    "SELECT count(*)::int FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(count, 0, 'The disposable database must begin empty.');
  const migrations = await db.runMigrations({ transaction: 'all' });
  assert.ok(
    migrations.some((migration) => migration.timestamp === 1794000000000),
  );
  assert.ok(
    migrations.some((migration) => migration.timestamp === 1794060000000),
  );
  assert.ok(
    migrations.some((migration) => migration.timestamp === 1794090000000),
  );
  const cvModule = await seedAuthority();
  await openHttp();
  await json(request('GET', '/versions', null), 401);
  await json(request('GET', '/versions', unassigned), 403);
  assert.deepEqual(
    (await json(request('GET', '/versions', other), 200)).items,
    [],
  );
  const es = await readyDraft('es', false);
  const en = await readyDraft('en', true);
  const letterPath = '/drafts/' + es.generationId + '/application-documents/pdf';
  const letter = {
    revision: 1,
    kind: 'recommendation',
    text: 'Antecedente confirmado por la persona postulante.',
  };
  await json(request('POST', letterPath, null, letter), 401);
  await json(request('POST', letterPath, unassigned, letter), 403);
  await json(
    request('POST', letterPath, other, letter),
    404,
    'generation_not_found',
  );
  await json(
    request('POST', letterPath, owner, { ...letter, revision: letter.revision + 1 }),
    409,
    'stale_draft',
  );
  await json(
    request('POST', letterPath, owner, { ...letter, text: 'Línea\n'.repeat(29) }),
    422,
    'pdf_limits',
  );
  for (const kind of ['cover', 'recommendation']) {
    const response = await request('POST', letterPath, owner, { ...letter, kind });
    assert.equal(response.status, 200, response.ok ? undefined : await response.text());
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('content-type'), /^application\/pdf(?:$|;)/i);
    assert.match(response.headers.get('content-disposition'), /^attachment;/i);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(digest(bytes), response.headers.get('x-content-sha256'));
    const document = await readPdfWithPdfJs(bytes);
    assert.equal(document.pages, 1);
    assert.ok(document.text.includes(letter.text));
    assert.equal(document.text.includes('Borrador sin firma.'), kind === 'recommendation');
  }
  const editPath = '/drafts/' + es.generationId + '/ai-edits';
  const editRequest = {
    request_key: randomUUID(),
    revision: 1,
    instructions: 'Pon las competencias primero',
    selection: {
      connection_id: '501',
      mode: 'api_key',
      model_id: 'synthetic-unused',
      effort_id: null,
    },
  };
  await json(request('POST', editPath, null, editRequest), 401);
  await json(request('POST', editPath, unassigned, editRequest), 403);
  await json(
    request('POST', editPath, other, editRequest),
    404,
    'generation_not_found',
  );
  await json(
    request('POST', editPath, owner, { ...editRequest, revision: 2 }),
    409,
    'stale_draft',
  );
  await json(
    request('POST', editPath, owner, {
      ...editRequest,
      instructions: 'á'.repeat(1025),
    }),
    400,
    'generation_invalid_input',
  );
  const pair = await Promise.all([
    prepare(es.generationId, 'classic'),
    prepare(es.generationId, 'classic'),
  ]);
  assert.deepEqual(
    pair[0],
    pair[1],
    'Concurrent preparation must return the exact same artifact',
  );
  const esClassic = pair[0];
  const esCompact = await prepare(es.generationId, 'compact');
  const enClassic = await prepare(en.generationId, 'classic');
  const enCompact = await prepare(en.generationId, 'compact');
  const matrix = [
    esClassic,
    esCompact,
    enClassic,
    enCompact,
    await prepare(es.generationId, 'editorial'),
    await prepare(en.generationId, 'editorial'),
    await prepare(es.generationId, 'contemporary'),
    await prepare(en.generationId, 'contemporary'),
  ];
  const artifacts = new Map();
  for (const artifact of matrix) {
    const source = artifact.language === 'es' ? es : en;
    assert.equal(artifact.generation_id, source.generationId);
    assert.equal(artifact.revision, 1);
    assert.equal(artifact.format, 'a4');
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    assert.match(artifact.renderer, /\/2$/);
    assert.ok(Date.parse(artifact.expires_at) > Date.now());
    const bytes = await readPdf(
      draftPdf(source.generationId) + '/' + artifact.id,
      artifact.sha256,
    );
    artifacts.set(artifact.id, bytes);
    const parsed = await readPdfWithPdfJs(bytes);
    assert.equal(artifact.page_count, parsed.pages);
    // The diagnostic joins wrapped lines by logical field. PDF.js items retain physical wraps.
    assert.equal(
      normalized(artifact.extracted_text).replace(/\s+/gu, ''),
      parsed.text.replace(/\s+/gu, ''),
    );
    assert.ok(
      parsed.pages <= 4 &&
        (source === es ? parsed.pages === 1 : parsed.pages >= 2),
    );
    for (const fact of [
      'Inés Ñúñez',
      'C++',
      'C#',
      'cv-lab@example.invalid',
      'Diseñé',
    ])
      assert.ok(parsed.text.includes(fact), fact);
    const section =
      source === es ? 'Experiencia profesional' : 'Professional experience';
    const index = parsed.text.indexOf(section);
    assert.ok(index > parsed.text.indexOf('cv-lab@example.invalid'));
    const skills = source === es ? 'Competencias' : 'Skills';
    const skillIndex = parsed.text.indexOf(skills);
    assert.ok(skillIndex > index);
    const chronology =
      source === es
        ? ['Equipo Ñandú Ingeniería de software 01/2023 - 12/2024']
        : Array.from(
            { length: 8 },
            (_, job) =>
              `Equipo sintético ${job + 1} Ingeniería de software 01/2021 - 12/2022`,
          );
    for (const ordered of chronology)
      assert.ok(
        parsed.pageTexts.some((page) => page.includes(ordered)),
        ordered,
      );
    assert.doesNotMatch(
      parsed.text,
      /\b(?:Finished|Finalizado)\b|2021-01|2022-12|2023-01|2024-12/,
    );
    assert.match(parsed.text.slice(skillIndex), /C\+\+\s+C#/);
    assert.equal(typeof artifact.missing_contact, 'boolean');
    if (source === en) {
      assert.ok(
        parsed.text.includes('1.1 Diseñé') &&
          parsed.text.includes('8.4 Diseñé'),
      );
      assert.ok(parsed.links.includes(github));
    }
    if (process.env.NODIA_CV_RECORD_PDF_FIXTURES === '1') {
      const output = new URL(
        '../../.tmp/nodia-cv05-lab/pdfs/',
        import.meta.url,
      );
      await mkdir(output, { recursive: true });
      await writeFile(
        new URL(artifact.language + '-' + artifact.template + '.pdf', output),
        bytes,
      );
    }
  }
  assert.notEqual(esClassic.sha256, esCompact.sha256);
  assert.notEqual(enClassic.sha256, enCompact.sha256);
  for (const language of ['es', 'en']) {
    const versions = matrix.filter(
      (artifact) => artifact.language === language,
    );
    assert.equal(new Set(versions.map(({ sha256 }) => sha256)).size, 4);
    assert.equal(
      new Set(versions.map(({ extracted_text }) => extracted_text)).size,
      1,
    );
  }
  await json(
    request('GET', draftPdf(es.generationId) + '/' + esClassic.id, other),
    404,
  );
  await json(
    request('POST', draftPdf(es.generationId), other, {
      revision: 1,
      template: 'classic',
    }),
    404,
  );
  await json(request('POST', '/versions', other, bodyFor(esClassic)), 404);
  await json(
    request('POST', '/versions', owner, {
      ...bodyFor(esClassic),
      sha256: '1'.repeat(64),
    }),
    409,
  );

  const firstInput = bodyFor(esClassic);
  const [first, firstReplay] = await Promise.all([
    save(firstInput),
    save(firstInput),
  ]);
  assert.deepEqual(first, firstReplay);
  const cPlusPlus = es.draft.selectedFacts.find(({ text }) => text === 'C++');
  assert.ok(cPlusPlus);
  assert.deepEqual(first.analysis, {
    requirements: es.draft.requirements,
    facts: [cPlusPlus],
    evidence: [],
  });
  assert.deepEqual(
    await save(bodyFor(esClassic)),
    first,
    'An existing artifact must dedupe across keys',
  );
  await json(
    request(
      'POST',
      '/versions',
      owner,
      bodyFor(esCompact, firstInput.request_key),
    ),
    409,
    'idempotency_conflict',
  );
  const secondInput = bodyFor(esCompact);
  await simulateLostSaveReply(secondInput);
  const second = await save(secondInput);
  assert.equal(second.version_number, first.version_number + 1);
  assert.notEqual(second.id, first.id);
  assert.equal(second.vacancy_title, first.vacancy_title);

  const latest = await json(
    request('PUT', '/drafts/' + es.generationId, owner, {
      revision: 1,
      included_fact_ids: es.review.included_fact_ids.filter(
        (id) => id !== cPlusPlus.id,
      ),
      evidence: [
        {
          requirement_id: 'r2',
          source: 'Laboratorio sintético',
          detail: 'Preparé pruebas de Kubernetes.',
        },
      ],
    }),
    200,
  );
  assert.equal(latest.review.revision, 2);
  await json(
    request('GET', draftPdf(es.generationId) + '/' + esClassic.id),
    404,
    'pdf_not_found',
  );
  await json(
    request('POST', draftPdf(es.generationId), owner, {
      revision: 1,
      template: 'classic',
    }),
    409,
  );
  await json(request('POST', '/versions', owner, bodyFor(esClassic)), 409);
  await json(request('DELETE', versionPath(second)), 204);
  await json(request('GET', versionPath(second) + '/pdf'), 404);
  await json(
    request('POST', '/versions', owner, secondInput),
    404,
    'version_not_found',
  );
  const revised = await prepare(es.generationId, 'classic', 2);
  assert.match(revised.extracted_text, /Preparé pruebas de Kubernetes\./);
  artifacts.set(
    revised.id,
    await readPdf(draftPdf(es.generationId) + '/' + revised.id, revised.sha256),
  );
  const third = await save(bodyFor(revised));
  assert.equal(third.version_number, second.version_number + 1);
  assert.equal(third.vacancy_title, first.vacancy_title);
  assert.deepEqual(third.analysis, {
    ...first.analysis,
    evidence: latest.review.evidence,
  });
  const enInput = bodyFor(enClassic);
  const retainedEn = await save(enInput);

  await db.query(
    "UPDATE nodia_cv_generations SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [en.generationId],
  );

  // Rehearse upgrading existing versions in an isolated transaction.
  const migration = new SaveNodiaCvVersionAnalysis1794060000000();
  const upgrade = db.createQueryRunner();
  await upgrade.connect();
  await upgrade.startTransaction();
  try {
    await upgrade.query('UPDATE nodia_cv_versions SET analysis=NULL');
    await migration.down(upgrade);
    await migration.up(upgrade);
    const restored = await upgrade.query(
      'SELECT id,analysis FROM nodia_cv_versions WHERE owner_user_id=$1 ORDER BY version_number',
      [owner],
    );
    assert.deepEqual(restored, [
      { id: first.id, analysis: null },
      { id: third.id, analysis: third.analysis },
      { id: retainedEn.id, analysis: null },
    ]);
  } finally {
    await upgrade.rollbackTransaction();
    await upgrade.release();
  }

  await json(
    request('GET', draftPdf(en.generationId) + '/' + enCompact.id),
    410,
  );
  await json(
    request('POST', draftPdf(en.generationId), owner, {
      revision: 1,
      template: 'compact',
    }),
    410,
  );
  await json(request('POST', '/versions', owner, bodyFor(enCompact)), 410);
  assert.deepEqual(await save(enInput), retainedEn);

  for (const { profile } of [es, en])
    await json(
      request(
        'DELETE',
        '/profiles/' + profile.id + '?revision=' + profile.revision,
      ),
      204,
    );
  assert.deepEqual((await json(request('GET', '/profiles'), 200)).items, []);
  assert.deepEqual(await save(firstInput), first);
  assert.deepEqual(await save(enInput), retainedEn);
  for (const [version, artifact] of [
    [first, esClassic],
    [third, revised],
    [retainedEn, enClassic],
  ]) {
    const detail = await json(request('GET', versionPath(version)), 200);
    assert.deepEqual(detail, version);
    assert.equal(detail.extracted_text, artifact.extracted_text);
    assert.deepEqual(detail.missing_contact, artifact.missing_contact);
    assert.deepEqual(
      await readPdf(versionPath(version) + '/pdf', artifact.sha256),
      artifacts.get(artifact.id),
    );
  }
  await db.query('UPDATE nodia_cv_versions SET analysis=NULL WHERE id=$1', [
    retainedEn.id,
  ]);
  assert.deepEqual(await json(request('GET', versionPath(retainedEn)), 200), {
    ...retainedEn,
    analysis: null,
  });
  assert.deepEqual(
    await readPdf(versionPath(retainedEn) + '/pdf', enClassic.sha256),
    artifacts.get(enClassic.id),
  );

  const pageOne = await json(request('GET', '/versions?page=1&limit=2'), 200);
  const pageTwo = await json(request('GET', '/versions?page=2&limit=2'), 200);
  assert.deepEqual(Object.keys(pageOne).sort(), [
    'items',
    'limit',
    'page',
    'total',
  ]);
  assert.deepEqual(
    [
      pageOne.page,
      pageTwo.page,
      pageOne.limit,
      pageTwo.limit,
      pageOne.total,
      pageTwo.total,
    ],
    [1, 2, 2, 2, 3, 3],
  );
  const published = [...pageOne.items, ...pageTwo.items];
  for (const item of published) {
    assert.ok(item.created_at.endsWith('Z'));
    assert.ok(Number.isFinite(Date.parse(item.created_at)));
  }
  assert.deepEqual(
    published.map((item) => item.id).sort(),
    [first.id, third.id, retainedEn.id].sort(),
  );
  for (const item of published)
    assert.deepEqual(Object.keys(item).sort(), [
      'created_at',
      'id',
      'language',
      'profile_name',
      'template',
      'vacancy_company',
      'vacancy_title',
      'version_number',
    ]);
  assert.deepEqual(
    (await json(request('GET', '/versions', other), 200)).items,
    [],
  );
  for (const path of [versionPath(first), versionPath(first) + '/pdf']) {
    await json(request('GET', path, other), 404);
    await json(request('GET', path, unassigned), 403);
  }
  await json(request('DELETE', versionPath(first), other), 404);

  // Open a copy after its original temporary generation and profile were removed.
  const copyPath = versionPath(first) + '/draft-copy';
  const copyInput = { request_key: randomUUID() };
  for (const [actor, status] of [
    [null, 401],
    [unassigned, 403],
    [other, 404],
  ])
    await json(request('POST', copyPath, actor, copyInput), status);
  const [copy, replay] = await Promise.all([
    json(request('POST', copyPath, owner, copyInput), 200),
    json(request('POST', copyPath, owner, copyInput), 200),
  ]);
  assert.deepEqual(copy, replay);
  assert.equal(copy.state, 'ready');
  assert.equal(copy.selection, null);
  assert.equal(copy.profile_id, es.profile.id);
  assert.equal(copy.recovery.offer_text, '');
  assert.deepEqual(copy.source_version, {
    id: first.id,
    template: first.template,
  });
  assert.deepEqual(copy.draft.requirements, first.analysis.requirements);
  await json(
    request('POST', versionPath(third) + '/draft-copy', owner, copyInput),
    409,
  );

  await db.query('UPDATE nodia_cv_versions SET analysis=NULL WHERE id=$1', [
    third.id,
  ]);
  const legacy = await json(
    request('POST', versionPath(third) + '/draft-copy', owner, {
      request_key: randomUUID(),
    }),
    200,
  );
  assert.deepEqual(legacy.draft.requirements, []);
  assert.ok(third.analysis.evidence.length > 0);
  assert.deepEqual(legacy.review.evidence, third.analysis.evidence);
  for (const [draft, original, artifact] of [
    [copy, first, esClassic],
    [legacy, { ...third, analysis: null }, revised],
  ]) {
    const pdf = await json(
      request('POST', draftPdf(draft.id), owner, {
        revision: draft.review.revision,
        template: original.template,
      }),
      200,
    );
    assert.equal(pdf.extracted_text, original.extracted_text);
    assert.deepEqual(
      await json(request('GET', versionPath(original)), 200),
      original,
    );
    assert.deepEqual(
      await readPdf(versionPath(original) + '/pdf', original.sha256),
      artifacts.get(artifact.id),
    );
    if (draft === legacy) {
      const resaved = await save(bodyFor(pdf));
      assert.deepEqual(resaved.analysis, {
        requirements: [],
        facts: [],
        evidence: [],
      });
      const [row] = await db.query(
        "SELECT snapshot->'evidence' AS evidence FROM nodia_cv_versions WHERE id=$1",
        [resaved.id],
      );
      assert.deepEqual(row.evidence, legacy.review.evidence);
    }
  }

  for (const template of ['editorial', 'contemporary']) {
    const artifact = await prepare(copy.id, template, copy.review.revision);
    const verified = await readPdf(
      draftPdf(copy.id) + '/' + artifact.id,
      artifact.sha256,
    );
    const version = await save(bodyFor(artifact));
    assert.equal(version.template, template);
    assert.equal(version.extracted_text, first.extracted_text);
    assert.deepEqual(
      await json(request('GET', versionPath(version)), 200),
      version,
    );
    assert.deepEqual(
      await readPdf(versionPath(version) + '/pdf', artifact.sha256),
      verified,
    );
    const reopened = await json(
      request('POST', versionPath(version) + '/draft-copy', owner, {
        request_key: randomUUID(),
      }),
      200,
    );
    assert.deepEqual(reopened.source_version, { id: version.id, template });
    assert.equal(reopened.state, 'ready');
  }
  assert.deepEqual(
    await readPdf(versionPath(first) + '/pdf', first.sha256),
    artifacts.get(esClassic.id),
  );

  const technologyReview = {
    included: ['Dagger'],
    additions: [
      { name: 'Dagger', status: 'confirmed', source: 'Portal de pruebas', detail: 'Configuré un pipeline de pruebas.' },
      { name: 'Flux CD', status: 'study' },
    ],
  };
  const withTechnologies = await json(request('PUT', '/drafts/' + copy.id, owner, {
    revision: copy.review.revision,
    included_fact_ids: copy.review.included_fact_ids,
    evidence: copy.review.evidence,
    technologies: technologyReview,
  }), 200);
  assert.deepEqual(withTechnologies.review.technologies, technologyReview);
  const withOrdinaryReview = await json(request('PUT', '/drafts/' + copy.id, owner, {
    revision: withTechnologies.review.revision,
    included_fact_ids: withTechnologies.review.included_fact_ids,
    evidence: withTechnologies.review.evidence,
  }), 200);
  assert.deepEqual(withOrdinaryReview.review.technologies, technologyReview);
  const technologyArtifact = await prepare(copy.id, 'editorial', withOrdinaryReview.review.revision);
  assert.match(technologyArtifact.extracted_text, /Tecnologías\s+Dagger/);
  assert.match(technologyArtifact.extracted_text, /Configuré un pipeline de pruebas\./);
  assert.doesNotMatch(technologyArtifact.extracted_text, /Flux CD/);
  const technologyVersion = await save(bodyFor(technologyArtifact));
  const technologyCopy = await json(request(
    'POST', versionPath(technologyVersion) + '/draft-copy', owner, { request_key: randomUUID() },
  ), 200);
  assert.deepEqual(technologyCopy.review.technologies, technologyReview);

  const rollbackTemplates = db.createQueryRunner();
  await rollbackTemplates.connect();
  await rollbackTemplates.startTransaction();
  try {
    await assert.rejects(
      new ExpandNodiaCvPdfTemplates1794110000000().down(rollbackTemplates),
      /Preserve Nodia CV versions and drafts using new templates before reverting/,
    );
  } finally {
    await rollbackTemplates.rollbackTransaction();
    await rollbackTemplates.release();
  }

  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
    [owner, cvModule],
  );
  await json(request('GET', versionPath(first) + '/pdf'), 403);
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=$1 AND module_id=$2',
    [owner, cvModule],
  );
  await db.query(
    'UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1',
    [sessions.get(owner)],
  );
  await json(request('GET', versionPath(first) + '/pdf'), 401);
  assert.equal(providerCalls, 0);
  const [{ ledger }] = await db.query(
    "SELECT count(*)::int AS ledger FROM ai_generation_operations WHERE owner_kind='cv'",
  );
  assert.equal(ledger, 0);
  console.log(
    JSON.stringify({
      suite: 'Nodia CV PDF and versions integration',
      migrations: migrations.length,
      variants: matrix.map(({ language, template, page_count, sha256 }) => ({
        language,
        template,
        page_count,
        sha256,
      })),
      verifiedVersions: [
        first.version_number,
        second.version_number,
        third.version_number,
      ],
      providerCalls,
    }),
  );
} finally {
  if (app) await app.close();
  if (db.isInitialized) await db.destroy();
}
