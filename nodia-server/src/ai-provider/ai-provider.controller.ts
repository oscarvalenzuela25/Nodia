import { actorReference } from '../authorization/authority-transaction.js';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { SubmitGeminiAgenticCodeDto } from './dto/submit-gemini-agentic-code.dto.js';
import { ManageGeminiAgenticLoginUseCase } from './use-case/manage-gemini-agentic-login.use-case.js';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto.js';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto.js';
import { GetAiProvidersDto } from './dto/get-ai-providers.dto.js';
import { GetSelectableModelsDto } from './dto/get-selectable-models.dto.js';
import { CreateAiProviderCatalogDto } from './dto/create-ai-provider-catalog.dto.js';
import { UpdateAiProviderCatalogDto } from './dto/update-ai-provider-catalog.dto.js';
import { GetAllAiProvidersUseCase } from './use-case/get-all-ai-providers.use-case.js';
import { CreateAiProviderUseCase } from './use-case/create-ai-provider.use-case.js';
import { UpdateAiProviderUseCase } from './use-case/update-ai-provider.use-case.js';
import { GetSelectableModelsUseCase } from './use-case/get-selectable-models.use-case.js';
import { GetAiProvidersHealthUseCase } from './use-case/get-ai-providers-health.use-case.js';
import { GetSupportedAiProvidersUseCase } from './use-case/get-supported-ai-providers.use-case.js';
import { GetAiProviderCatalogUseCase } from './use-case/get-ai-provider-catalog.use-case.js';
import { CreateAiProviderCatalogUseCase } from './use-case/create-ai-provider-catalog.use-case.js';
import { UpdateAiProviderCatalogUseCase } from './use-case/update-ai-provider-catalog.use-case.js';
import { SyncAiProviderModelsUseCase } from './use-case/sync-ai-provider-models.use-case.js';
import { ManageGeminiLoginUseCase } from './use-case/manage-gemini-login.use-case.js';
import { GetGeminiEnginesUseCase } from './use-case/get-gemini-engines.use-case.js';
import { RequireAction } from '../authorization/action-permission.guard.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import type { GeminiExecutionEngine } from '../common/ai/ai.types.js';
import { ManageCodexSessionUseCase } from './use-case/manage-codex-session.use-case.js';
import { CodexSessionDto } from './dto/codex-session.dto.js';
import { GeminiLoginInputDto } from './dto/gemini-login-input.dto.js';

@RequireAction('ai:manage')
@Controller(['ai-provider', 'ai-providers'])
export class AiProviderController {
  constructor(
    private readonly getAllAiProvidersUseCase: GetAllAiProvidersUseCase,
    private readonly createAiProviderUseCase: CreateAiProviderUseCase,
    private readonly updateAiProviderUseCase: UpdateAiProviderUseCase,
    private readonly getSelectableModelsUseCase: GetSelectableModelsUseCase,
    private readonly getAiProvidersHealthUseCase: GetAiProvidersHealthUseCase,
    private readonly getSupportedAiProvidersUseCase: GetSupportedAiProvidersUseCase,
    private readonly getAiProviderCatalogUseCase: GetAiProviderCatalogUseCase,
    private readonly createAiProviderCatalogUseCase: CreateAiProviderCatalogUseCase,
    private readonly updateAiProviderCatalogUseCase: UpdateAiProviderCatalogUseCase,
    private readonly syncAiProviderModelsUseCase: SyncAiProviderModelsUseCase,
    private readonly manageGeminiLoginUseCase: ManageGeminiLoginUseCase,
    private readonly getGeminiEnginesUseCase: GetGeminiEnginesUseCase,
    private readonly manageGeminiAgenticLoginUseCase: ManageGeminiAgenticLoginUseCase,
    private readonly manageCodexSessionUseCase: ManageCodexSessionUseCase,
  ) {}

  @Get(':id/session')
  @Header('Cache-Control', 'no-store')
  getCodexSession(@Param('id') id: string, @Query() _query: CodexSessionDto) {
    return this.manageCodexSessionUseCase.session(id);
  }

  @Post(':id/session/login')
  @Header('Cache-Control', 'no-store')
  startCodexLogin(
    @Param('id') id: string,
    @Body() _dto: CodexSessionDto,
    @Req() request: AuthRequest,
  ) {
    return this.manageCodexSessionUseCase.start(id, request.auth.user.id);
  }

  @Get(':id/session/login/current')
  @Header('Cache-Control', 'no-store')
  currentCodexLogin(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.manageCodexSessionUseCase.current(id, request.auth.user.id);
  }

  @Get(':id/session/login/:jobId')
  @Header('Cache-Control', 'no-store')
  codexLoginStatus(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
  ) {
    return this.manageCodexSessionUseCase.status(
      id,
      jobId,
      request.auth.user.id,
    );
  }

  @Post(':id/session/login/:jobId/cancel')
  @Header('Cache-Control', 'no-store')
  cancelCodexLogin(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
  ) {
    return this.manageCodexSessionUseCase.cancel(
      id,
      jobId,
      request.auth.user.id,
    );
  }

  @Post(':id/session/logout')
  @Header('Cache-Control', 'no-store')
  logoutCodex(@Param('id') id: string, @Body() _dto: CodexSessionDto) {
    return this.manageCodexSessionUseCase.logout(id);
  }

