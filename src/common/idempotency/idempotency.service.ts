import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class IdempotencyService {
  private mem = new Map<string, { status: number; headers: Record<string,string>; body: any; expireAt: number }>();
  private ttlMs = 15 * 60 * 1000;

  private normalizeKey(key: string) {
    return createHash('sha256').update(key).digest('hex');
  }

  async get(key: string) {
    const k = this.normalizeKey(key);
    const rec = this.mem.get(k);
    if (!rec) return null;
    if (Date.now() > rec.expireAt) { this.mem.delete(k); return null; }
    return rec;
  }
  async set(key: string, value: { status: number; headers: Record<string,string>; body: any }) {
    const k = this.normalizeKey(key);
    this.mem.set(k, { ...value, expireAt: Date.now() + this.ttlMs });
  }
}
