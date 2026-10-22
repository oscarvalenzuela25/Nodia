// Documentation integrity checks. Does not connect to DB, storage or providers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const manifestPath = 'docs/mvp/nodia-ai-v1-data-model.json';
const model = JSON.parse(read(manifestPath));
const key = columns => columns.join('|');
const prefix = (a, b) => a.every((v, i) => b[i] === v);

function validate(m) {
  const all = [...m.externalTables, ...m.tables];
  const tables = new Map(all.map(t => [t.name, t]));
  assert(tables.size === all.length, 'duplicate table');
  for (const t of all) {
    const columns = new Map(t.columns.map(c => [c.name, c]));
    assert(columns.size === t.columns.length, 'duplicate column');
    assert(t.primaryKey.length > 0, 'missing PK');
    for (const c of t.primaryKey) assert(columns.has(c) && !columns.get(c).nullable, 'nullable/missing PK');
    const keys = [t.primaryKey, ...(t.unique ?? [])];
    assert(new Set(keys.map(key)).size === keys.length, 'duplicate key');
    for (const k of keys) for (const c of k) assert(columns.has(c), 'missing key column');
    for (const i of t.indexes ?? []) {
      for (const c of i.columns) assert(columns.has(c), 'missing indexed column');
      if (!i.where && !i.unique) assert(!keys.some(k => prefix(i.columns, k)), 'redundant ordinary index');
    }
  }
  const graph = new Map(all.map(t => [t.name, []]));
  for (const f of m.foreignKeys) {
    const from = tables.get(f.fromTable), to = tables.get(f.toTable);
    assert(from && to, 'unknown FK table');
    assert(f.columns.length === f.targetColumns.length && f.columns.length > 0, 'FK arity mismatch');
    assert([to.primaryKey, ...(to.unique ?? [])].some(k => key(k) === key(f.targetColumns)), 'nonunique FK target');
    for (let i = 0; i < f.columns.length; i++) {
      const a = from.columns.find(c => c.name === f.columns[i]);
      const b = to.columns.find(c => c.name === f.targetColumns[i]);
      assert(a && b, 'unknown FK column');
      assert(a.type === b.type, 'FK type mismatch');
      if (f.onDelete === 'SET NULL') assert(a.nullable, 'SET NULL nonnullable');
    }
    if (f.onDelete === 'CASCADE') graph.get(f.toTable).push(f.fromTable);
  }
  const visited = new Set(), active = new Set();
  function visit(t) {
    assert(!active.has(t), 'cascade cycle');
    if (visited.has(t)) return;
    active.add(t); for (const child of graph.get(t)) visit(child); active.delete(t); visited.add(t);
  }
  for (const t of graph.keys()) visit(t);
  const purged = new Set();
  function descendants(t) { for (const child of graph.get(t)) if (!purged.has(child)) { purged.add(child); descendants(child); } }
  descendants('nodia_ai_conversations');
  for (const t of m.tables.filter(t => t.retention === 'conversation' && t.name !== 'nodia_ai_conversations')) assert(purged.has(t.name), 'missing content cascade');
  for (const n of ['executions', 'execution_steps', 'preferences', 'runtime_slots', 'jobs', 'job_attempts']) assert(!purged.has(`nodia_ai_${n}`), 'independent data cascades with chat');
  assert(purged.has('nodia_ai_audit_events'), 'audit archive survives chat contrary to policy50');
  assert(tables.get('nodia_ai_runs').columns.some(c => c.name === 'context_manifest' && c.type === 'jsonb' && !c.nullable), 'missing context manifest');
  assert(tables.get('nodia_ai_adapter_states').activation?.kind === 'conditional', 'missing adapter activation gate');
  assert(!tables.has('nodia_ai_step_dependencies'), 'redundant workflow edge table');
  for (const name of ['nodia_ai_jobs', 'nodia_ai_job_attempts']) {
    const columns = tables.get(name).columns;
    assert(columns.some(c => c.name === 'stage_key' && c.type === 'text' && !c.nullable), 'missing bounded stage key');
    assert(columns.some(c => c.name === 'stage_seq' && c.type === 'integer' && !c.nullable), 'missing bounded stage sequence');
  }
  return { purged: purged.size, cascadeEdges: m.foreignKeys.filter(f => f.onDelete === 'CASCADE').length };
}

