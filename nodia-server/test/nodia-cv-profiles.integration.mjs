import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthGuard } from '../dist/auth/auth.guard.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { AuthTokenService } from '../dist/auth/auth-token.service.js';
import { AuthenticateRequestUseCase } from '../dist/auth/use-case/authenticate-request.use-case.js';
import { ModuleAccessGuard } from '../dist/authorization/module-access.guard.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import {
  NODIA_CV_HTTP_PATH,
  nodiaCvBodyParser,
} from '../dist/nodia-cv/nodia-cv-body-parser.js';
import { CreateNodiaCvGenerations1793970000000 } from '../dist/migrations/1793970000000-CreateNodiaCvGenerations.js';
import { AttachNodiaCvGenerationLedger1793980000000 } from '../dist/migrations/1793980000000-AttachNodiaCvGenerationLedger.js';
import { AddNodiaCvDraftReviews1793990000000 } from '../dist/migrations/1793990000000-AddNodiaCvDraftReviews.js';
import { NodiaCvGenerationStore } from '../dist/nodia-cv/nodia-cv-generation.store.js';
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

const profileMigrationTimestamp = '1793960000000';
const migrationsDirectory = new URL('../dist/migrations/', import.meta.url);
const profileMigrations = (await readdir(migrationsDirectory))
  .filter(
    (name) =>
      /^[0-9]{13}-.+\.js$/.test(name) &&
      name.slice(0, 13) <= profileMigrationTimestamp,
  )
  .map((name) => fileURLToPath(new URL(name, migrationsDirectory)));

const settings = {
  type: 'postgres',
  url: url.href,
  synchronize: false,
  entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))],
  migrations: profileMigrations,
};
const db = new DataSource(settings);
const profilePath = '/api/v1/nodia-cv/profiles';
const cvMigration = 'CreateNodiaCvProfiles1793960000000';
const role = {
  owner: '9007199254740993',
  other: '9007199254740994',
  wrongRoute: '9007199254740995',
  admin: '9007199254740996',
};
const profile = {
  profile_name: 'CV Backend sintético',
  full_name: 'Persona de prueba',
  contact: { email: 'candidate@example.invalid' },
  experiences: [
    {
      company: 'Equipo de prueba',
      position: 'Desarrollo',
      start_month: '2024-02',
      end_month: '2025-08',
      status: 'finished',
    },
  ],
};

async function tableExists(name) {
  const [row] = await db.query('SELECT to_regclass($1) IS NOT NULL AS found', [
    name,
  ]);
  return row.found;
}

async function verifyNoAssignment() {
  const [row] = await db.query(
    "SELECT count(*)::int AS count FROM modules WHERE key='nodia_cv' OR link='/nodia-cv'",
  );
  assert.equal(row.count, 0);
}

function expectStatus(response, status) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  return response.body;
}

// Authorization navigation context is outside this HTTP slice. Access must use SQL.
class IsolatedNavigationCacheModule {}
Global()(IsolatedNavigationCacheModule);
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
})(IsolatedNavigationCacheModule);

