import { Controller, Get, UseGuards } from '@nestjs/common';
import { DatabaseHealthService } from '../../common/database/database.health';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller()
export class HealthController {
  constructor(private readonly dbHealth: DatabaseHealthService) {}

  @Get('test')
  getTest() {
    return { message: 'Backend funcionando!' };
  }

  @Get('db')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async db() {
    const res = await this.dbHealth.healthCheck();
    return { database: res };
  }
}
