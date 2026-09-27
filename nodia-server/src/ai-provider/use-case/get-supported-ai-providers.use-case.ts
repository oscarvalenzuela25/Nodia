import { Injectable } from '@nestjs/common';
import { getSupportedAiProviders } from '../helpers/supported-providers.helper.js';
import type { SupportedProviderDef } from '../constants/supported-providers.constant.js';

@Injectable()
export class GetSupportedAiProvidersUseCase {
  async execute(): Promise<SupportedProviderDef[]> {
    return getSupportedAiProviders();
  }
}
