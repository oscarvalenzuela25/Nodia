// AI38 compatibility profile: genuinely empty publication across every family.
// AI34 predates selective write/common publication; keep its historical file intact.
import { createNodiaAiUnpublishedFixture } from './nodia-ai-unpublished.fixture.mjs';
import { loadAi } from './nodia-ai.integration.fixture.mjs';

export async function createNodiaAiUnpublishedFixtureForAi38() {
  const base = await createNodiaAiUnpublishedFixture();
  const Registry = await loadAi('nodia-ai-tools/nodia-ai-tool-registry.module', 'NodiaAiToolRegistryModule');
  const types = await Promise.all([
    ['nodia-ai-write-tools/nodia-ai-write-tools.module', 'NodiaAiWriteToolsModule'],
    ['nodia-ai-invoice-analysis/nodia-ai-invoice-analysis.module', 'NodiaAiInvoiceAnalysisModule'],
    ['nodia-ai-common-reads/nodia-ai-common-reads.module', 'NodiaAiCommonReadsModule'],
    ['nodia-ai-common-preparation/nodia-ai-common-preparation.module', 'NodiaAiCommonPreparationModule'],
  ].map(([file, name]) => loadAi(file, name)));
  const imports = Reflect.getMetadata('imports', Registry);
  return {
    override(builder) {
      base.override(builder);
      for (const ModuleType of types) {
        const actual = imports.find(value => value?.module === ModuleType);
        if (!actual) throw Error('Missing explicit AI38 publication composition');
        builder.overrideModule(actual).useModule(ModuleType.forPublication([]));
      }
      return builder;
    },
    close: () => base.close(),
  };
}

export { createNodiaAiUnpublishedFixtureForAi38 as createNodiaAiUnpublishedFixture };
