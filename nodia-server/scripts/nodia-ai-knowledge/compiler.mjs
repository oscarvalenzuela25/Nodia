// Build tooling only: synchronous bounded files, no Nest/DB/provider initialization.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import frontmatter from './frontmatter.cjs';

const { parseStrictJson, parseDocument, canonical, contentHash, sha256 } = frontmatter;
export const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const registryPath = 'nodia-server/config/nodia-ai-knowledge.registry.json';
const schemaBytes = fs.readFileSync(new URL('./contracts.schema.json', import.meta.url));
export const schema = parseStrictJson(schemaBytes.toString('utf8'));
const ajv = new Ajv({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
export function validateShape(name, value) {
  ensure(ajv.getSchema(schema.$id + '#/$defs/' + name)?.(value), name.toLowerCase() + '_schema_invalid');
}
function unique(values, code) { ensure(new Set(values).size === values.length, code); }
function sorted(values) { return [...values].sort(); }

function resolveRepositoryFile(root, relative, nativeDocumentLink) {
  const native = nativeDocumentLink && typeof relative === 'string' && relative.startsWith('nodia-gemini-microservice/');
  ensure(typeof relative === 'string' && (native
    ? /^nodia-gemini-microservice\/[A-Za-z0-9_./-]+$/.test(relative)
    : /^(docs|nodia-server|nodia-client)\/[A-Za-z0-9_./-]+$/.test(relative)), 'invalid_repository_path');
  ensure(!relative.split('/').some(p => p === '' || p === '.' || p === '..'), 'path_traversal');
  ensure(!relative.split('/').some(p => p.startsWith('.')), 'hidden_source_denied');
  if (native) {
    const directories = relative.split('/').slice(1, -1).map(p => p.toLowerCase());
    const operational = /^(?:browser_profiles?|session_states?|sessions?|profiles?|perfiles?|venv|agentic_home|gemini_home|antigravity_home|credentials?|secrets?|cookies?|temp_uploads|node_modules|__pycache__)$/;
    ensure(relative.endsWith('.py') && !directories.some(p => operational.test(p)), 'native_document_link_denied');
  }
  let target = path.resolve(root);
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    if (fs.existsSync(target)) ensure(!fs.lstatSync(target).isSymbolicLink(), 'symlink_denied');
  }
  ensure(fs.existsSync(target) && fs.statSync(target).isFile(), 'source_missing');
  const resolved = fs.realpathSync(target), inside = path.relative(fs.realpathSync(root), resolved);
  ensure(inside !== '..' && !inside.startsWith('..' + path.sep) && !path.isAbsolute(inside), 'source_outside_root');
  return resolved;
}
// Metadata, schema and implementation references retain their original three-root contract.
export function repositoryFile(root, relative) { return resolveRepositoryFile(root, relative, false); }
// Only approved-document hyperlink validation opts into public Python source links.
export function repositoryDocumentLinkFile(root, relative) { return resolveRepositoryFile(root, relative, true); }
function readUtf8(file, limit = 1048576) {
  ensure(fs.statSync(file).size <= limit, 'input_too_large');
  const bytes = fs.readFileSync(file);
  ensure(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), 'utf8_bom_denied');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('invalid_utf8'); }
}
function hashedFile(root, relative) { return { path: relative, sha256: sha256(fs.readFileSync(repositoryFile(root, relative))) }; }
function metadataReferences(metadata) {
  return [...metadata.sources.map(s => s.path), ...metadata.verification.evidence_paths,
    ...(metadata.approval ? [metadata.approval.reference] : [])];
}
export function checkMetadata(metadata, sourcePath) {
  validateShape('Metadata', metadata);
  const key = metadata.document_id.split('.');
  ensure(key[0] === metadata.product_id, 'document_product_mismatch');
  ensure((metadata.kind === 'product' && key.length === 1) || (metadata.kind === 'feature' && key.length === 2), 'document_kind_mismatch');
  const expected = `docs/nodia-ai/knowledge/${metadata.product_id}/` +
    (metadata.kind === 'product' ? 'README.md' : `features/${key[1]}.md`);
  ensure(sourcePath === expected, 'document_path_mismatch');
  unique(metadata.sources.map(s => s.path), 'duplicate_source_reference');
  if (metadata.document_status === 'approved') {
    ensure(metadata.approval !== null, 'approval_required');
    ensure(metadata.verification.checked_on !== null && metadata.verification.evidence_paths.length > 0, 'approval_verification_required');
  }
  else ensure(metadata.approval === null, 'approval_on_unapproved_document');
}
function checkLinks(root, sourcePath, body) {
  for (const match of body.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
    const link = match[1].replace(/^<|>$/g, '');
    if (!link || link.startsWith('#') || /^https?:\/\//i.test(link)) continue;
    ensure(!/^[a-z][a-z0-9+.-]*:/i.test(link) && !link.includes('\\'), 'invalid_document_link');
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), link.split('#')[0]));
    repositoryDocumentLinkFile(root, target);
  }
}
function selectedSections(body, titles) {
  ensure(!body.includes('<!--'), 'html_comment_not_supported');
  const lines = body.split('\n'), sections = new Map(); let current = null, fenced = null;
  for (const line of lines) {
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (!fenced) fenced = { character: fence[0], length: fence.length };
      else if (fenced.character === fence[0] && fence.length >= fenced.length &&
        /^ {0,3}(`{3,}|~{3,})\s*$/.test(line)) fenced = null;
    }
    const heading = !fenced && /^## ([^\n]+)$/.exec(line);
    if (heading) {
      current = heading[1].trim(); ensure(!sections.has(current), 'duplicate_section'); sections.set(current, [line]);
    } else if (current) sections.get(current).push(line);
  }
  ensure(!fenced, 'unclosed_markdown_fence');
  return titles.map(title => {
    ensure(sections.has(title), 'section_missing');
    // Traceability paths stay in the manifest; do not send repo/URL links to the model.
    return sections.get(title).join('\n').trim().replace(/!?\[([^\]\n]+)\]\([^)\n]+\)/g, '$1');
  }).join('\n\n') + '\n';
}

export function compileKnowledge(root = defaultRoot, previousManifest = null) {
  const registry = parseStrictJson(readUtf8(repositoryFile(root, registryPath)));
  validateShape('Registry', registry);
  unique(registry.capabilities.map(c => c.capability_id), 'duplicate_capability');
  unique(registry.bindings.map(b => b.document_id + ':' + b.fragment_id), 'duplicate_binding');
  if (registry.capabilities.length || registry.bindings.length) ensure(registry.context_module_route !== null, 'context_module_unresolved');
  const documents = new Map(), schemaFiles = new Map(), capabilities = new Map();
  const counts = { sources: registry.source_paths.length, excluded: 0 };
  for (const sourcePath of registry.source_paths) {
    ensure(/^docs\/nodia-ai\/knowledge\/[a-z][a-z0-9-]*\/(README\.md|features\/[a-z][a-z0-9-]*\.md)$/.test(sourcePath), 'knowledge_path_denied');
    const parsed = parseDocument(readUtf8(repositoryFile(root, sourcePath), 262144));
    checkMetadata(parsed.metadata, sourcePath);
    ensure(!documents.has(parsed.metadata.document_id), 'duplicate_document_id');
    for (const reference of metadataReferences(parsed.metadata)) repositoryFile(root, reference);
    if (parsed.metadata.document_status === 'approved') {
      ensure(parsed.metadata.approval.revision === parsed.metadata.revision, 'approval_revision_mismatch');
      ensure(parsed.metadata.approval.content_sha256 === contentHash(parsed.metadata, parsed.body), 'approval_hash_mismatch');
      checkLinks(root, sourcePath, parsed.body);
    } else counts.excluded++;
    documents.set(parsed.metadata.document_id, { ...parsed, sourcePath });
  }
  for (const d of documents.values()) if (d.metadata.kind === 'feature')
    ensure(documents.get(d.metadata.product_id)?.metadata.kind === 'product', 'product_document_missing');
  for (const c of registry.capabilities) {
    unique(c.implementation_sources.map(s => s.path), 'duplicate_implementation_source');
    for (const source of c.implementation_sources) {
      ensure(/^nodia-server\/src\/.+\.ts$/.test(source.path), 'implementation_source_denied');
      ensure(hashedFile(root, source.path).sha256 === source.sha256, 'implementation_hash_mismatch');
    }
    for (const evidence of c.evidence_paths) {
      ensure(evidence.startsWith('docs/evidence/'), 'capability_evidence_denied'); repositoryFile(root, evidence);
    }
    for (const reference of [c.input_schema, c.output_schema]) {
      ensure(reference.path.endsWith('.schema.json'), 'contract_path_denied');
      ensure(hashedFile(root, reference.path).sha256 === reference.sha256, 'contract_hash_mismatch');
      if (!schemaFiles.has(reference.path)) schemaFiles.set(reference.path, parseStrictJson(readUtf8(repositoryFile(root, reference.path))));
    }
    capabilities.set(c.capability_id, c);
  }
  const contracts = new Ajv({ strict: true, allErrors: true }); addFormats(contracts);
  for (const source of schemaFiles.values()) { ensure(typeof source.$id === 'string', 'schema_id_required'); contracts.addSchema(source); }
  for (const c of capabilities.values()) for (const reference of [c.input_schema, c.output_schema]) {
    const source = schemaFiles.get(reference.path);
    ensure(source.$defs?.[reference.definition], 'contract_definition_missing');
    ensure(contracts.getSchema(source.$id + '#/$defs/' + reference.definition), 'contract_not_compilable');
  }
  const fragments = [], assets = new Map(), included = new Map(), boundCapabilities = new Set();
  for (const binding of registry.bindings) {
    const document = documents.get(binding.document_id); ensure(document, 'binding_document_missing');
    const m = document.metadata;
    ensure(m.document_status === 'approved', 'binding_document_unapproved');
    ensure(['partial', 'implemented'].includes(m.implementation.status) && ['verified', 'published'].includes(m.integration_status), 'binding_document_not_verified');
    unique(binding.requires.map(r => r.capability_id), 'duplicate_capability_requirement');
    const targetModules = new Set();
    for (const requirement of binding.requires) {
      const c = capabilities.get(requirement.capability_id); ensure(c, 'capability_missing');
      ensure(c.revision === requirement.revision && c.input_schema.sha256 === requirement.input_schema_sha256 &&
        c.output_schema.sha256 === requirement.output_schema_sha256, 'capability_contract_incompatible');
      for (const route of c.required_module_routes) targetModules.add(route);
      boundCapabilities.add(c.capability_id);
    }
    ensure(canonical(sorted(targetModules)) === canonical(sorted(binding.required_module_routes)), 'module_binding_mismatch');
    const body = selectedSections(document.body, binding.sections), bytes = Buffer.byteLength(body, 'utf8');
    ensure(bytes > 0 && bytes <= 262144, 'fragment_size_exceeded');
    const digest = sha256(body), asset = `fragments/${digest}.md`;
    assets.set(asset, body);
    fragments.push({ document_id: m.document_id, fragment_id: binding.fragment_id, purpose: binding.purpose,
      sections: binding.sections, asset_path: asset, sha256: digest, byte_length: bytes,
      required_module_routes: sorted(new Set([registry.context_module_route, ...targetModules])), requires: binding.requires });
    included.set(m.document_id, { document_id: m.document_id, source_path: document.sourcePath, revision: m.revision,
      content_sha256: contentHash(m, document.body), source_hashes: m.sources.map(s => hashedFile(root, s.path)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) });
  }
  for (const c of registry.capabilities) ensure(boundCapabilities.has(c.capability_id), 'published_capability_without_knowledge');
  for (const d of documents.values()) if (d.metadata.document_status === 'approved' &&
    ['verified', 'published'].includes(d.metadata.integration_status)) ensure(included.has(d.metadata.document_id), 'verified_document_without_binding');
  const by = key => (a, b) => a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
  const payload = { schema_version: 1, registry_sha256: sha256(canonical(registry)), contract_schema_sha256: sha256(schemaBytes),
    catalog_release: registry.catalog_release, context_module_route: registry.context_module_route,
    documents: [...included.values()].sort(by('document_id')),
    fragments: fragments.sort((a, b) => (a.document_id + ':' + a.fragment_id) < (b.document_id + ':' + b.fragment_id) ? -1 : 1),
    capability_contracts: [...capabilities.values()].sort(by('capability_id')) };
  const manifest = { ...payload, release_id: sha256(canonical(payload)) };
  validateShape('ReleaseManifest', manifest);
  if (previousManifest !== null) {
    validateShape('ReleaseManifest', previousManifest);
    const previous = new Map(previousManifest.documents.map(d => [d.document_id, d]));
    for (const current of manifest.documents) {
      const old = previous.get(current.document_id);
      if (old) ensure(current.revision >= old.revision &&
        (current.content_sha256 === old.content_sha256 || current.revision > old.revision), 'document_revision_not_advanced');
    }
  }
  return { manifest, assets, counts };
}

export function verifyBundle(assetRoot, expectedReleaseId, expectedCatalogRelease) {
  ensure(typeof expectedReleaseId === 'string' && /^[a-f0-9]{64}$/.test(expectedReleaseId), 'trusted_release_pin_required');
  ensure(!fs.lstatSync(assetRoot).isSymbolicLink() && !fs.lstatSync(path.join(assetRoot, 'manifest.json')).isSymbolicLink(), 'symlink_denied');
  const manifest = parseStrictJson(readUtf8(path.join(assetRoot, 'manifest.json')));
  validateShape('ReleaseManifest', manifest);
  const { release_id: digest, ...payload } = manifest;
  ensure(digest === expectedReleaseId && digest === sha256(canonical(payload)), 'release_hash_mismatch');
  ensure(manifest.catalog_release === expectedCatalogRelease && manifest.contract_schema_sha256 === sha256(schemaBytes), 'release_contract_mismatch');
  for (const fragment of manifest.fragments) {
    let resolved = assetRoot;
    for (const part of fragment.asset_path.split('/')) {
      resolved = path.join(resolved, part); ensure(!fs.lstatSync(resolved).isSymbolicLink(), 'symlink_denied');
    }
    const bytes = fs.readFileSync(resolved);
    ensure(bytes.length === fragment.byte_length && sha256(bytes) === fragment.sha256, 'fragment_hash_mismatch');
  }
  return manifest;
}

function outputParent(root) {
  const relative = 'nodia-server/dist/nodia-ai'; let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current)) ensure(!fs.lstatSync(current).isSymbolicLink(), 'output_symlink_denied');
  }
  fs.mkdirSync(current, { recursive: true });
  const inside = path.relative(fs.realpathSync(root), fs.realpathSync(current));
  ensure(!inside.startsWith('..') && !path.isAbsolute(inside), 'output_outside_root'); return current;
}
function removeOwnDirectory(target, parent) {
  ensure(path.dirname(target) === parent && /^\.knowledge-(stage|backup)-[a-f0-9-]+$/.test(path.basename(target)), 'unsafe_cleanup_target');
  if (!fs.existsSync(target)) return;
  const real = fs.realpathSync(target), relative = path.relative(fs.realpathSync(parent), real);
  ensure(!relative.startsWith('..') && !path.isAbsolute(relative) && !fs.lstatSync(target).isSymbolicLink(), 'unsafe_cleanup_resolution');
  fs.rmSync(target, { recursive: true });
}
export function emitBundle(root, compiled) {
  const parent = outputParent(root), target = path.join(parent, 'knowledge'), lock = path.join(parent, '.knowledge.lock');
  try { fs.mkdirSync(lock); } catch { throw new Error('knowledge_build_locked'); }
  const stage = path.join(parent, '.knowledge-stage-' + randomUUID()), backup = path.join(parent, '.knowledge-backup-' + randomUUID());
  let previous = false;
  try {
    fs.mkdirSync(stage);
    for (const [relative, body] of compiled.assets) {
      ensure(/^fragments\/[a-f0-9]{64}\.md$/.test(relative), 'invalid_asset_path');
      const file = path.join(stage, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body, 'utf8');
    }
    fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(compiled.manifest, null, 2) + '\n');
    verifyBundle(stage, compiled.manifest.release_id, compiled.manifest.catalog_release);
    if (fs.existsSync(target)) { ensure(!fs.lstatSync(target).isSymbolicLink(), 'output_symlink_denied'); fs.renameSync(target, backup); previous = true; }
    fs.renameSync(stage, target);
    if (previous) removeOwnDirectory(backup, parent);
    return target;
  } finally {
    if (previous && !fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target);
    removeOwnDirectory(stage, parent);
    fs.rmdirSync(lock);
  }
}
