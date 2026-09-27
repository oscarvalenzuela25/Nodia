import { Injectable } from '@nestjs/common';
import { getEnabledWebAiProviders } from '../helpers/web-providers.helper.js';

export interface EnabledWebAiProvidersResponse {
  enabled_providers: string[];
}

@Injectable()
export class GetEnabledWebAiProvidersUseCase {
  async execute(): Promise<EnabledWebAiProvidersResponse> {
    const enabled_providers = getEnabledWebAiProviders();
    return { enabled_providers };
  }
}
