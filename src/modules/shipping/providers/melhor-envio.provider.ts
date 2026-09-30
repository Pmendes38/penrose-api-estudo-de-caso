import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

type CalculateByPackageInput = {
  from: { postal_code: string };
  to: { postal_code: string };
  package: { height: number; width: number; length: number; weight: number };
  options?: {
    insurance_value?: number;
    receipt?: boolean;
    own_hand?: boolean;
  };
  services?: string;
};

@Injectable()
export class MelhorEnvioProvider {
  private readonly logger = new Logger(MelhorEnvioProvider.name);
  private readonly sandbox: boolean;
  private readonly baseApiUrl: string;
  private readonly baseAuthUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly defaultRetries: number;

  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly staticAccessToken?: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.sandbox = this.config.get<string>('MELHOR_ENVIO_SANDBOX') === 'true';
    const host = this.sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://www.melhorenvio.com.br';
    this.baseApiUrl  = `${host}/api/v2`;
    this.baseAuthUrl = `${host}/oauth`;

    this.userAgent = this.config.get<string>('APP_USER_AGENT') || 'MyStore (contact@example.com)';
    this.timeoutMs = Number(this.config.get('HTTP_TIMEOUT_MS') ?? 15000);
    this.defaultRetries = Number(this.config.get('HTTP_RETRIES') ?? 2);

    this.clientId     = this.config.get<string>('MELHOR_ENVIO_CLIENT_ID') || undefined;
    this.clientSecret = this.config.get<string>('MELHOR_ENVIO_CLIENT_SECRET') || undefined;
    this.staticAccessToken = this.config.get<string>('MELHOR_ENVIO_ACCESS_TOKEN') || undefined;
  }

  private async getAccessToken(): Promise<string> {
    if (this.staticAccessToken) return this.staticAccessToken;

    if (!this.clientId || !this.clientSecret) {
      throw new InternalServerErrorException('Melhor Envio credentials/token not configured');
    }
    const url = `${this.baseAuthUrl}/token`;
    try {
      const res = await this.request<any>({
        method: 'POST',
        url,
        data: {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }, 0);
      const token = res?.access_token as string | undefined;
      if (!token) throw new Error('Empty access_token');
      return token;
    } catch (err) {
      this.logger.error(`OAuth token error: ${(err as Error).message}`);
      throw err;
    }
  }

  private async request<T>(
    cfg: { method: 'GET'|'POST'|'DELETE'; url: string; data?: any; params?: any; headers?: Record<string, any> },
    retries = this.defaultRetries,
  ): Promise<T> {
    const headers = {
      Accept: 'application/json',
      'User-Agent': this.userAgent,
      ...(cfg.headers ?? {}),
    };
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await firstValueFrom(
          this.http.request<T>({
            method: cfg.method,
            url: cfg.url,
            data: cfg.data,
            params: cfg.params,
            headers,
            timeout: this.timeoutMs,
          }),
        );
        return res.data;
      } catch (e: any) {
        const status = e?.response?.status;
        const retryable = status === 429 || (status >= 500 && status < 600) || e?.code === 'ECONNABORTED';
        if (!retryable || attempt === retries) throw e;
        const backoff = 500 * Math.pow(2, attempt); // 0.5s, 1s, 2s...
        await new Promise(r => setTimeout(r, backoff + Math.floor(Math.random() * 200)));
      }
    }
    throw new Error('unreachable');
  }

  private async authHeaders(accessToken?: string) {
    const token = accessToken || (await this.getAccessToken());
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async calculateByPackage(input: CalculateByPackageInput, accessToken?: string) {
    const url = `${this.baseApiUrl}/me/shipment/calculate`;
    const headers = await this.authHeaders(accessToken);
    return this.request<any[]>({ method: 'POST', url, data: input, headers });
  }

  async listServices(accessToken?: string) {
    const url = `${this.baseApiUrl}/me/shipment/services`;
    const headers = await this.authHeaders(accessToken);
    return this.request<any[]>({ method: 'GET', url, headers });
  }

  async listCompanies(accessToken?: string) {
    const url = `${this.baseApiUrl}/me/shipment/companies`;
    const headers = await this.authHeaders(accessToken);
    return this.request<any[]>({ method: 'GET', url, headers });
  }

  async listAgencies(params?: { company?: string; country?: string; state?: string; city?: string }, accessToken?: string) {
    const url = `${this.baseApiUrl}/me/shipment/agencies`;
    const headers = await this.authHeaders(accessToken);
    return this.request<any[]>({ method: 'GET', url, params, headers });
  }

  async ordersSearch(q: string, status?: string, accessToken?: string) {
    const url = `${this.baseApiUrl}/me/orders/search`;
    const headers = await this.authHeaders(accessToken);
    const params: any = { q };
    if (status) params.status = status;
    return this.request<any>({ method: 'GET', url, params, headers });
  }

  async tracking(orders: string[], accessToken?: string) {
    const url = `${this.baseApiUrl}/me/shipment/tracking`;
    const headers = await this.authHeaders(accessToken);
    return this.request<any>({ method: 'POST', url, data: { orders }, headers });
  }
}
