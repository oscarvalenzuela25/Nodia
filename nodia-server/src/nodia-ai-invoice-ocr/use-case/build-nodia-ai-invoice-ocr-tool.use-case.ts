import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiToolFamily, NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { NODIA_AI_INVOICE_OCR_TOOL } from '../types/invoice-ocr-port.js';
import { invoiceOcrRequestResult, ocrHash, ocrInvalid } from '../types/invoice-ocr-state.js';
import { SnapshotNodiaAiInvoiceOcrUseCase } from './snapshot-nodia-ai-invoice-ocr.use-case.js';

/** Rechecking identical current prices may observe a later time without changing their authority. */
export function invoiceOcrAuthorityFingerprint(input: NodiaAiJsonObject, value: NodiaAiJsonObject): string {
  if (input.action !== 'read' || input.compare_prices !== true) return ocrHash(value);
  const authority = { ...value };
  delete authority.comparison_observed_at;
  return ocrHash(authority);
}

@Injectable()
export class BuildNodiaAiInvoiceOcrToolUseCase {
  constructor(private readonly snapshots: SnapshotNodiaAiInvoiceOcrUseCase) {}
  execute(): readonly NodiaAiToolFamily[] {
    const sourceJson = readFileSync(new URL('../contracts/invoice-ocr.json', import.meta.url), 'utf8');
    const sha256 = createHash('sha256').update(sourceJson).digest('hex');
    const ref = (definition: string) => ({ sourceJson, sha256, definition });
    const validateInput = compileNodiaAiToolSchema(ref('InvoiceOcrInput')).validate;
    const validateOutput = compileNodiaAiToolSchema(ref('InvoiceOcrResult')).validate;
    const load = async (input: NodiaAiJsonObject, context: NodiaAiToolHandlerContext) => {
      if (!validateInput(input)) ocrInvalid('invalid_tool_input');
      if (input.action === 'read') return this.snapshots.read(String(input.analysis_id), context, input.compare_prices === true);
      if (!context.attemptId) {
        const receipt = input.action === 'prepare'
          ? await this.snapshots.preparation(String(context.toolCallId), context)
          : await this.snapshots.anchor(String(context.toolCallId), context);
        return this.snapshots.current(receipt, context, false);
      }
      return this.snapshots.capture(input, context);
    };
    return [{ familyKey: 'nodia_invoice_ocr', modules: [{ key: 'invoice_ocr_business', route: '/business', label: 'Negocios' }],
      resources: [{ key: 'invoices', label: 'Facturas', requiredModuleRoutes: ['/business'] }],
      capabilities: [{ capabilityId: NODIA_AI_INVOICE_OCR_TOOL, revision: 1, publication: 'published',
        toolName: NODIA_AI_INVOICE_OCR_TOOL, kind: 'analyze_attachment', moduleKey: 'invoice_ocr_business',
        resourceKey: 'invoices', operationKey: 'ocr', descriptionKey: 'nodia_ai:tools.nodia_invoices_ocr',
        description: 'prepare conserva la intención y pide elegir proveedor comercial explícitamente. Usa la lectura autorizada y paginada de proveedores filtrada por el business_id exacto de la preparación; nunca presentes una lista global como si perteneciera a ese negocio. request exige analysis_id y provider_id de una elección explícita o coincidencia única autorizada; nunca elige el primero. Solicita OCR mediante el motor de Productos y termina esta generación. El backend lo ejecuta después del cierre y ACK. read recupera la extracción sin inferir; compare_prices permite compararla con productos actuales en un turno posterior. Nunca guarda productos, stock o facturas.',
        requiredModuleRoutes: ['/business'], actionKeys: [], effectKey: 'invoices.ocr',
        inputSchema: ref('InvoiceOcrInput'), outputSchema: ref('InvoiceOcrResult'),
        verifyAuthority: async (input, context) => { await load(input, context); },
        external: { prepare: async (input, context) => {
          const snapshot = await load(input, context), fingerprint = invoiceOcrAuthorityFingerprint(input, snapshot);
          return { fingerprint, verify: async current => {
            if (invoiceOcrAuthorityFingerprint(input, await load(input, current)) !== fingerprint) ocrInvalid('request_conflict');
          }, execute: async signal => {
            signal.throwIfAborted();
            const result = input.action === 'read' ? snapshot : invoiceOcrRequestResult(context.toolCallId!, snapshot);
            if (!validateOutput(result)) ocrInvalid('invalid_tool_output');
            return result;
          } };
        } },
        verifyResultAuthority: async (input, result, context) => {
          const snapshot = await load(input, context);
          const expected = input.action === 'read' ? snapshot : invoiceOcrRequestResult(context.toolCallId!, snapshot);
          if (!validateOutput(result) || invoiceOcrAuthorityFingerprint(input, expected) !== invoiceOcrAuthorityFingerprint(input, result)) ocrInvalid('invalid_tool_output');
          if (input.action === 'read') return;
          const repo = context.manager.getRepository(NodiaAiToolCall);
          const receipt = await repo.findOneBy({ id: context.toolCallId, run_id: context.runId, conversation_id: context.conversationId });
          if (!receipt || receipt.tool_name !== NODIA_AI_INVOICE_OCR_TOOL || !['validated', 'completed'].includes(receipt.state) ||
              ocrHash(receipt.arguments) !== ocrHash(input)) ocrInvalid();
          if (receipt.state === 'completed') {
            if (ocrHash(receipt.scope_manifest.invoice_ocr_snapshot) !== ocrHash(snapshot) ||
                receipt.scope_manifest.invoice_ocr_request_hash !== ocrHash(result)) ocrInvalid('request_conflict');
          } else {
            receipt.scope_manifest = { ...receipt.scope_manifest, invoice_ocr_snapshot: snapshot, invoice_ocr_request_hash: ocrHash(result) };
            if (input.action === 'request') {
              const prep = await this.snapshots.preparation(String(input.analysis_id), context, true);
              if (prep.scope_manifest.invoice_ocr_consumed_by && prep.scope_manifest.invoice_ocr_consumed_by !== receipt.id) ocrInvalid('invoice_ocr_already_requested');
              prep.scope_manifest = { ...prep.scope_manifest, invoice_ocr_consumed_by: receipt.id };
              await repo.save(prep);
            }
            await repo.save(receipt);
          }
        }, handler: async () => ocrInvalid('external_protocol_required') }] }];
  }
}
