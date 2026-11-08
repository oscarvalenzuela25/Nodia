import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NodiaAiNavigationService } from '../nodia-ai-navigation.service.js';
import { withCoreAuthorityLock } from '../../authorization/core-authority-transaction.js';

@Injectable()
export class SeedNodiaAiNavigationUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly navigation: NodiaAiNavigationService,
  ) {}

  execute(): Promise<{ group_id: string; module_id: string }> {
    // Explicit CLI only. Never assign a user or activate an existing disabled module/group.
    return this.dataSource.transaction((manager) =>
      withCoreAuthorityLock(manager, undefined, () =>
        this.navigation.register(manager),
      ),
    );
  }
}
