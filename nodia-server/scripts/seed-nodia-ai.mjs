import 'reflect-metadata';
import source from '../dist/config/data-source.js';
import { NodiaAiNavigationService } from '../dist/nodia-ai/nodia-ai-navigation.service.js';
import { SeedNodiaAiNavigationUseCase } from '../dist/nodia-ai/use-case/seed-nodia-ai-navigation.use-case.js';

// Explicit installation step; never run by app startup/build.
try {
  await source.initialize();
  const ids = await new SeedNodiaAiNavigationUseCase(
    source,
    new NodiaAiNavigationService(),
  ).execute();
  console.log(
    'NodiaAI navigation registered; assign explicitly in Settings.',
    ids,
  );
} finally {
  if (source.isInitialized) await source.destroy();
}
