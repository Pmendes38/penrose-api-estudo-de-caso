import {
  Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { avatarMulterConfig } from './upload/avatar-multer.config';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('User')
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('admin/customers')
  @UseGuards(RolesGuard)
  @Roles('admin')
  listAdminCustomers() {
    return this.service.listAdminCustomers();
  }

  /* --------- Perfil ---------- */
  @Get('me')
  me(@CurrentUser() user: any) {
    return this.service.getMe(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateMeDto) {
    return this.service.updateMe(user.sub, dto);
  }

  /* --------- Endereços ---------- */
  @Get('addresses')
  listAddresses(@CurrentUser() user: any) {
    return this.service.listAddresses(user.sub);
  }

  @Post('addresses')
  addAddress(@CurrentUser() user: any, @Body() dto: CreateAddressDto) {
    return this.service.addAddress(user.sub, dto);
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @CurrentUser() user: any,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.service.updateAddress(user.sub, addressId, dto);
  }

  @Delete('addresses/:addressId')
  removeAddress(@CurrentUser() user: any, @Param('addressId') addressId: string) {
    return this.service.removeAddress(user.sub, addressId);
  }

  @Patch('addresses/:addressId/default')
  setDefault(@CurrentUser() user: any, @Param('addressId') addressId: string) {
    return this.service.setDefaultAddress(user.sub, addressId);
  }

  /* --------- Preferências ---------- */
  @Patch('preferences')
  updatePreferences(@CurrentUser() user: any, @Body() dto: UpdatePreferencesDto) {
    return this.service.updatePreferences(user.sub, dto);
  }

  /* --------- Avatar ---------- */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarMulterConfig))
  async uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    // Garanta que /uploads/avatars é servido estaticamente (ex.: ServeStaticModule)
    const publicUrl = `/uploads/avatars/${file.filename}`;
    return this.service.updateAvatar(user.sub, publicUrl);
  }

  /* --------- Troca de Senha ---------- */
  @Post('change-password')
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  /* --------- Sessões/Devices (via AuthService) ---------- */
  @Get('sessions')
  listSessions(@CurrentUser() user: any) {
    return this.service.listSessions(user.sub);
  }

  @Delete('sessions/:sessionId')
  revokeSession(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.service.revokeSession(user.sub, sessionId);
  }

  @Delete('sessions')
  revokeAllOther(@CurrentUser() user: any, @Query('except') except?: string) {
    return this.service.revokeAllOtherSessions(user.sub, except);
  }
}