const cascadeSummary = validate(model);
const counts = { newTables: model.tables.length, reusedTables: model.externalTables.length, columns: model.tables.reduce((n, t) => n + t.columns.length, 0), foreignKeys: model.foreignKeys.length };
assert(JSON.stringify(counts) === JSON.stringify(model.counts), 'stale counts');
const negativeDesignFixtures = [];
function negative(name, mutate, expected) {
  const clone = structuredClone(model); mutate(clone);
  let error; try { validate(clone); } catch (e) { error = e; }
  assert(error && error.message.includes(expected), `${name}: wrong rejection ${error?.message}`);
  negativeDesignFixtures.push(name);
}
const table = (m, suffix) => m.tables.find(t => t.name === `nodia_ai_${suffix}`);
negative('duplicate table rejected', m => m.tables.push(structuredClone(m.tables[0])), 'duplicate table');
negative('duplicate column rejected', m => m.tables[0].columns.push(structuredClone(m.tables[0].columns[0])), 'duplicate column');
negative('nullable PK rejected', m => m.tables[0].columns[0].nullable = true, 'nullable/missing PK');
negative('unknown FK table rejected', m => m.foreignKeys[0].toTable = 'missing', 'unknown FK table');
negative('FK arity mismatch rejected', m => m.foreignKeys[0].columns.push('id'), 'FK arity mismatch');
negative('FK type mismatch rejected', m => table(m, 'conversations').columns.find(c => c.name === 'owner_id').type = 'uuid', 'FK type mismatch');
negative('nonunique FK target rejected', m => m.foreignKeys[0].targetColumns = ['public_id'], 'nonunique FK target');
negative('SET NULL nonnullable rejected', m => m.foreignKeys[0].onDelete = 'SET NULL', 'SET NULL nonnullable');
negative('receipt chat cascade rejected', m => m.foreignKeys.find(f => f.fromTable === 'nodia_ai_executions' && f.toTable === 'nodia_ai_conversations').onDelete = 'CASCADE', 'independent data cascades');
negative('preference chat cascade rejected', m => m.foreignKeys.find(f => f.fromTable === 'nodia_ai_preferences' && f.toTable === 'nodia_ai_conversations').onDelete = 'CASCADE', 'independent data cascades');
negative('missing content cascade rejected', m => m.foreignKeys.find(f => f.fromTable === 'nodia_ai_attachments' && f.toTable === 'nodia_ai_conversations').onDelete = 'NO ACTION', 'missing content cascade');
negative('missing indexed column rejected', m => table(m, 'messages').indexes.push({ columns: ['missing'] }), 'missing indexed column');
negative('redundant index rejected', m => table(m, 'messages').indexes.push({ columns: ['conversation_id', 'seq'] }), 'redundant ordinary index');
negative('cascade cycle rejected', m => m.foreignKeys.push({ fromTable: 'nodia_ai_conversations', columns: ['id'], toTable: 'nodia_ai_messages', targetColumns: ['id'], onDelete: 'CASCADE' }), 'cascade cycle');
negative('missing knowledge provenance rejected', m => table(m, 'runs').columns = table(m, 'runs').columns.filter(c => c.name !== 'context_manifest'), 'missing context manifest');
negative('unconditional opaque state rejected', m => delete table(m, 'adapter_states').activation, 'missing adapter activation gate');

