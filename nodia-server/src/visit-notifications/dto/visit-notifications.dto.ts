import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class BusinessVisitPreferenceParams {
  @IsUUID() businessId!: string;
}

export class SaveBusinessVisitPreferenceDto {
  @IsBoolean() enabled!: boolean;
}

export class WebPushInstallationParams {
  @IsUUID('4') installationId!: string;
}

class WebPushSubscriptionKeysDto {
  @IsString() @MaxLength(87) p256dh!: string;
  @IsString() @MaxLength(22) auth!: string;
}

class WebPushSubscriptionDto {
  @IsString() @MaxLength(2048) endpoint!: string;

  @ValidateIf((_data, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  @Max(8_640_000_000_000_000)
  expirationTime?: number | null;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WebPushSubscriptionKeysDto)
  keys!: WebPushSubscriptionKeysDto;
}

export class SaveWebPushInstallationDto {
  @IsInt() @Min(0) @Max(2_147_483_646) expected_revision!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) key_id!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WebPushSubscriptionDto)
  subscription!: WebPushSubscriptionDto;
}

export class RevokeWebPushInstallationQuery {
  @Matches(/^(?:0|[1-9][0-9]{0,9})$/) expected_revision!: string;
}
