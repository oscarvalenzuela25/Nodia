// Current corpus/build verification; historical dated reconciliation stays untouched.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileKnowledge, verifyBundle, defaultRoot, registryPath, repositoryFile } from './nodia-ai-knowledge/compiler.mjs';
import fm from './nodia-ai-knowledge/frontmatter.cjs';

export function assertKnowledgeRuntimePin(pin, manifest, schemaHash) {
  const expected = {
    schema_version: 1, release_id: manifest.release_id,
    catalog_release: manifest.catalog_release, schema_sha256: schemaHash,
  };
  if (fm.canonical(pin) !== fm.canonical(expected)) throw new Error('knowledge_runtime_pin_mismatch');
}

export function checkCurrentKnowledge(root = defaultRoot) {
  const read = relative => fs.readFileSync(repositoryFile(root, relative), 'utf8');
  const previous = fm.parseStrictJson(read('nodia-server/dist/nodia-ai/knowledge/manifest.json'));
  const corpus = compileKnowledge(root, previous);
  const registry = fm.parseStrictJson(read(registryPath));
  const schemaHash = fm.sha256(fs.readFileSync(repositoryFile(root, 'nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json')));
  for (const location of ['src', 'dist']) {
    const directory = `nodia-server/${location}/nodia-ai-context/config`;
    assertKnowledgeRuntimePin(fm.parseStrictJson(read(`${directory}/knowledge-pin.json`)), corpus.manifest, schemaHash);
    if (fm.sha256(fs.readFileSync(repositoryFile(root, `${directory}/knowledge-schema.json`))) !== schemaHash)
      throw new Error('knowledge_runtime_schema_mismatch');
  }
  const bundle = verifyBundle(path.join(root, 'nodia-server/dist/nodia-ai/knowledge'), corpus.manifest.release_id, corpus.manifest.catalog_release);
  assert.deepEqual(bundle, corpus.manifest, 'Compiled bundle differs from current source publication');

  // Preserve the historical local-link/authoring checks, without dated release assumptions.
  const files = [
    'docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md',
    'docs/architecture/decisions/ADR-038-nodia-ai-compiled-knowledge-contract.md',
    ...registry.source_paths,
    'docs/nodia-ai/knowledge/_templates/product.md', 'docs/nodia-ai/knowledge/_templates/feature.md',
  ];
  let localLinksChecked = 0;
  for (const file of files) {
    const doc = read(file);
    assert(!doc.includes('\uFFFD'), `Invalid replacement character: ${file}`);
    assert(!doc.split(/\r?\n/).some(line => /[\t ]+$/.test(line)), `Whitespace: ${file}`);
    for (const match of doc.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g, '').split('#')[0];
      if (!link || /^[a-z][a-z0-9+.-]*:\/\//i.test(link)) continue;
      assert(fs.existsSync(path.resolve(root, path.dirname(file), link)), `Broken link: ${file} -> ${link}`);
      localLinksChecked++;
    }
  }
  return {
    task: 'nodia_ai_current_knowledge', status: 'passed', mode: 'read_only',
    source_documents: corpus.counts.sources, excluded_documents: corpus.counts.excluded,
    published_documents: corpus.manifest.documents.length, published_fragments: corpus.manifest.fragments.length,
    published_capabilities: corpus.manifest.capability_contracts.length,
    release_id: corpus.manifest.release_id, catalog_release: corpus.manifest.catalog_release,
    schema_sha256: schemaHash, runtime_pins: ['src', 'dist'], local_links_checked: localLinksChecked,
    limits: [
      'Filesystem/compiler fixtures run separately in the same package command. Synthetic approvals are not approval of actual documents.',
      'Verifies current declared sources, local emitted bundle and source/dist pins; no deployed VM equality, API AST inventory, DI, SQL, provider or UI acceptance.',
      'Historical dated release unrolls, fixed source/publication counts and reconciliation evidence are intentionally not executed or rewritten.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => arg !== '--current')) throw new Error('knowledge_check_argument_invalid');
    console.log(JSON.stringify(checkCurrentKnowledge()));
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'knowledge_current_check_failed';
    console.error(JSON.stringify({ task: 'nodia_ai_current_knowledge', status: 'failed', code }));
    process.exitCode = 1;
  }
}
