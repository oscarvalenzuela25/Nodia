import { ValidateIf } from 'class-validator';
import { TranslateItemDto } from '../../translation/dto/translate-item.dto.js';

// Only optional business descriptions may have an empty locale. Required
// translations in other resources retain the shared DTO's validation.
export class BusinessTranslateItemDto extends TranslateItemDto {
  @ValidateIf((item: TranslateItemDto) =>
    !['description', 'comment'].includes(item.key) || item.es !== '',
  )
  es: string = '';

  @ValidateIf((item: TranslateItemDto) =>
    !['description', 'comment'].includes(item.key) || item.en !== '',
  )
  en: string = '';
}
