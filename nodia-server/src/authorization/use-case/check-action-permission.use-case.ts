import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CheckModuleAccessUseCase } from './check-module-access.use-case.js';

@Injectable()
export class CheckActionPermissionUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(userId: string, _actionKey: string): Promise<void> {
    // Legacy metadata remains descriptive; actions do not gate this product stage.
    await new CheckModuleAccessUseCase(this.dataSource).execute(userId, []);
  }
}