  @Get(['gemini-engines', 'gemini/engines'])
  getGeminiEngines() {
    return this.getGeminiEnginesUseCase.execute();
  }

  @Post('gemini-login/start')
  @Header('Cache-Control', 'no-store')
  startGeminiLogin(@Req() request: AuthRequest) {
    return this.manageGeminiLoginUseCase.start(request.auth.user.id);
  }

  @Post('gemini-session/logout')
  @Header('Cache-Control', 'no-store')
  disconnectGeminiWeb(@Req() request: AuthRequest) {
    return this.manageGeminiLoginUseCase.disconnect(request.auth.user.id);
  }

  @Post('gemini-agentic-login/start')
  @Header('Cache-Control', 'no-store')
  startGeminiAgenticLogin(@Req() request: AuthRequest) {
    return this.manageGeminiAgenticLoginUseCase.start(request.auth.user.id);
  }

  @Get('gemini-agentic-login/current')
  @Header('Cache-Control', 'no-store')
  currentGeminiAgenticLogin(@Req() request: AuthRequest) {
    return this.manageGeminiAgenticLoginUseCase.current(request.auth.user.id);
  }

  @Get('gemini-agentic-login/:jobId')
  @Header('Cache-Control', 'no-store')
  getGeminiAgenticLogin(
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
  ) {
    return this.manageGeminiAgenticLoginUseCase.status(
      jobId,
      request.auth.user.id,
    );
  }

  @Post('gemini-agentic-login/:jobId/code')
  @Header('Cache-Control', 'no-store')
  submitGeminiAgenticCode(
    @Param('jobId') jobId: string,
    @Body() dto: SubmitGeminiAgenticCodeDto,
    @Req() request: AuthRequest,
  ) {
    return this.manageGeminiAgenticLoginUseCase.submit(
      jobId,
      request.auth.user.id,
      dto,
    );
  }

  @Post('gemini-agentic-login/:jobId/cancel')
  @Header('Cache-Control', 'no-store')
  cancelGeminiAgenticLogin(
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
  ) {
    return this.manageGeminiAgenticLoginUseCase.cancel(
      jobId,
      request.auth.user.id,
    );
  }

  @Get('gemini-login/:jobId')
  @Header('Cache-Control', 'no-store')
  getGeminiLoginStatus(
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
  ) {
    return this.manageGeminiLoginUseCase.status(jobId, request.auth.user.id);
  }

  @Post('gemini-login/:jobId/cancel')
  @Header('Cache-Control', 'no-store')
  cancelGeminiLogin(
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
  ) {
    return this.manageGeminiLoginUseCase.cancel(jobId, request.auth.user.id);
  }

  @Get('gemini-login/:jobId/frame')
  @Header('Cache-Control', 'no-store')
  getGeminiLoginFrame(
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
  ) {
    return this.manageGeminiLoginUseCase.frame(jobId, request.auth.user.id);
  }

  @Post('gemini-login/:jobId/input')
  @Header('Cache-Control', 'no-store')
  sendGeminiLoginInput(
    @Param('jobId') jobId: string,
    @Req() request: AuthRequest,
    @Body() dto: GeminiLoginInputDto,
  ) {
    return this.manageGeminiLoginUseCase.input(
      jobId,
      request.auth.user.id,
      dto,
    );
  }

  @Get(['catalog', 'provider-catalogs'])
  getCatalog() {
    return this.getAiProviderCatalogUseCase.execute();
  }

  @Post(['catalog', 'provider-catalogs'])
  createCatalog(
    @Body() createDto: CreateAiProviderCatalogDto,
    @Req() request: AuthRequest,
  ) {
    return this.createAiProviderCatalogUseCase.execute(
      createDto,
      actorReference(request.auth),
    );
  }

  @Put(['catalog/:id', 'provider-catalogs/:id'])
  updateCatalog(
    @Param('id') id: string,
    @Body() updateDto: UpdateAiProviderCatalogDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateAiProviderCatalogUseCase.execute(
      id,
      updateDto,
      actorReference(request.auth),
    );
  }

  @Get(['supported', 'supported-providers'])
  getSupportedProviders() {
    return this.getSupportedAiProvidersUseCase.execute();
  }

  @Get(['health', 'health-check', 'verify-all'])
  getHealth() {
    return this.getAiProvidersHealthUseCase.execute();
  }

  @Get(['models', 'selectable-models'])
  getSelectableModels(@Query() queryParams: GetSelectableModelsDto) {
    return this.getSelectableModelsUseCase.execute(queryParams);
  }

  @Get()
  findAll(@Query() queryParams: GetAiProvidersDto) {
    return this.getAllAiProvidersUseCase.execute(queryParams);
  }

  @Post()
  create(@Body() createDto: CreateAiProviderDto, @Req() request: AuthRequest) {
    return this.createAiProviderUseCase.execute(
      createDto,
      actorReference(request.auth),
    );
  }

  @Post(':id/sync-models')
  syncModels(
    @Param('id') id: string,
    @Query('persist') persist?: string,
    @Query('mode') mode?: string,
    @Query('engine') engine?: GeminiExecutionEngine,
  ) {
    const shouldPersist = persist === undefined ? true : persist === 'true';
    return this.syncAiProviderModelsUseCase.execute(id, {
      persist: shouldPersist,
      mode,
      engine,
    });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAiProviderDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateAiProviderUseCase.execute(
      id,
      updateDto,
      actorReference(request.auth),
    );
  }
}
