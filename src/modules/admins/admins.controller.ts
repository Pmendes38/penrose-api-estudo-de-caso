import {
  Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UseInterceptors, ClassSerializerInterceptor, Query, HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ListAdminsQueryDto } from './dto/list-admins.dto';
import { AdminEntity } from './entities/admin.entity';

@ApiTags('Admins')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, AdminGuard, ThrottlerGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @ApiOkResponse({ description: 'Lista paginada de admins', type: Object })
  list(@Query() q: ListAdminsQueryDto) {
    return this.admins.list(q.page, q.pageSize);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Admin encontrado', type: AdminEntity })
  get(@Param('id') id: string): Promise<AdminEntity> { return this.admins.get(id); }

  @Post()
  @ApiCreatedResponse({ description: 'Admin criado', type: AdminEntity })
  create(@Body() dto: CreateAdminDto): Promise<AdminEntity> { return this.admins.create(dto); }

  @Put(':id')
  @ApiOkResponse({ description: 'Admin atualizado', type: AdminEntity })
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto): Promise<AdminEntity> { return this.admins.update(id, dto); }

  @Delete(':id')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Admin removido' })
  remove(@Param('id') id: string): Promise<{ message: string }> { return this.admins.remove(id); }
}
