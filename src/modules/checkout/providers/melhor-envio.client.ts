import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';

type PrintMode = 'public' | 'private';

@Injectable()
export class MelhorEnvioClient {
  private readonly apiBase: string;
  private readonly userAgent: string;

  constructor(private readonly http: HttpService, private readonly config: ConfigService) {
    const sandbox = this.config.get<string>('MELHOR_ENVIO_SANDBOX') === 'true';
    this.apiBase = sandbox ? 'https://sandbox.melhorenvio.com.br/api/v2' : 'https://www.melhorenvio.com.br/api/v2';
    this.userAgent = this.config.get<string>('APP_USER_AGENT') || 'MyStore (contact@example.com)';
  }

  private headers(token: string) {
    if (!token) throw new InternalServerErrorException('melhor_envio_token_missing');
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': this.userAgent,
    };
  }

  async addToCart(payload: any, token: string) {
    const req$ = this.http
      .post(`${this.apiBase}/me/cart`, payload, { headers: this.headers(token) })
      .pipe(timeout({ first: 15000 }));
    const res = await firstValueFrom(req$);
    return res.data;
  }

  async checkout(orders: string[], token: string) {
    const body = { orders };
    const req$ = this.http
      .post(`${this.apiBase}/me/shipment/checkout`, body, { headers: this.headers(token) })
      .pipe(timeout({ first: 15000 }));
    const res = await firstValueFrom(req$);
    return res.data;
  }

  async generate(orders: string[], token: string) {
    const body = { orders };
    const req$ = this.http
      .post(`${this.apiBase}/me/shipment/generate`, body, { headers: this.headers(token) })
      .pipe(timeout({ first: 20000 }));
    const res = await firstValueFrom(req$);
    return res.data;
  }

  async print(orders: string[], mode: PrintMode, token: string) {
    const body = { mode, orders };
    const req$ = this.http
      .post(`${this.apiBase}/me/shipment/print`, body, { headers: this.headers(token) })
      .pipe(timeout({ first: 15000 }));
    const res = await firstValueFrom(req$);
    return res.data;
  }

  async preview(orders: string[], token: string) {
    const body = { orders };
    const req$ = this.http
      .post(`${this.apiBase}/me/shipment/preview`, body, { headers: this.headers(token) })
      .pipe(timeout({ first: 15000 }));
    const res = await firstValueFrom(req$);
    return res.data;
  }
}
