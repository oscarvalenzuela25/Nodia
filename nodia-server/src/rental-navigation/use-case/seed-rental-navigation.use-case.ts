import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RentalNavigationService } from '../rental-navigation.service.js';
import { withCoreAuthorityLock } from '../../authorization/core-authority-transaction.js';
@Injectable()
export class SeedRentalNavigationUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly navigation: RentalNavigationService,
  ) {}
  execute(): Promise<{ group_id: string; module_id: string }> {
    return this.dataSource.transaction('READ COMMITTED', (manager) =>
      withCoreAuthorityLock(manager, undefined, () =>
        this.navigation.register(manager),
      ),
    );
  }
}
