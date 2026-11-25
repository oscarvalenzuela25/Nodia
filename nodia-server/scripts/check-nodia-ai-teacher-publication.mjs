// Verification of the approved release. No provider requests or publication writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import frontmatter from './nodia-ai-knowledge/frontmatter.cjs';
import { mergeCatalogExtensions } from './nodia-ai-knowledge/catalog-audit.mjs';
import {
  apiChatBody,
  validateApiPayload,
} from '../dist/nodia-ai-adapter/api-nodia-ai-chat-transport.js';
import {
  isNodiaAiMcpToolDescriptorValid,
  nodiaAiMcpCatalogUtf8Bytes,
  NODIA_AI_MCP_CATALOG_LIMITS,
} from '../dist/nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { compileNodiaAiToolSchema } from '../dist/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => frontmatter.parseStrictJson(read(file));
const sha256 = (source) => createHash('sha256').update(source).digest('hex');

function compile(sourceJson, definition) {
  return compileNodiaAiToolSchema({
    sourceJson,
    definition,
    sha256: sha256(sourceJson),
  });
}

function checkPublication(
  publication,
  tools,
  teacherSchema,
  preparationSchema,
) {
  const registry = json(publication.registry_path);
  const manifest = json('nodia-server/dist/nodia-ai/knowledge/manifest.json');
  const capabilityIds = new Set(tools.map((tool) => tool.toolName));
  const groups = publication.document_reviews;
  assert.equal(publication.schema_version, 1);
  assert.equal(publication.status, 'published');
  assert.equal(publication.authoring_only, true);
  assert.deepEqual(publication.required_module_routes, ['/nodia-teacher']);
  assert.equal(publication.contract_revision, 1);
  assert.equal(registry.catalog_release, publication.catalog_release);
  assert.equal(manifest.catalog_release, publication.catalog_release);
  assert.deepEqual(
    groups.flatMap((group) => group.capability_ids).sort(),
    [...capabilityIds].sort(),
  );
  const contracts = new Map(
    manifest.capability_contracts
      .filter((item) => item.capability_id.startsWith('nodia_teacher_'))
      .map((item) => [item.capability_id, item]),
  );
  assert.deepEqual([...contracts.keys()].sort(), [...capabilityIds].sort());
  for (const tool of tools) {
    const contract = contracts.get(tool.toolName);
    const output =
      tool.kind === 'read'
        ? [publication.schema_path, teacherSchema]
        : [publication.preparation_result_schema_path, preparationSchema];
    assert.equal(contract.publication, 'published');
    assert.equal(contract.kind, tool.kind);
    assert.equal(contract.revision, publication.contract_revision);
    assert.deepEqual(
      contract.required_module_routes,
      publication.required_module_routes,
    );
    assert.deepEqual(contract.input_schema, {
      path: publication.schema_path,
      definition: tool.inputSchema,
      sha256: sha256(teacherSchema),
    });
    assert.deepEqual(contract.output_schema, {
      path: output[0],
      definition: tool.outputSchema,
      sha256: sha256(output[1]),
    });
  }
  for (const group of groups) {
    assert.ok(registry.source_paths.includes(group.path));
    const { metadata, body } = frontmatter.parseDocument(read(group.path));
    assert.equal(metadata.document_id, group.document_id);
    assert.equal(metadata.document_status, 'approved');
    assert.equal(metadata.integration_status, 'published');
    assert.equal(metadata.revision, group.approved_revision);
    const digest = frontmatter.contentHash(metadata, body);
    assert.deepEqual(metadata.approval, {
      reference: group.approval_reference,
      revision: group.approved_revision,
      content_sha256: digest,
    });
    assert.ok(
      manifest.documents.some(
        (document) =>
          document.document_id === group.document_id &&
          document.revision === group.approved_revision &&
          document.content_sha256 === digest,
      ),
    );
    const fragments = manifest.fragments.filter(
      (fragment) => fragment.document_id === group.document_id,
    );
    assert.equal(fragments.length, 1);
    const [fragment] = fragments;
    assert.equal(fragment.fragment_id, group.fragment_id);
    assert.deepEqual(fragment.sections, group.sections);
    assert.deepEqual(
      fragment.requires.map((value) => value.capability_id).sort(),
      [...group.capability_ids].sort(),
    );
    for (const section of group.sections)
      assert.equal(
        body.split('\n').filter((line) => line === '## ' + section).length,
        1,
      );
  }
}

