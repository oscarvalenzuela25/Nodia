import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  PERSONAL_NEWS_API_KEY_PATTERN,
  PERSONAL_NEWS_PROVIDERS,
  type PersonalNewsProvider,
} from '../personal-news.types.js';

export class PersonalNewsProviderDto {
  @IsIn(PERSONAL_NEWS_PROVIDERS) provider!: PersonalNewsProvider;
}

export class PersonalNewsArticlesDto {
  @IsOptional() @IsIn(PERSONAL_NEWS_PROVIDERS) provider?: PersonalNewsProvider;
}

export class ConnectPersonalNewsDto {
  @Matches(PERSONAL_NEWS_API_KEY_PATTERN, { message: 'news:invalid_input' })
  api_key!: string;
}

@Injectable()
export class EmptyPersonalNewsInputPipe implements PipeTransform<
  unknown,
  undefined
> {
  transform(value: unknown): undefined {
    if (
      value !== undefined &&
      (!value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length > 0)
    )
      throw new BadRequestException('news:invalid_input');
    return undefined;
  }
}
