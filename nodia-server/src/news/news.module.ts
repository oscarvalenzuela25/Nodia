import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsSource } from './entities/news-source.entity.js';
import { NewsController } from './news.controller.js';
import { ListNewsUseCase } from './use-case/list-news.use-case.js';
import { RefreshNewsUseCase } from './use-case/refresh-news.use-case.js';
import { PersonalNewsConnection } from './personal/entities/personal-news-connection.entity.js';
import { PersonalNewsController } from './personal/personal-news.controller.js';
import { PersonalNewsService } from './personal/personal-news.service.js';
import { PersonalNewsUseCase } from './personal/personal-news.use-case.js';
import { DevCommunityNewsClient } from './personal/dev-community-news.client.js';
import { DailyDevNewsClient } from './personal/daily-dev-news.client.js';

@Module({
  imports: [TypeOrmModule.forFeature([NewsSource, PersonalNewsConnection])],
  controllers: [NewsController, PersonalNewsController],
  providers: [
    ListNewsUseCase,
    RefreshNewsUseCase,
    PersonalNewsService,
    PersonalNewsUseCase,
    DevCommunityNewsClient,
    DailyDevNewsClient,
  ],
})
export class NewsModule {}
