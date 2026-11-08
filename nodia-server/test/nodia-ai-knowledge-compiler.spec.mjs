import { after, test } from 'node:test';
import { createKnowledgeCompilerFixtures } from '../scripts/nodia-ai-knowledge/compiler-fixtures.mjs';

const suite = createKnowledgeCompilerFixtures();
after(() => suite.cleanup());
for (const fixture of suite.cases) {
  test(fixture.name, t => {
    const result = fixture.run();
    if (result?.unavailable) t.skip('Filesystem junction unavailable on this host');
  });
}
