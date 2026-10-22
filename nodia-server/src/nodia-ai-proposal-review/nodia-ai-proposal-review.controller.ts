import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { NodiaAiProposalQueryDto } from '../nodia-ai-proposal/dto/nodia-ai-proposal.dto.js';
import { GetNodiaAiProposalReviewUseCase } from './use-case/get-nodia-ai-proposal-review.use-case.js';
@ApiTags('NodiaAI proposal review')
@ApiBearerAuth()
@Controller('nodia-ai/proposals')
export class NodiaAiProposalReviewController {
  constructor(private readonly review: GetNodiaAiProposalReviewUseCase) {}
  @Get(':id/review-metadata')
  @Header('Cache-Control', 'no-store')
  detail(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: NodiaAiProposalQueryDto,
  ) {
    return this.review.execute(
      actorReference(request.auth),
      id,
      query.revision,
    );
  }
}
