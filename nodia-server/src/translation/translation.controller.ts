import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TranslationService } from './translation.service.js';
import { CreateTranslationDto } from './dto/create-translation.dto.js';
import { UpdateTranslationDto } from './dto/update-translation.dto.js';
import { GetTranslationsDto } from './dto/get-translations.dto.js';
import { GetAllTranslationsUseCase } from './use-case/get-all-translations.use-case.js';
import { GetBundleTranslationsUseCase } from './use-case/get-bundle-translations.use-case.js';
import { CreateTranslationUseCase } from './use-case/create-translation.use-case.js';
import { UpdateTranslationUseCase } from './use-case/update-translation.use-case.js';

@Controller(['translation', 'translations'])
export class TranslationController {
  constructor(
    private readonly translationService: TranslationService,
    private readonly getAllTranslationsUseCase: GetAllTranslationsUseCase,
    private readonly getBundleTranslationsUseCase: GetBundleTranslationsUseCase,
    private readonly createTranslationUseCase: CreateTranslationUseCase,
    private readonly updateTranslationUseCase: UpdateTranslationUseCase,
  ) {}

  @Get('bundle')
  getBundle(@Query('locale') locale?: string) {
    return this.getBundleTranslationsUseCase.execute(locale || 'es');
  }

  @Post()
  create(@Body() createTranslationDto: CreateTranslationDto) {
    return this.createTranslationUseCase.execute(createTranslationDto);
  }

  @Get()
  findAll(@Query() queryParams: GetTranslationsDto) {
    return this.getAllTranslationsUseCase.execute(queryParams);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.translationService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateTranslationDto: UpdateTranslationDto,
  ) {
    return this.updateTranslationUseCase.execute(id, updateTranslationDto);
  }

  @Patch(':id')
  updatePatch(
    @Param('id') id: string,
    @Body() updateTranslationDto: UpdateTranslationDto,
  ) {
    return this.updateTranslationUseCase.execute(id, updateTranslationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.translationService.remove(id);
  }
}
