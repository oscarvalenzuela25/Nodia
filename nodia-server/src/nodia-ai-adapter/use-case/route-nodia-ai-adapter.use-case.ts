import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NodiaAiAdapterPort,
  type NodiaAiAdapterRequest,
  type NodiaAiContextMeasureInput,
} from '../types/nodia-ai-adapter.types.js';
import { GeminiNodiaAiAdapterUseCase } from './gemini-nodia-ai-adapter.use-case.js';
import { CodexNodiaAiAdapterUseCase } from './codex-nodia-ai-adapter.use-case.js';
import { ResolveNodiaAiAdapterUseCase } from './resolve-nodia-ai-adapter.use-case.js';
import { ApiNodiaAiAdapterUseCase } from './api-nodia-ai-adapter.use-case.js';

@Injectable()
export class RouteNodiaAiAdapterUseCase extends NodiaAiAdapterPort {
  constructor(
    private readonly resolver: ResolveNodiaAiAdapterUseCase,
    private readonly gemini: GeminiNodiaAiAdapterUseCase,
    private readonly codex: CodexNodiaAiAdapterUseCase,
    private readonly api: ApiNodiaAiAdapterUseCase,
  ) {
    super();
  }

  private async adapter(
    selection: NodiaAiSelection,
    manager?: EntityManager,
  ): Promise<NodiaAiAdapterPort> {
    const resolved = await this.resolver.execute(selection, manager);
    if (resolved === 'api') return this.api;
    return resolved === 'gemini' ? this.gemini : this.codex;
  }
  async measureContext(
    input: NodiaAiContextMeasureInput,
    signal?: AbortSignal,
  ) {
    return (await this.adapter(input.selection)).measureContext(input, signal);
  }
  async observe(selection: NodiaAiSelection, signal?: AbortSignal) {
    return (await this.adapter(selection)).observe(selection, signal);
  }
  async verifyConfiguration(
    selection: NodiaAiSelection,
    generation: string,
    manager?: EntityManager,
  ) {
    return (await this.adapter(selection, manager)).verifyConfiguration(
      selection,
      generation,
      manager,
    );
  }
  async execute(request: NodiaAiAdapterRequest, signal?: AbortSignal) {
    return (await this.adapter(request.selection)).execute(request, signal);
  }
}
