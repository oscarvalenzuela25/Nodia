import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RentalNavigationService } from '../rental-navigation.service.js';
@Injectable()
export class SeedRentalNavigationUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly navigation: RentalNavigationService,
  ) {}
  execute(): Promise<{ group_id: string; module_id: string }> {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await manager.query("SET LOCAL lock_timeout = '2s'");
      await manager.query("SET LOCAL statement_timeout = '5s'");
      return this.navigation.register(manager);
    });
  }
}
