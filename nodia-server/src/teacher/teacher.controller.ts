import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Header,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { ReadTeacherUseCase } from './use-case/read-teacher.use-case.js';
import { ExecuteTeacherCommandUseCase } from './use-case/execute-teacher-command.use-case.js';
import { TeacherReceiptStatusInterceptor } from './teacher-receipt-status.interceptor.js';
import {
  ActivateRevisionDto,
  AcceptPlanDto,
  ApplyCandidateDto,
  AttemptRevisionDto,
  ClosePendingAttemptDto,
  ContinueJobDto,
  CreateSessionDto,
  GetTeacherSessionsDto,
  PatchCursorDto,
  PatchProposalDto,
  PatchResponsesDto,
  PatchSessionDto,
  PatchSetupDraftDto,
  PauseDto,
  PrepareMaterialDto,
  ProposePlanDto,
  RequestHelpDto,
  SessionStateDto,
  SetupMessageDto,
  StartAttemptDto,
  SubmitPracticeAnswerDto,
  TeacherEligibilityDto,
} from './dto/teacher.dto.js';

@Controller('teacher')
@UseInterceptors(TeacherReceiptStatusInterceptor)
export class TeacherController {
  constructor(
    private readonly read: ReadTeacherUseCase,
    private readonly command: ExecuteTeacherCommandUseCase,
  ) {}
  @Get('connections') @Header('Cache-Control', 'no-store') connections(
    @Req() r: AuthRequest,
  ) {
    return this.read.connections(actorReference(r.auth));
  }
  @Get('connections/:id/eligibility')
  @Header('Cache-Control', 'no-store')
  eligibility(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Query() q: TeacherEligibilityDto,
  ) {
    return this.read.eligibility(actorReference(r.auth), id, {
      mode: q.mode,
      model_id: q.model_id,
      effort_id: q.effort_id ?? null,
    });
  }
  @Get('sessions') @Header('Cache-Control', 'no-store') list(
    @Req() r: AuthRequest,
    @Query() q: GetTeacherSessionsDto,
  ) {
    return this.read.list(actorReference(r.auth), q);
  }
  @Post('sessions') create(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Body() b: CreateSessionDto,
  ) {
    return this.command.execute(actorReference(r.auth), null, k, 'create', b);
  }
  @Get('sessions/:id') @Header('Cache-Control', 'no-store') detail(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.read.detail(actorReference(r.auth), id);
  }
  @Patch('sessions/:id') patch(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: PatchSessionDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'patch', b);
  }
  @Get('sessions/:id/messages') @Header('Cache-Control', 'no-store') messages(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: GetTeacherSessionsDto,
  ) {
    return this.read.messages(actorReference(r.auth), id, q.page, q.limit);
  }
  @Patch('sessions/:id/setup-draft') patchSetupDraft(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: PatchSetupDraftDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'setup_draft', b);
  }
  @Post('sessions/:id/messages') @HttpCode(202) message(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: SetupMessageDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'message', b);
  }
  @Post('sessions/:id/plan-proposals') @HttpCode(202) propose(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: ProposePlanDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'propose', b);
  }
  @Get('sessions/:id/plan-proposals/:proposalId')
  @Header('Cache-Control', 'no-store')
  proposal(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proposalId', new ParseUUIDPipe()) p: string,
  ) {
    return this.read.proposal(actorReference(r.auth), id, p);
  }
  @Patch('sessions/:id/plan-proposals/:proposalId') patchProposal(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proposalId', new ParseUUIDPipe()) p: string,
    @Body() b: PatchProposalDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'patch_proposal',
      b,
      { proposalId: p },
    );
  }
  @Post('sessions/:id/plan-proposals/:proposalId/apply-candidate')
  @HttpCode(200)
  applyCandidate(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proposalId', new ParseUUIDPipe()) p: string,
    @Body() b: ApplyCandidateDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'apply_candidate',
      b,
      { proposalId: p },
    );
  }
  @Post('sessions/:id/plan-proposals/:proposalId/accept') accept(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proposalId', new ParseUUIDPipe()) p: string,
    @Body() b: AcceptPlanDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'accept', b, {
      proposalId: p,
    });
  }
  @Post('sessions/:id/plan-revisions/:proposalId/activate')
  @HttpCode(200)
  activate(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proposalId', new ParseUUIDPipe()) p: string,
    @Body() b: ActivateRevisionDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'activate', b, {
      proposalId: p,
    });
  }
  @Post('sessions/:id/units/:unitId/material') @HttpCode(202) material(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('unitId', new ParseUUIDPipe()) u: string,
    @Body() b: PrepareMaterialDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'material', b, {
      unitId: u,
    });
  }
  @Get('sessions/:id/units/:unitId') @Header('Cache-Control', 'no-store') unit(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('unitId', new ParseUUIDPipe()) u: string,
    @Query('plan_revision_id', new ParseUUIDPipe()) revision: string,
  ) {
    return this.read.material(actorReference(r.auth), id, u, revision);
  }
  @Post('sessions/:id/units/:unitId/attempts') @HttpCode(202) practice(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('unitId', new ParseUUIDPipe()) u: string,
    @Body() b: StartAttemptDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'start_practice',
      b,
      { unitId: u },
    );
  }
  @Post('sessions/:id/sections/:sectionId/attempts') @HttpCode(202) final(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('sectionId', new ParseUUIDPipe()) s: string,
    @Body() b: StartAttemptDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'start_final',
      b,
      { sectionId: s },
    );
  }
  @Post('sessions/:id/diagnostic-attempts') @HttpCode(202) diagnostic(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: StartAttemptDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'start_diagnostic',
      b,
    );
  }
  @Get('sessions/:id/attempts/:attemptId')
  @Header('Cache-Control', 'no-store')
  attempt(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
  ) {
    return this.read.attempt(actorReference(r.auth), id, a);
  }
  @Get('sessions/:id/attempts/:attemptId/questions/:questionId')
  @Header('Cache-Control', 'no-store')
  question(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
    @Param('questionId', new ParseUUIDPipe()) q: string,
  ) {
    return this.read.question(actorReference(r.auth), id, a, q);
  }
  @Patch('sessions/:id/attempts/:attemptId/responses') responses(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
    @Body() b: PatchResponsesDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'patch_responses',
      b,
      { attemptId: a },
    );
  }
  @Post('sessions/:id/attempts/:attemptId/responses/:questionId/submit')
  @HttpCode(200)
  submitQuestion(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
    @Param('questionId', new ParseUUIDPipe()) q: string,
    @Body() b: SubmitPracticeAnswerDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'submit_question',
      b,
      { attemptId: a, questionId: q },
    );
  }
  @Post('sessions/:id/attempts/:attemptId/submit') @HttpCode(200) submit(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
    @Body() b: AttemptRevisionDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'submit_attempt',
      b,
      { attemptId: a },
    );
  }
  @Post('sessions/:id/attempts/:attemptId/help') @HttpCode(200) help(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
    @Body() b: RequestHelpDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'help', b, {
      attemptId: a,
    });
  }
  @Post('sessions/:id/attempts/:attemptId/close-pending')
  @HttpCode(200)
  closePending(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attemptId', new ParseUUIDPipe()) a: string,
    @Body() b: ClosePendingAttemptDto,
  ) {
    return this.command.execute(
      actorReference(r.auth),
      id,
      k,
      'close_pending',
      b,
      { attemptId: a },
    );
  }
  @Patch('sessions/:id/cursor') cursor(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: PatchCursorDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'cursor', b);
  }
  @Post('sessions/:id/pause') @HttpCode(200) pause(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: PauseDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'pause', b);
  }
  @Post('sessions/:id/resume') @HttpCode(200) resume(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: SessionStateDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'resume', b);
  }
  @Post('sessions/:id/archive') @HttpCode(200) archive(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: SessionStateDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'archive', b);
  }
  @Post('sessions/:id/unarchive') @HttpCode(200) unarchive(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: SessionStateDto,
  ) {
    return this.command.execute(actorReference(r.auth), id, k, 'unarchive', b);
  }
  @Get('jobs/:jobId') @Header('Cache-Control', 'no-store') job(
    @Req() r: AuthRequest,
    @Param('jobId', new ParseUUIDPipe()) j: string,
  ) {
    return this.read.job(actorReference(r.auth), j);
  }
  @Post('jobs/:jobId/continue-before-dispatch') @HttpCode(202) continueJob(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('jobId', new ParseUUIDPipe()) j: string,
    @Body() b: ContinueJobDto,
  ) {
    return this.command.job(actorReference(r.auth), k, j, 'continue_job', b);
  }
  @Post('jobs/:jobId/new-generation') @HttpCode(202) newGeneration(
    @Req() r: AuthRequest,
    @Headers('idempotency-key') k: string,
    @Param('jobId', new ParseUUIDPipe()) j: string,
    @Body() b: ContinueJobDto,
  ) {
    return this.command.job(actorReference(r.auth), k, j, 'new_generation', b);
  }
  @Get('requests/:requestKey') @Header('Cache-Control', 'no-store') receipt(
    @Req() r: AuthRequest,
    @Param('requestKey', new ParseUUIDPipe()) k: string,
  ) {
    return this.read.receipt(actorReference(r.auth), k);
  }
}
