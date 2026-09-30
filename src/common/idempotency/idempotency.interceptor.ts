import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly store: IdempotencyService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req: any = ctx.switchToHttp().getRequest();
    const res: any = ctx.switchToHttp().getResponse();
    const key = req.header('Idempotency-Key');

    if (!key) return next.handle();

    const scope = `${req.method}:${req.originalUrl}:${req.user?.id ?? req.cookies?.cartId ?? 'guest'}`;
    const cached = await this.store.get(`${scope}:${key}`);
    if (cached) {
      Object.entries(cached.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(cached.status);
      return of(cached.body);
    }

    return next.handle().pipe(
      tap(async (body) => {
        const status = res.statusCode ?? 200;
        const headers: Record<string,string> = {
          'Idempotent-Replayed': 'false',
        };
        await this.store.set(`${scope}:${key}`, { status, headers, body });
      }),
    );
  }
}
