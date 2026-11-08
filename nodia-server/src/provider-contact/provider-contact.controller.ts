import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ContactIdParamsDto,
  ContactListDto,
  ContactParamsDto,
  CreateProviderContactDto,
  ToggleProviderContactDto,
  UpdateProviderContactDto,
} from './dto/provider-contact.dto.js';
import { CreateProviderContactUseCase } from './use-case/create-provider-contact.use-case.js';
import { GetProviderContactsUseCase } from './use-case/get-provider-contacts.use-case.js';
import { UpdateProviderContactUseCase } from './use-case/update-provider-contact.use-case.js';

@ApiTags('Provider contacts')
@Controller('providers/:providerId/contacts')
export class ProviderContactController {
  constructor(
    private readonly listContacts: GetProviderContactsUseCase,
    private readonly createContact: CreateProviderContactUseCase,
    private readonly updateContact: UpdateProviderContactUseCase,
  ) {}
  @Get() list(
    @Param() params: ContactParamsDto,
    @Query() query: ContactListDto,
    @Req() request: AuthRequest,
  ) {
    return this.listContacts.execute(
      params.providerId,
      query,
      undefined,
      actorReference(request.auth),
    );
  }
  @Post() create(
    @Param() params: ContactParamsDto,
    @Body() dto: CreateProviderContactDto,
    @Req() request: AuthRequest,
  ) {
    return this.createContact.execute(
      params.providerId,
      dto,
      undefined,
      actorReference(request.auth),
    );
  }
  @Put(':id') update(
    @Param() params: ContactIdParamsDto,
    @Body() dto: UpdateProviderContactDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateContact.execute(
      params.providerId,
      params.id,
      dto,
      undefined,
      actorReference(request.auth),
    );
  }
  @Patch(':id/status') toggle(
    @Param() params: ContactIdParamsDto,
    @Body() dto: ToggleProviderContactDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateContact.execute(
      params.providerId,
      params.id,
      dto,
      undefined,
      actorReference(request.auth),
    );
  }
}
