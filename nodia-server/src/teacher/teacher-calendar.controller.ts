import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  CalendarPlansQueryDto,
  CreateCalendarCategoryDto,
  CreateCalendarPlanDto,
  PatchCalendarCategoryDto,
  PatchCalendarDayDto,
} from './dto/teacher-calendar.dto.js';
import { TeacherCalendarUseCase } from './use-case/teacher-calendar.use-case.js';

@ApiTags('Teacher')
@Controller('teacher/calendar')
export class TeacherCalendarController {
  constructor(private readonly calendar: TeacherCalendarUseCase) {}

  @Get('plans')
  @Header('Cache-Control', 'no-store')
  listPlans(
    @Req() request: AuthRequest,
    @Query() query: CalendarPlansQueryDto,
  ) {
    return this.calendar.listPlans(
      actorReference(request.auth),
      query.page,
      query.category_id,
    );
  }

  @Post('plans')
  @Header('Cache-Control', 'no-store')
  createPlan(@Req() request: AuthRequest, @Body() body: CreateCalendarPlanDto) {
    return this.calendar.createPlan(actorReference(request.auth), body);
  }

  @Get('plans/:planId')
  @Header('Cache-Control', 'no-store')
  plan(
    @Req() request: AuthRequest,
    @Param('planId', ParseUUIDPipe) planId: string,
  ) {
    return this.calendar.plan(actorReference(request.auth), planId);
  }

  @Get('plans/:planId/days/:dayId')
  @Header('Cache-Control', 'no-store')
  day(
    @Req() request: AuthRequest,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
  ) {
    return this.calendar.day(actorReference(request.auth), planId, dayId);
  }

  @Patch('plans/:planId/days/:dayId')
  @Header('Cache-Control', 'no-store')
  patchDay(
    @Req() request: AuthRequest,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Body() body: PatchCalendarDayDto,
  ) {
    return this.calendar.patchDay(
      actorReference(request.auth),
      planId,
      dayId,
      body,
    );
  }

  @Get('categories')
  @Header('Cache-Control', 'no-store')
  categories(@Req() request: AuthRequest) {
    return this.calendar.categories(actorReference(request.auth));
  }

  @Post('categories')
  @Header('Cache-Control', 'no-store')
  createCategory(
    @Req() request: AuthRequest,
    @Body() body: CreateCalendarCategoryDto,
  ) {
    return this.calendar.createCategory(actorReference(request.auth), body);
  }

  @Patch('categories/:categoryId')
  @Header('Cache-Control', 'no-store')
  patchCategory(
    @Req() request: AuthRequest,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: PatchCalendarCategoryDto,
  ) {
    return this.calendar.patchCategory(
      actorReference(request.auth),
      categoryId,
      body,
    );
  }
}
