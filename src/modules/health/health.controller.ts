import { Controller, Get } from '@nestjs/common';
import { DatabaseHealthService } from '../../common/database/database.health';

@Controller()
export class HealthController {
  constructor(private readonly dbHealth: DatabaseHealthService) {}

  @Get('test')
  getTest() {
    return { message: 'Backend funcionando!' };
  }

  @Get('db')
  async db() {
    const res = await this.dbHealth.healthCheck();
    return { database: res };
  }
}
