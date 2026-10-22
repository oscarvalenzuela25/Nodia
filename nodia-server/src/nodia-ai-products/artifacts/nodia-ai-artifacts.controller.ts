import { Controller, Get, Param, ParseUUIDPipe, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthRequest } from '../../auth/types/auth.types.js';
import { actorReference } from '../../authorization/authority-transaction.js';
import { DownloadNodiaAiArtifactUseCase } from './use-case/download-nodia-ai-artifact.use-case.js';

@ApiTags('NodiaAI artifacts')
@ApiBearerAuth()
@Controller('nodia-ai/artifacts')
export class NodiaAiArtifactsController {
  constructor(private readonly download: DownloadNodiaAiArtifactUseCase) {}
  @Get(':reference')
  async get(@Req() request: AuthRequest, @Param('reference', ParseUUIDPipe) reference: string, @Res() response: Response) {
    const controller = new AbortController();
    const closed = () => { if (!response.writableEnded) controller.abort(); };
    response.once('close', closed);
    try {
      const file = await this.download.execute(actorReference(request.auth), reference, controller.signal);
      response.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.filename}"`, 'Content-Length': String(file.buffer.byteLength) });
      response.send(file.buffer);
    } finally {
      response.off('close', closed);
    }
  }
}
