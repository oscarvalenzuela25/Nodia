import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { teacherUpgradeLab } from './helpers/teacher-upgrade-lab.mjs';
import { TeacherService } from '../dist/teacher/teacher.service.js';
import { TeacherLearningController } from '../dist/teacher/teacher-learning.controller.js';
import { TeacherEnrichmentController } from '../dist/teacher/teacher-enrichment.controller.js';
import { TeacherReceiptStatusInterceptor } from '../dist/teacher/teacher-receipt-status.interceptor.js';
import { TeacherLearningUseCase } from '../dist/teacher/use-case/teacher-learning.use-case.js';
import { TeacherEnrichmentUseCase } from '../dist/teacher/use-case/teacher-enrichment.use-case.js';
import { ExecuteTeacherCommandUseCase } from '../dist/teacher/use-case/execute-teacher-command.use-case.js';
import { teacherBodyParser } from '../dist/teacher/teacher-body-parser.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';

// Real Nest transport/DTO/authority/SQL. Authentication identities are controlled
// synthetic middleware only: this does not claim a JWT/session-login acceptance.
const lab = await teacherUpgradeLab();
const checks = [];
const check = async (name, run) => {
  await run();
  checks.push(name);
};
let app;
try {
  await lab.migrate('1793630000000-TeacherLearningEvidence');
  await lab.migrate('1793640000000-TeacherLearningEnrichment');
  const command = new ExecuteTeacherCommandUseCase(lab.store, lab.generation);
  const created = await command.execute(
    lab.actor,
    null,
    randomUUID(),
    'create',
    {
      topic: 'Synthetic HTTP QA',
      objective: 'Observe ownership and recovery',
      explanation_language: 'en',
      organization: 'topics',
      day_count: null,
    },
  );
  const id = created.session_id;
  let savedBlueprint;
  const learning = new TeacherLearningUseCase(lab.store);
  const enrichment = new TeacherEnrichmentUseCase(lab.store, lab.generation);
  class HttpQaModule {}
  Module({
    controllers: [TeacherLearningController, TeacherEnrichmentController],
    providers: [
      { provide: TeacherService, useValue: lab.store },
      { provide: TeacherLearningUseCase, useValue: learning },
      { provide: TeacherEnrichmentUseCase, useValue: enrichment },
      TeacherReceiptStatusInterceptor,
    ],
  })(HttpQaModule);
  app = await NestFactory.create(HttpQaModule, {
    logger: false,
    bodyParser: false,
  });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/teacher', teacherBodyParser);
  app.use((req, res, next) => {
    const actor =
      req.headers['x-qa-actor'] === 'other'
        ? lab.other
        : req.headers['x-qa-actor'] === 'no-module'
          ? lab.noModule
          : lab.actor;
    req.auth = {
      user: {
        id: actor.userId,
        name: 'Synthetic HTTP QA',
        email: 'fixture@example.test',
        image_url: null,
      },
      sessionId: actor.sessionId,
    };
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const url = `${await app.getUrl()}/api/v1/teacher/sessions/${id}`;
  const request = async (
    path,
    { body, actor, key = randomUUID(), raw, method } = {},
  ) => {
    const response = await fetch(`${url}/${path}`, {
      method:
        method ?? (body !== undefined || raw !== undefined ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        ...(actor ? { 'x-qa-actor': actor } : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : raw !== undefined
          ? { body: raw }
          : {}),
    });
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    };
  };
  const expectError = (result, status) => {
    assert.equal(result.status, status);
    assert.deepEqual(Object.keys(result.body).sort(), ['code', 'message']);
    assert.match(result.body.code, /^[a-z][a-z0-9_]+$/);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  };
  await check(
    'new controllers compose through actual Nest DI and preserve private empty projections',
    async () => {
      const a = await request('learning');
      const b = await request('enrichment');
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.deepEqual(a.body.observations, []);
      assert.deepEqual(b.body.sources, []);
      assert.equal(b.body.revision, 0);
      assert.equal(b.headers.get('cache-control'), 'no-store');
      assert.equal(JSON.stringify(a.body).includes('private_key'), false);
    },
  );
  await check(
    'real ownership and module checks reject both new route families',
    async () => {
      for (const route of ['learning', 'enrichment', 'enrichment/concepts']) {
        expectError(await request(route, { actor: 'other' }), 404);
        expectError(await request(route, { actor: 'no-module' }), 403);
      }
      expectError(
        await request('enrichment/commands', {
          actor: 'other',
          body: {
            expected_revision: 0,
            operation: 'concept_create',
            payload: { label: 'Other', statement: 'Not permitted' },
          },
        }),
        404,
      );
    },
  );
  await check(
    'UUID, enum, top-level extras and nested payload allowlists reject malformed commands',
    async () => {
      const invalid = await fetch(
        `${await app.getUrl()}/api/v1/teacher/sessions/not-a-uuid/enrichment`,
      );
      assert.equal(invalid.status, 400);
      expectError(
        await request('enrichment/commands', {
          body: {
            expected_revision: 0,
            operation: 'execute_shell',
            payload: {},
          },
        }),
        400,
      );
      expectError(
        await request('enrichment/commands', {
          body: {
            expected_revision: 0,
            operation: 'concept_create',
            payload: { label: 'A', statement: 'B' },
            owner_user_id: '2',
          },
        }),
        400,
      );
      expectError(
        await request('enrichment/commands', {
          body: {
            expected_revision: 0,
            operation: 'source_create',
            payload: {
              title: 'A',
              media_type: 'text/plain',
              text: 'B',
              path: 'C:/private',
            },
          },
        }),
        400,
      );
      expectError(await request('enrichment/concepts?page=0'), 400);
      expectError(await request('enrichment/concepts?owner_user_id=2'), 400);
    },
  );
  await check(
    'Teacher JSON byte cap and UTF-8 validation run before DTO processing',
    async () => {
      expectError(
        await request('enrichment/commands', {
          raw: JSON.stringify({
            expected_revision: 0,
            operation: 'source_create',
            payload: { text: 'x'.repeat(262144) },
          }),
        }),
        413,
      );
      expectError(
        await request('enrichment/commands', {
          raw: Buffer.from([
            0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d,
          ]),
        }),
        400,
      );
      expectError(
        await request('enrichment/commands', { raw: '{ invalid json' }),
        400,
      );
    },
  );
  await check(
    'reviewed-bank boundary rejects nested escalation and does not publish private answers',
    async () => {
      const dimension = randomUUID();
      const body = {
        expected_session_revision: created.revision,
        title: 'Synthetic reviewed bank',
        reviewed: true,
        dimensions: [{ id: dimension, description: 'Fixture dimension' }],
        items: [
          {
            dimension_id: dimension,
            kind: 'completion',
            prompt: 'Supply the fixture token',
            private_key: {
              kind: 'completion',
              alternatives: ['private-fixture-key'],
              case_sensitive: true,
            },
            explanation: 'Synthetic explanation',
          },
        ],
      };
      expectError(
        await request('learning/diagnostic-blueprints', {
          body: {
            ...body,
            dimensions: [{ ...body.dimensions[0], ownership_override: true }],
          },
        }),
        400,
      );
      const saved = await request('learning/diagnostic-blueprints', { body });
      assert.equal(saved.status, 200);
      savedBlueprint = body;
      const view = await request('learning');
      assert.equal(view.status, 200);
      assert.equal(
        JSON.stringify(view.body).includes('private-fixture-key'),
        false,
      );
      assert.equal(JSON.stringify(view.body).includes('private_key'), false);
    },
  );
  let sourceId;
  let sourceIntent;
  await check(
    'HTTP response recovery returns status 200 and one durable source without duplicate effects',
    async () => {
      const body = {
        expected_revision: 0,
        operation: 'source_create',
        payload: {
          title: 'Private source fixture',
          media_type: 'text/plain',
          text: 'Page-one provenance for synthetic QA.',
        },
      };
      const key = randomUUID();
      sourceIntent = { body, key };
      const first = await request('enrichment/commands', { body, key });
      const second = await request('enrichment/commands', { body, key });
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.deepEqual(second.body, first.body);
      sourceId = first.body.resource_id;
      const count = await lab.db.query(
        "SELECT count(*)::integer AS n FROM teacher_enrichment_records WHERE session_id=$1 AND kind='source'",
        [id],
      );
      assert.equal(count[0].n, 1);
      expectError(
        await request('enrichment/commands', {
          body: {
            ...body,
            payload: { ...body.payload, title: 'Different intent' },
          },
          key,
        }),
        409,
      );
    },
  );
  await check(
    'source projection resolves immutable page provenance and rejects other owners',
    async () => {
      const read = await request(`enrichment/sources/${sourceId}`);
      assert.equal(read.status, 200);
      assert.deepEqual(read.body.pages, [
        { page: 1, text: 'Page-one provenance for synthetic QA.' },
      ]);
      assert.match(read.body.content_hash, /^[a-f0-9]{64}$/);
      expectError(
        await request(`enrichment/sources/${sourceId}`, { actor: 'other' }),
        404,
      );
      const dashboard = await request('enrichment');
      assert.equal(dashboard.body.sources[0].page_count, 1);
      assert.equal(dashboard.body.sources[0].pages, undefined);
    },
  );
  await check(
    'concept lookup paginates one authorized session and escapes wildcard input',
    async () => {
      const before = await request('enrichment');
      const saved = await request('enrichment/commands', {
        body: {
          expected_revision: before.body.revision,
          operation: 'concept_create',
          payload: {
            label: 'Literal % concept',
            statement: 'Synthetic concept condition',
          },
        },
      });
      assert.equal(saved.status, 200);
      const matching = await request(
        `enrichment/concepts?q=${encodeURIComponent('%')}`,
      );
      assert.equal(matching.status, 200);
      assert.equal(matching.body.items.length, 1);
      assert.equal(matching.body.items[0].label, 'Literal % concept');
      const injected = await request(
        `enrichment/concepts?q=${encodeURIComponent("' OR 1=1 --")}`,
      );
      assert.equal(injected.status, 200);
      assert.deepEqual(injected.body.items, []);
      assert.equal(
        (await request('enrichment/concepts?page=2')).body.items.length,
        0,
      );
    },
  );
  await check(
    'archive retains authorized reading while refusing new mutation; old receipt remains recoverable',
    async () => {
      const row = (
        await lab.db.query(
          'SELECT revision FROM teacher_sessions WHERE id=$1',
          [id],
        )
      )[0];
      await command.execute(lab.actor, id, randomUUID(), 'archive', {
        expected_session_revision: row.revision,
      });
      assert.equal((await request('enrichment')).status, 200);
      assert.equal((await request('learning')).status, 200);
      assert.equal(
        (await request(`enrichment/sources/${sourceId}`)).status,
        200,
      );
      const recovered = await request('enrichment/commands', sourceIntent);
      assert.equal(recovered.status, 200);
      assert.equal(recovered.body.resource_id, sourceId);
      expectError(
        await request('enrichment/commands', {
          body: {
            expected_revision: 2,
            operation: 'concept_create',
            payload: { label: 'Archived', statement: 'Must not save' },
          },
        }),
        409,
      );
      expectError(
        await request('learning/diagnostic-blueprints', {
          body: {
            ...savedBlueprint,
            expected_session_revision: row.revision + 1,
          },
        }),
        409,
      );
    },
  );
  console.log(
    JSON.stringify({
      task: 'teacher_upgrade_http_integration',
      status: 'passed',
      checks,
      limitations: [
        'Synthetic authentication middleware; no JWT/login, real-provider inference, deployed environment or pedagogical-efficacy claim.',
      ],
    }),
  );
} finally {
  try {
    if (app) await app.close();
  } finally {
    await lab.close();
  }
}
