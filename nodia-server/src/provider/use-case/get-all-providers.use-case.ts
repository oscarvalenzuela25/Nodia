import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { GetProvidersDto } from '../dto/get-providers.dto.js';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class GetAllProvidersUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(queryParams: GetProvidersDto, actor?: ActorReference) {
    return this.providerService.findAll(queryParams, actor);
  }
}
