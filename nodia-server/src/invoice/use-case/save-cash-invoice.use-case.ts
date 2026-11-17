import { HttpException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { syncInvoiceCashExpense } from '../../business-cash/invoice-cash-expense.js';
import type { CashInvoiceResult } from '../../business-cash/types/cash.types.js';
import {
  CashWriteRejection,
  ExecuteCashMutationUseCase,
} from '../../business-cash/use-case/execute-cash-mutation.use-case.js';
import { buildOcrInvoiceData } from '../../product/ocr-confirmation-products.js';
import { ProductService } from '../../product/product.service.js';
import {
  normalizeCashInvoiceCreate,
  normalizeCashInvoiceUpdate,
  normalizeOcrInvoiceConfirmation,
} from '../dto/cash-invoice-command.js';
import type { CreateInvoiceDto } from '../dto/create-invoice.dto.js';
import {
  describeInvoiceUpload,
  InvoiceCashUploadService,
} from '../invoice-cash-upload.js';
import { InvoiceService } from '../invoice.service.js';

// The native writer is reused by legacy and identified paths. Only its
// definitive domain errors are recorded as a terminal receipt rejection.
async function writeNativeInvoice<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (
      !(error instanceof HttpException) ||
      error instanceof CashWriteRejection
    )
      throw error;
    const status = error.getStatus();
    if (status === 404)
      throw new CashWriteRejection(status, 'business:resource_not_found');
    if (status === 400 || status === 409)
      throw new CashWriteRejection(
        status,
        error.message.startsWith('business:')
          ? error.message
          : status === 400
            ? 'business:cash_invalid_command'
            : 'business:cash_version_conflict',
      );
    throw error;
  }
}

function result(
  invoice: { id: string; version: number },
  movementId: string | null,
): CashInvoiceResult {
  return {
    invoice_id: invoice.id,
    invoice_version: invoice.version,
    cash_movement_id: movementId,
  };
}

@Injectable()
export class SaveCashInvoiceUseCase {
  constructor(
    private readonly invoices: InvoiceService,
    private readonly mutation: ExecuteCashMutationUseCase,
    private readonly uploads: InvoiceCashUploadService,
    private readonly products: ProductService,
  ) {}

  create(
    raw: unknown,
    multipart: boolean,
    inputFile: Express.Multer.File | undefined,
    actor: ActorReference,
  ) {
    const { request_key, cash_category_id, invoice } =
      normalizeCashInvoiceCreate(raw, multipart);
    const file = inputFile && describeInvoiceUpload(inputFile);
    const { path_storage, ...invoiceFields } = invoice;
    return this.mutation.execute(
      {
        requestKey: request_key,
        operation: 'invoice_create',
        target: { kind: 'business', id: invoice.business_id },
        intent: {
          invoice: file ? invoiceFields : invoice,
          cash_category_id,
          ...(file
            ? { file: { sha256: file.sha256, mime_type: file.mime_type } }
            : {}),
        },
      },
      actor,
      async (manager, _businessId, attempt) => {
        const key = file
          ? await this.uploads.lockPrepared(manager, attempt, file)
          : path_storage;
        const receipt = await this.createWithExpense(
          manager,
          actor,
          { ...invoiceFields, path_storage: key },
          cash_category_id,
        );
        if (file) await this.uploads.consume(manager, attempt, key);
        return receipt;
      },
      file && ((attempt) => this.uploads.stage(attempt, actor, file)),
    );
  }

  update(id: string, raw: unknown, actor: ActorReference) {
    const { request_key, expected_version, cash_category_id, patch } =
      normalizeCashInvoiceUpdate(raw);
    return this.mutation.execute(
      {
        requestKey: request_key,
        operation: 'invoice_update',
        target: { kind: 'invoice', id },
        intent: { expected_version, cash_category_id, patch },
      },
      actor,
      async (manager, businessId) => {
        const prepared = await writeNativeInvoice(() =>
          this.invoices.prepareInvoiceUpdate(
            manager,
            id,
            patch,
            actor,
            businessId,
          ),
        );
        if (prepared.before.version !== expected_version)
          throw new CashWriteRejection(409, 'business:cash_version_conflict');
        const { movementId, changed } = await syncInvoiceCashExpense(
          manager,
          actor.userId,
          prepared.candidate,
          cash_category_id,
        );
        const invoice = await writeNativeInvoice(() =>
          this.invoices.applyInvoiceUpdate(manager, prepared, changed),
        );
        return result(invoice, movementId);
      },
    );
  }

  confirmOcr(
    command: unknown,
    inputFile: Express.Multer.File,
    actor: ActorReference,
  ) {
    const { request_key, business_id, invoice, items } =
      normalizeOcrInvoiceConfirmation(command);
    const file = describeInvoiceUpload(inputFile);
    return this.mutation.execute(
      {
        requestKey: request_key,
        operation: 'invoice_ocr_confirm',
        target: { kind: 'business', id: business_id },
        intent: {
          invoice,
          items,
          file: { sha256: file.sha256, mime_type: file.mime_type },
        },
      },
      actor,
      async (manager, businessId, attempt) => {
        const key = await this.uploads.lockPrepared(manager, attempt, file);
        const saveProducts = await this.products.prepareOcrConfirmation(
          manager,
          businessId,
          invoice.provider_id,
          items,
          actor,
        );
        const products = await saveProducts();
        const receipt = await this.createWithExpense(
          manager,
          actor,
          {
            business_id: businessId,
            provider_id: invoice.provider_id,
            code: invoice.code,
            total_amount: invoice.total_amount,
            path_storage: key,
            is_active: true,
            data: buildOcrInvoiceData(items, products, invoice.issue_date),
          },
          invoice.cash_category_id,
        );
        await this.uploads.consume(manager, attempt, key);
        return { ...receipt, products };
      },
      (attempt) => this.uploads.stage(attempt, actor, file),
    );
  }

  private async createWithExpense(
    manager: EntityManager,
    actor: ActorReference,
    input: CreateInvoiceDto,
    cashCategory: string | null,
  ): Promise<CashInvoiceResult> {
    const invoice = await writeNativeInvoice(() =>
      this.invoices.createInvoice(input, manager, actor),
    );
    const { movementId } = await syncInvoiceCashExpense(
      manager,
      actor.userId,
      invoice,
      cashCategory,
    );
    return result(invoice, movementId);
  }
}
