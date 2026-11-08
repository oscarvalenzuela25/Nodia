// Exercise Nest's clean compiler output before context:build can repair missing assets.
// No database, network, account or application bootstrap is needed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileNodiaAiToolSchema } from '../dist/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';

const source = readFileSync(
  new URL('../../docs/mvp/nodia-ai-v1-common-contracts.schema.json', import.meta.url),
);
const compiled = readFileSync(
  new URL('../dist/nodia-ai-tools/config/common-schema.json', import.meta.url),
);
assert.deepEqual(compiled, source, 'Nest must package the canonical common schema unchanged');
const { validate } = compileNodiaAiToolSchema({
  sourceJson: compiled.toString('utf8'),
  definition: 'ConfirmationChallengeRequest',
  sha256: createHash('sha256').update(compiled).digest('hex'),
});
assert.equal(validate({ proposal_revision: 1, expected_hash: 'a'.repeat(64) }), true);
assert.equal(validate({ proposal_revision: 1 }), false);
console.log(JSON.stringify({ check: 'nest-build-common-schema', result: 'passed' }));

const invoiceSource = readFileSync(new URL('../src/nodia-ai-invoice-ocr/contracts/invoice-ocr.json', import.meta.url));
const invoiceCompiled = readFileSync(new URL('../dist/nodia-ai-invoice-ocr/contracts/invoice-ocr.json', import.meta.url));
assert.deepEqual(invoiceCompiled, invoiceSource, 'Nest must package the conversational OCR contract unchanged');
const invoiceSchema = compileNodiaAiToolSchema({ sourceJson: invoiceCompiled.toString('utf8'), definition: 'InvoiceOcrInput',
  sha256: createHash('sha256').update(invoiceCompiled).digest('hex') });
assert.equal(invoiceSchema.validate({ action: 'request', analysis_id: 'af10e79d-7b63-45ac-8c2a-4d8b4263e740', provider_id: '1' }), true);
assert.equal(invoiceSchema.validate({ action: 'request', analysis_id: 'af10e79d-7b63-45ac-8c2a-4d8b4263e740' }), false);
console.log(JSON.stringify({ check: 'nest-build-invoice-ocr-schema', result: 'passed' }));
