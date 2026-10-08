import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthRepository } from './repo/auth.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordService } from '../../shared/password/password.service';

jest.mock('argon2', () => ({
  __esModule: true,
  hash: jest.fn(async (value: string) => `hashed:${value}`),
  verify: jest.fn(async (hash: string, value: string) => hash === `hashed:${value}`),
}));

describe('AuthService', () => {
  let service: AuthService;

  const repo = {
    findAdminByEmail: jest.fn(),
    findCustomerByEmail: jest.fn(),
    existsCustomerByEmail: jest.fn(),
    insertCustomer: jest.fn(),
    createSession: jest.fn(),
    findSession: jest.fn(),
    revokeSession: jest.fn(),
    touchSession: jest.fn(),
    findPrincipalById: jest.fn().mockResolvedValue({ name: 'User', email: 'contato@example.com', role: 'customer' }),
  } as unknown as jest.Mocked<AuthRepository>;

  const jwt = {
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1', jti: 'jti-1' }),
    signAsync: jest.fn(async (_payload: any, opts?: any) => {
      const aud = opts?.audience ?? '';
      return aud.includes(':refresh') ? 'refresh-token' : 'access-token';
    }),
  } as unknown as jest.Mocked<JwtService>;

  const config = {
    get: jest.fn((key: string, def?: any) => {
      const map: Record<string, any> = {
        JWT_ISSUER: 'auth-service',
        JWT_AUDIENCE: 'api',
        JWT_ACCESS_TTL: '8h',
        JWT_REFRESH_TTL: '30d',
        JWT_REFRESH_ENABLED: true,
        HASH_PEPPER: 'pep',
        HASH_MEMORY_COST: 19456,
        HASH_TIME_COST: 2,
        HASH_PARALLELISM: 1,
      };
      return key in map ? map[key] : def;
    }),
  } as unknown as jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repo },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: PasswordService, useValue: { verify: (hash: string, value: string) => argon2.verify(hash, value + 'pep'), verifySecret: (hash: string, value: string) => argon2.verify(hash, value + 'pep'), hashSecret: (value: string) => argon2.hash(value + 'pep'), validateAndHash: (value: string) => argon2.hash(value + 'pep') } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('adminLogin', () => {
    it('logs in admin successfully', async () => {
      repo.findAdminByEmail = jest.fn().mockResolvedValue({
        id: 'a1', name: 'Admin', email: 'contato@example.com', passwordHash: 'hashed:123pep',
      });

      const res = await service.adminLogin('contato@example.com', '123');
      expect(res.role).toBe('admin');
      expect(res.tokens.accessToken).toBe('access-token');
      expect(res.tokens.refreshToken).toBe('refresh-token');
      expect(repo.createSession).toHaveBeenCalled();
    });

    it('fails when email or password missing', async () => {
      await expect(service.adminLogin('', 'x')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.adminLogin('contato@example.com', '')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fails with invalid credentials', async () => {
      repo.findAdminByEmail = jest.fn().mockResolvedValue(null);
      await expect(service.adminLogin('contato@example.com', '123')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('fails with wrong password', async () => {
      repo.findAdminByEmail = jest.fn().mockResolvedValue({
        id: 'a1', name: 'Admin', email: 'contato@example.com', passwordHash: 'hashed:otherpep',
      });
      await expect(service.adminLogin('contato@example.com', '123')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('login (mixed)', () => {
    it('admin path', async () => {
      repo.findAdminByEmail = jest.fn().mockResolvedValue({
        id: 'a1', name: 'Admin', email: 'contato@example.com', passwordHash: 'hashed:123pep',
      });
      const res = await service.login('contato@example.com', '123');
      expect(res.role).toBe('admin');
    });

    it('customer path', async () => {
      repo.findAdminByEmail = jest.fn().mockResolvedValue(null);
      repo.findCustomerByEmail = jest.fn().mockResolvedValue({
        id: 'c1', name: 'User', email: 'contato@example.com', passwordHash: 'hashed:123pep',
      });
      const res = await service.login('contato@example.com', '123');
      expect(res.role).toBe('customer');
      expect(res.tokens.accessToken).toBe('access-token');
      expect(res.tokens.refreshToken).toBe('refresh-token');
    });

    it('invalid credentials (no account)', async () => {
      repo.findAdminByEmail = jest.fn().mockResolvedValue(null);
      repo.findCustomerByEmail = jest.fn().mockResolvedValue(null);
      await expect(service.login('contato@example.com', '123')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('invalid credentials (wrong password)', async () => {
      repo.findAdminByEmail = jest.fn().mockResolvedValue(null);
      repo.findCustomerByEmail = jest.fn().mockResolvedValue({
        id: 'c1', name: 'User', email: 'contato@example.com', passwordHash: 'hashed:otherpep',
      });
      await expect(service.login('contato@example.com', '123')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('missing email/password', async () => {
      await expect(service.login('', '123')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.login('contato@example.com', '')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('register', () => {
    it('creates new customer', async () => {
      repo.existsCustomerByEmail = jest.fn().mockResolvedValue(false);
      repo.insertCustomer = jest.fn().mockResolvedValue({ id: 'c1', name: 'Jane', email: 'contato@example.com' });

      const out = await service.register({ name: 'Jane', email: 'contato@example.com', password: '12345678' } as any);
      expect(out.success).toBe(true);
      expect(repo.insertCustomer).toHaveBeenCalled();
    });

    it('rejects duplicate email', async () => {
      repo.existsCustomerByEmail = jest.fn().mockResolvedValue(true);
      await expect(
        service.register({ name: 'Jane', email: 'contato@example.com', password: '12345678' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('requires name/email/password', async () => {
      await expect(service.register({ name: '', email: '', password: '' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('refresh', () => {
    it('rotates refresh token and returns new access token', async () => {
      repo.findSession = jest.fn().mockResolvedValue({ hashedToken: 'hashed:refresh-tokenpep' });
      repo.revokeSession = jest.fn().mockResolvedValue({});

      const res = await service.refreshByToken('refresh-token');
      expect(res.accessToken).toBe('access-token');
      expect(repo.revokeSession).toHaveBeenCalledWith('u1', 'jti-1');
      expect(repo.createSession).toHaveBeenCalled();
    });

    it('fails when refresh disabled', async () => {
      (config.get as any) = jest.fn((k: string, d?: any) => (k === 'JWT_REFRESH_ENABLED' ? false : d));
      service = new AuthService(config, jwt, repo, {} as any);
      await expect(service.refreshByToken('rt')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('fails with invalid refresh record', async () => {
      (config.get as any) = jest.fn((k: string, d?: any) => {
        const map: any = { JWT_REFRESH_ENABLED: true };
        return k in map ? map[k] : d;
      });
      repo.findSession = jest.fn().mockResolvedValue(null);
      await expect(service.refreshByToken('rt')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('fails with wrong token', async () => {
      repo.findSession = jest.fn().mockResolvedValue({ hashedToken: 'hashed:OTHERpep' });
      await expect(service.refreshByToken('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
