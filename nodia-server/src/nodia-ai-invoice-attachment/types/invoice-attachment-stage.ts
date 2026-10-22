import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { StoredProposalStep } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

interface InvoiceFileStage extends NodiaAiJsonObject {
  kind: 'invoice_attachment_stage';
  status: 'preparing' | 'ready';
  source_step_id: string;
  business_id: string;
  storage_key: string;
  fence: string;
}
export interface InvoiceAttachmentStage extends InvoiceFileStage {
  schema_version: 1;
  attachment_id: string;
  content_hash: string;
}
export interface InvoiceLegacyFileStage extends InvoiceFileStage {
  schema_version: 2;
  attachment_id: null;
  source_storage_key: string;
  content_hash: string | null;
  byte_count: string | null;
}
export type InvoiceFileCopyStage =
  InvoiceAttachmentStage | InvoiceLegacyFileStage;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const fileExtensions = ['pdf', 'png', 'jpg', 'webp'] as const;
/** Only a persisted invoice key under its source business namespace is reusable. */
export function invoiceLegacyFileMediaType(
  key: unknown,
  businessId: unknown,
): string {
  if (
    typeof key !== 'string' ||
    typeof businessId !== 'string' ||
    !uuid.test(businessId) ||
    !key.startsWith(`invoices/${businessId}/`) ||
    key.length > 1024 ||
    !/^invoices\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(pdf|png|jpg|webp)$/u.test(key)
  )
    throw new ConflictException('nodia_ai:invoice_file_move_requires_staging');
  const extension = key.slice(key.lastIndexOf('.') + 1);
  return {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
  }[extension]!;
}
export function invoiceAttachmentStage(
  value: NodiaAiJsonObject | null,
): InvoiceFileCopyStage | null {
  if (
    !value ||
    value.kind !== 'invoice_attachment_stage' ||
    typeof value.status !== 'string' ||
    !['preparing', 'ready'].includes(value.status) ||
    typeof value.source_step_id !== 'string' ||
    !uuid.test(value.source_step_id) ||
    typeof value.business_id !== 'string' ||
    !uuid.test(value.business_id) ||
    typeof value.fence !== 'string' ||
    !/^[1-9][0-9]{0,18}$/u.test(value.fence) ||
    typeof value.storage_key !== 'string'
  )
    return null;
  const prefix = `invoices/${value.business_id}/nodia-ai-${value.source_step_id}-${value.fence}-`;
  if (value.schema_version === 1) {
    if (
      Object.keys(value).length !== 9 ||
      typeof value.attachment_id !== 'string' ||
      !uuid.test(value.attachment_id) ||
      typeof value.content_hash !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(value.content_hash) ||
      !fileExtensions.some(
        (ext) => value.storage_key === `${prefix}${value.content_hash}.${ext}`,
      )
    )
      return null;
    return value as InvoiceAttachmentStage;
  }
  if (
    value.schema_version !== 2 ||
    Object.keys(value).length !== 11 ||
    value.attachment_id !== null ||
    typeof value.source_storage_key !== 'string' ||
    !/^invoices\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(pdf|png|jpg|webp)$/u.test(
      value.source_storage_key,
    ) ||
    value.source_storage_key.length > 1024 ||
    !fileExtensions.some(
      (ext) => value.storage_key === `${prefix}legacy.${ext}`,
    ) ||
    (value.status === 'preparing'
      ? value.content_hash !== null || value.byte_count !== null
      : typeof value.content_hash !== 'string' ||
        !/^[0-9a-f]{64}$/u.test(value.content_hash) ||
        typeof value.byte_count !== 'string' ||
        !/^[1-9][0-9]{0,7}$/u.test(value.byte_count) ||
        Number(value.byte_count) > 10485760)
  )
    return null;
  return value as InvoiceLegacyFileStage;
}
/** SQL-only check performed within the invoice + receipt transaction. */
export async function consumeInvoiceAttachmentStage(
  manager: EntityManager,
  step: StoredProposalStep,
  attachmentId: string | null,
): Promise<string> {
  const [row]: {
    recovery_descriptor: NodiaAiJsonObject | null;
    lease_fence: string;
  }[] = await manager.query(
    "SELECT recovery_descriptor,lease_fence::text FROM nodia_ai_execution_steps WHERE id=$1 AND source_step_id=$1 AND state='running' FOR UPDATE",
    [step.id],
  );
  const stage = invoiceAttachmentStage(row?.recovery_descriptor ?? null);
  const attachment = step.preconditions.attachment;
  if (
    !stage ||
    stage.status !== 'ready' ||
    stage.fence !== row.lease_fence ||
    stage.source_step_id !== step.id ||
    stage.attachment_id !== attachmentId ||
    stage.business_id !== step.preconditions.destination_business_id
  )
    throw new ConflictException('nodia_ai:invoice_attachment_not_staged');
  if (stage.schema_version === 1) {
    if (
      !attachment ||
      typeof attachment !== 'object' ||
      Array.isArray(attachment) ||
      stage.content_hash !== attachment.content_hash
    )
      throw new ConflictException('nodia_ai:invoice_attachment_not_staged');
  } else {
    const target = step.preconditions.target;
    if (
      step.toolName !== 'nodia_invoices_prepare_update' ||
      !target ||
      typeof target !== 'object' ||
      Array.isArray(target) ||
      stage.source_storage_key !== target.path_storage ||
      stage.business_id === target.business_id ||
      invoiceLegacyFileMediaType(
        stage.source_storage_key,
        target.business_id,
      ) !== invoiceLegacyFileMediaType(stage.storage_key, stage.business_id)
    )
      throw new ConflictException('nodia_ai:invoice_attachment_not_staged');
  }
  const intent: unknown[] = await manager.query(
    `SELECT storage_key FROM invoice_uploads WHERE storage_key=$1 AND NOT cleanup_started AND cleanup_after>clock_timestamp() FOR UPDATE`,
    [stage.storage_key],
  );
  if (intent.length !== 1)
    throw new ConflictException('nodia_ai:invoice_attachment_not_staged');
  return stage.storage_key;
}
