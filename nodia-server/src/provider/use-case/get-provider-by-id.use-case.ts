import { Injectable } from '@nestjs/common';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class GetProviderByIdUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(id: string) {
    return this.providerService.findOne(id);
  }
}
