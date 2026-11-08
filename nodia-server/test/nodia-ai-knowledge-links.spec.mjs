import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryFile, repositoryDocumentLinkFile, validateShape, compileKnowledge, defaultRoot } from '../scripts/nodia-ai-knowledge/compiler.mjs';

function fixture(t) {
  const parent = fileURLToPath(new URL('../../.tmp/', import.meta.url));
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'knowledge-public-links-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(parent));
    assert.ok(path.basename(root).startsWith('knowledge-public-links-'));
    fs.rmSync(root, { recursive: true });
  });
  const put = relative => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '# Synthetic public-source fixture only\n');
    return target;
  };
  return { root, put };
}

test('document links accept multiple public Python sources without expanding metadata roots', t => {
  const { root, put } = fixture(t);
  for (const relative of ['nodia-gemini-microservice/contract.py', 'nodia-gemini-microservice/tests/test_contract.py']) {
    const target = put(relative);
    assert.equal(repositoryDocumentLinkFile(root, relative), fs.realpathSync(target));
    assert.throws(() => repositoryFile(root, relative), { message: 'invalid_repository_path' });
    assert.throws(() => validateShape('RepoPath', relative), { message: 'repopath_schema_invalid' });
  }
});

test('native links reject operational directories even when they contain Python files', t => {
  const { root, put } = fixture(t);
  for (const directory of ['browser_profile', 'session_state', 'profiles', 'perfiles', 'credentials', 'agentic_home', 'node_modules']) {
    const relative = `nodia-gemini-microservice/${directory}/private.py`;
    put(relative);
    assert.throws(() => repositoryDocumentLinkFile(root, relative), { message: 'native_document_link_denied' });
  }
});

test('native links retain hidden, traversal and non-Python denials', t => {
  const { root, put } = fixture(t);
  for (const relative of ['nodia-gemini-microservice/.env', 'nodia-gemini-microservice/.venv/module.py']) {
    put(relative);
    assert.throws(() => repositoryDocumentLinkFile(root, relative), { message: 'hidden_source_denied' });
  }
  put('nodia-gemini-microservice/config.json');
  assert.throws(() => repositoryDocumentLinkFile(root, 'nodia-gemini-microservice/config.json'), { message: 'native_document_link_denied' });
  assert.throws(() => repositoryDocumentLinkFile(root, 'nodia-gemini-microservice/../nodia-server/source.py'), { message: 'path_traversal' });
  assert.throws(() => repositoryDocumentLinkFile(root, 'nodia-gemini-microservice//source.py'), { message: 'path_traversal' });
});

test('native document links retain symlink and repository-containment protection', t => {
  const { root, put } = fixture(t);
  const target = put('nodia-server/synthetic-source.py');
  const link = path.join(root, 'nodia-gemini-microservice/linked');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(path.dirname(target), link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => repositoryDocumentLinkFile(root, 'nodia-gemini-microservice/linked/synthetic-source.py'), { message: 'symlink_denied' });
});

test('the approved C03 document builds its one selected fragment without changing historical publication', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(defaultRoot, 'nodia-server/config/nodia-ai-knowledge.registry.json')));
  const compiled = compileKnowledge(defaultRoot);
  assert.equal(compiled.manifest.capability_contracts.length, registry.capabilities.length);
  assert.equal(compiled.manifest.fragments.length, registry.bindings.length);
  const added = compiled.manifest.fragments.find(f => f.document_id === 'businesses.active-invoice-analysis');
  assert.deepEqual(added.sections, ['Uso del análisis en la generación activa']);
  assert.equal(added.sha256, '5504a3cc2716d5da1b233a36ac992ab24209bfee2133f7eabbdeb8346370b9b8');
  assert.ok(!compiled.assets.get(added.asset_path).includes('nodia-gemini-microservice/'));
});
