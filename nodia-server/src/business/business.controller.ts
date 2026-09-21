import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { BusinessService } from './business.service.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { GetBusinessesDto } from './dto/get-businesses.dto.js';
import { AssignCollaboratorsDto } from './dto/assign-collaborators.dto.js';
import { GetMyBusinessesUseCase } from './use-case/get-my-businesses.use-case.js';
import { CreateBusinessUseCase } from './use-case/create-business.use-case.js';
import { UpdateBusinessUseCase } from './use-case/update-business.use-case.js';
import { AssignBusinessCollaboratorsUseCase } from './use-case/assign-business-collaborators.use-case.js';
import { GetBusinessByIdUseCase } from './use-case/get-business-by-id.use-case.js';

@Controller(['business', 'businesses'])
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly getMyBusinessesUseCase: GetMyBusinessesUseCase,
    private readonly getBusinessByIdUseCase: GetBusinessByIdUseCase,
    private readonly createBusinessUseCase: CreateBusinessUseCase,
    private readonly updateBusinessUseCase: UpdateBusinessUseCase,
    private readonly assignBusinessCollaboratorsUseCase: AssignBusinessCollaboratorsUseCase,
  ) {}

  @Get()
  findMyBusinesses(
    @Req() request: AuthRequest,
    @Query() queryParams: GetBusinessesDto,
  ) {
    return this.getMyBusinessesUseCase.execute(request.auth.user.id, queryParams);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.getBusinessByIdUseCase.execute(id, request.auth.user.id);
  }

  @Post()
  create(
    @Req() request: AuthRequest,
    @Body() createBusinessDto: CreateBusinessDto,
  ) {
    return this.createBusinessUseCase.execute(request.auth.user.id, createBusinessDto);
  }

  @Put(':id')
  update(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
  ) {
    return this.updateBusinessUseCase.execute(id, request.auth.user.id, updateBusinessDto);
  }

  @Put(':id/collaborators')
  assignCollaborators(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() assignCollaboratorsDto: AssignCollaboratorsDto,
  ) {
    return this.assignBusinessCollaboratorsUseCase.execute(
      id,
      request.auth.user.id,
      assignCollaboratorsDto,
    );
  }
}