function checkCatalog(candidate, tools, teacherSchema, preparationSchema) {
  const extension = json(candidate.catalog_extension_path);
  mergeCatalogExtensions(
    json('docs/mvp/nodia-ai-v1-tool-catalog.json'),
    extension,
  );
  const teacherTools = new Map(
    extension.domainTools
      .filter((item) => item.name.startsWith('nodia_teacher_'))
      .map((item) => [item.name, item]),
  );
  assert.equal(teacherTools.size, tools.length);
  for (const tool of tools) {
    const entry = teacherTools.get(tool.toolName);
    assert.equal(entry.kind, tool.kind);
    assert.equal(entry.resourceKey, tool.resourceKey);
    assert.equal(entry.targetModuleRoute, candidate.required_module_routes[0]);
    assert.equal(entry.publication.published, false);
    const contract = entry.implementationContract;
    assert.deepEqual(
      contract.requiredModuleRoutes,
      candidate.required_module_routes,
    );
    assert.equal(contract.schemaPath, candidate.schema_path);
    assert.equal(contract.revision, candidate.contract_revision);
    assert.deepEqual(contract.inputSchema, {
      definition: tool.inputSchema,
      sha256: sha256(teacherSchema),
    });
    assert.deepEqual(
      contract.outputSchema,
      tool.kind === 'read'
        ? { definition: tool.outputSchema, sha256: sha256(teacherSchema) }
        : {
            path: candidate.preparation_result_schema_path,
            definition: tool.outputSchema,
            sha256: sha256(preparationSchema),
          },
    );
    for (const source of contract.handlerSources)
      assert.ok(read(source).length);
  }
  return new Set(
    [...teacherTools.values()].flatMap((tool) => tool.sourceHandlerIds),
  ).size;
}

function checkWireProjection(descriptors, policy) {
  for (const tool of descriptors)
    assert.ok(isNodiaAiMcpToolDescriptorValid(tool), tool.name);
  const bytes = nodiaAiMcpCatalogUtf8Bytes(descriptors);
  assert.ok(bytes <= NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes);

  const request = {
    canonicalPrompt: 'Fixture aislada de contratos de Teacher',
    selection: { model_id: 'teacher-test-model', effort_id: null },
    tools: descriptors,
  };
  validateApiPayload(request, policy);

  const openai = apiChatBody('openai', request, []);
  const gemini = apiChatBody('gemini', request, []);
  for (const [index, tool] of descriptors.entries()) {
    assert.equal(openai.tools[index].name, tool.name);
    assert.deepEqual(openai.tools[index].parameters, tool.inputSchema);
    const declaration = gemini.tools[0].functionDeclarations[index];
    assert.equal(declaration.name, tool.name);
    assert.deepEqual(declaration.parametersJsonSchema, tool.inputSchema);
  }
  return bytes;
}

const candidate = json('nodia-server/config/nodia-ai-teacher-publication.json');
const { tools } = json(candidate.metadata_path);
const policy = json(
  'nodia-server/src/nodia-ai-runtime/config/runtime-policy.json',
).policy;
const teacherSchema = read(candidate.schema_path);
const preparationSchema = read(candidate.preparation_result_schema_path);
const commonSchema = read(
  'nodia-server/src/nodia-ai-tools/config/common-schema.json',
);
const commonPreparation = compile(commonSchema, 'PreparationResult');
const candidatePreparation = compile(preparationSchema, 'PreparationResult');
assert.deepEqual(
  json(candidate.preparation_result_schema_path).$defs,
  frontmatter.parseStrictJson(JSON.stringify(commonPreparation.schema.$defs)),
);
assert.deepEqual(
  candidatePreparation.schema.$defs,
  commonPreparation.schema.$defs,
);
const compiledByName = new Map();

for (const tool of tools) {
  assert.equal(compiledByName.has(tool.toolName), false);
  assert.ok(['read', 'prepare_change'].includes(tool.kind));
  assert.equal(
    tool.toolName,
    'nodia_' +
      tool.resourceKey +
      '_' +
      (tool.kind === 'read' ? '' : 'prepare_') +
      tool.operationKey,
  );
  if (tool.kind === 'prepare_change')
    assert.equal(tool.outputSchema, 'PreparationResult');
  compiledByName.set(tool.toolName, {
    input: compile(teacherSchema, tool.inputSchema),
    output: compile(
      tool.kind === 'read' ? teacherSchema : preparationSchema,
      tool.outputSchema,
    ),
  });
}

function accepts(name, payload, output = false) {
  const contract = compiledByName.get(name);
  assert.ok(contract, name);
  return (output ? contract.output : contract.input).validate(payload);
}

