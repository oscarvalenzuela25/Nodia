import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CALENDAR_ACTIVITY_LIMIT,
  CALENDAR_CATEGORY_LIMIT,
} from '../policies/teacher-calendar.js';
import {
  calendarColors,
  calendarPlanStatuses,
  type CalendarColor,
  type CalendarPlanStatus,
} from '../types/teacher-calendar.types.js';

export class CalendarPlansQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[1-9][0-9]{0,8}$/.test(value)
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  @Max(999999999)
  page = 1;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  category_id?: string;

  @IsIn(calendarPlanStatuses)
  status: CalendarPlanStatus = 'active';
}

export class CreateCalendarPlanDto {
  @IsUUID()
  request_key!: string;

  @IsObject()
  plan!: Record<string, unknown>;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(CALENDAR_CATEGORY_LIMIT)
  @IsString({ each: true })
  new_categories?: string[];
}

export class PatchCalendarPlanDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(CALENDAR_CATEGORY_LIMIT)
  @IsUUID(undefined, { each: true })
  category_ids?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}

export class PatchCalendarDayDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  title!: string | null;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  notes!: string | null;

  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes!: number | null;

  @IsArray()
  @ArrayMaxSize(CALENDAR_ACTIVITY_LIMIT)
  activities!: unknown[];
}

export class CreateCalendarCategoryDto {
  @IsString()
  name!: string;

  @IsIn(calendarColors)
  color!: CalendarColor;
}

export class PatchCalendarCategoryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(calendarColors)
  color?: CalendarColor;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
