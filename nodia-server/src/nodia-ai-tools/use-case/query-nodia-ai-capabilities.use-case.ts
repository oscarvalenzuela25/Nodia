import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { validateNodiaAiDto } from '../../nodia-ai-conversation/dto/nodia-ai-validation.js';
import {
  NodiaAiCapabilitiesQueryDto,
  NodiaAiCapabilityVersionQueryDto,
} from '../dto/nodia-ai-capabilities-query.dto.js';
import { NodiaAiToolsService } from '../nodia-ai-tools.service.js';
import { DiscoverNodiaAiToolsUseCase } from './discover-nodia-ai-tools.use-case.js';

/** HTTP and Agentic consume the same discovery rules and public projections. */
@Injectable()
export class QueryNodiaAiCapabilitiesUseCase {
  constructor(
    private readonly tools: NodiaAiToolsService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly discovery: DiscoverNodiaAiToolsUseCase,
  ) {}
  async execute(
    identity: NodiaAiActorReference,
    kind: 'search' | 'describe' | 'schema',
    input: unknown,
    name?: string,
  ) {
    const query =
      kind === 'search'
        ? validateNodiaAiDto(NodiaAiCapabilitiesQueryDto, input)
        : validateNodiaAiDto(NodiaAiCapabilityVersionQueryDto, input);
    if (
      kind !== 'search' &&
      (typeof name !== 'string' || !/^[a-z][a-z0-9_]{0,127}$/.test(name))
    )
      throw new BadRequestException('nodia_ai:invalid_tool_input');
    const fields = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined),
    );
    const normalized =
      kind === 'search' ? fields : { ...fields, tool_name: name };
    return this.tools.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await this.authorize.execute(identity, {}, manager);
      try {
        return await this.discovery.execute(
          manager,
          actor,
          actor.modules.map((module) => module.route),
          kind,
          normalized,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'nodia_ai:capability_denied'
        )
          throw new NotFoundException('nodia_ai:capability_not_found');
        if (
          error instanceof Error &&
          error.message === 'nodia_ai:catalog_changed'
        )
          throw new ConflictException('nodia_ai:catalog_changed');
        if (
          error instanceof Error &&
          error.message === 'nodia_ai:invalid_tool_input'
        )
          throw new BadRequestException('nodia_ai:invalid_tool_input');
        throw error;
      }
    });
  }
}
