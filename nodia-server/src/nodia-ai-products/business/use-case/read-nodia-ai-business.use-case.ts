import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { BusinessService } from '../../../business/business.service.js';
import { Business } from '../../../business/entities/business.entity.js';
import { BusinessCollaborator } from '../../../business/entities/business-collaborator.entity.js';
import { BusinessAction } from '../../../business-action/entities/business-action.entity.js';
import { GetBusinessByIdUseCase } from '../../../business/use-case/get-business-by-id.use-case.js';
import { GetMyBusinessesUseCase } from '../../../business/use-case/get-my-businesses.use-case.js';
import { InvoiceService } from '../../../invoice/invoice.service.js';
import { Invoice } from '../../../invoice/entities/invoice.entity.js';
import { GetInvoiceByIdUseCase } from '../../../invoice/use-case/get-invoice-by-id.use-case.js';
import { GetAllInvoicesUseCase } from '../../../invoice/use-case/get-all-invoices.use-case.js';
import { ProductService } from '../../../product/product.service.js';
import { Product } from '../../../product/entities/product.entity.js';
import { ProductLog } from '../../../product/entities/product-log.entity.js';
import { CheckModuleAccessUseCase } from '../../../authorization/use-case/check-module-access.use-case.js';
import { GetProductByIdUseCase } from '../../../product/use-case/get-product-by-id.use-case.js';
import { GetAllProductsUseCase } from '../../../product/use-case/get-all-products.use-case.js';
import { GetProductLogByIdUseCase } from '../../../product/use-case/get-product-log-by-id.use-case.js';
import { GetAllProductLogsUseCase } from '../../../product/use-case/get-all-product-logs.use-case.js';
import { QueryProductLogsUseCase } from '../../../product/use-case/query-product-logs.use-case.js';
import { ProviderService } from '../../../provider/provider.service.js';
import { Provider } from '../../../provider/entities/provider.entity.js';
import { GetProviderByIdUseCase } from '../../../provider/use-case/get-provider-by-id.use-case.js';
import { GetAllProvidersUseCase } from '../../../provider/use-case/get-all-providers.use-case.js';
import { ProviderContactService } from '../../../provider-contact/provider-contact.service.js';
import { ProviderContact } from '../../../provider-contact/entities/provider-contact.entity.js';
import { GetProviderContactsUseCase } from '../../../provider-contact/use-case/get-provider-contacts.use-case.js';
import { TranslationService } from '../../../translation/translation.service.js';
import { Translation } from '../../../translation/entities/translation.entity.js';
import { UserRole } from '../../../user/entities/user-role.entity.js';
import {
  assertBusinessResourcesAccess,
  resolveBusinessAccess,
  type BusinessDataResource,
} from '../../../business-access/business-access.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

export type BusinessReadOperation =
  | 'businesses_get'
  | 'businesses_list'
  | 'invoices_get'
  | 'invoices_list'
  | 'products_get'
  | 'products_list'
  | 'product_logs_get'
  | 'product_logs_list'
  | 'product_logs_query'
  | 'providers_get'
  | 'providers_list'
  | 'provider_contacts_list';

