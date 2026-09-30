import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private metaFromReq(req: any) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = (req.headers['user-agent'] as string) || undefined;
    return { ip, userAgent };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Authenticate as admin or customer' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto.email, dto.password, this.metaFromReq(req));
  }

  @Post('admin-login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Authenticate as admin' })
  adminLogin(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.adminLogin(dto.email, dto.password, this.metaFromReq(req));
  }

  @Post('register')
  @ApiOkResponse({ description: 'Register a new customer' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Issue a new access token (and rotated refresh token)' })
  async refresh(@Body() body: RefreshDto, @Req() req: any) {
    const presented =
      body.refreshToken ||
      (req.headers['x-refresh-token'] as string | undefined) ||
      (req.cookies?.refreshToken as string | undefined);

    if (!presented) throw new BadRequestException('Refresh token is required');
    return this.authService.refreshByToken(presented, this.metaFromReq(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Revoke current session (or all sessions)' })
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  async logout(@Body() body: LogoutDto, @Req() req: any) {
    const user = req.user as { sub: string };
    const presented =
      body.refreshToken ||
      (req.headers['x-refresh-token'] as string | undefined) ||
      (req.cookies?.refreshToken as string | undefined) ||
      null;

    return this.authService.logout(user.sub, { all: body.all, presentedRefresh: presented });
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return { user: req.user };
  }

  @Get('admin/ping')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminPing() {
    return { ok: true };
  }
}
