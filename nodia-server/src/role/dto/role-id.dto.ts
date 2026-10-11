import { IsString, Matches } from 'class-validator';

export class RoleIdDto {
  @IsString({ message: 'roles:invalid_id' })
  @Matches(/^[1-9]\d{0,18}$/, { message: 'roles:invalid_id' })
  id!: string;
}
