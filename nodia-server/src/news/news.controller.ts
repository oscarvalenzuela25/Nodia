import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.guard.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { ListNewsDto } from './dto/list-news.dto.js';
import { RefreshNewsDto } from './dto/refresh-news.dto.js';
import { ListNewsUseCase } from './use-case/list-news.use-case.js';
import { RefreshNewsUseCase } from './use-case/refresh-news.use-case.js';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(
    private readonly list: ListNewsUseCase,
    private readonly refresh: RefreshNewsUseCase,
  ) {}
  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  getNews(@Query() query: ListNewsDto) {
    return this.list.execute(query);
  }
  @Post('refresh')
  @HttpCode(200)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  refreshNews(@Req() request: AuthRequest, @Body() _body: RefreshNewsDto) {
    return this.refresh.execute(actorReference(request.auth));
  }
}
