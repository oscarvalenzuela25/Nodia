import {
  BadRequestException,
  PayloadTooLargeException,
  type Type,
} from '@nestjs/common';
import {
  assertCashFields,
  isCashText,
  normalizeCashActivity,
  normalizeCashUuid,
  normalizeCashVersion,
  validateCashCategoryId,
} from '../../business-cash/policies/cash-category.policy.js';
import { isCashMovementDate } from '../../business-cash/policies/cash-movement-date.js';
import { normalizeOcrProducts } from '../../product/ocr-confirmation-products.js';
import { RentalValidationPipe } from '../../rental-common/rental-validation.pipe.js';
import { normalizeInvoiceCode } from '../invoice-code.js';

export const MAX_OCR_COMMAND_BYTES = 1024 * 1024;

const nativeFields = [
  'business_id',
  'provider_id',
  'code',
  'total_amount',
  'path_storage',
  'data',
  'is_active',
] as const;
const cashFields = [
  'request_key',
  'expected_version',
  'cash_category_id',
] as const;

const nativeInvoicePipe = new RentalValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

export async function parseLegacyInvoiceBody<T>(
  body: unknown,
  dto: Type<T>,
): Promise<T> {
  return (await nativeInvoicePipe.transform(body, {
    type: 'body',
    metatype: dto,
  })) as T;
}

export function hasIdentifiedInvoiceFields(body: unknown): boolean {
  return (
    !!body &&
    typeof body === 'object' &&
    cashFields.some((field) => Object.hasOwn(body, field))
  );
}

function invalid(): never {
  throw new BadRequestException('business:cash_invalid_command');
}

function nullableId(value: unknown, multipart: boolean): string | null {
  if (value === null || (multipart && value === 'null')) return null;
  if (typeof value !== 'string') return invalid();
  validateCashCategoryId(value);
  return value;
}

function invoiceTotal(value: unknown, multipart = false): number {
  const total =
    multipart && typeof value === 'string' && /^(0|[1-9]\d{0,9})$/.test(value)
      ? Number(value)
      : value;
  if (
    typeof total !== 'number' ||
    !Number.isInteger(total) ||
    total < 0 ||
    total > 2147483647
  )
    return invalid();
  return total === 0 ? 0 : total;
}

function invoiceCode(value: unknown): string | null {
  if (value !== null && !isCashText(value)) return invalid();
  return normalizeInvoiceCode(value);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return invalid();
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return invalid();
  }
}

function invoiceData(
  raw: unknown,
  multipart: boolean,
): Record<string, unknown> {
  const value = multipart ? parseJson(raw) : raw;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  // Also validate the JSON values PostgreSQL must store. In particular the JSON
  // parser can return Infinity on overflow and JSONB cannot store NUL or lone surrogates.
  try {
    JSON.stringify(value, (key, nested: unknown) => {
      if (
        !isCashText(key) ||
        (typeof nested === 'string' && !isCashText(nested)) ||
        (typeof nested === 'number' && !Number.isFinite(nested))
      )
        return invalid();
      return nested;
    });
  } catch {
    return invalid();
  }
  return value as Record<string, unknown>;
}

function invoicePath(value: unknown): string {
  if (!isCashText(value) || value.length > 255) return invalid();
  return value;
}

function invoiceActivity(value: unknown, multipart: boolean): boolean {
  if (multipart && (value === 'true' || value === 'false'))
    return value === 'true';
  return normalizeCashActivity(value);
}

function nativeInvoicePatch(
  value: Record<string, unknown>,
  multipart: boolean,
) {
  return {
    ...(value.business_id === undefined
      ? {}
      : { business_id: normalizeCashUuid(value.business_id) }),
    ...(value.provider_id === undefined
      ? {}
      : { provider_id: nullableId(value.provider_id, multipart) }),
    ...(value.code === undefined ? {} : { code: invoiceCode(value.code) }),
    ...(value.total_amount === undefined
      ? {}
      : { total_amount: invoiceTotal(value.total_amount, multipart) }),
    ...(value.path_storage === undefined
      ? {}
      : { path_storage: invoicePath(value.path_storage) }),
    ...(value.data === undefined
      ? {}
      : { data: invoiceData(value.data, multipart) }),
    ...(value.is_active === undefined
      ? {}
      : { is_active: invoiceActivity(value.is_active, multipart) }),
  };
}

export function normalizeCashInvoiceCreate(value: unknown, multipart: boolean) {
  assertCashFields(value, [...nativeFields, 'request_key', 'cash_category_id']);
  return {
    request_key: normalizeCashUuid(value.request_key),
    cash_category_id:
      value.cash_category_id === undefined
        ? null
        : nullableId(value.cash_category_id, multipart),
    invoice: {
      provider_id: null,
      code: null,
      total_amount: 0,
      path_storage: '',
      data: {},
      is_active: true,
      ...nativeInvoicePatch(value, multipart),
      business_id: normalizeCashUuid(value.business_id),
    },
  };
}

export function normalizeCashInvoiceUpdate(value: unknown) {
  assertCashFields(value, [...nativeFields, ...cashFields]);
  return {
    request_key: normalizeCashUuid(value.request_key),
    expected_version: normalizeCashVersion(value.expected_version),
    cash_category_id:
      value.cash_category_id === undefined
        ? undefined
        : nullableId(value.cash_category_id, false),
    patch: nativeInvoicePatch(value, false),
  };
}

export function normalizeOcrInvoiceConfirmation(value: unknown) {
  if (typeof value !== 'string') return invalid();
  if (Buffer.byteLength(value, 'utf8') > MAX_OCR_COMMAND_BYTES)
    throw new PayloadTooLargeException('business:cash_invalid_command');
  // Multer decodes text fields as UTF-8, replacing undecodable bytes. Require
  // the JSON escape for a literal replacement character in this transport.
  if (value.includes('\uFFFD')) return invalid();
  const body = parseJson(value);
  assertCashFields(body, ['request_key', 'business_id', 'invoice', 'items']);
  const invoice = body.invoice;
  assertCashFields(invoice, [
    'provider_id',
    'code',
    'total_amount',
    'issue_date',
    'cash_category_id',
  ]);
  const issueDate = invoice.issue_date;
  if (
    issueDate !== undefined &&
    issueDate !== null &&
    !isCashMovementDate(issueDate)
  )
    return invalid();
  return {
    request_key: normalizeCashUuid(body.request_key),
    business_id: normalizeCashUuid(body.business_id),
    invoice: {
      provider_id:
        invoice.provider_id === undefined
          ? null
          : nullableId(invoice.provider_id, false),
      code: invoice.code === undefined ? null : invoiceCode(invoice.code),
      total_amount: invoiceTotal(invoice.total_amount),
      issue_date: issueDate ?? null,
      cash_category_id:
        invoice.cash_category_id === undefined
          ? null
          : nullableId(invoice.cash_category_id, false),
    },
    items: normalizeOcrProducts(body.items),
  };
}
