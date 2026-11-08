import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class GetProviderByIdUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(id: string, actor?: ActorReference) {
    return this.providerService.findOne(id, actor);
  }
}
