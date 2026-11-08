import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BuildNodiaAiSalesOperationsUseCase, NodiaAiSalesOperation } from '../dist/nodia-ai-sales/use-case/build-nodia-ai-sales-operations.use-case.js';
import { buildNodiaAiLocalReceipt } from '../dist/nodia-ai-proposal/types/local-operation.types.js';
import { compileNodiaAiToolSchema } from '../dist/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';

/** SQL companion: retired AI entry points cannot add effects; manual sale coverage remains in the parent harness. */
export async function verifyNodiaAiPosPorts({ db, business, actor, mutate, check }) {
  const names = ['create', 'update', 'complete', 'cancel', 'discard'];
  const sourceJson = readFileSync(new URL('../src/nodia-ai-tools/config/common-schema.json', import.meta.url), 'utf8');
  const witness = compileNodiaAiToolSchema({ sourceJson, definition: 'BusinessEffectReceipt', sha256: createHash('sha256').update(sourceJson).digest('hex') });
  await check('NodiaAI registers no native sale writer ports', async () => {
    assert.deepEqual(new BuildNodiaAiSalesOperationsUseCase(mutate).operations, []);
  });
  await check('retired direct preparation and confirmed execution reject without commercial database effects', async () => {
    const counts = () => db.query(`SELECT (SELECT count(*) FROM sales)::text AS sales,
      (SELECT count(*) FROM sale_items)::text AS items,(SELECT count(*) FROM sale_events)::text AS events,
      (SELECT count(*) FROM sale_mutation_requests)::text AS requests`);
    const before = await counts();
    for (const operation of names) {
      const port = new NodiaAiSalesOperation(operation, mutate);
      await db.transaction('READ COMMITTED', async manager => {
        const context = { manager, actor: { actorId: actor.userId, sessionId: actor.sessionId, isSuperAdmin: false },
          moduleRoutes: ['/business'], conversationId: randomUUID(), maxCollectionItems: 100, executionStepId: randomUUID() };
        await assert.rejects(() => port.prepare({ business_id: business }, context), /catalog_changed/);
        await assert.rejects(() => port.executeConfirmed({ toolName: port.toolName,
          commandTemplate: { business_id: business }, scope: { business_id: business }, preconditions: {} }, context), /catalog_changed/);
      });
    }
    assert.deepEqual(await counts(), before);
  });
  await check('historical sale receipt identities remain parseable without restoring an active writer', async () => {
    for (const operation of names) {
      const id = randomUUID();
      const receipt = buildNodiaAiLocalReceipt({ tool_name: `nodia_sales_prepare_${operation}`,
        command_template: { business_id: business, ...(operation === 'create' ? {} : { id }) },
        scope: { business_id: business }, preconditions: { destination_business_id: business } },
      { id, businessId: business }, (_definition, value) => assert.equal(witness.validate(value), true, JSON.stringify(witness.validate.errors)));
      assert.equal(receipt.resource_key, 'sales');
      assert.equal(receipt.operation, operation);
    }
  });
}
