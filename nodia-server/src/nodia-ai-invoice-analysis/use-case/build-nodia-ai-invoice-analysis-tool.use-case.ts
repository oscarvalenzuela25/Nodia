import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
  NodiaAiToolSchemaReference,
} from '../../nodia-ai-tools/types/tool-registry.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import {
  NodiaAiInvoiceAnalysisContract,
  NODIA_AI_INVOICE_ANALYSIS_TOOL,
} from '../types/invoice-analysis-contract.types.js';
import {
  SnapshotNodiaAiInvoiceAnalysisUseCase,
  analysisHash,
  analysisObject,
  invoiceAnalysisInvalid,
} from './snapshot-nodia-ai-invoice-analysis.use-case.js';

@Injectable()
export class BuildNodiaAiInvoiceAnalysisToolUseCase {
  constructor(
    private readonly native: NodiaAiInvoiceAnalysisContract,
    private readonly snapshots: SnapshotNodiaAiInvoiceAnalysisUseCase,
  ) {}
  execute(): readonly NodiaAiToolFamily[] {
    const sourceJson = readFileSync(
      new URL(
        '../../nodia-ai-products/contracts/invoice-analysis.json',
        import.meta.url,
      ),
      'utf8',
    );
    const sha256 = createHash('sha256').update(sourceJson).digest('hex');
    const ref = (definition: string): NodiaAiToolSchemaReference => ({
      sourceJson,
      definition,
      sha256,
    });
    const inputSchema = ref('InvoiceAnalysisInput'),
      outputSchema = ref('InvoiceAnalysisResult');
    const inputValidator = compileNodiaAiToolSchema(inputSchema).validate,
      outputValidator = compileNodiaAiToolSchema(outputSchema).validate;
    const checkInput = (input: NodiaAiJsonObject) => {
      if (!inputValidator(input)) invoiceAnalysisInvalid('invalid_tool_input');
    };
    const verify = async (
      input: NodiaAiJsonObject,
      context: NodiaAiToolHandlerContext,
    ) => {
      checkInput(input);
      await this.snapshots.execute(input, context);
    };
    return [
      {
        familyKey: 'nodia_invoice_analysis',
        modules: [
          {
            key: 'invoice_analysis_business',
            route: '/business',
            label: 'Negocios',
          },
        ],
        resources: [
          {
            key: 'invoices',
            label: 'Facturas',
            requiredModuleRoutes: ['/business'],
          },
        ],
        capabilities: [
          {
            capabilityId: NODIA_AI_INVOICE_ANALYSIS_TOOL,
            revision: 1,
            publication: 'published',
            toolName: NODIA_AI_INVOICE_ANALYSIS_TOOL,
            kind: 'analyze_attachment',
            moduleKey: 'invoice_analysis_business',
            resourceKey: 'invoices',
            operationKey: 'analyze',
            descriptionKey: 'nodia_ai:tools.nodia_invoices_analyze',
            description:
              'Prepara las instrucciones nativas de factura para un adjunto de la generación activa Agentic o API key y completa su extracción revisable; no crea facturas ni ejecuta otra inferencia.',
            requiredModuleRoutes: ['/business'],
            actionKeys: [],
            inputSchema,
            outputSchema,
            effectKey: 'invoices.analysis',
            verifyAuthority: verify,
            external: {
              prepare: async (input, context) => {
                checkInput(input);
                if (!context.attemptId) invoiceAnalysisInvalid();
                const snapshot = await this.snapshots.execute(input, context),
                  fingerprint = analysisHash(snapshot);
                return {
                  fingerprint,
                  verify: async (current) => {
                    if (
                      analysisHash(
                        await this.snapshots.execute(input, current),
                      ) !== fingerprint
                    )
                      invoiceAnalysisInvalid('request_conflict');
                  },
                  execute: async (signal) => {
                    signal.throwIfAborted();
                    if (!context.deadlineAt)
                      invoiceAnalysisInvalid('external_timeout');
                    const args = {
                      providerFields:
                        snapshot.provider_fields === null
                          ? null
                          : analysisObject(snapshot.provider_fields),
                      tax: snapshot.tax as number | null,
                      signal,
                      deadlineAt: context.deadlineAt,
                    };
                    const privateSource = analysisObject(snapshot.source);
                    const source: NodiaAiJsonObject = {
                      attachment_id: privateSource.attachment_id,
                      kind: privateSource.kind,
                      media_type: privateSource.media_type,
                      byte_count: privateSource.byte_count,
                    };
                    const common: NodiaAiJsonObject = {
                      analysis_id:
                        input.action === 'prepare'
                          ? context.toolCallId!
                          : input.analysis_id,
                      review_required: true,
                      extraction_source: analysisObject(snapshot.selection).mode === 'api_key' ? 'active_api_generation' : 'active_agentic_generation',
                      business_id: snapshot.business_id,
                      provider_id: snapshot.provider_id,
                      attachment_id: source.attachment_id,
                      source,
                      selection: snapshot.selection,
                    };
                    let result: NodiaAiJsonObject;
                    if (input.action === 'prepare') {
                      const response = await this.native.prepare(args);
                      result = {
                        status: 'prepared',
                        ...common,
                        instructions: response.instructions,
                      };
                    } else {
                      const response = await this.native.normalize({
                        ...args,
                        extraction: analysisObject(input.extraction),
                      });
                      result = {
                        status: 'analyzed',
                        ...common,
                        extraction: response.extraction,
                      };
                    }
                    if (!outputValidator(result))
                      invoiceAnalysisInvalid('invalid_tool_output');
                    return result;
                  },
                };
              },
            },
            verifyResultAuthority: async (input, result, context) => {
              checkInput(input);
              if (!outputValidator(result))
                invoiceAnalysisInvalid('invalid_tool_output');
              await this.snapshots.verifyResult(input, result, context);
            },
            handler: async () =>
              invoiceAnalysisInvalid('external_protocol_required'),
          },
        ],
      },
    ];
  }
}
