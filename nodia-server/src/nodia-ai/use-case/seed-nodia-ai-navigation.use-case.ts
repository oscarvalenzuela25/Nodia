import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NodiaAiNavigationService } from '../nodia-ai-navigation.service.js';

@Injectable()
export class SeedNodiaAiNavigationUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly navigation: NodiaAiNavigationService,
  ) {}

  execute(): Promise<{ group_id: string; module_id: string }> {
    // Explicit CLI only. Never assign a user or activate an existing disabled module/group.
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout = '2s'");
      await manager.query("SET LOCAL statement_timeout = '5s'");
      return this.navigation.register(manager);
    });
  }
}
