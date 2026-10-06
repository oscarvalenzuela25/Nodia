import 'reflect-metadata';
import dataSource from '../dist/config/data-source.js';
import { SeedFinanceNavigationUseCase } from '../dist/finance-navigation/use-case/seed-finance-navigation.use-case.js';
import { FinanceNavigationService } from '../dist/finance-navigation/finance-navigation.service.js';

// Explicit operational command: uses the configured DB only when invoked manually.
try {
  await dataSource.initialize();
  const ids = await new SeedFinanceNavigationUseCase(
    dataSource,
    new FinanceNavigationService(),
  ).execute();
  console.log(
    'Finance navigation registered; assign the module through Settings.',
    ids,
  );
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
