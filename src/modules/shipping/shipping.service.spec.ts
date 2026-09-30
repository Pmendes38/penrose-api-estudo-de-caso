import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ConfigService } from '@nestjs/config';
import { MelhorEnvioProvider } from './providers/melhor-envio.provider';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';

describe('ShippingService', () => {
    let service: ShippingService;

    // Mocks
    const config = {
        get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    const melhorEnvio = {
        calculateQuotes: jest.fn(),
    } as unknown as jest.Mocked<MelhorEnvioProvider>;

    beforeEach(async () => {
        jest.clearAllMocks();
        const mod = await Test.createTestingModule({
            providers: [
                ShippingService,
                { provide: ConfigService, useValue: config },
                { provide: MelhorEnvioProvider, useValue: melhorEnvio },
            ],
        }).compile();

        service = mod.get(ShippingService);
    });

    // ------------ normalizePostalCode

    it('normalizePostalCode: should normalize a postal code with special characters', () => {
        const result = service.normalizePostalCode('01.658-456');
        
        expect(result).toBe('01658-456');
    });

    it('normalizePostalCode: should normalize a postal code with only digits', () => {
        const result = service.normalizePostalCode('12345678');
        
        expect(result).toBe('12345-678');
    });

    it('normalizePostalCode: should throw an error for a postal code with less than 8 digits', () => {
        expect(() => service.normalizePostalCode('54321')).toThrow(BadRequestException);
    });

    it('normalizePostalCode: should throw an error for a postal code with more than 8 digits', () => {
        expect(() => service.normalizePostalCode('987654321')).toThrow(BadRequestException);
    });

    // ------------ computeDimensionalWeightKg

    it('computeDimensionalWeightKg: calculates the dimensional weight correctly', () => {
        const result = (service as any).computeDimensionalWeightKg({ lengthCm: 20, widthCm: 15, heightCm: 10 });
        
        expect(result).toBeCloseTo(0.5); // (20*15*10)/6000 = 0.5
    });

    // ------------ pickBestOption

    it('pickBestOption: selects the cheapest option when preferCheapest is true', () => {
        const quotes = [
            { priceBRL: 50, deliveryDays: 5 },
            { priceBRL: 30, deliveryDays: 7 },
            { priceBRL: 30, deliveryDays: 4 },
            { priceBRL: 40, deliveryDays: 4 },
        ];
        const result = (service as any).pickBestOption(quotes, true);
        
        expect(result).toEqual({ priceBRL: 30, deliveryDays: 4 });
    });

    it('pickBestOption: selects the fastest option when preferCheapest is false', () => {
        const quotes = [
            { priceBRL: 50, deliveryDays: 5 },
            { priceBRL: 30, deliveryDays: 7 },
            { priceBRL: 30, deliveryDays: 4 },
            { priceBRL: 40, deliveryDays: 4 },
        ];
        const result = (service as any).pickBestOption(quotes, false);
        
        expect(result).toEqual({ priceBRL: 30, deliveryDays: 4 });
    });

    it('pickBestOption: returns null if no quotes are provided', () => {
        const result = (service as any).pickBestOption([], true);
        
        expect(result).toBeNull();
    });

    it('pickBestOption: returns the only quote if one is provided', () => {
        const quote = { priceBRL: 50, deliveryDays: 5 };
        const result = (service as any).pickBestOption([quote], true);
        
        expect(result).toEqual(quote);
    });

    // ------------ withEtaDate

    it('withEtaDate: transforms deliveryDays <= 0 into 1', () => {
        jest.useFakeTimers().setSystemTime(new Date('2025-09-15T10:00:00Z'));
        const quote = { priceBRL: 50, deliveryDays: 0 };
        const result = (service as any).withEtaDate(quote);
        
        expect(result).toHaveProperty('etaDate');
        expect(result.etaDate).toBe('2025-09-16T10:00:00.000Z');
    });

    it('withEtaDate: skips weekends when calculating etaDate', () => {
        jest.useFakeTimers().setSystemTime(new Date('2025-09-12T10:00:00Z'));
        const quote = { priceBRL: 50, deliveryDays: 3 };
        const result = (service as any).withEtaDate(quote);

        expect(result).toHaveProperty('etaDate');
        expect(result.etaDate).toBe('2025-09-17T10:00:00.000Z'); 
    });

    it('witchEtaDate: should start counting from the first business day', () => {
        jest.useFakeTimers().setSystemTime(new Date('2025-09-20T10:00:00Z'));
        const quote = { priceBRL: 50, deliveryDays: 1 };
        const result = (service as any).withEtaDate(quote);

        expect(result).toHaveProperty('etaDate');
        expect(result.etaDate).toBe('2025-09-22T10:00:00.000Z'); 
    });

    it('withEtaDate: returns a new object with all origin properties', () => {
        const result = (service as any).withEtaDate({ priceBRL: 50, deliveryDays: 5, extra: 'data' });

        expect(result).toHaveProperty('priceBRL', 50);
        expect(result).toHaveProperty('deliveryDays', 5);
        expect(result).toHaveProperty('extra', 'data');
        expect(result).toHaveProperty('etaDate');
    });

    it('withEtaDate: adds an etaDate to the quote', () => {
        jest.useFakeTimers().setSystemTime(new Date('2025-09-15T10:00:00Z'));
        const quote = { priceBRL: 50, deliveryDays: 5 };
        const result = (service as any).withEtaDate(quote); 

        expect(result).toHaveProperty('etaDate');
        expect(result.etaDate).toBe('2025-09-22T10:00:00.000Z'); 
    });

    // ------------ applyFreeShipping

    it('applyFreeShipping: applies free shipping when cart total exceeds threshold', () => {
        config.get.mockReturnValueOnce('400');
        const quotes = [
            { priceBRL: 50, deliveryDays: 5 },
            { priceBRL: 100, deliveryDays: 7 },  
        ];
        const result = (service as any).applyFreeShipping(quotes, 475);
        expect(result[0].priceBRL).toBe(0);
        expect(result[0].isFree).toBe(true);
        expect(result[1].priceBRL).toBe(0);
        expect(result[1].isFree).toBe(true);
    });

    it('applyFreeShipping: does not apply free shipping when cart total is below threshold', () => {
        config.get.mockReturnValueOnce(400);
        const quotes = [
            { priceBRL: 50, deliveryDays: 5 },
            { priceBRL: 30, deliveryDays: 7 },  
        ];
        const result = (service as any).applyFreeShipping(quotes, 70);
        expect(result[0].priceBRL).toBe(50);
        expect(result[0].isFree).toBeUndefined();
        expect(result[1].priceBRL).toBe(30);
        expect(result[1].isFree).toBeUndefined();
    });

    it('applyFreeShipping: does not apply free shipping when cart total is not provided', () => {
        config.get.mockReturnValueOnce(400);
        const quotes = [
            { priceBRL: 50, deliveryDays: 5 },
            { priceBRL: 30, deliveryDays: 7 },  
        ];
        const result = (service as any).applyFreeShipping(quotes, undefined);
        expect(result[0].priceBRL).toBe(50);
        expect(result[0].isFree).toBeUndefined();
        expect(result[1].priceBRL).toBe(30);
        expect(result[1].isFree).toBeUndefined();
    });

    // ------------ validatePostalCode  

    it('validatePostalCode: returns normalized postal code for valid input', async () => {
        const result = await service.validatePostalCode('66771412');
        expect(result).toEqual({ valid: true, normalized: '66771-412' });
    });

    it('validatePostalCode: throws BadRequestException for invalid input', async () => {
        await expect(service.validatePostalCode('666')).rejects.toThrow(BadRequestException);
    });

    // ------------ quote

    it('quote: returns a quote from Melhor Envio when the API is successful', async () => {
        config.get.mockImplementation((key: string) => {
            if (key === 'ORIGIN_POSTAL_CODE') return '01310-100';
            return undefined;
        });

        melhorEnvio.calculateQuotes.mockResolvedValueOnce([
            { price: 90, delivery_time: 6, company: { name: 'Empresa Entregamo Bem' }, service: 'Serviço É nois'},
        ]);

        const mockDto: CalculateShippingDto = {
            destination: { postalCode: '00000-666' },
            packages: [{ lengthCm: 10, widthCm: 5, heightCm: 6, weightKg: 1 }],
        };

        const result = await service.quote(mockDto);
        expect(melhorEnvio.calculateQuotes).toHaveBeenCalled();
        expect(result.source).toBe('melhor-envio');
        expect(result.quotes).toHaveLength(1);
    });

    it('quote: returns a fallback quote when the API fails', async () => {
        melhorEnvio.calculateQuotes.mockRejectedValue(new Error('API offline'));

        const mockDto: CalculateShippingDto = {
            destination: { postalCode: '00000-666' },
            packages: [{ lengthCm: 10, widthCm: 5, heightCm: 6, weightKg: 1 }],
        };

        const result = await service.quote(mockDto);
        expect(melhorEnvio.calculateQuotes).toHaveBeenCalled();
        expect(result.source).toBe('fallback');
        expect(result.quotes).toHaveLength(2); //PAC e SEDEX fallback
    });

    // ------------ fallbackQuotes

    it('fallbackQuotes: provides fallback quotes based on weight', () => {
        const result = (service as any).fallbackQuotes('00000-666', 2, 150);
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('priceBRL');
        expect(result[1]).toHaveProperty('priceBRL');
    });

    // ------------ trackShipment

    it('trackShipment: throws an error as tracking is not provided', async () => {
        await expect(service.trackShipment('')).rejects.toThrow('trackingCode is required');
    });
});