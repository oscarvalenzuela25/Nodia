import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';
import { SaleService } from '../sale.service.js';
import { runSaleScope } from '../sale-authority.js';
import {
  assertSaleTransition,
  normalizeSaleCommand,
  saleCommandHash,
  saleItemInputsFromSnapshots,
  snapshotSaleItems,
  saleUuid,
} from '../policies/sale-policy.js';
import type {
  SaleActor,
  SaleMutationCommand,
  SaleItemSnapshot,
  SaleOperation,
  SaleView,
} from '../types/sale.types.js';

@Injectable()
export class MutateSaleUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly store: SaleService,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  async execute(
    businessId: string,
    operation: SaleOperation,
    value: SaleMutationCommand,
    actor: SaleActor,
    manager?: EntityManager,
  ): Promise<SaleView> {
    if (
      ![
        'create',
        'checkout',
        'update',
        'complete',
        'cancel',
        'discard',
      ].includes(operation)
    )
      throw new BadRequestException('business:sale_invalid_command');
    businessId = saleUuid(businessId);
    const command = normalizeSaleCommand(operation, value);
    const hash = saleCommandHash(operation, command);
    const createsSale = operation === 'create' || operation === 'checkout';
    return runSaleScope(
      this.source,
      this.modules,
      businessId,
      actor,
      async (tx) => {
        // An absent receipt is not proof of rollback. The same durable identity serializes in-flight callers.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `sale:${businessId}:${actor.userId}:${command.request_key}`,
        ]);
        const receipts: {
          request_hash: string;
          operation: string;
          result: SaleView | null;
        }[] = await tx.query(
          'SELECT request_hash,operation,result FROM sale_mutation_requests WHERE business_id=$1 AND actor_id=$2 AND request_key=$3',
          [businessId, actor.userId, command.request_key],
        );
        if (receipts[0]) {
          if (
            receipts[0].request_hash !== hash ||
            receipts[0].operation !== operation
          )
            throw new ConflictException('business:sale_request_conflict');
          if (!receipts[0].result)
            throw new ConflictException('business:sale_request_pending');
          return receipts[0].result;
        }
        const requestId = randomUUID();
        await tx.query(
          `INSERT INTO sale_mutation_requests(id,business_id,actor_id,request_key,operation,request_hash)
        VALUES($1,$2,$3,$4,$5,$6)`,
          [
            requestId,
            businessId,
            actor.userId,
            command.request_key,
            operation,
            hash,
          ],
        );
        const id = command.sale_id ?? randomUUID();
        let previous: SaleView | null = null;
        if (!createsSale) {
          previous = await this.store.load(tx, businessId, id, true);
          if (previous.version !== command.expected_version)
            throw new ConflictException('business:sale_version_conflict');
          if (previous.version >= 2147483647)
            throw new ConflictException('business:sale_version_conflict');
        }
        const status = assertSaleTransition(
          previous?.status ?? 'draft',
          operation,
        );
        let snapshots: SaleItemSnapshot[] | undefined;
        let total = '0';
        if (command.items !== undefined) {
          const products = await this.store.products(
            tx,
            businessId,
            command.items.map((item) => item.product_id),
          );
          snapshots = snapshotSaleItems(command.items, products);
          total = snapshots
            .reduce((sum, item) => sum + BigInt(item.line_total), 0n)
            .toString();
        }
        if (operation === 'checkout') {
          if (!snapshots?.length || BigInt(total) <= 0n)
            throw new ConflictException(
              'business:sale_positive_total_required',
            );
          // Insert the final state directly: no draft header or follow-up completion is persisted.
          await tx.query(
            `INSERT INTO sales(id,business_id,status,currency,payment_method,payment_method_description,
          total_amount,version,created_by,updated_by,completed_at,completed_by)
          VALUES($1,$2,'completed','CLP',$3,$4,$5,1,$6,$6,clock_timestamp(),$6)`,
            [
              id,
              businessId,
              command.payment_method,
              command.payment_method_description,
              total,
              actor.userId,
            ],
          );
        }
        if (operation === 'create') {
          await tx.query(
            `INSERT INTO sales(id,business_id,status,currency,payment_method,payment_method_description,
          total_amount,version,created_by,updated_by) VALUES($1,$2,'draft','CLP',$3,$4,0,1,$5,$5)`,
            [
              id,
              businessId,
              command.payment_method,
              command.payment_method_description,
              actor.userId,
            ],
          );
        }
        if (snapshots !== undefined) {
          await this.store.replaceItems(tx, businessId, id, snapshots);
          if (operation !== 'checkout')
            await tx.query(
              'UPDATE sales SET total_amount=$3 WHERE business_id=$1 AND id=$2',
              [businessId, id, total],
            );
        }
        if (operation === 'complete') {
          if (!previous?.items.length || BigInt(previous.total_amount) <= 0n)
            throw new ConflictException(
              'business:sale_positive_total_required',
            );
          const products = await this.store.products(
            tx,
            businessId,
            previous.items.map((item) => item.product_id),
          );
          // Validate saved observations; confirming never silently refreshes a stale cart.
          snapshotSaleItems(
            saleItemInputsFromSnapshots(previous.items),
            products,
          );
        }
        if (operation !== 'checkout' && command.payment_method !== undefined)
          await tx.query(
            'UPDATE sales SET payment_method=$3 WHERE business_id=$1 AND id=$2',
            [businessId, id, command.payment_method],
          );
        if (
          operation !== 'checkout' &&
          command.payment_method_description !== undefined
        )
          await tx.query(
            'UPDATE sales SET payment_method_description=$3 WHERE business_id=$1 AND id=$2',
            [businessId, id, command.payment_method_description],
          );
        if (!createsSale) {
          await tx.query(
            `UPDATE sales SET status=$3,version=version+1,updated_at=clock_timestamp(),updated_by=$4,
          completed_at=CASE WHEN $5='complete' THEN clock_timestamp() ELSE completed_at END,
          completed_by=CASE WHEN $5='complete' THEN $4::bigint ELSE completed_by END,
          cancelled_at=CASE WHEN $5='cancel' THEN clock_timestamp() ELSE cancelled_at END,
          cancelled_by=CASE WHEN $5='cancel' THEN $4::bigint ELSE cancelled_by END,
          cancellation_reason=CASE WHEN $5='cancel' THEN $6::varchar ELSE cancellation_reason END
          WHERE business_id=$1 AND id=$2`,
            [
              businessId,
              id,
              status,
              actor.userId,
              operation,
              command.cancellation_reason ?? null,
            ],
          );
        }
        const result = await this.store.load(tx, businessId, id);
        await tx.query(
          `UPDATE sale_mutation_requests SET sale_id=$2,result_version=$3,result_status=$4,
        result=$5::jsonb,completed_at=clock_timestamp() WHERE id=$1`,
          [
            requestId,
            id,
            result.version,
            result.status,
            JSON.stringify(result),
          ],
        );
        await tx.query(
          `INSERT INTO sale_events(id,business_id,sale_id,sale_version,event_type,actor_id,origin,mutation_request_id,changes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [
            randomUUID(),
            businessId,
            id,
            result.version,
            operation,
            actor.userId,
            manager || actor.transaction ? 'nodia_ai' : 'http',
            requestId,
            JSON.stringify({
              from_status: previous?.status ?? null,
              to_status: result.status,
              total_amount: result.total_amount,
              item_count: result.items.length,
              ...(result.items.some((item) => item.price_source === 'manual')
                ? {
                    manual_prices: result.items
                      .filter((item) => item.price_source === 'manual')
                      .map((item) => ({
                        product_id: item.product_id,
                        unit_price: item.unit_price,
                        regular_unit_price: item.regular_unit_price,
                        offer_price_snapshot: item.offer_price_snapshot,
                        is_offer_enabled_snapshot:
                          item.is_offer_enabled_snapshot,
                        product_version: item.product_version,
                      })),
                  }
                : {}),
            }),
          ],
        );
        return result;
      },
      manager,
    );
  }
}
