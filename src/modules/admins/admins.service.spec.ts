// src/modules/admins/admins.service.spec.ts
import { Test } from '@nestjs/testing';
import { AdminsService } from './admins.service';
import { AdminsRepository } from './repo/admins.repository';
import { ConfigService } from '@nestjs/config';

describe('AdminsService', () => {
  let service: AdminsService;

  // Mock compatível com o repository Mongoose
  const repoMock = {
    findPaged: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(async (doc: any) => ({ toJSON: () => doc })),
    updateById: jest.fn(),
    deleteById: jest.fn(),
  } as unknown as jest.Mocked<AdminsRepository>;

  const configMock = {
    get: jest.fn((k: string, d?: any) => {
      const map: Record<string, any> = {
        HASH_PEPPER: 'pep',
        HASH_MEMORY_COST: 19456,
        HASH_TIME_COST: 2,
        HASH_PARALLELISM: 1,
      };
      return k in map ? map[k] : d;
    }),
  } as unknown as ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminsService,
        { provide: AdminsRepository, useValue: repoMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = moduleRef.get(AdminsService);
  });

  it('creates an admin successfully', async () => {
    (repoMock.findByEmail as any) = jest.fn().mockResolvedValue(null);

    const out = await service.create({
      name: 'Admin',
      email: 'contato@example.com',
      password: '12345678',
    } as any);

    expect(out.email).toBe('contato@example.com');
    expect(repoMock.create).toHaveBeenCalled();
  });

  it('rejects duplicate email', async () => {
    (repoMock.findByEmail as any) = jest.fn().mockResolvedValue({ id: 'a1' });
    await expect(service.create({
      name: 'Admin',
      email: 'contato@example.com',
      password: '12345678',
    } as any)).rejects.toThrow('Email already registered');
  });

  it('deletes admin', async () => {
    (repoMock.deleteById as any) = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const res = await service.remove('a1');
    expect(res.message).toContain('deleted');
  });
});