const prices = [
  'cost_price',
  'cost_price_tax',
  'sale_price',
  'stock',
] as const;
const common = ['id', 'is_active', 'created_at', 'updated_at'] as const;
type PublicRow = Record<string, unknown>;
function project(row: PublicRow, fields: readonly string[]): NodiaAiJsonObject {
  return Object.fromEntries(
    fields
      .filter((key) => Object.hasOwn(row, key))
      .map((key) => {
        const value = row[key];
        return [key, value instanceof Date ? value.toISOString() : value];
      }),
  ) as NodiaAiJsonObject;
}
function businessService(manager: EntityManager): BusinessService {
  return new BusinessService(
    manager.getRepository(Business),
    manager.getRepository(BusinessCollaborator),
    manager.getRepository(BusinessAction),
    manager.getRepository(Product),
    manager.getRepository(Provider),
    manager.getRepository(UserRole),
    new TranslationService(manager.getRepository(Translation)),
  );
}
function activity(input: NodiaAiJsonObject): boolean | undefined {
  return input.activity === 'all' ? undefined : input.activity !== 'inactive';
}
function filters(
  input: NodiaAiJsonObject,
  hasActivity: boolean,
): NodiaAiJsonObject {
  const supplied =
    input.q && typeof input.q === 'object' && !Array.isArray(input.q)
      ? input.q
      : {};
  const q = { s: 'created_at desc', ...supplied };
  const active = activity(input);
  return hasActivity && active !== undefined
    ? { ...q, is_active_eq: active }
    : q;
}
function page(input: NodiaAiJsonObject) {
  return {
    page: typeof input.page === 'number' ? input.page : 1,
    limit: typeof input.limit === 'number' ? input.limit : 25,
    all: false,
    includes: false,
  };
}
function publicRow(resource: string, row: unknown): NodiaAiJsonObject {
  const value = row as PublicRow;
  switch (resource) {
    case 'businesses':
      return {
        ...project(value, [...common, 'name', 'owner_id', 'has_description']),
        translates: (value.translates ?? []) as NodiaAiJsonValue,
      };
    case 'products':
      return project(value, [
        ...common,
        'business_id',
        'provider_id',
        'code',
        'measurement_unit',
        'name',
        ...prices,
        'barcode',
        'offer_price',
        'is_offer_enabled',
        'has_stock',
        'version',
        'effective_price',
        'price_source',
      ]);
    case 'product_logs':
      return project(value, [
        'id',
        'product_id',
        'code',
        'measurement_unit',
        'name',
        ...prices,
        'barcode',
        'offer_price',
        'is_offer_enabled',
        'has_stock',
        'product_version',
        'created_at',
        'updated_at',
      ]);
    case 'providers':
      return project(value, [...common, 'business_id', 'name', 'tax']);
    case 'invoices': {
      const data = value.data as PublicRow | null;
      return {
        ...project(value, [
          ...common,
          'business_id',
          'provider_id',
          'code',
          'total_amount',
        ]),
        has_file:
          typeof value.path_storage === 'string' &&
          value.path_storage.trim().length > 0,
        issue_date:
          typeof data?.issue_date === 'string' ? data.issue_date : null,
      };
    }
    case 'provider_contacts':
      return project(value, [
        ...common,
        'provider_id',
        'name',
        'version',
        'phone',
        'email',
        'description',
        'schedule',
      ]);
    default:
      throw new BadRequestException('nodia_ai:business_operation_invalid');
  }
}

/** Local domain adapters: every repository, translation and UC uses the inherited checkpoint manager. */
@Injectable()
export class ReadNodiaAiBusinessUseCase {
  async verifyAuthority(
    operation: BusinessReadOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    context.signal?.throwIfAborted();
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    this.validateIds(input);
    if (!context.moduleRoutes.includes('/business'))
      throw new ForbiddenException('nodia_ai:module_not_allowed');
    const actor = {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: context.manager,
    };
    const scope = await resolveBusinessAccess(context.manager, actor);
    if (operation === 'businesses_get') {
      await new GetBusinessByIdUseCase(
        businessService(context.manager),
      ).execute(String(input.id), context.actor.actorId, false);
    }
    if (
      operation === 'businesses_list' &&
      input.all_businesses === true &&
      !scope.isSuperAdmin
    )
      throw new ForbiddenException('nodia_ai:business_scope_not_allowed');
    if (operation.endsWith('_get') && operation !== 'businesses_get')
      await assertBusinessResourcesAccess(
        context.manager,
        actor,
        operation.replace(/_get$/, '') as BusinessDataResource,
        [String(input.id)],
      );
    if (operation === 'provider_contacts_list') {
      await new GetProviderByIdUseCase(
        new ProviderService(context.manager.getRepository(Provider)),
      ).execute(String(input.provider_id), {
        userId: context.actor.actorId,
        sessionId: context.actor.sessionId,
        transaction: context.manager,
      });
    }
  }

