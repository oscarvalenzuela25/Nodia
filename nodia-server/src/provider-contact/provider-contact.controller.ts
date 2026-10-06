import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
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
  ) {
    return this.listContacts.execute(params.providerId, query);
  }
  @Post() create(
    @Param() params: ContactParamsDto,
    @Body() dto: CreateProviderContactDto,
  ) {
    return this.createContact.execute(params.providerId, dto);
  }
  @Put(':id') update(
    @Param() params: ContactIdParamsDto,
    @Body() dto: UpdateProviderContactDto,
  ) {
    return this.updateContact.execute(params.providerId, params.id, dto);
  }
  @Patch(':id/status') toggle(
    @Param() params: ContactIdParamsDto,
    @Body() dto: ToggleProviderContactDto,
  ) {
    return this.updateContact.execute(params.providerId, params.id, dto);
  }
}