const id = '5aa4dba6-43eb-41ca-8a9c-29b2cc7721a8';
const source = {
  label: 'Lección de ejemplo',
  url: 'https://example.org/lesson',
};
const calendarCreate = 'nodia_teacher_calendars_prepare_create';
const fourWeeks = {
  plan: {
    version: 1,
    title: 'Cuatro semanas de inglés',
    categories: ['Inglés'],
    schedule: { kind: 'numbered', days: 28 },
    days: Array.from({ length: 28 }, (_, index) => ({
      day: index + 1,
      title: 'Práctica diaria',
      minutes: 30,
      activities: [
        { text: 'Estudiar la lección', source },
        { text: 'Resolver el ejercicio', source },
      ],
    })),
  },
  new_categories: ['Inglés'],
};
assert.ok(accepts(calendarCreate, fourWeeks));
assert.ok(
  Buffer.byteLength(JSON.stringify(fourWeeks)) <=
    policy.results.tool_arguments_utf8_bytes,
);
assert.equal(accepts(calendarCreate, { ...fourWeeks, owner_id: '792' }), false);
assert.equal(
  accepts(calendarCreate, {
    plan: {
      ...fourWeeks.plan,
      schedule: { kind: 'dated', start: '2026-11-23', end: '2026-12-20' },
    },
  }),
  false,
);
assert.equal(
  accepts(calendarCreate, {
    plan: {
      ...fourWeeks.plan,
      days: [
        {
          day: 1,
          activities: [
            {
              text: 'Ejercicio',
              source: { ...source, url: 'http://example.org' },
            },
          ],
        },
      ],
    },
  }),
  false,
);
assert.ok(
  accepts('nodia_teacher_calendar_activities_prepare_set_completion', {
    plan_id: id,
    id,
    activity_id: id,
    completed: false,
  }),
);
assert.equal(
  accepts('nodia_teacher_calendar_days_prepare_update', {
    plan_id: id,
    id,
    title: null,
    notes: null,
    minutes: null,
    activities: [],
    completed: true,
  }),
  false,
);

const flashcardUpdate = 'nodia_teacher_flashcards_prepare_update';
assert.ok(
  accepts(flashcardUpdate, {
    id,
    deck_id: 'general',
    source: null,
    remove_image: true,
  }),
);
assert.equal(accepts(flashcardUpdate, { id }), false);
assert.equal(
  accepts(flashcardUpdate, { id, image_side: 'answer', remove_image: true }),
  false,
);
assert.equal(
  accepts(flashcardUpdate, { id, image: { side: 'answer', data: 'bytes' } }),
  false,
);
assert.ok(
  accepts('nodia_teacher_flashcard_imports_prepare_create', {
    destination: { kind: 'new', title: 'Vocabulario', category: 'Inglés' },
    cards: [
      {
        question: 'How are you?',
        answer: 'I am doing well.',
        source: 'Apuntes',
      },
    ],
  }),
);
assert.equal(
  accepts('nodia_teacher_flashcard_imports_prepare_create', {
    destination: { kind: 'existing', deck_id: 'general', title: 'Excedente' },
    cards: [{ question: 'How are you?', answer: 'I am doing well.' }],
  }),
  false,
);

const card = {
  id,
  deck_id: 'general',
  question: 'How are you?',
  answer: 'I am doing well.',
  revision: 1,
  source: { label: 'Apuntes' },
  image: { side: 'answer' },
};
assert.ok(accepts('nodia_teacher_flashcards_get', card, true));
assert.equal(
  accepts(
    'nodia_teacher_flashcards_get',
    {
      ...card,
      source: { ...card.source, anchor: { selection: 'private' } },
    },
    true,
  ),
  false,
);

const descriptors = tools.map((tool) => ({
  name: tool.toolName,
  description: tool.description,
  inputSchema: compiledByName.get(tool.toolName).input.schema,
}));
const catalogBytes = checkWireProjection(descriptors, policy);
checkPublication(candidate, tools, teacherSchema, preparationSchema);
const sourceHandlers = checkCatalog(
  candidate,
  tools,
  teacherSchema,
  preparationSchema,
);
console.log(
  JSON.stringify(
    {
      status: 'passed',
      publication: 'published',
      catalog_release: candidate.catalog_release,
      read_contracts: tools.filter((tool) => tool.kind === 'read').length,
      preparation_contracts: tools.filter(
        (tool) => tool.kind === 'prepare_change',
      ).length,
      teacher_schema_sha256: sha256(teacherSchema),
      preparation_result_schema_sha256: sha256(preparationSchema),
      native_handler_sources: sourceHandlers,
      catalog_descriptor_bytes: catalogBytes,
      api_wire_projections: ['openai', 'gemini'],
      calendar_preview_days: fourWeeks.plan.days.length,
    },
    null,
    2,
  ),
);
