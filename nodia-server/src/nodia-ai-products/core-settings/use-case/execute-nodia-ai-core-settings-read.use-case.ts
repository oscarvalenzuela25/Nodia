import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { currentActor } from '../../../authorization/authority-transaction.js';
import type { NodiaAiJsonObject } from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import type { ActionService } from '../../../action/action.service.js';
import type { BusinessActionService } from '../../../business-action/business-action.service.js';
import type { ModuleService } from '../../../module/module.service.js';
import type { RoleService } from '../../../role/role.service.js';
import type { GetAllActionsUseCase } from '../../../action/use-case/get-all-actions.use-case.js';
import type { GetAllBusinessActionsUseCase } from '../../../business-action/use-case/get-all-business-actions.use-case.js';
import type { GetAllModulesUseCase } from '../../../module/use-case/get-all-modules.use-case.js';
import type { GetAllModuleGroupsUseCase } from '../../../module-group/use-case/get-all-module-groups.use-case.js';
import type { GetAllRolesUseCase } from '../../../role/use-case/get-all-roles.use-case.js';
import type { GetAllUsersUseCase } from '../../../user/use-case/get-all-users.use-case.js';
import type { GetActionsDto } from '../../../action/dto/get-actions.dto.js';
import type { GetBusinessActionsDto } from '../../../business-action/dto/get-business-actions.dto.js';
import type { GetModulesDto } from '../../../module/dto/get-modules.dto.js';
import type { GetModuleGroupsDto } from '../../../module-group/dto/get-module-groups.dto.js';
import type { GetRolesDto } from '../../../role/dto/get-roles.dto.js';
import type { GetUsersDto } from '../../../user/dto/get-users.dto.js';

export interface NodiaAiCoreSettingsReadPorts {
  actions: Pick<ActionService, 'findOne'>;
  businessActions: Pick<BusinessActionService, 'findOne'>;
  modules: Pick<ModuleService, 'findOne'>;
  roles: Pick<RoleService, 'findOne'>;
  listActions: Pick<GetAllActionsUseCase, 'execute'>;
  listBusinessActions: Pick<GetAllBusinessActionsUseCase, 'execute'>;
  listModules: Pick<GetAllModulesUseCase, 'execute'>;
  listGroups: Pick<GetAllModuleGroupsUseCase, 'execute'>;
  listRoles: Pick<GetAllRolesUseCase, 'execute'>;
  listUsers: Pick<GetAllUsersUseCase, 'execute'>;
}
export type CoreSettingsReadOperation = keyof NodiaAiCoreSettingsReadPorts;
export type CoreSettingsResource =
  | 'actions'
  | 'business_actions'
  | 'modules'
  | 'module_groups'
  | 'roles'
  | 'users';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('nodia_ai:invalid_tool_output');
  return value as Record<string, unknown>;
}
function select(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  const source = record(value);
  return Object.fromEntries(
    fields
      .filter((key) => Object.hasOwn(source, key))
      .map((key) => [key, source[key]]),
  );
}
function project(
  resource: CoreSettingsResource,
  value: unknown,
  detail: boolean,
): Record<string, unknown> {
  const source = record(value);
  const fields = ['id', 'key', 'is_active', 'created_at', 'updated_at'];
  if (resource === 'actions') fields.push('description');
  if (resource === 'business_actions') fields.push('has_description');
  if (resource === 'modules') fields.push('module_group_id', 'link', 'icon');
  if (resource === 'module_groups') fields.push('icon');
  if (resource === 'users') {
    fields.splice(fields.indexOf('key'), 1);
    fields.push('name', 'email', 'image_url');
  }
  const result = select(source, fields);
  if (resource !== 'users' && Array.isArray(source.translates))
    result.translates = source.translates.map((item) =>
      select(item, ['key', 'es', 'en']),
    );
  if (resource === 'modules' && detail && source.module_group)
    result.module_group = project('module_groups', source.module_group, false);
  if (resource === 'roles' && detail)
    result.actions = Array.isArray(source.actions)
      ? source.actions.map((item) => project('actions', item, false))
      : source.actions;
  return result;
}

@Injectable()
export class ExecuteNodiaAiCoreSettingsReadUseCase {
  constructor(private readonly ports: NodiaAiCoreSettingsReadPorts) {}