  /** Recheck membership of cached list rows; a collaborator revocation must also hide prior results. */
  async verifyResultAuthority(
    operation: BusinessReadOperation,
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    context.signal?.throwIfAborted();
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (!context.moduleRoutes.includes('/business'))
      throw new ForbiddenException('nodia_ai:module_not_allowed');
    const data = result.data;
    if (operation.endsWith('_get')) {
      if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        typeof data.id !== 'string' ||
        typeof input.id !== 'string' ||
        data.id.toLowerCase() !== input.id.toLowerCase()
      )
        throw new ForbiddenException('nodia_ai:business_result_scope_invalid');
      await this.verifyAuthority(operation, input, context);
      return;
    }
    if (
      operation === 'provider_contacts_list' &&
      Array.isArray(data) &&
      data.some(
        (row) =>
          !row ||
          typeof row !== 'object' ||
          Array.isArray(row) ||
          row.provider_id !== input.provider_id,
      )
    )
      throw new ForbiddenException('nodia_ai:business_result_scope_invalid');
    if (!Array.isArray(data))
      throw new BadRequestException('nodia_ai:business_result_invalid');
    if (
      data.some(
        (row) =>
          !row ||
          typeof row !== 'object' ||
          Array.isArray(row) ||
          typeof row.id !== 'string',
      )
    )
      throw new BadRequestException('nodia_ai:business_result_invalid');
    const ids = data.map((row) => String((row as NodiaAiJsonObject).id));
    const actor = {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: context.manager,
    };
    if (operation !== 'businesses_list') {
      await assertBusinessResourcesAccess(
        context.manager,
        actor,
        operation.replace(/_(list|query)$/, '') as BusinessDataResource,
        ids,
      );
      return;
    }
    const scope = await resolveBusinessAccess(context.manager, actor);
    if (scope.isSuperAdmin) return;
    if (!ids.length) return;
    // Collaborator writers lock the business row before changing membership.
    // Lock before the fresh membership check, including replayed list results.
    await context.manager.query(
      'SELECT id FROM businesses WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',
      [ids],
    );
    const count = await context.manager
      .getRepository(Business)
      .createQueryBuilder('business')
      .where('business.id IN (:...ids)', { ids })
      .andWhere(
        '(business.owner_id = :actor OR business.id IN (SELECT bc.business_id FROM business_collaborators bc WHERE bc.user_id = :actor AND bc.is_active = true))',
        { actor: context.actor.actorId },
      )
      .getCount();
    if (count !== new Set(ids).size)
      throw new ForbiddenException('nodia_ai:business_scope_not_allowed');
  }

  async execute(
    operation: BusinessReadOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiJsonObject> {
    await this.verifyAuthority(operation, input, context);
    context.signal?.throwIfAborted();
    const manager = context.manager;
    const products = () =>
      new ProductService(
        manager.getRepository(Product),
        manager.getRepository(ProductLog),
        new CheckModuleAccessUseCase(manager.connection),
      );
    const invoices = () => new InvoiceService(manager.getRepository(Invoice));
    const invoiceActor = {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: manager,
    };
    const providers = () =>
      new ProviderService(manager.getRepository(Provider));
    let result: unknown;
    switch (operation) {
      case 'businesses_get':
        result = await new GetBusinessByIdUseCase(
          businessService(manager),
        ).execute(String(input.id), context.actor.actorId, false);
        break;
      case 'businesses_list':
        result = await new GetMyBusinessesUseCase(
          businessService(manager),
        ).execute(
          context.actor.actorId,
          {
            ...page(input),
            all_businesses: input.all_businesses === true,
            q: filters(input, true),
          },
          false,
        );
        break;
      case 'invoices_get':
        result = await new GetInvoiceByIdUseCase(invoices()).execute(
          String(input.id),
          invoiceActor,
        );
        break;
      case 'invoices_list':
        result = await new GetAllInvoicesUseCase(invoices()).execute(
          {
            ...page(input),
            q: filters(input, true),
          },
          invoiceActor,
        );
        break;
      case 'products_get':
        result = await new GetProductByIdUseCase(products()).execute(
          String(input.id),
          { userId: context.actor.actorId, sessionId: context.actor.sessionId },
        );
        break;
      case 'products_list':
        result = await new GetAllProductsUseCase(products()).execute(
          {
            ...page(input),
            q: filters(input, true),
          },
          { userId: context.actor.actorId, sessionId: context.actor.sessionId },
        );
        break;
      case 'product_logs_get':
        result = await new GetProductLogByIdUseCase(products()).execute(
          String(input.id),
          { userId: context.actor.actorId, sessionId: context.actor.sessionId },
        );
        break;
      case 'product_logs_list':
        result = await new GetAllProductLogsUseCase(products()).execute(
          {
            ...page(input),
            q: filters(input, false),
          },
          { userId: context.actor.actorId, sessionId: context.actor.sessionId },
        );
        break;
      case 'product_logs_query':
        result = await new QueryProductLogsUseCase(products()).execute(
          {
            ...page(input),
            q: filters(input, false),
            ...(input.product_ids
              ? { product_ids: input.product_ids as string[] }
              : {}),
            ...(input.codes ? { codes: input.codes as string[] } : {}),
            ...(input.s ? { s: String(input.s) } : {}),
          },
          { userId: context.actor.actorId, sessionId: context.actor.sessionId },
        );
        break;
      case 'providers_get':
        result = await new GetProviderByIdUseCase(providers()).execute(
          String(input.id),
          {
            userId: context.actor.actorId,
            sessionId: context.actor.sessionId,
            transaction: manager,
          },
        );
        break;
      case 'providers_list':
        result = await new GetAllProvidersUseCase(providers()).execute(
          {
            ...page(input),
            q: filters(input, true),
          },
          {
            userId: context.actor.actorId,
            sessionId: context.actor.sessionId,
            transaction: manager,
          },
        );
        break;
      case 'provider_contacts_list':
        result = await new GetProviderContactsUseCase(
          new ProviderContactService(
            manager.getRepository(ProviderContact),
            manager.getRepository(Provider),
          ),
        ).execute(
          String(input.provider_id),
          {
            page: page(input).page,
            limit: page(input).limit,
            ...(input.search ? { search: String(input.search) } : {}),
          },
          activity(input),
          {
            userId: context.actor.actorId,
            sessionId: context.actor.sessionId,
            transaction: manager,
          },
        );
        break;
      default:
        throw new BadRequestException('nodia_ai:business_operation_invalid');
    }
    const isList = operation.endsWith('_list') || operation.endsWith('_query');
    const resource = operation.replace(/_(get|list|query)$/, '');
    if (!isList) return { data: publicRow(resource, result) };
    const response = result as { data: unknown[]; meta: NodiaAiJsonObject };
    return {
      data: response.data.map((row) => publicRow(resource, row)),
      meta: { ...response.meta },
    };
  }

  private validateIds(input: NodiaAiJsonObject): void {
    const visit = (value: NodiaAiJsonValue, key: string): void => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [name, child] of Object.entries(value)) visit(child, name);
      } else if (Array.isArray(value))
        value.forEach((item) => visit(item, key));
      else if (
        typeof value === 'string' &&
        /(^id$|_id(?:_eq|_in)?$|_ids$)/.test(key) &&
        /^\d+$/.test(value) &&
        BigInt(value) > 9223372036854775807n
      )
        throw new BadRequestException('nodia_ai:identifier_out_of_range');
    };
    visit(input, 'input');
  }
}