async function openHttp(sessions) {
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot(settings),
      IsolatedNavigationCacheModule,
      NodiaCvModule,
    ],
  }).compile();
  const app = module.createNestApplication({
    logger: false,
    bodyParser: false,
  });
  try {
    app.setGlobalPrefix('api/v1');
    app.use(NODIA_CV_HTTP_PATH, nodiaCvBodyParser);
    const tokens = new AuthTokenService(new JwtService(), {
      secret: randomBytes(48).toString('hex'),
      issuer: 'nodia-cv-lab',
      accessAudience: 'nodia-cv-lab:api',
      refreshAudience: 'nodia-cv-lab:refresh',
      accessSeconds: 900,
    });
    const reflector = new Reflector();
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

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Nodia CV integration').build(),
    );
    const paths = document.paths;
    assert.ok(paths[profilePath]?.post && paths[profilePath]?.get);
    const detail = paths[`${profilePath}/{id}`];
    assert.ok(detail?.get && detail?.put && detail?.delete);
    assert.ok(paths[`${NODIA_CV_HTTP_PATH}/drafts/{id}`]?.put);

    const authHeaders = new Map();
    for (const [id, session] of sessions) {
      const data = await tokens.issue(
        {
          id,
          name: 'Persona de prueba',
          email: `cv-${id}@example.invalid`,
          image_url: null,
        },
        session,
        new Date(Date.now() + 3_600_000),
      );
      authHeaders.set(id, `Bearer ${data.response.token}`);
    }

    const base = await app.getUrl();
    async function request(
      method,
      suffix = '',
      user,
      body,
      path = profilePath,
    ) {
      const options = {
        method,
        headers: user ? { Authorization: authHeaders.get(user) } : {},
      };
      if (body !== undefined) {
        assert.ok(method === 'POST' || method === 'PUT');
        options.headers['Content-Type'] = 'application/json';
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      const response = await fetch(`${base}${path}${suffix}`, options);
      return {
        status: response.status,
        body: response.status === 204 ? null : await response.json(),
        headers: response.headers,
      };
    }

    return { app, request };
  } catch (error) {
    await app.close();
    throw error;
  }
}

