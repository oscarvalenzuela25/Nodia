import 'reflect-metadata';
import dataSource from '../dist/config/data-source.js';
import { SeedRentalNavigationUseCase } from '../dist/rental-navigation/use-case/seed-rental-navigation.use-case.js';
import { RentalNavigationService } from '../dist/rental-navigation/rental-navigation.service.js';
// Explicit operational command; assignment to users remains a separate Settings action.
try {
  await dataSource.initialize();
  const ids = await new SeedRentalNavigationUseCase(
    dataSource,
    new RentalNavigationService(),
  ).execute();
  console.log(
    'Rental navigation registered; assign the module through Settings.',
    ids,
  );
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
