import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom, timeout } from 'rxjs';
import { BillingType } from '../enums/billing-type.enum';

type AsaasCustomer = { id: string };

type AsaasCreatePaymentPayload = {
  customer: string;
  billingType: BillingType | 'UNDEFINED';
  value?: number;            // BRL
  totalValue?: number;       // BRL
  dueDate?: string;          // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number; // BRL

  discount?: { value: number; dueDateLimitDays?: number; type?: 'PERCENTAGE' | 'CURRENCY' };
  interest?: { value: number };
  fine?: { value: number };

  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string; email: string; cpfCnpj: string;
    postalCode: string; addressNumber: string;
    addressComplement?: string;
    phone?: string; mobilePhone?: string;
  };
  creditCardToken?: string;

  remoteIp?: string;

  callback?: { successUrl: string; autoRedirect?: boolean };
};

type AsaasPaymentResponse = {
  id: string;
  status?: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
  pixQrCode?: { payload?: string; originalPayload?: string };
};

type IdentificationFieldResponse = {
  identificationField: string;
  nossoNumero?: string;
  barCode?: string;
};

@Injectable()
export class AsaasProvider {
  private readonly logger = new Logger(AsaasProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly axiosCfg: AxiosRequestConfig;

  constructor(private readonly http: HttpService, private readonly config: ConfigService) {
    const sandbox = this.config.get<string>('ASAAS_SANDBOX') === 'true';
    this.baseUrl = sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';
    this.apiKey = this.config.get<string>('ASAAS_API_KEY') || undefined;

    this.axiosCfg = {
      baseURL: this.baseUrl,
      timeout: 65_000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { access_token: this.apiKey } : {}),
      },
      validateStatus: () => true,
    };
  }

  private buildHeaders(idempotencyKey?: string) {
    const h: Record<string, string> = {};
    if (this.apiKey) h['access_token'] = this.apiKey;
    if (idempotencyKey) {
      h['Idempotency-Key'] = idempotencyKey;
      h['X-Idempotency-Key'] = idempotencyKey;
    }
    return h;
  }

  private normalizeError(where: string, err: any): never {
    const payload = err?.response?.data ?? err?.data ?? err;
    const desc =
      payload?.errors?.[0]?.description ||
      payload?.message ||
      err?.message ||
      'Asaas error';
    const snippet = (() => {
      try { return JSON.stringify(payload).slice(0, 2000); } catch { return String(payload).slice(0, 2000); }
    })();
    this.logger.error(`${where}: ${desc}${snippet ? `\n${snippet}` : ''}`);
    throw new InternalServerErrorException(`Asaas ${where} failed: ${desc}`);
  }

  async ensureCustomer(payload: Record<string, any>): Promise<string> {
    if (!this.apiKey) throw new InternalServerErrorException('Asaas API key not configured');

    const headers = this.buildHeaders();

    const create$ = this.http.post<{ id: string }>(
      `/customers`,
      {
        name: payload.name || payload.nome,
        cpfCnpj: payload.cpfCnpj || payload.cpf,
        email: payload.email,
        mobilePhone: payload.mobilePhone || payload.phone || payload.telefone,
        phone: payload.phone || payload.telefone,
        postalCode: payload.postalCode || payload.cep,
        address: payload.address || payload.endereco,
        addressNumber: payload.addressNumber || payload.numero,
        addressComplement: payload.complement || payload.complemento,
        province: payload.province || payload.bairro,
        city: payload.city || payload.cidade,
        state: payload.state || payload.estado,
      },
      { ...this.axiosCfg, headers: { ...this.axiosCfg.headers, ...headers } },
    ).pipe(timeout(20_000));

    const created = await firstValueFrom(create$).catch((e) => ({ status: 0, data: e }));
    if (created?.status && created.status >= 200 && created.status < 300 && created.data?.id) {
      return created.data.id;
    }

    const cpf = payload.cpfCnpj || payload.cpf;
    if (cpf) {
      const byCpf$ = this.http.get<{ data: AsaasCustomer[] }>(
        `/customers?cpfCnpj=${encodeURIComponent(cpf)}`,
        { ...this.axiosCfg, headers: { ...this.axiosCfg.headers, ...headers } },
      ).pipe(timeout(10_000));
      const found = await firstValueFrom(byCpf$).catch(() => ({ data: { data: [] } }));
      const idCpf = found?.data?.data?.[0]?.id;
      if (idCpf) return idCpf;
    }

    const email = payload.email;
    if (email) {
      const byEmail$ = this.http.get<{ data: AsaasCustomer[] }>(
        `/customers?email=${encodeURIComponent(email)}`,
        { ...this.axiosCfg, headers: { ...this.axiosCfg.headers, ...headers } },
      ).pipe(timeout(10_000));
      const found = await firstValueFrom(byEmail$).catch(() => null);
      const idEmail = found?.data?.data?.[0]?.id;
      if (idEmail) return idEmail;
    }

    return this.normalizeError('ensureCustomer', created);
  }

  async createPayment(input: {
    payload: AsaasCreatePaymentPayload;
    idempotencyKey?: string;
  }): Promise<AsaasPaymentResponse> {
    if (!this.apiKey) throw new InternalServerErrorException('Asaas API key not configured');
    const headers = this.buildHeaders(input.idempotencyKey);

    const req$ = this.http.post<AsaasPaymentResponse>(
      `/payments`,
      input.payload,
      { ...this.axiosCfg, headers: { ...this.axiosCfg.headers, ...headers } },
    ).pipe(timeout(65_000));

    const res = await firstValueFrom(req$).catch((e) => this.normalizeError('createPayment', e));
    if (res.status >= 200 && res.status < 300) return res.data;
    return this.normalizeError('createPayment', res);
  }

  async getIdentificationField(paymentId: string): Promise<IdentificationFieldResponse | null> {
    const headers = this.buildHeaders();

    const req$ = this.http.get<IdentificationFieldResponse>(
      `/payments/${encodeURIComponent(paymentId)}/identificationField`,
      { ...this.axiosCfg, headers: { ...this.axiosCfg.headers, ...headers } },
    ).pipe(timeout(15_000));

    const res = await firstValueFrom(req$).catch((e) => {
      this.logger.warn(`getIdentificationField failed: ${paymentId} - will retry later`);
      return null as any;
    });

    if (!res) return null;
    if (res.status >= 200 && res.status < 300) return res.data ?? null;
    return null;
  }

  async tokenizeCard(payload: {
    customer: string;
    creditCard: Required<AsaasCreatePaymentPayload['creditCard']>;
    creditCardHolderInfo: Required<AsaasCreatePaymentPayload['creditCardHolderInfo']>;
    remoteIp?: string;
    idempotencyKey?: string;
  }): Promise<{ creditCardToken: string; creditCardBrand?: string; creditCardNumber?: string }> {
    const headers = this.buildHeaders(payload.idempotencyKey);

    const req$ = this.http.post(
      `/creditCard/tokenize`,
      {
        customer: payload.customer,
        creditCard: payload.creditCard,
        creditCardHolderInfo: payload.creditCardHolderInfo,
        remoteIp: payload.remoteIp,
      },
      { ...this.axiosCfg, headers: { ...this.axiosCfg.headers, ...headers } },
    ).pipe(timeout(40_000));

    const res = await firstValueFrom(req$).catch((e) => this.normalizeError('tokenizeCard', e));
    if (res.status >= 200 && res.status < 300) return res.data;
    return this.normalizeError('tokenizeCard', res);
  }
}