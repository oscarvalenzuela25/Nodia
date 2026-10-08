import { readFile, writeFile, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const path = process.argv[2];
if (!path) throw new Error('Pass the absolute path to nodia.json.');
const original = JSON.parse(await readFile(path, 'utf8'));
const updated = structuredClone(original);
const catalog = updated.tables.find((table) => table.name === 'ai_provider_catalog');
assert(catalog, 'ai_provider_catalog must already exist.');
const provider = updated.tables.find((table) => table.name === 'ai_providers');
assert(provider, 'ai_providers must already exist.');
const removed = provider.fields.filter((field) => ['key', 'mode', 'fields_version'].includes(field.name));
for (const field of removed) assert(!JSON.stringify(updated.references).includes(field.id), `Referenced legacy column: ${field.name}`);
provider.fields = provider.fields.filter((field) => !removed.includes(field));
for (const name of ['use_api_key', 'use_token_plan_web', 'use_token_plan_agentic', 'is_default']) {
  if (!provider.fields.some((field) => field.name === name)) provider.fields.push({
    id: `AiProv_${name}`, name, type: 'BOOLEAN', default: 'false', check: '', primary: false,
    unique: false, notNull: true, increment: false, comment: 'Configuración de la instancia; no acredita disponibilidad del servicio.',
  });
}
if (!provider.fields.some((field) => field.name === 'default_mode')) provider.fields.push({
  id: 'AiProv_default_mode', name: 'default_mode', type: 'VARCHAR', size: '32', default: '', check: '',
  primary: false, unique: false, notNull: false, increment: false,
  comment: 'Modo preferido entre los use_* habilitados: api_key / token_plan_web / token_plan_agentic.',
});
const definitions = {
  can_use_api_key: 'Permite configurar API; no certifica disponibilidad. Gemini y OpenAI: true.',
  can_use_token_plan_web: 'Permite configurar sesión Web. Gemini: true; OpenAI: false.',
  can_use_token_plan_agentic: 'Permite configurar Agentic. Gemini y OpenAI: true en catálogo objetivo (migración Codex). No demuestra sesión ni inferencia.',
};
for (const [name, comment] of Object.entries(definitions)) {
  const existing = catalog.fields.find((field) => field.name === name);
  if (existing) { if (name === 'can_use_token_plan_agentic') existing.comment = comment; continue; }
  catalog.fields.push({ id: `AiCat_${name}`, name, type: 'BOOLEAN', default: 'false',
    check: '', primary: false, unique: false, notNull: true, increment: false, comment });
}
assert.deepEqual(updated.references, original.references);
assert.equal(updated.tables.length, original.tables.length);
for (const table of original.tables.filter((table) => ![catalog.name, provider.name].includes(table.name))) {
  assert.deepEqual(updated.tables.find((item) => item.id === table.id), table);
}
const ids = updated.tables.flatMap((table) => [table.id, ...table.fields.map((field) => field.id)]);
assert.equal(new Set(ids).size, ids.length);
if (JSON.stringify(updated) === JSON.stringify(original)) {
  console.log('Catalog and provider schema already aligned; diagram unchanged.');
} else {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  await copyFile(path, `${path}.before-ai-catalog-${stamp}.bak`);
  updated.lastModified = new Date().toISOString();
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  const verified = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(verified, updated);
  console.log(`Catalog/provider schema aligned; ${verified.tables.length} tables / ${verified.references.length} references preserved. Backup created.`);
}
