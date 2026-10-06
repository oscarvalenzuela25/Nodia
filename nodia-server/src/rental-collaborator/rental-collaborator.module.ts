import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalCollaboratorController } from './rental-collaborator.controller.js';
import { CreateRentalCollaboratorUseCase } from './use-case/create-rental-collaborator.use-case.js';
import { GetRentalCollaboratorCandidatesUseCase } from './use-case/get-rental-collaborator-candidates.use-case.js';
import { GetRentalCollaboratorsUseCase } from './use-case/get-rental-collaborators.use-case.js';
import { UpdateRentalCollaboratorUseCase } from './use-case/update-rental-collaborator.use-case.js';
import { RentalCollaboratorService } from './rental-collaborator.service.js';
import { RentalCollaborator } from './entities/rental-collaborator.entity.js';
@Module({
  imports: [RentalCommonModule, TypeOrmModule.forFeature([RentalCollaborator])],
  controllers: [RentalCollaboratorController],
  providers: [
    RentalCollaboratorService,
    CreateRentalCollaboratorUseCase,
    GetRentalCollaboratorCandidatesUseCase,
    GetRentalCollaboratorsUseCase,
    UpdateRentalCollaboratorUseCase,
  ],
  exports: [
    RentalCollaboratorService,
    CreateRentalCollaboratorUseCase,
    GetRentalCollaboratorCandidatesUseCase,
    GetRentalCollaboratorsUseCase,
    UpdateRentalCollaboratorUseCase,
  ],
})
export class RentalCollaboratorModule {}
