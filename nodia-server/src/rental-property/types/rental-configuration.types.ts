import {
  validateRentalQuery,
  pageResult,
} from '../../rental-common/rental-query.js';
import type { RentalConfigurationQueryDto } from '../dto/rental-configuration-query.dto.js';
export function validateConfigurationQuery(
  query: RentalConfigurationQueryDto,
  resource: 'property' | 'collaborator' | 'policy',
): void {
  validateRentalQuery(
    query,
    resource === 'property'
      ? 'properties'
      : resource === 'collaborator'
        ? 'collaborators'
        : 'policies',
  );
}
export const configurationPage = pageResult;
