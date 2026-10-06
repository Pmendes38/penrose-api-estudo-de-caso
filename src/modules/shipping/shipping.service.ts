import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';
import { ShippingQuote } from './types/shipping.types';
import { MelhorEnvioProvider } from './providers/melhor-envio.provider';

type AccessToken = string | undefined;

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly originPostalCode: string;
  private readonly freeShippingThresholdBRL: number;

  private servicesCache: { at: number; data: any[] } | null = null;
  private servicesTtlMs = 5 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly melhorEnvio: MelhorEnvioProvider,
  ) {
    this.originPostalCode = this.onlyDigits(this.config.get<string>('ORIGIN_POSTAL_CODE') || '72850180');
    this.freeShippingThresholdBRL = Number(this.config.get<string>('FREE_SHIPPING_THRESHOLD_BRL') ?? 400);
  }

  private onlyDigits(v: string) { return String(v || '').replace(/\D/g, ''); }

  normalizePostalCode(cep: string) {
    const digits = this.onlyDigits(cep);
    if (digits.length !== 8) throw new BadRequestException('postalCode must have 8 digits');
    return digits;
  }

  private computeDimensionalWeightKg({ lengthCm, widthCm, heightCm }: { lengthCm: number; widthCm: number; heightCm: number; }) {
    const cubic = lengthCm * widthCm * heightCm;
    return cubic / 6000;
  }

  private pickBestOption(quotes: ShippingQuote[], preferCheapest?: boolean) {
    if (!quotes.length) return null;
    const sorted = [...quotes].sort((a, b) => {
      if (preferCheapest) return a.priceBRL - b.priceBRL || a.deliveryDays - b.deliveryDays;
      return a.deliveryDays - b.deliveryDays || a.priceBRL - b.priceBRL;
    });
    return sorted[0];
  }

  private withEtaDate(q: ShippingQuote): ShippingQuote {
    const days = Math.max(1, q.deliveryDays);
    const eta = new Date();
    let added = 0;
    while (added < days) {
      eta.setDate(eta.getDate() + 1);
      const day = eta.getDay();
      if (day !== 0 && day !== 6) added++;
    }
    return { ...q, etaDate: eta.toISOString() };
  }

  private applyFreeShipping(quotes: ShippingQuote[], cartTotal?: number) {
    if (cartTotal && cartTotal >= this.freeShippingThresholdBRL) {
      return quotes.map(q => ({ ...q, priceBRL: 0, isFree: true }));
    }
    return quotes;
  }

  async validatePostalCode(postalCode: string) {
    const normalized = this.normalizePostalCode(postalCode);
    return { valid: true, normalized };
  }

  private async getAccessToken(): Promise<AccessToken> {
    return undefined;
  }

  async listAvailableServices() {
    const now = Date.now();
    if (this.servicesCache && now - this.servicesCache.at < this.servicesTtlMs) {
      return this.servicesCache.data;
    }
    const token = await this.getAccessToken();
    const data = await this.melhorEnvio.listServices(token);
    this.servicesCache = { at: now, data };
    return data;
  }

  async quote(dto: CalculateShippingDto) {
    const toDigits = this.normalizePostalCode(dto.destination.postalCode);

    const pkg = dto.packages[0];
    const weightReal = Math.max(pkg.weightKg, this.computeDimensionalWeightKg(pkg));
    const insurance = Math.max(0, Number(pkg.declaredValue ?? 0));

    const payload = {
      from: { postal_code: this.originPostalCode },
      to:   { postal_code: toDigits },
      package: {
        height: pkg.heightCm,
        width:  pkg.widthCm,
        length: pkg.lengthCm,
        weight: Number(weightReal.toFixed(3)),
      },
      options: {
        insurance_value: insurance,
      },
    } as const;

    try {
      const token = await this.getAccessToken();
      const raw = await this.melhorEnvio.calculateByPackage(payload, token);

      const quotes: ShippingQuote[] = (raw || []).map((r: any): ShippingQuote => {
        const price = Number(r.custom_price ?? r.price ?? 0);
        const deliveryDays = Number(
          r.custom_delivery_time ??
          r.delivery_time ??
          r.delivery_range?.min ??
          r.delivery_time?.min ??
          5,
        );
        const serviceName = r.name || r.service || r?.service_name || 'Frete';
        const companyName = r.company?.name || r.carrier?.name || 'Transportadora';
        const id = String(r.id ?? r.service_id ?? r.company?.id ?? `svc_${Date.now()}`);

        return {
          id,
          name: serviceName,
          company: { name: companyName, code: String(r.company?.id ?? '') },
          priceBRL: price,
          deliveryDays,
          description: `${deliveryDays} dia(s) útil(eis)`,
        };
      });

      const withPolicy = this.applyFreeShipping(quotes, dto.cartTotal).map(q => this.withEtaDate(q));
      const best = this.pickBestOption(withPolicy, dto.preferCheapest);

      return { source: 'melhor-envio', quotes: withPolicy, bestQuote: best };
    } catch (e) {
      this.logger.warn(`Melhor Envio: cálculo falhou, usando fallback. ${ (e as Error).message }`);
    }

    const fallback = this.fallbackQuotes(toDigits, pkg.weightKg, dto.cartTotal);
    const best = this.pickBestOption(fallback, dto.preferCheapest);
    return { source: 'fallback', quotes: fallback, bestQuote: best };
  }

  private fallbackQuotes(normalizedToCep: string, weightKg: number, cartTotal?: number): ShippingQuote[] {
    const digits = Number(normalizedToCep);
    let basePrice = 15.9;
    let deliveryDays = 7;

    const ranges: Array<[number, number, number, number]> = [
      [10_000_00, 19_999_999, 12.9, 3],
      [20_000_000, 28_999_999, 14.9, 4],
      [30_000_000, 39_999_999, 16.9, 5],
      [40_000_000, 48_999_999, 19.9, 6],
      [50_000_000, 56_999_999, 22.9, 7],
      [60_000_000, 63_999_999, 24.9, 8],
      [70_000_000, 72_999_999, 18.9, 5],
      [80_000_000, 87_999_999, 15.9, 4],
      [90_000_000, 99_999_999, 17.9, 5],
    ];
    for (const [a, b, price, days] of ranges) {
      if (digits >= a && digits <= b) { basePrice = price; deliveryDays = days; break; }
    }

    const weightMult = Math.max(1, weightKg / 1);
    const finalBase = basePrice * weightMult;

    let quotes: ShippingQuote[] = [
      { id: 'pac',   name: 'PAC',   company: { name: 'Correios' }, priceBRL: Number((finalBase).toFixed(2)),    deliveryDays: deliveryDays + 2, description: `${deliveryDays + 2} dias úteis` },
      { id: 'sedex', name: 'SEDEX', company: { name: 'Correios' }, priceBRL: Number((finalBase * 1.5).toFixed(2)), deliveryDays: Math.max(1, deliveryDays - 2), description: `${Math.max(1, deliveryDays - 2)} dias úteis` },
    ];

    if (digits >= 10_000_00 && digits <= 28_999_999) {
      quotes.unshift({ id: 'expresso', name: 'Entrega Expressa', company: { name: 'Transportadora Expressa' }, priceBRL: Number((finalBase * 2).toFixed(2)), deliveryDays: 1, description: '1 dia útil' });
    }

    quotes = this.applyFreeShipping(quotes, cartTotal).map(this.withEtaDate.bind(this));
    return quotes;
  }

  async trackShipment(trackingOrOrderId: string) {
    const q = trackingOrOrderId?.trim();
    if (!q) throw new BadRequestException('tracking or order id is required');

    const token = await this.getAccessToken();

    const looksLikeOrderId = q.includes('-') && q.length > 20;
    let orderId = looksLikeOrderId ? q : undefined;

    if (!orderId) {
      const search = await this.melhorEnvio.ordersSearch(q, undefined, token);
      const found = Array.isArray(search) ? search[0] : search?.data?.[0];
      orderId = found?.id || found?.order_id;
      if (!orderId) {
        return { input: q, status: 'NOT_FOUND', history: [] };
      }
    }

    const trackingRes = await this.melhorEnvio.tracking([orderId], token);
    return { orderId, data: trackingRes };
  }
}
