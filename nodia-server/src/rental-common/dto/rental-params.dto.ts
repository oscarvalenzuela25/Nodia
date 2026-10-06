import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsRentalId } from '../rental-validation.js';
export class RentalPropertyParamsDto {
  @ApiProperty({ type: String, example: '1' })
  @IsRentalId()
  propertyId!: string;
}
export class RentalResourceParamsDto extends RentalPropertyParamsDto {
  @ApiProperty({ type: String, example: '1' }) @IsRentalId() id!: string;
}
export class RentalOperationParamsDto extends RentalPropertyParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') requestKey!: string;
}
