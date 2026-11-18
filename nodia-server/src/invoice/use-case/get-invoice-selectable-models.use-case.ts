import { Injectable } from '@nestjs/common';
import {
  GetSelectableModelsUseCase,
  type ProviderSelectableModelsResult,
  type SelectableModelInfo,
} from '../../ai-provider/use-case/get-selectable-models.use-case.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import type { GetInvoiceSelectableModelsQueryDto } from '../dto/get-invoice-selectable-models-query.dto.js';

type InvoiceModel = Pick<
  SelectableModelInfo,
  | 'id'
  | 'name'
  | 'displayName'
  | 'inputModalities'
  | 'supportedReasoningEfforts'
>;

export interface InvoiceSelectableModelsResult {
  providerId: string;
  mode: GetInvoiceSelectableModelsQueryDto['mode'];
  models_source: ProviderSelectableModelsResult['models_source'];
  models: InvoiceModel[];
}

@Injectable()
export class GetInvoiceSelectableModelsUseCase {
  constructor(private readonly selectableModels: GetSelectableModelsUseCase) {}

  async execute(
    query: GetInvoiceSelectableModelsQueryDto,
  ): Promise<InvoiceSelectableModelsResult[]> {
    validateCatalogId(query.provider_id, 'ai_provider:invalid_id');
    const [observation] = await this.selectableModels.executeForProvider(query);
    if (
      observation?.providerId !== query.provider_id ||
      observation.mode !== query.mode
    )
      return [];

    return [
      {
        providerId: observation.providerId,
        mode: query.mode,
        models_source: observation.models_source,
        models:
          observation.models_source === 'provider'
            ? observation.models.map((model) => ({
                id: model.id,
                name: model.name,
                displayName: model.displayName,
                inputModalities: model.inputModalities,
                supportedReasoningEfforts: model.supportedReasoningEfforts,
              }))
            : [],
      },
    ];
  }
}
