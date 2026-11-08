import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Invoice } from '../../../invoice/entities/invoice.entity.js';
import { InvoiceService } from '../../../invoice/invoice.service.js';
import { GetInvoiceByIdUseCase } from '../../../invoice/use-case/get-invoice-by-id.use-case.js';
import { Product } from '../../../product/entities/product.entity.js';
import { CheckModuleAccessUseCase } from '../../../authorization/use-case/check-module-access.use-case.js';
import { ProductLog } from '../../../product/entities/product-log.entity.js';
import { ProductService } from '../../../product/product.service.js';
import { ExportProductsCsvUseCase } from '../../../product/use-case/export-products-csv.use-case.js';
import { Provider } from '../../../provider/entities/provider.entity.js';
import { ProviderService } from '../../../provider/provider.service.js';
import { ExportProvidersCsvUseCase } from '../../../provider/use-case/export-providers-csv.use-case.js';
import type { NodiaAiJsonObject } from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiRuntimePolicy } from '../../../nodia-ai-runtime/config/runtime-policy.js';
import type {
  NodiaAiPreparedToolOperation,
  NodiaAiToolHandlerContext,
} from '../../../nodia-ai-tools/types/tool-registry.types.js';
import { canonicalKnowledge } from '../../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import {
  assertBusinessResourcesAccess,
  assertBusinessesAccess,
  resolveBusinessAccess,
} from '../../../business-access/business-access.js';

export type NodiaAiArtifactOperation =
  'invoices_file' | 'products_export_csv' | 'providers_export_csv';
export const NODIA_AI_ARTIFACT_OPERATIONS: readonly NodiaAiArtifactOperation[] =
  ['invoices_file', 'products_export_csv', 'providers_export_csv'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bigint = /^[1-9]\d{0,18}$/;
function validBigint(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    bigint.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalKnowledge(value)).digest('hex');
}
export interface NodiaAiMaterializedArtifact {
  readonly filename: string;
  readonly mimeType: string;
  readonly buffer?: Buffer;
  /** Internal only. Never persisted in public_result or returned to the model. */
  readonly invoiceKey?: string;
}

