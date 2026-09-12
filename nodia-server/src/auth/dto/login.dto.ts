import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ enum: ['google'] })
  @Equals('google')
  provider!: 'google';

  @ApiProperty({
    description: 'ID token returned by GoogleLogin in credential',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  credential!: string;
}