for (const s of model.sourceChecksums) assert(sha(s.file) === s.sha256, `source changed: ${s.file}`);
const dbmlPath = 'docs/mvp/nodia-ai-v1-data-model.dbml';
const dbml = read(dbmlPath);
const blocks = new Map([...dbml.matchAll(/Table (\w+) \{([\s\S]*?)\n\}/g)].map(m => [m[1], m[2]]));
assert(blocks.size === model.tables.length + model.externalTables.length, 'DBML table count');
for (const t of [...model.externalTables, ...model.tables]) {
  assert(blocks.has(t.name), `DBML missing ${t.name}`);
  const columns = [...blocks.get(t.name).matchAll(/^  (\w+) (\S+) \[([^\]]+)\]$/gm)];
  assert(columns.length === t.columns.length, `DBML columns ${t.name}`);
  for (const c of t.columns) {
    const match = columns.find(m => m[1] === c.name);
    assert(match && match[2] === c.type && match[3].includes(c.nullable ? 'null' : 'not null'), `DBML column ${t.name}.${c.name}`);
    assert(c.nullable ? !match[3].includes('not null') : true, `DBML nullability ${t.name}.${c.name}`);
    if (t.primaryKey.length === 1 && t.primaryKey[0] === c.name) assert(match[3].split(', ').includes('pk'), `DBML PK ${t.name}`);
  }
  if (t.primaryKey.length > 1) assert(blocks.get(t.name).includes(`(${t.primaryKey.join(', ')}) [pk]`), `DBML compound PK ${t.name}`);
  for (const u of t.unique ?? []) assert(blocks.get(t.name).includes(`(${u.join(', ')}) [unique]`), `DBML unique ${t.name}`);
}
const ref = (t, cols) => cols.length === 1 ? `${t}.${cols[0]}` : `${t}.(${cols.join(', ')})`;
for (const f of model.foreignKeys) assert(dbml.includes(`Ref: ${ref(f.fromTable, f.columns)} > ${ref(f.toTable, f.targetColumns)} [delete: ${f.onDelete.toLowerCase()}]`), 'DBML missing FK');
assert([...dbml.matchAll(/^Ref:/gm)].length === model.foreignKeys.length, 'DBML FK count');
const schemas = JSON.parse(read('docs/mvp/nodia-ai-v1-common-contracts.schema.json'));
for (const [name, protocol] of [['proposal_revisions', 'PublicProposal'], ['executions', 'ExecutionStatus'], ['execution_steps', 'StepStatus'], ['attachments', 'AttachmentMetadata']]) {
  const dbState = table(model, name).checks.find(c => typeof c === 'object' && c.key === 'state').values;
  assert(JSON.stringify([...dbState].sort()) === JSON.stringify([...schemas.$defs[protocol].properties.state.enum].sort()), `protocol states ${name}`);
}
const review = read('docs/mvp/44-nodia-ai-data-model-review.md');
const cases = [...review.matchAll(/^\| NR-(\d{2}) \|/gm)].map(m => Number(m[1]));
assert(cases.length === 34 && cases.every((n, i) => n === i + 1), 'review scenario IDs');
const plan = read('docs/mvp/45-nodia-ai-implementation-plan.md');
const taskEntries = [...plan.matchAll(/^- \[([ x])\] \*\*AI-(\d{2})/gm)];
const tasks = taskEntries.map(m => Number(m[2]));
assert(tasks.length === 38 && tasks.every((n, i) => n === i + 1), 'plan task IDs');
const mapped = new Set();
for (const m of plan.matchAll(/NR-(\d{2})(?:\.\.(?:NR-)?(\d{2}))?/g)) for (let n = Number(m[1]); n <= Number(m[2] ?? m[1]); n++) mapped.add(n);
assert(cases.every(n => mapped.has(n)), 'unmapped scenario');
const docPaths = [
  'docs/mvp/03-domain-model-erd.md', 'docs/mvp/11-architecture-overview.md', 'docs/mvp/12-kanban.md',
  'docs/mvp/38-nodia-ai-research-and-v1-plan.md', 'docs/mvp/40-nodia-ai-tool-catalog-v1.md', 'docs/mvp/41-nodia-ai-v1-contracts.md',
  'docs/mvp/42-nodia-ai-erd.md', 'docs/mvp/43-nodia-ai-execution-architecture.md', 'docs/mvp/44-nodia-ai-data-model-review.md', 'docs/mvp/45-nodia-ai-implementation-plan.md',
  'docs/mvp/README.md', 'docs/mvp/00-progress.md', 'docs/nodia-ai/knowledge/README.md',
  'docs/architecture/decisions/ADR-033-nodia-ai-confirmation-and-sequential-recovery.md', 'docs/architecture/decisions/ADR-034-nodia-ai-postgres-jobs-and-retention.md',
  'docs/architecture/decisions/ADR-035-nodia-ai-bounded-persistence-and-knowledge.md',
];
let localLinksChecked = 0;
for (const p of docPaths) {
  const text = read(p);
  assert(!text.includes('\uFFFD'), `invalid text ${p}`);
  assert(!text.split(/\r?\n/).some(l => /[\t ]+$/.test(l)), `trailing whitespace ${p}`);
  for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
    const link = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!link || /^[a-z][a-z0-9+.-]*:\/\//i.test(link)) continue;
    assert(fs.existsSync(path.resolve(root, path.dirname(p), link)), `missing link ${p}: ${link}`); localLinksChecked++;
  }
}
let erdDiagramEdgesChecked = 0;
for (const edge of read('docs/mvp/42-nodia-ai-erd.md').matchAll(/^    (\w+) [|o{}-]+ (\w+) :/gm)) {
  assert(model.foreignKeys.some(f => (f.fromTable === edge[1] && f.toTable === edge[2]) || (f.fromTable === edge[2] && f.toTable === edge[1])), `diagram edge ${edge[1]} ${edge[2]}`);
  erdDiagramEdgesChecked++;
}
const artifactPaths = [manifestPath, dbmlPath, ...docPaths.filter(p => /(?:42-|43-|44-|45-|ADR-035)/.test(p)), 'docs/evidence/scripts/validate-nodia-ai-design.mjs'];
const result = {
  date: model.date, status: 'static_pass', scope: 'design_manifest_integrity_and_scenario_task_traceability_not_runtime_validation',
  designRevision: model.designRevision, counts, fullV1Tables: model.tables.filter(t => !t.activation).length, conditionalTables: ['nodia_ai_adapter_states'],
  checks: { tableColumnKeyUniqueness: true, foreignKeyArityTypesUniqueTargets: true, setNullNullability: true, cascadeAcyclic: true, conversationPayloadCascade: true, unresolvedReceiptsPreferencesRuntimeSurviveChat: true, auditPurgesWithChat: true, dbmlTablesColumnsRelationsMatch: true, commonProtocolStateSetsMatch: 4, boundedStageMetadataPresent: true, redundantOrdinaryIndexesAbsent: true, knowledgeManifestPresent: true },
  cascadeSummary, cascadeNote: 'Table-level reachability; only run-linked grant rows cascade. Execution grant rows have run_id null and follow separate operational policy.',
  negativeDesignFixtures, sourceHashesChecked: model.sourceChecksums.length, localLinksChecked, erdDiagramEdgesChecked,
  reviewScenarios: { count: cases.length, assessment: 'design reasoning against repository contracts; NOT executed domain use cases', mappedToImplementationTasks: true },
  implementationTasks: { count: tasks.length, markedCompletedInPlan: taskEntries.filter(m => m[1] === 'x').map(m => 'AI-' + m[2]), runtimeTasksVerifiedByThisStaticCheck: 0 },
  artifacts: artifactPaths.map(file => ({ file, sha256: sha(file) })),
  limitations: ['No SQL migrations, locks, real jobs, storage, UI or provider inference executed', 'DBML textual parity checked; grammar/visual rendering not validated with a renderer', 'JSONB semantics, immutability, authority, idempotency and performance require real implementation and isolated runtime tests', 'Scenario mapping does not demonstrate scenario execution or acceptance'],
};
if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, 'docs/evidence/nodia-ai-erd-execution-validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, counts, negativeFixtures: negativeDesignFixtures.length, localLinksChecked, erdDiagramEdgesChecked, sourceHashesChecked: model.sourceChecksums.length, scenarios: cases.length, tasks: tasks.length, wroteEvidence: process.argv.includes('--write') }, null, 2));
