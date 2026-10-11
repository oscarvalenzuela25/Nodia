import { IsString, Matches } from 'class-validator';

export class ActionIdDto {
  @IsString({ message: 'actions:invalid_id' })
  @Matches(/^[1-9]\d{0,18}$/, { message: 'actions:invalid_id' })
  id: string;
}
