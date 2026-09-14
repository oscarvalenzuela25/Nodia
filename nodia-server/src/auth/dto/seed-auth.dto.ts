import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SeedAuthDto {
  @ApiProperty({
    description: 'Secret seed verification token matching SECRET_SEED env',
    example: 'dev_secret_seed_change_in_prod',
  })
  @IsString()
  @IsNotEmpty()
  secret_seed!: string;

  @ApiProperty({
    description: 'Email of the super admin user to create or assign',
    example: 'admin@nodia.com',
  })
  @IsEmail()
  @IsNotEmpty()
  super_admin_email!: string;
}
