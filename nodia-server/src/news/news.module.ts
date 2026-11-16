import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsSource } from './entities/news-source.entity.js';
import { NewsController } from './news.controller.js';
import { NewsService } from './news.service.js';
import { NewsFeedClient } from './news-feed.client.js';
import { ListNewsUseCase } from './use-case/list-news.use-case.js';
import { RefreshNewsUseCase } from './use-case/refresh-news.use-case.js';

@Module({
  imports: [TypeOrmModule.forFeature([NewsSource])],
  controllers: [NewsController],
  providers: [NewsService, NewsFeedClient, ListNewsUseCase, RefreshNewsUseCase],
})
export class NewsModule {}
