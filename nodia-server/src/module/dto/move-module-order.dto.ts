import { IsString, Matches } from 'class-validator';
import { MoveOrderDto } from '../../module-order/move-order.dto.js';

export class MoveModuleOrderDto extends MoveOrderDto {
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  expected_module_group_id: string;
}
