import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../auth/types/auth.types.js';
import { actorReference } from '../../authorization/authority-transaction.js';
import {
  ConnectPersonalNewsDto,
  EmptyPersonalNewsInputPipe,
  PersonalNewsArticlesDto,
  PersonalNewsProviderDto,
} from './dto/personal-news.dto.js';
import { PersonalNewsUseCase } from './personal-news.use-case.js';

const noStore = () => Header('Cache-Control', 'private, no-store');

@ApiBearerAuth()
@ApiTags('Personal News')
@Controller('news/personal')
export class PersonalNewsController {
  constructor(private readonly news: PersonalNewsUseCase) {}

  @Get('connections')
  @noStore()
  connections(
    @Req() request: AuthRequest,
    @Query(EmptyPersonalNewsInputPipe) _query?: undefined,
  ) {
    return this.news.connections(actorReference(request.auth));
  }

  @Get('articles')
  @noStore()
  articles(
    @Req() request: AuthRequest,
    @Query() query: PersonalNewsArticlesDto,
  ) {
    return this.news.articles(actorReference(request.auth), query.provider);
  }

  @Post('connections/:provider')
  @HttpCode(200)
  @noStore()
  connect(
    @Req() request: AuthRequest,
    @Param() params: PersonalNewsProviderDto,
    @Body() body: ConnectPersonalNewsDto,
    @Query(EmptyPersonalNewsInputPipe) _query?: undefined,
  ) {
    return this.news.connect(
      actorReference(request.auth),
      params.provider,
      body.api_key,
    );
  }

  @Post('connections/:provider/test')
  @HttpCode(200)
  @noStore()
  test(
    @Req() request: AuthRequest,
    @Param() params: PersonalNewsProviderDto,
    @Body(EmptyPersonalNewsInputPipe) _body?: undefined,
    @Query(EmptyPersonalNewsInputPipe) _query?: undefined,
  ) {
    return this.news.test(actorReference(request.auth), params.provider);
  }

  @Post('connections/:provider/refresh')
  @HttpCode(200)
  @noStore()
  refresh(
    @Req() request: AuthRequest,
    @Param() params: PersonalNewsProviderDto,
    @Body(EmptyPersonalNewsInputPipe) _body?: undefined,
    @Query(EmptyPersonalNewsInputPipe) _query?: undefined,
  ) {
    return this.news.refresh(actorReference(request.auth), params.provider);
  }

  @Delete('connections/:provider')
  @HttpCode(204)
  @noStore()
  disconnect(
    @Req() request: AuthRequest,
    @Param() params: PersonalNewsProviderDto,
    @Body(EmptyPersonalNewsInputPipe) _body?: undefined,
    @Query(EmptyPersonalNewsInputPipe) _query?: undefined,
  ) {
    return this.news.disconnect(actorReference(request.auth), params.provider);
  }
}
