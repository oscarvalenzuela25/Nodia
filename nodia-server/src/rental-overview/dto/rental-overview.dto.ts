import { ApiProperty } from '@nestjs/swagger';
import { IsCivilDate } from '../../rental-common/rental-validation.js';

export class RentalOverviewQueryDto {
  @ApiProperty() @IsCivilDate() from_on!: string;
  @ApiProperty() @IsCivilDate() to_on!: string;
}
