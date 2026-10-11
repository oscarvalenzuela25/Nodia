import assert from 'node:assert/strict';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, parse, join } from 'node:path';

const path = process.argv[2];
assert(path && isAbsolute(path), 'Pass the absolute path to nodia.json.');
const bytes = await readFile(path);
const original = JSON.parse(bytes.toString('utf8'));
const diagram = structuredClone(original);
const property = diagram.tables.find(
  (table) => table.name === 'rental_properties',
);
assert(property, 'rental_properties must already exist.');
assert.equal(diagram.database, 'postgresql');
const fields = Object.fromEntries(
  property.fields.map((field) => [field.name, field]),
);
for (const name of ['check_in_time', 'check_out_time']) {
  assert(fields[name]?.type === 'TIME');
  fields[name].notNull = false;
  fields[name].comment =
    'Metadato histórico nullable. No se muestra en el formulario ni se hereda a reservas; cada reserva exige su propio horario.';
}
assert(
  fields.timezone?.notNull,
  'The persisted calendar timezone remains required.',
);
fields.timezone.comment =
  'Zona interna validada al crear con RENTAL_DEFAULT_TIMEZONE (base America/Santiago). No es input del formulario ni depende del navegador.';
fields.default_cancellation_policy_id.comment =
  'Política opcional de este mismo alojamiento. FK compuesta real conservada en PostgreSQL; documentada en la nota de ALTER TABLE para evitar el ciclo del grafo visual.';
property.comment =
  'Alojamiento, propietario, capacidad, zona interna y valores comerciales habituales. Horarios por reserva; horarios legacy nullable desde 2026-10-09. La FK de política predeterminada se documenta como ALTER TABLE en la nota del diagrama y su archivo SQL adjunto.';

const constraint = 'fk_rental_properties_id_default_cancellation_policy_id';
const returning = diagram.references.filter(
  (reference) => reference.name === constraint,
);
assert(returning.length <= 1, 'Unexpected duplicate default-policy FK.');
if (returning.length) {
  const policy = diagram.tables.find(
    (table) => table.name === 'rental_cancellation_policies',
  );
  assert(policy);
  const policyFields = Object.fromEntries(
    policy.fields.map((field) => [field.name, field]),
  );
  assert.equal(returning[0].startTableId, property.id);
  assert.equal(returning[0].endTableId, policy.id);
  assert.deepEqual(returning[0].fields, [
    { startFieldId: fields.id.id, endFieldId: policyFields.property_id.id },
    {
      startFieldId: fields.default_cancellation_policy_id.id,
      endFieldId: policyFields.id.id,
    },
  ]);
}
// A visual projection: keep the database constraint, document its second DDL phase.
diagram.references = diagram.references.filter(
  (reference) => reference.name !== constraint,
);
const sql = `-- Complemento del SQL exportado desde nodia.json: ejecutar después de crear ambas tablas.
-- La BD Nodia existente ya tiene esta FK; esto NO es una migración para retirarla.
ALTER TABLE "rental_properties"
  ADD CONSTRAINT "${constraint}"
  FOREIGN KEY ("id", "default_cancellation_policy_id")
  REFERENCES "rental_cancellation_policies" ("property_id", "id")
  ON DELETE RESTRICT;
`;
const noteId = 'rental-default-policy-fk';
const content = `FK real de política predeterminada: pertenece al mismo alojamiento.
El grafo visual omite solo esta arista de retorno para evitar los avisos circulares del editor. PostgreSQL conserva la restricción. Crear tablas primero y agregar esta FK después; no se trata de DEFERRABLE ni se debilita la pertenencia.

${sql}
Archivo adjunto: ${parse(path).name}.rental-default-policy.sql
Fuente completa: docs/mvp/27-rental-reservations-erd.md y migración 1791146000000.
`;
const existingNote = diagram.notes.find((note) => note.id === noteId);
if (existingNote) existingNote.content = content;
else
  diagram.notes.push({
    id: noteId,
    title: 'Política predeterminada: FK después de crear tablas',
    content,
    x: property.x + 650,
    y: property.y - 760,
    width: 600,
    height: 700,
    color: '#fef3c7',
    locked: false,
  });

// Mirror DrawDB's circular relationship traversal; original input reproduces 19 alerts.
function circularIssues(input) {
  const issues = [],
    visited = new Set();
  function visit(id, ancestors = []) {
    if (ancestors.includes(id)) {
      issues.push(id);
      return;
    }
    visited.add(id);
    for (const reference of input.references)
      if (
        reference.startTableId === id &&
        reference.startTableId !== reference.endTableId
      )
        visit(reference.endTableId, [...ancestors, id]);
  }
  for (const table of input.tables) if (!visited.has(table.id)) visit(table.id);
  return issues;
}
assert.equal(
  circularIssues(diagram).length,
  0,
  'Refusing a diagram with remaining circular dependencies.',
);
assert.equal(diagram.tables.length, original.tables.length);
for (const table of original.tables.filter((table) => table.id !== property.id))
  assert.deepEqual(
    diagram.tables.find((item) => item.id === table.id),
    table,
  );
for (const key of Object.keys(original).filter(
  (key) => !['lastModified', 'tables', 'references', 'notes'].includes(key),
))
  assert.deepEqual(diagram[key], original[key]);
assert.deepEqual(
  diagram.references,
  original.references.filter((reference) => reference.name !== constraint),
);
assert.deepEqual(
  diagram.notes.filter((note) => note.id !== noteId),
  original.notes.filter((note) => note.id !== noteId),
);
const ids = diagram.tables.flatMap((table) => [
  table.id,
  ...table.fields.map((field) => field.id),
]);
assert.equal(new Set(ids).size, ids.length);
assert.deepEqual(
  diagram.tables.map((table) => ({
    id: table.id,
    x: table.x,
    y: table.y,
    fields: table.fields.map((field) => field.id),
  })),
  original.tables.map((table) => ({
    id: table.id,
    x: table.x,
    y: table.y,
    fields: table.fields.map((field) => field.id),
  })),
);
const sqlPath = join(
  parse(path).dir,
  `${parse(path).name}.rental-default-policy.sql`,
);
const currentSql = await readFile(sqlPath, 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
if (currentSql !== null)
  assert.equal(
    currentSql,
    sql,
    'Refusing to overwrite a manually edited companion SQL.',
  );
let backup;
if (JSON.stringify(diagram) !== JSON.stringify(original)) {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  backup = `${path}.before-rental-diagram-${stamp}.bak`;
  await copyFile(path, backup);
  assert.deepEqual(await readFile(backup), bytes);
  diagram.lastModified = new Date().toISOString();
  const temporary = `${path}.${stamp}.tmp`;
  await writeFile(temporary, JSON.stringify(diagram, null, 2) + '\n', {
    flag: 'wx',
  });
  assert.deepEqual(
    await readFile(path),
    bytes,
    'The diagram changed during preparation; original preserved.',
  );
  if (currentSql === null) await writeFile(sqlPath, sql, { flag: 'wx' });
  await rename(temporary, path);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), diagram);
} else if (currentSql === null) await writeFile(sqlPath, sql, { flag: 'wx' });
console.log(
  JSON.stringify({
    changed: Boolean(backup),
    backup,
    tables: diagram.tables.length,
    visualReferences: diagram.references.length,
    documentedSqlConstraints: 1,
    circularIssuesBefore: circularIssues(original).length,
    circularIssuesAfter: 0,
    sqlPath,
  }),
);
