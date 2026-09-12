import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './auth.guard.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import { AuthCookieService } from './auth-cookie.service.js';
import { LoginUseCase } from './use-case/login.use-case.js';
import { RefreshSessionUseCase } from './use-case/refresh-session.use-case.js';
import { LogoutUseCase } from './use-case/logout.use-case.js';
import type { AuthRequest } from './types/auth.types.js';
import { LimitLogin } from '../rate-limit/rate-limit.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
    private readonly cookies: AuthCookieService,
  ) {}

  @Public()
  @LimitLogin()
  @UseGuards(AuthOriginGuard)
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Exchange a Google ID token for a Nodia session' })
  async signIn(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.cookies.write(response, await this.login.execute(dto));
  }

  @Public()
  @UseGuards(AuthOriginGuard)
  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Rotate the refresh cookie and renew the access JWT',
  })
  async renew(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.cookies.write(
      response,
      await this.refresh.execute(this.cookies.read(request)),
    );
  }

  @Public()
  @UseGuards(AuthOriginGuard)
  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Revoke this session and clear its cookie' })
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.logout.execute(this.cookies.read(request));
    this.cookies.clear(response);
  }

  @ApiBearerAuth()
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthRequest) {
    return request.auth.user;
  }
}
