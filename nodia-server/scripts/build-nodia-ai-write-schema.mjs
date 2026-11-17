// Offline structural compilation only: run after `nest build`; never opens application ports.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { BuildNodiaAiWriteToolsUseCase } from '../dist/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.js';
import { loadNodiaAiWriteContracts } from '../dist/nodia-ai-write-tools/types/write-tool-contract.types.js';
import { BuildNodiaAiFinanceCatalogOperationsUseCase } from '../dist/nodia-ai-finance-catalog/use-case/build-nodia-ai-finance-catalog-operations.use-case.js';
import { BuildNodiaAiFinanceLedgerOperationsUseCase } from '../dist/nodia-ai-finance-ledger/use-case/build-nodia-ai-finance-ledger-operations.use-case.js';
import { BuildNodiaAiBusinessCatalogOperationsUseCase } from '../dist/nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case.js';
import { BuildNodiaAiSupplierOperationsUseCase } from '../dist/nodia-ai-supplier-operations/use-case/build-nodia-ai-supplier-operations.use-case.js';
import { BuildNodiaAiInvoiceOperationsUseCase } from '../dist/nodia-ai-invoice-operations/use-case/build-nodia-ai-invoice-operations.use-case.js';
import { PrepareNodiaAiFinanceMovementUseCase } from '../dist/nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.js';
import { ValidateNodiaAiProposalUseCase } from '../dist/nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../dist/nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every(arg => arg === '--check'), 'invalid_schema_build_argument');
const check = args.includes('--check');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const common = readFileSync(new URL('../../docs/mvp/nodia-ai-v1-common-contracts.schema.json', import.meta.url), 'utf8');
const policyBytes = readFileSync(new URL('../../docs/mvp/nodia-ai-v1-runtime-policy.json', import.meta.url));
const payload = { schema_version: 1, policyHash: digest(policyBytes), policy: JSON.parse(policyBytes.toString('utf8')),
  schema: JSON.parse(readFileSync(new URL('../../docs/mvp/nodia-ai-v1-runtime-policy.schema.json', import.meta.url), 'utf8')) };
const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute({ ...payload, contentHash: digest(JSON.stringify(payload)) });
const forbidden = new Proxy({}, { get() { throw Error('structural_schema_build_must_not_access_application_ports'); } });
const factories = [BuildNodiaAiFinanceCatalogOperationsUseCase, BuildNodiaAiFinanceLedgerOperationsUseCase,
  BuildNodiaAiBusinessCatalogOperationsUseCase, BuildNodiaAiSupplierOperationsUseCase, BuildNodiaAiInvoiceOperationsUseCase];
const preparers = factories.flatMap(Factory => Reflect.construct(Factory, Array(35).fill(forbidden)).operations);
preparers.push(new PrepareNodiaAiFinanceMovementUseCase(forbidden));
const validate = new ValidateNodiaAiProposalUseCase(preparers, common, policy, new CanonicalizeNodiaAiProposalUseCase(policy));
const bundles = loadNodiaAiWriteContracts().filter(bundle => bundle.tools.some(tool => tool.tool_name === 'nodia_products_prepare_create'));
assert.equal(bundles.length, 1);
const families = new BuildNodiaAiWriteToolsUseCase(forbidden, forbidden, validate, common, policy).execute(bundles);
assert.equal(families.length, 1);
const capabilities = families[0].capabilities;
const source = capabilities[0].inputSchema.sourceJson;
for (const capability of capabilities) {
  assert.equal(capability.inputSchema.sourceJson, source);
  assert.equal(capability.outputSchema.sourceJson, source);
  assert.equal(capability.inputSchema.sha256, digest(source));
  assert.equal(capability.outputSchema.sha256, digest(source));
}
const target = new URL('../src/nodia-ai-products/contracts/pos-write-finance-business.schema.json', import.meta.url);
const before = readFileSync(target);
if (check) assert.equal(before.toString('utf8'), source, 'stale_finance_business_schema_artifact');
else writeFileSync(target, source, 'utf8');
console.log(JSON.stringify({ task: 'finance_business_write_schema', mode: check ? 'check' : 'build',
  previous_sha256: digest(before), sha256: digest(source), capabilities: capabilities.length,
  changed: before.toString('utf8') !== source, application_ports_accessed: false }));
