import { actorReference } from '../authorization/authority-transaction.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Header,
} from '@nestjs/common';
import { CreateAiApiKeyDto } from './dto/create-ai-api-key.dto.js';
import { UpdateAiApiKeyDto } from './dto/update-ai-api-key.dto.js';
import { GetAiApiKeysDto } from './dto/get-ai-api-keys.dto.js';
import { GetAllAiApiKeysUseCase } from './use-case/get-all-ai-api-keys.use-case.js';
import { CreateAiApiKeyUseCase } from './use-case/create-ai-api-key.use-case.js';
import { UpdateAiApiKeyUseCase } from './use-case/update-ai-api-key.use-case.js';
import { DeleteAiApiKeyUseCase } from './use-case/delete-ai-api-key.use-case.js';
import { RequireAction } from '../authorization/action-permission.guard.js';

@RequireAction('ai:manage')
@Controller(['ai-api-key', 'ai-api-keys'])
export class AiApiKeyController {
  constructor(
    private readonly getAllAiApiKeysUseCase: GetAllAiApiKeysUseCase,
    private readonly createAiApiKeyUseCase: CreateAiApiKeyUseCase,
    private readonly updateAiApiKeyUseCase: UpdateAiApiKeyUseCase,
    private readonly deleteAiApiKeyUseCase: DeleteAiApiKeyUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetAiApiKeysDto) {
    return this.getAllAiApiKeysUseCase.execute(queryParams);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() createDto: CreateAiApiKeyDto, @Req() request: AuthRequest) {
    return this.createAiApiKeyUseCase.execute(
      createDto,
      actorReference(request.auth),
    );
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAiApiKeyDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateAiApiKeyUseCase.execute(
      id,
      updateDto,
      actorReference(request.auth),
    );
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  remove(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.deleteAiApiKeyUseCase.execute(id, actorReference(request.auth));
  }
}
