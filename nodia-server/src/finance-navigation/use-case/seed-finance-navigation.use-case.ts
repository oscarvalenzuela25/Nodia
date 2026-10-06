import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceNavigationService } from '../finance-navigation.service.js';

@Injectable()
export class SeedFinanceNavigationUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly navigation: FinanceNavigationService,
  ) {}

  execute(): Promise<{ group_id: string; module_id: string }> {
    // Registration never grants modules to users. Assignment remains explicit in Settings.
    return this.dataSource.transaction((manager) =>
      this.navigation.register(manager),
    );
  }
}
