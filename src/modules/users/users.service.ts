import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { UsersRepository } from './repo/users.repository';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PasswordService } from '../../shared/password/password.service';
import { AuthService } from '../auth/auth.service';

function sanitize(u: any) {
  if (!u) return null;
  const { _id, __v, passwordHash, ...rest } = u;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly pwd: PasswordService,
    private readonly auth: AuthService,
  ) {}

  async listAdminCustomers() {
    // ponytail: consulta completa para segmentação local; paginar no banco quando a base crescer.
    const [profiles, orderStats] = await Promise.all([this.repo.listAdminProfiles(), this.repo.listAdminOrderStats()]);
    const byCustomer = new Map(orderStats.map(stats => [stats._id, stats]));
    return profiles.map(profile => {
      const stats = byCustomer.get(profile.id);
      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? null,
        createdAt: profile.createdAt ?? null,
        totalOrders: stats?.totalOrders ?? 0,
        paidOrders: stats?.paidOrders ?? 0,
        totalSpent: stats?.totalSpent ?? 0,
        lastOrder: stats?.lastOrder ?? null,
      };
    });
  }

  /* ------------ Perfil básico ------------- */
  async getMe(userId: string) {
    const u = await this.repo.findById(userId);
    if (!u) throw new NotFoundException('User not found');
    return sanitize(u);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    try {
      const updated = await this.repo.updateById(userId, {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      });
      if (!updated) throw new NotFoundException('User not found');
      return { message: 'Profile updated', user: sanitize(updated) };
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('E-mail/telefone já em uso');
      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  /* ------------ Endereços ------------- */
  async listAddresses(userId: string) {
    const u = await this.repo.findById(userId);
    if (!u) throw new NotFoundException('User not found');
    return (u.addresses ?? []).sort((a: any, b: any) => Number(b.isDefault) - Number(a.isDefault));
  }

  async addAddress(userId: string, dto: CreateAddressDto) {
    const address = {
      id: crypto.randomUUID(),
      label: dto.label,
      personName: dto.personName,
      phone: dto.phone,
      zipCode: dto.zipCode,
      street: dto.street,
      number: dto.number,
      complement: dto.complement,
      neighborhood: dto.neighborhood,
      city: dto.city,
      state: dto.state,
      country: dto.country ?? 'BR',
      isDefault: !!dto.isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let updated = await this.repo.pushAddress(userId, address);
    if (!updated) throw new NotFoundException('User not found');

    if (address.isDefault) {
      updated = await this.repo.setDefaultAddress(userId, address.id);
    }
    return { message: 'Address added', address, user: sanitize(updated) };
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const set: Record<string, any> = { ...dto };
    const updated = await this.repo.updateAddressById(userId, addressId, set);
    if (!updated) throw new NotFoundException('Address not found');

    if (dto.isDefault === true) {
      await this.repo.setDefaultAddress(userId, addressId);
    }
    return { message: 'Address updated', user: sanitize(updated) };
  }

  async removeAddress(userId: string, addressId: string) {
    const updated = await this.repo.pullAddress(userId, addressId);
    if (!updated) throw new NotFoundException('Address not found');
    return { message: 'Address removed', user: sanitize(updated) };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const updated = await this.repo.setDefaultAddress(userId, addressId);
    if (!updated) throw new NotFoundException('Address not found');
    return { message: 'Default address set', user: sanitize(updated) };
  }

  /* ------------ Preferências ------------- */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const updated = await this.repo.updateById(userId, {
      ...(dto.locale !== undefined && { 'preferences.locale': dto.locale } as any),
      ...(dto.theme !== undefined && { 'preferences.theme': dto.theme } as any),
      ...(dto.newsletterOptIn !== undefined && { 'preferences.newsletterOptIn': !!dto.newsletterOptIn } as any),
    } as any);
    if (!updated) throw new NotFoundException('User not found');
    return { message: 'Preferences updated', user: sanitize(updated) };
  }

  /* ------------ Avatar ------------- */
  async updateAvatar(userId: string, fileUrl: string) {
    if (!fileUrl) throw new BadRequestException('Invalid avatar');
    const updated = await this.repo.updateById(userId, { avatarUrl: fileUrl });
    if (!updated) throw new NotFoundException('User not found');
    return { message: 'Avatar updated', user: sanitize(updated) };
  }

  /* ------------ Troca de senha ------------- */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const u = await this.repo.findById(userId);
    if (!u) throw new NotFoundException('User not found');

    const ok = await this.pwd.verify(u.passwordHash, currentPassword);
    if (!ok) throw new ForbiddenException('Senha atual inválida');

    const newHash = await this.pwd.validateAndHash(newPassword);
    const updated = await this.repo.updateById(userId, { passwordHash: newHash } as any);
    if (!updated) throw new InternalServerErrorException('Failed to update password');

    await this.auth.revokeAll(userId);

    return { message: 'Password changed successfully' };
  }

  /* ------------ Sessões (via AuthService) ------------- */
  listSessions(userId: string) {
    return this.auth.listSessions(userId);
  }
  async revokeSession(userId: string, sessionId: string) {
    await this.auth.revokeSession(userId, sessionId);
    return { message: 'Session revoked' };
  }
  async revokeAllOtherSessions(userId: string, _except?: string) {
    await this.auth.revokeAll(userId);
    return { message: 'All sessions revoked' };
  }
}