/** Domain adapters issue regenerable references, not stored snapshots or external bearer links. */
@Injectable()
export class ExecuteNodiaAiArtifactUseCase {
  validate(
    operation: NodiaAiArtifactOperation,
    input: NodiaAiJsonObject,
  ): void {
    if (
      !NODIA_AI_ARTIFACT_OPERATIONS.includes(operation) ||
      !input ||
      Array.isArray(input)
    )
      throw new BadRequestException('nodia_ai:invalid_tool_input');
    const allowed =
      operation === 'invoices_file'
        ? ['id']
        : operation === 'products_export_csv'
          ? ['business_id', 'lang']
          : ['business_id', 'lang', 'ids'];
    if (
      Object.keys(input).some((key) => !allowed.includes(key)) ||
      (operation === 'invoices_file' && !validBigint(input.id)) ||
      (input.business_id !== undefined &&
        (typeof input.business_id !== 'string' ||
          !uuid.test(input.business_id))) ||
      (input.lang !== undefined &&
        (typeof input.lang !== 'string' ||
          !/^(es|en)(?:-[A-Za-z]{2})?$/.test(input.lang)))
    )
      throw new BadRequestException('nodia_ai:invalid_tool_input');
    if (
      input.ids !== undefined &&
      (!Array.isArray(input.ids) ||
        !input.ids.length ||
        input.ids.length > 1000 ||
        input.ids.some((id) => !validBigint(id)) ||
        new Set(input.ids).size !== input.ids.length)
    )
      throw new BadRequestException('nodia_ai:invalid_tool_input');
  }
  async verifyAuthority(
    operation: NodiaAiArtifactOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    context.signal?.throwIfAborted();
    this.validate(operation, input);
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (!context.moduleRoutes.includes('/business'))
      throw new ForbiddenException('nodia_ai:module_not_allowed');
    const actor = {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: context.manager,
    };
    await resolveBusinessAccess(context.manager, actor);
    if (typeof input.business_id === 'string')
      await assertBusinessesAccess(context.manager, actor, [input.business_id]);
    if (operation === 'providers_export_csv' && Array.isArray(input.ids))
      await assertBusinessResourcesAccess(
        context.manager,
        actor,
        'providers',
        input.ids as string[],
      );
    if (operation === 'invoices_file') await this.invoice(input, context);
  }
  async prepare(
    operation: NodiaAiArtifactOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiPreparedToolOperation> {
    await this.verifyAuthority(operation, input, context);
    if (
      !context.toolCallId ||
      !uuid.test(context.toolCallId) ||
      !context.conversationId ||
      !uuid.test(context.conversationId)
    )
      throw new ForbiddenException('nodia_ai:artifact_context_required');
    const args = structuredClone(input);
    const invoice =
      operation === 'invoices_file'
        ? await this.invoice(args, context)
        : undefined;
    const descriptor = this.descriptor(operation, context.toolCallId, invoice);
    const initial = fingerprint({
      operation,
      input: args,
      invoiceKey: invoice?.invoiceKey ?? null,
    });
    return {
      fingerprint: initial,
      execute: async (signal) => {
        signal.throwIfAborted();
        return structuredClone(descriptor);
      },
      verify: async (fresh) => {
        await this.verifyAuthority(operation, args, fresh);
        const current =
          operation === 'invoices_file'
            ? await this.invoice(args, fresh)
            : undefined;
        if (
          fingerprint({
            operation,
            input: args,
            invoiceKey: current?.invoiceKey ?? null,
          }) !== initial
        )
          throw new ForbiddenException('nodia_ai:artifact_changed');
      },
      // No uploaded object, temporary file, or retained buffer exists to clean up.
    };
  }
  async verifyResultAuthority(
    operation: NodiaAiArtifactOperation,
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    await this.verifyAuthority(operation, input, context);
    const artifact = result.artifact;
    if (
      !artifact ||
      typeof artifact !== 'object' ||
      Array.isArray(artifact) ||
      artifact.reference !== context.toolCallId
    )
      throw new ForbiddenException('nodia_ai:artifact_reference_invalid');
    const current =
      operation === 'invoices_file'
        ? await this.invoice(input, context)
        : undefined;
    if (
      canonicalKnowledge(result) !==
      canonicalKnowledge(
        this.descriptor(operation, context.toolCallId, current),
      )
    )
      throw new ForbiddenException('nodia_ai:artifact_changed');
  }
  private descriptor(
    operation: NodiaAiArtifactOperation,
    reference: string,
    invoice?: NodiaAiMaterializedArtifact,
  ): NodiaAiJsonObject {
    return {
      artifact: {
        reference,
        kind: operation === 'invoices_file' ? 'invoice_file' : 'csv_export',
        filename:
          invoice?.filename ??
          (operation === 'products_export_csv'
            ? 'products.csv'
            : 'providers.csv'),
        mime_type: invoice?.mimeType ?? 'text/csv; charset=utf-8',
        semantics: 'current_on_download',
        access: 'authenticated_reauthorized',
      },
    };
  }
  async materialize(
    operation: NodiaAiArtifactOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
    policy: NodiaAiRuntimePolicy,
  ): Promise<NodiaAiMaterializedArtifact> {
    await this.verifyAuthority(operation, input, context);
    if (operation === 'invoices_file') return this.invoice(input, context);
    const maxRows = policy.results.list_max_rows;
    if (Array.isArray(input.ids) && input.ids.length > maxRows)
      throw new BadRequestException('nodia_ai:artifact_limit');
    const limits = {
      maxRows,
      maxBytes: policy.admission.file_bytes,
      signal: context.signal,
    };
    const actor = {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: context.manager,
    };
    const dto = {
      ...(typeof input.business_id === 'string'
        ? { business_id: input.business_id }
        : {}),
      ...(typeof input.lang === 'string' ? { lang: input.lang } : {}),
    };
    const csv =
      operation === 'products_export_csv'
        ? await new ExportProductsCsvUseCase(
            new ProductService(
              context.manager.getRepository(Product),
              context.manager.getRepository(ProductLog),
              new CheckModuleAccessUseCase(context.manager.connection),
            ),
          ).execute(dto, limits, actor)
        : await new ExportProvidersCsvUseCase(
            new ProviderService(context.manager.getRepository(Provider)),
          ).execute(
            {
              ...dto,
              ...(Array.isArray(input.ids)
                ? { ids: input.ids as string[] }
                : {}),
            },
            limits,
            actor,
          );
    context.signal?.throwIfAborted();
    const buffer = Buffer.from(csv, 'utf8');
    if (buffer.byteLength > policy.admission.file_bytes)
      throw new BadRequestException('nodia_ai:artifact_limit');
    return {
      buffer,
      mimeType: 'text/csv; charset=utf-8',
      filename:
        operation === 'products_export_csv' ? 'products.csv' : 'providers.csv',
    };
  }
  private async invoice(
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiMaterializedArtifact> {
    const invoice = await new GetInvoiceByIdUseCase(
      new InvoiceService(context.manager.getRepository(Invoice)),
    ).execute(String(input.id), {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: context.manager,
    });
    if (typeof invoice.business_id !== 'string')
      throw new BadRequestException('nodia_ai:invoice_file_unavailable');
    const escapedBusiness = invoice.business_id.toLowerCase();
    if (
      !uuid.test(escapedBusiness) ||
      typeof invoice.path_storage !== 'string' ||
      !new RegExp(
        `^invoices/${escapedBusiness}/[A-Za-z0-9_-]+\\.(pdf|png|jpg|jpeg|webp)$`,
        'i',
      ).test(invoice.path_storage)
    )
      throw new BadRequestException('nodia_ai:invoice_file_unavailable');
    const extension = invoice.path_storage
      .slice(invoice.path_storage.lastIndexOf('.') + 1)
      .toLowerCase();
    const mimeType =
      extension === 'pdf'
        ? 'application/pdf'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : `image/${extension}`;
    return {
      filename: `invoice-${invoice.id}.${extension}`,
      mimeType,
      invoiceKey: invoice.path_storage,
    };
  }
}