  async verifyAuthority(
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    const q =
      input.q && typeof input.q === 'object' && !Array.isArray(input.q)
        ? input.q
        : {};
    const ids = [
      input.id,
      ...Object.entries(q)
        .filter(([key]) => /_id_(eq|in)$/.test(key))
        .flatMap(([, value]) => (Array.isArray(value) ? value : [value])),
    ];
    for (const id of ids)
      if (
        id !== undefined &&
        (typeof id !== 'string' ||
          !/^[1-9][0-9]{0,18}$/.test(id) ||
          BigInt(id) > 9223372036854775807n)
      )
        throw new BadRequestException('nodia_ai:invalid_tool_input');
    // Core reads are authenticated global catalogs. Target-module authorization
    // remains in ToolGateway, and the native current session is checked again.
    await currentActor(context.manager, {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
    });
  }

  async verifyResultAuthority(
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    await this.verifyAuthority(input, context);
    if (input.id !== undefined && result.id !== input.id)
      throw new ForbiddenException('nodia_ai:tool_authority_denied');
  }

  async execute(
    operation: CoreSettingsReadOperation,
    resource: CoreSettingsResource,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiJsonObject> {
    await this.verifyAuthority(input, context);
    if (
      operation === 'actions' ||
      operation === 'businessActions' ||
      operation === 'modules' ||
      operation === 'roles'
    ) {
      if (operation === 'roles') {
        const limit = context.maxCollectionItems ?? 128;
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 4096)
          throw new Error('nodia_ai:context_limit');
        // Bound the join cardinality before TypeORM hydrates actions and their
        // translations. The authority barrier excludes concurrent Core writers.
        const [bounded]: { count: number }[] = await context.manager.query(
          'SELECT count(*)::integer AS count FROM (SELECT 1 FROM role_actions WHERE role_id=$1 LIMIT $2) bounded',
          [input.id, limit + 1],
        );
        if (
          !bounded ||
          !Number.isSafeInteger(bounded.count) ||
          bounded.count < 0
        )
          throw new Error('nodia_ai:invalid_tool_output');
        if (bounded.count > limit) throw new Error('nodia_ai:context_limit');
      }
      const result = await this.ports[operation].findOne(
        input.id as string,
        context.manager,
      );
      return JSON.parse(
        JSON.stringify(project(resource, result, true)),
      ) as NodiaAiJsonObject;
    }
    const { active = 'active', ...rest } = input;
    const q = {
      ...(rest.q as Record<string, unknown> | undefined),
      ...(active === 'all' ? {} : { is_active_eq: active === 'active' }),
    };
    // No unbounded all or relation fan-out in list tools. Details preserve their
    // native related records, under the output schema and Gateway byte budget.
    const query = {
      ...rest,
      page: input.page ?? 1,
      limit: input.limit ?? 10,
      all: false,
      includes: false,
      q,
    };
    const manager = context.manager;
    let result: unknown;
    switch (operation) {
      case 'listActions':
        result = await this.ports.listActions.execute(
          query as GetActionsDto,
          manager,
        );
        break;
      case 'listBusinessActions':
        result = await this.ports.listBusinessActions.execute(
          query as GetBusinessActionsDto,
          manager,
        );
        break;
      case 'listModules':
        result = await this.ports.listModules.execute(
          query as GetModulesDto,
          manager,
        );
        break;
      case 'listGroups':
        result = await this.ports.listGroups.execute(
          query as GetModuleGroupsDto,
          manager,
        );
        break;
      case 'listRoles':
        result = await this.ports.listRoles.execute(
          query as GetRolesDto,
          manager,
        );
        break;
      case 'listUsers':
        result = await this.ports.listUsers.execute(
          query as GetUsersDto,
          manager,
        );
        break;
    }
    const page = record(result);
    if (!Array.isArray(page.data))
      throw new Error('nodia_ai:invalid_tool_output');
    return JSON.parse(
      JSON.stringify({
        data: page.data.map((item) => project(resource, item, false)),
        meta: select(page.meta, [
          'page',
          'limit',
          'total_items',
          'total_pages',
        ]),
      }),
    ) as NodiaAiJsonObject;
  }
}
