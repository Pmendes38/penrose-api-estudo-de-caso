import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { AdminEntity } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminsRepository } from './repo/admins.repository';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);
  private readonly pepper?: string;
  private readonly argonOptions: argon2.Options & { raw?: false };

  constructor(
    private readonly repo: AdminsRepository,
    private readonly config: ConfigService,
  ) {
    this.pepper = this.config.get<string>('HASH_PEPPER');
    this.argonOptions = {
      type: argon2.argon2id,
      memoryCost: Number(this.config.get('HASH_MEMORY_COST', 19_456)), // ~19MB
      timeCost: Number(this.config.get('HASH_TIME_COST', 2)),
      parallelism: Number(this.config.get('HASH_PARALLELISM', 1)),
    };
  }

  private nowISO() {
    return new Date().toISOString();
  }

  private async hashPassword(plain: string) {
    const toHash = this.pepper ? `${plain}${this.pepper}` : plain;
    return argon2.hash(toHash, this.argonOptions);
  }

  async list(page = 1, pageSize = 20) {
    return this.repo.findPaged(page, pageSize);
  }

  async get(id: string): Promise<AdminEntity> {
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundException('Admin not found');
    return AdminEntity.from(doc);
  }

  async create(dto: CreateAdminDto): Promise<AdminEntity> {
    const email = dto.email.trim().toLowerCase();

    if (!dto.name?.trim() || !email || !dto.password) {
      throw new BadRequestException('Name, email and password are required');
    }

    const exists = await this.repo.findByEmail(email, true);
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await this.hashPassword(dto.password);
    const now = this.nowISO();

    const doc = {
      id: crypto.randomUUID(),
      name: dto.name.trim(),
      email,
      role: 'admin' as const,
      passwordHash,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    try {
      const created = await this.repo.create(doc);
      return AdminEntity.from(created.toJSON());
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Email already registered');
      this.logger.error('Failed to create admin', e?.stack || e);
      throw new InternalServerErrorException('Failed to create admin');
    }
  }

  async update(id: string, dto: UpdateAdminDto): Promise<AdminEntity> {
    const current = await this.repo.findById(id, true);
    if (!current) throw new NotFoundException('Admin not found');

    const set: any = { updatedAt: new Date(this.nowISO()) };

    if (dto.name !== undefined) set.name = dto.name.trim();
    if (dto.email !== undefined) {
      const normalized = dto.email.trim().toLowerCase();
      set.email = normalized;
      if (normalized !== current.email) {
        const byEmail = await this.repo.findByEmail(normalized, true);
        if (byEmail && byEmail.id !== id) {
          throw new ConflictException('Email already registered');
        }
      }
    }
    if (dto.password !== undefined) {
      set.passwordHash = await this.hashPassword(dto.password);
    }

    try {
      const updated = await this.repo.updateById(id, set);
      if (!updated) throw new NotFoundException('Admin not found');
      return AdminEntity.from(updated);
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Email already registered');
      this.logger.error('Failed to update admin', e?.stack || e);
      throw new InternalServerErrorException('Failed to update admin');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const res = await this.repo.deleteById(id);
    if (!('deletedCount' in res) || res.deletedCount === 0) {
      throw new NotFoundException('Admin not found');
    }
    return { message: 'Admin deleted successfully' };
  }
}