let app;
try {
  await db.initialize();
  const [{ count }] = await db.query(
    "SELECT count(*)::int FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(count, 0, 'The disposable database must begin empty.');

  const installed = await db.runMigrations({ transaction: 'all' });
  assert.equal(installed.at(-1)?.name, cvMigration);
  assert.ok(await tableExists('nodia_cv_profiles'));
  assert.ok(await tableExists('nodia_cv_profile_create_receipts'));
  await verifyNoAssignment();
  await db.undoLastMigration({ transaction: 'all' });
  assert.equal(await tableExists('nodia_cv_profiles'), false);
  assert.equal(await tableExists('nodia_cv_profile_create_receipts'), false);

  const sessions = new Map();
  for (const id of Object.values(role)) {
    const sid = randomUUID();
    sessions.set(id, sid);
    await db.query(
      "INSERT INTO users(id,email,name) VALUES ($1,$2,'Persona de prueba')",
      [id, `cv-${id}@example.invalid`],
    );
    await db.query(
      `INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at)
       VALUES ($1,$2,$3,now()+interval '1 hour')`,
      [sid, id, createHash('sha256').update(sid).digest('hex')],
    );
  }
  await db.query(
    `INSERT INTO user_roles(user_id,role_id,is_active)
     SELECT $1,id,true FROM roles WHERE key='super_admin'`,
    [role.admin],
  );
  const [{ id: group }] = await db.query(
    "INSERT INTO module_groups(key,sort_order) VALUES ('cv_synthetic_tools',99) RETURNING id::text",
  );
  const [{ id: wrongModule }] = await db.query(
    `INSERT INTO modules(module_group_id,key,link,sort_order)
     VALUES ($1,'cv_synthetic_wrong_route','/cv-synthetic-wrong-route',0) RETURNING id::text`,
    [group],
  );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES ($1,$2,true)',
    [role.wrongRoute, wrongModule],
  );

  const reapplied = await db.runMigrations({ transaction: 'all' });
  assert.deepEqual(
    reapplied.map(({ name }) => name),
    [cvMigration],
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int FROM users WHERE id=ANY($1::bigint[])',
        [Object.values(role)],
      )
    )[0].count,
    4,
  );
  await verifyNoAssignment();

  // The profile schema is verified above. The current HTTP delete also invalidates generations.
  await db.transaction(async (manager) => {
    await new CreateNodiaCvGenerations1793970000000().up(manager);
    await new AttachNodiaCvGenerationLedger1793980000000().up(manager);
    await new AddNodiaCvDraftReviews1793990000000().up(manager);
  });

  const http = await openHttp(sessions);
  app = http.app;
  const { request } = http;
  expectStatus(await request('GET'), 401);
  expectStatus(await request('GET', '', role.owner), 403);
  expectStatus(await request('GET', '', role.wrongRoute), 403);
  assert.deepEqual(
    expectStatus(await request('GET', '', role.admin), 200).items,
    [],
  );

  const [{ id: cvModule }] = await db.query(
    `INSERT INTO modules(module_group_id,key,link,sort_order)
     VALUES ($1,'nodia_cv','/nodia-cv',1) RETURNING id::text`,
    [group],
  );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES ($1,$3,true),($2,$3,true)',
    [role.owner, role.other, cvModule],
  );
  expectStatus(await request('GET', '', role.wrongRoute), 403);
  assert.deepEqual(
    expectStatus(await request('GET', '', role.owner), 200).items,
    [],
  );

  const malformed = await request('POST', '', role.owner, '{"profile":');
  expectStatus(malformed, 400);
  assert.equal(malformed.headers.get('cache-control'), 'private, no-store');
  const oversized = await request('POST', '', role.owner, {
    request_key: randomUUID(),
    profile: { ...profile, summary: 'x'.repeat(128 * 1024) },
  });
  expectStatus(oversized, 413);
  assert.equal(oversized.headers.get('cache-control'), 'private, no-store');

  for (const experience of [
    { ...profile.experiences[0], start_month: '2024-13' },
    { ...profile.experiences[0], start_month: '2026-01' },
    { ...profile.experiences[0], status: 'current' },
  ]) {
    expectStatus(
      await request('POST', '', role.owner, {
        request_key: randomUUID(),
        profile: { ...profile, experiences: [experience] },
      }),
      400,
    );
  }
  expectStatus(
    await request('POST', '', role.owner, {
      request_key: randomUUID(),
      profile: { ...profile, owner_user_id: role.other },
    }),
    400,
  );
  assert.equal(
    expectStatus(await request('GET', '', role.owner), 200).total,
    0,
  );

  const create = { request_key: randomUUID(), profile };
  const [first, replay] = await Promise.all([
    request('POST', '', role.owner, create),
    request('POST', '', role.owner, create),
  ]);
  const created = expectStatus(first, 201);
  assert.deepEqual(expectStatus(replay, 201), created);
  assert.match(first.headers.get('cache-control') ?? '', /private.*no-store/);
  assert.equal(created.revision, 1);
  assert.equal(created.schema_version, 1);
  assert.equal(created.experiences.length, 1);
  assert.equal(created.experiences[0].start_month, '2024-02');
  assert.equal(created.experiences[0].end_month, '2025-08');
  assert.ok(!('owner_user_id' in created) && !('request_hash' in created));
  assert.equal(
    expectStatus(await request('GET', '', role.owner), 200).total,
    1,
  );
  expectStatus(
    await request('POST', '', role.owner, {
      ...create,
      profile: { ...profile, profile_name: 'Otra intención' },
    }),
    409,
  );

  const sibling = expectStatus(
    await request('POST', '', role.other, create),
    201,
  );
  assert.notEqual(sibling.id, created.id);
  assert.notEqual(sibling.experiences[0].id, created.experiences[0].id);
  const clone = expectStatus(
    await request('POST', '', role.owner, {
      request_key: randomUUID(),
      profile: { ...profile, profile_name: 'Copia independiente' },
    }),
    201,
  );
  assert.notEqual(clone.id, created.id);
  assert.notEqual(clone.experiences[0].id, created.experiences[0].id);

  const page = expectStatus(
    await request('GET', '?page=1&page_size=1', role.owner),
    200,
  );
  assert.deepEqual([page.page, page.page_size, page.total], [1, 1, 2]);
  assert.equal(page.items.length, 1);
  assert.ok(!('experiences' in page.items[0]) && !('contact' in page.items[0]));
  assert.notEqual(page.items[0].id, sibling.id);
  assert.equal(
    expectStatus(await request('GET', '', role.other), 200).total,
    1,
  );

  const exact = `/${created.id}`;
  const detail = await request('GET', exact, role.owner);
  assert.equal(expectStatus(detail, 200).contact.email, profile.contact.email);
  assert.equal(detail.headers.get('cache-control'), 'private, no-store');
  const absent = expectStatus(
    await request('GET', `/${randomUUID()}`, role.other),
    404,
  );
  assert.deepEqual(
    expectStatus(await request('GET', exact, role.other), 404),
    absent,
  );
  const replacement = {
    revision: 1,
    profile: {
      ...profile,
      experiences: [
        { ...profile.experiences[0], id: created.experiences[0].id },
      ],
    },
  };
  expectStatus(await request('PUT', exact, role.other, replacement), 404);
  expectStatus(await request('DELETE', `${exact}?revision=1`, role.other), 404);
  assert.equal(
    expectStatus(await request('GET', '', role.admin), 200).total,
    0,
  );
  assert.deepEqual(
    expectStatus(await request('GET', exact, role.admin), 200),
    created,
  );
  expectStatus(await request('PUT', exact, role.admin, replacement), 404);
  expectStatus(await request('DELETE', `${exact}?revision=1`, role.admin), 404);

  const edits = await Promise.all(
    ['Cambios A', 'Cambios B'].map((profile_name) =>
      request('PUT', exact, role.owner, {
        ...replacement,
        profile: { ...replacement.profile, profile_name },
      }),
    ),
  );
  assert.deepEqual(edits.map(({ status }) => status).sort(), [200, 409]);
  const changed = expectStatus(await request('GET', exact, role.owner), 200);
  assert.deepEqual(changed, edits.find(({ status }) => status === 200).body);
  assert.equal(changed.revision, 2);
  assert.equal(changed.experiences[0].id, created.experiences[0].id);

  await db.query('UPDATE modules SET is_active=false WHERE id=$1', [cvModule]);
  expectStatus(await request('GET', exact, role.owner), 403);
  expectStatus(await request('GET', exact, role.admin), 200);
  await db.query('UPDATE modules SET is_active=true WHERE id=$1', [cvModule]);
  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
    [role.owner, cvModule],
  );
  expectStatus(await request('GET', exact, role.owner), 403);
  expectStatus(await request('PUT', exact, role.owner, replacement), 403);
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=$1 AND module_id=$2',
    [role.owner, cvModule],
  );
  expectStatus(await request('GET', exact, role.owner), 200);
  const generationId = randomUUID();
  const generationKey = randomUUID();
  await db.query(
    `INSERT INTO nodia_cv_generations
       (id,owner_user_id,profile_id,profile_revision,request_key,request_hash,state,language,purpose_version,
        prompt_version,profile_snapshot,offer_text,selection_snapshot,configuration_generation,session_generation,
        resource_key,scope_hash,queue_expires_at,expires_at)
     VALUES ($1,$2,$3,2,$4,$5,'queued','es','cv_tailoring','cv-tailoring/1',$6,$7,$8,
        'fixture-generation','fixture-session','fixture-resource',$5,now()+interval '1 minute',now()+interval '1 hour')`,
    [
      generationId,
      role.owner,
      created.id,
      generationKey,
      'a'.repeat(64),
      changed,
      'Synthetic offer',
      {
        connection_id: '1',
        mode: 'api_key',
        model_id: 'synthetic',
        effort_id: null,
      },
    ],
  );

  const reviewPath = `/drafts/${generationId}`;
  const statusPath = `/generations/${generationId}`;
  const cvRequest = (method, suffix, user, body) =>
    request(method, suffix, user, body, NODIA_CV_HTTP_PATH);
  const edit = {
    revision: 1,
    included_fact_ids: ['e4'],
    evidence: [
      {
        requirement_id: 'r1',
        source: ' Experiencia ',
        detail: ' Confirmado\r\npor mí. ',
      },
    ],
  };
  const put = (user, body = edit) => cvRequest('PUT', reviewPath, user, body);
  assert.equal(
    expectStatus(await cvRequest('GET', statusPath, role.owner), 200).review,
    null,
  );
  assert.equal(
    expectStatus(await put(role.owner), 409).message,
    'nodiaCv:draft_not_ready',
  );

  const draft = {
    schemaVersion: 1,
    locale: 'es',
    requirements: [
      {
        id: 'r1',
        quote: 'Synthetic offer',
        kind: 'required',
        coverage: 'gap',
        evidenceIds: [],
      },
    ],
    selectedFacts: [
      {
        id: 'e1',
        section: 'profile',
        groupId: 'g1',
        field: 'professional_title',
        text: 'Developer',
      },
    ],
    remainingFacts: [
      {
        id: 'e2',
        section: 'experience',
        groupId: 'g2',
        field: 'company',
        text: 'Study team',
      },
      {
        id: 'e3',
        section: 'experience',
        groupId: 'g2',
        field: 'position',
        text: 'Contributor',
      },
      {
        id: 'e4',
        section: 'experience',
        groupId: 'g2',
        field: 'achievement',
        text: 'Tested the app',
      },
    ],
  };
  const generationStore = app.get(NodiaCvGenerationStore);
  await db.transaction(async (manager) => {
    const row = await generationStore.status(manager, role.owner, {
      id: generationId,
    });
    await generationStore.publish(manager, row, draft, 'b'.repeat(64));
    const migration = new AddNodiaCvDraftReviews1793990000000();
    await migration.down(manager);
    await migration.up(manager);
  });
  const ready = expectStatus(
    await cvRequest('GET', statusPath, role.owner),
    200,
  );
  assert.deepEqual(ready.draft, draft);
  assert.deepEqual(ready.review, {
    revision: 1,
    included_fact_ids: ['e1'],
    evidence: [],
  });

  expectStatus(await put(undefined), 401);
  expectStatus(await put(role.wrongRoute), 403);
  const foreign = expectStatus(await put(role.other), 404);
  const absentDraft = expectStatus(
    await cvRequest('PUT', `/drafts/${randomUUID()}`, role.other, edit),
    404,
  );
  assert.equal(foreign.message, 'nodiaCv:generation_not_found');
  assert.equal(foreign.message, absentDraft.message);
  expectStatus(await put(role.admin), 404);
  for (const body of [
    { ...edit, included_fact_ids: ['e999'] },
    { ...edit, included_fact_ids: ['e4', 'e4'] },
    { ...edit, evidence: [{ ...edit.evidence[0], requirement_id: 'r99' }] },
    { ...edit, evidence: [...edit.evidence, ...edit.evidence] },
  ]) {
    assert.equal(
      expectStatus(await put(role.owner, body), 400).message,
      'nodiaCv:invalid_draft_review',
    );
  }
  for (const body of [
    { ...edit, owner_user_id: role.admin },
    { ...edit, revision: '1' },
    { ...edit, evidence: [{ ...edit.evidence[0], source: 'x'.repeat(161) }] },
    { ...edit, evidence: [{ ...edit.evidence[0], detail: 'x'.repeat(601) }] },
    { ...edit, evidence: [{ ...edit.evidence[0], detail: 'x\u0000y' }] },
    { ...edit, evidence: [null] },
  ]) {
    assert.equal(
      expectStatus(await put(role.owner, body), 400).message,
      'nodiaCv:invalid_input',
    );
  }
  const [saved, stale] = (
    await Promise.all([put(role.owner), put(role.owner)])
  ).sort((left, right) => left.status - right.status);
  const reviewed = expectStatus(saved, 200);
  assert.equal(saved.headers.get('cache-control'), 'private, no-store');
  assert.equal(expectStatus(stale, 409).message, 'nodiaCv:stale_draft');
  assert.deepEqual(reviewed.draft, draft);
  assert.deepEqual(reviewed.review, {
    revision: 2,
    included_fact_ids: ['e2', 'e3', 'e4'],
    evidence: [
      {
        requirement_id: 'r1',
        source: 'Experiencia',
        detail: 'Confirmado\npor mí.',
      },
    ],
  });
  const [storedReview] = await db.query(
    'SELECT review_updated_by_actor_id FROM nodia_cv_generations WHERE id=$1',
    [generationId],
  );
  assert.equal(storedReview.review_updated_by_actor_id, role.owner);
  const recoveryPath = `/generations/requests/${generationKey}`;
  const recoveryResponse = await cvRequest('GET', recoveryPath, role.owner);
  const recovered = expectStatus(recoveryResponse, 200);
  assert.equal(
    recoveryResponse.headers.get('cache-control'),
    'private, no-store',
  );
  assert.deepEqual(recovered, {
    ...reviewed,
    recovery: { offer_text: 'Synthetic offer', profile: changed },
  });
  assert.equal('recovery' in reviewed, false);
  assert.equal('recovery' in ready, false);
  assert.equal(
    expectStatus(await cvRequest('GET', recoveryPath, role.other), 404).message,
    'nodiaCv:generation_not_found',
  );
  await db.query(
    'UPDATE nodia_cv_generations SET profile_snapshot=NULL WHERE id=$1',
    [generationId],
  );
  const invalidRecoveryResponse = await cvRequest(
    'GET',
    recoveryPath,
    role.owner,
  );
  assert.deepEqual(expectStatus(invalidRecoveryResponse, 500), {
    statusCode: 500,
    message: 'nodiaCv:request_failed',
  });
  assert.equal(
    invalidRecoveryResponse.headers.get('cache-control'),
    'private, no-store',
  );
  await db.query(
    'UPDATE nodia_cv_generations SET profile_snapshot=$2 WHERE id=$1',
    [generationId, changed],
  );
  await assert.rejects(
    db.transaction((manager) =>
      new AddNodiaCvDraftReviews1793990000000().down(manager),
    ),
    /Preserve edited Nodia CV draft reviews/,
  );
  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
    [role.owner, cvModule],
  );
  expectStatus(await put(role.owner, { ...edit, revision: 2 }), 403);
  expectStatus(await cvRequest('GET', recoveryPath, role.owner), 403);
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=$1 AND module_id=$2',
    [role.owner, cvModule],
  );
  await db.query(
    'UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1',
    [sessions.get(role.other)],
  );
  expectStatus(await put(role.other), 401);

  expectStatus(await request('DELETE', `${exact}?revision=1`, role.owner), 409);
  assert.deepEqual(
    expectStatus(await cvRequest('GET', statusPath, role.owner), 200).review,
    reviewed.review,
  );
  expectStatus(await request('DELETE', `${exact}?revision=2`, role.owner), 204);
  const [invalidated] = await db.query(
    `SELECT state,profile_id,profile_snapshot,offer_text,selection_snapshot,request_hash,
        draft,review,review_revision,review_updated_by_actor_id
     FROM nodia_cv_generations WHERE id=$1`,
    [generationId],
  );
  assert.deepEqual(invalidated, {
    state: 'expired',
    profile_id: null,
    profile_snapshot: null,
    offer_text: null,
    selection_snapshot: null,
    request_hash: null,
    draft: null,
    review: null,
    review_revision: null,
    review_updated_by_actor_id: null,
  });
  assert.equal(
    expectStatus(await put(role.owner), 410).message,
    'nodiaCv:generation_expired',
  );
  assert.deepEqual(
    expectStatus(await cvRequest('GET', recoveryPath, role.owner), 410),
    {
      statusCode: 410,
      message: 'nodiaCv:generation_expired',
    },
  );
  expectStatus(await request('GET', exact, role.owner), 404);
  expectStatus(await request('POST', '', role.owner, create), 410);
  assert.equal(
    expectStatus(await request('GET', '', role.owner), 200).total,
    1,
  );
  const [receipt] = await db.query(
    'SELECT profile_id,request_hash FROM nodia_cv_profile_create_receipts WHERE owner_user_id=$1 AND request_key=$2',
    [role.owner, create.request_key],
  );
  assert.deepEqual(receipt, { profile_id: created.id, request_hash: null });
  await assert.rejects(
    db.undoLastMigration({ transaction: 'all' }),
    /Preserve Nodia CV profiles and creation receipts/,
  );
  assert.ok(await tableExists('nodia_cv_profiles'));
  assert.ok(await tableExists('nodia_cv_profile_create_receipts'));
  console.log(
    'Nodia CV profiles: fresh migration, prior schema, OpenAPI, authority, idempotency, review, CAS and deletion passed.',
  );
} finally {
  if (app) await app.close();
  if (db.isInitialized) await db.destroy();
}
