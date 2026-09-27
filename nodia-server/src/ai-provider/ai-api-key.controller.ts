import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateAiApiKeyDto } from './dto/create-ai-api-key.dto.js';
import { UpdateAiApiKeyDto } from './dto/update-ai-api-key.dto.js';
import { GetAiApiKeysDto } from './dto/get-ai-api-keys.dto.js';
import { GetAllAiApiKeysUseCase } from './use-case/get-all-ai-api-keys.use-case.js';
import { CreateAiApiKeyUseCase } from './use-case/create-ai-api-key.use-case.js';
import { UpdateAiApiKeyUseCase } from './use-case/update-ai-api-key.use-case.js';
import { DeleteAiApiKeyUseCase } from './use-case/delete-ai-api-key.use-case.js';

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
  create(@Body() createDto: CreateAiApiKeyDto) {
    return this.createAiApiKeyUseCase.execute(createDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAiApiKeyDto,
  ) {
    return this.updateAiApiKeyUseCase.execute(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deleteAiApiKeyUseCase.execute(id);
  }
}
