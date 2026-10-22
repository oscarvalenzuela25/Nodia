// Redirect exactly one historical test's fixture import. Test body, compiled
// product code, manifests and original fixtures remain byte-for-byte intact.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './nodia-ai-unpublished.fixture.mjs' &&
      context.parentURL?.endsWith('/test/nodia-ai-ai34.integration.mjs'))
      return nextResolve(new URL('./nodia-ai-ai38-empty-publication.fixture.mjs', import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
