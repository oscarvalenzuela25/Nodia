import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withCoreAuthorityLock } from '../../authorization/core-authority-transaction.js';
import { TeacherNavigationService, type TeacherNavigationRegistration } from '../teacher-navigation.service.js';

@Injectable()
export class SeedTeacherNavigationUseCase {
  constructor(private readonly source: DataSource, private readonly navigation: TeacherNavigationService) {}

  execute(): Promise<TeacherNavigationRegistration> {
    return this.source.transaction(manager => withCoreAuthorityLock(manager, undefined, () => this.navigation.register(manager)));
  }
}
