import { Injectable } from '@nestjs/common';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class DatabaseHealthService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  async healthCheck(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.conn.db!.admin().ping();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'unknown' };
    }
  }
}
