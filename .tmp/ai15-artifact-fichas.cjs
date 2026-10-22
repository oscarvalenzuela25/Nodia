const fs = require('node:fs');
const base = 'docs/nodia-ai/knowledge/businesses/features/';
for (const file of ['products.md', 'invoices-and-files.md', 'suppliers.md']) {
  const path = base + file;
  const text = fs.readFileSync(path, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw Error(path);
  const meta = JSON.parse(match[1]);
  meta.revision += 1;
  for (const source of [
    'nodia-server/src/nodia-ai-products/artifacts/artifacts.family.ts',
    'nodia-server/src/nodia-ai-products/artifacts/use-case/execute-nodia-ai-artifact.use-case.ts',
    'nodia-server/src/nodia-ai-products/artifacts/use-case/download-nodia-ai-artifact.use-case.ts',
    'nodia-server/src/nodia-ai-products/contracts/artifacts.schema.json',
  ]) if (!meta.sources.some((item) => item.path === source)) meta.sources.push({ path: source, kind: 'implementation' });
  if (!meta.verification.evidence_paths.includes('docs/evidence/nodia-ai-ai15-artifacts-integration.json'))
    meta.verification.evidence_paths.push('docs/evidence/nodia-ai-ai15-artifacts-integration.json');
  meta.verification.notes = 'AI-15: lecturas locales y tres artefactos regenerables privados implementados sin publicación. 24 comprobaciones compiladas HTTP/PostgreSQL desechable, incluyendo cinco de StorageService real con SDK/streams sintéticos, revocación, cancelación, bytes, límites SQL, reemplazo de clave, expiración y purga. 41 pruebas focales en cuatro casos de uso. Sin R2 real, Gemini real, aprobación ni publicación automática. Ver AI-15/61 para cierre global de las consultas externas y gates operativos.';
  fs.writeFileSync(path, '---\n' + JSON.stringify(meta, null, 2) + '\n---\n' + text.slice(match[0].length));
}
