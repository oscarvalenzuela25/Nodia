import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
interface ProviderTransfer {
  providerId: string;
  destinationBusinessId: string;
}
interface ProviderTransferImpact {
  provider_id: string;
  product_count: string;
  invoice_count: string;
}
/** Caller holds suppliers FOR UPDATE in ID order; association writers hold the same parent FOR SHARE. */
export async function requireCompatibleProviderTransfers(
  manager: EntityManager,
  transfers: readonly ProviderTransfer[],
) {
  if (!transfers.length) return [];
  const impacts: ProviderTransferImpact[] = await manager.query(
    `SELECT requested.provider_id::text,
      (SELECT count(*)::text FROM products WHERE provider_id=requested.provider_id AND business_id<>requested.destination_business_id) AS product_count,
      (SELECT count(*)::text FROM invoices WHERE provider_id=requested.provider_id AND business_id<>requested.destination_business_id) AS invoice_count
     FROM unnest($1::bigint[],$2::uuid[]) AS requested(provider_id,destination_business_id) ORDER BY requested.provider_id`,
    [
      transfers.map((item) => item.providerId),
      transfers.map((item) => item.destinationBusinessId),
    ],
  );
  if (
    impacts.length !== transfers.length ||
    impacts.some(
      (impact) => impact.product_count !== '0' || impact.invoice_count !== '0',
    )
  )
    throw new ConflictException(
      'Provider cannot move while products or invoices belong to another business',
    );
  return impacts;
}
export async function requireCompatibleProviderTransfer(
  manager: EntityManager,
  providerId: string,
  destinationBusinessId: string,
) {
  const [impact] = await requireCompatibleProviderTransfers(manager, [
    { providerId, destinationBusinessId },
  ]);
  return {
    product_count: impact.product_count,
    invoice_count: impact.invoice_count,
  };
}
