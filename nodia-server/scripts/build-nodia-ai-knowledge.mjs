import fs from 'node:fs';
import path from 'node:path';
import { compileKnowledge, emitBundle, defaultRoot, repositoryFile } from './nodia-ai-knowledge/compiler.mjs';
import frontmatter from './nodia-ai-knowledge/frontmatter.cjs';

try {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check') || args.length > 1) throw new Error('invalid_build_argument');
  const previousPath = 'nodia-server/dist/nodia-ai/knowledge/manifest.json';
  const previous = fs.existsSync(path.join(defaultRoot, previousPath))
    ? frontmatter.parseStrictJson(fs.readFileSync(repositoryFile(defaultRoot, previousPath), 'utf8')) : null;
  const compiled = compileKnowledge(defaultRoot, previous);
  if (!args.includes('--check')) emitBundle(defaultRoot, compiled);
  console.log(JSON.stringify({ task: 'AI-06', mode: args.includes('--check') ? 'check' : 'build',
    sources: compiled.counts.sources, excluded: compiled.counts.excluded,
    documents: compiled.manifest.documents.length, fragments: compiled.manifest.fragments.length,
    catalogRelease: compiled.manifest.catalog_release, releaseId: compiled.manifest.release_id }));
} catch (error) {
  const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'knowledge_build_failed';
  console.error(JSON.stringify({ task: 'AI-06', error: code })); process.exitCode = 1;
}
