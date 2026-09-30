import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private readonly pepper: string;

  private readonly minLength: number;
  private readonly requireUpper: boolean;
  private readonly requireLower: boolean;
  private readonly requireNumber: boolean;
  private readonly requireSpecial: boolean;
  private readonly forbidWhitespace: boolean;

  private readonly argonOpts: argon2.Options & { raw?: false };

  constructor(private readonly config: ConfigService) {
    this.pepper = this.config.get<string>('HASH_PEPPER', '') ?? '';

    this.minLength = Number(this.config.get('PASSWORD_MIN_LENGTH', 8));
    this.requireUpper = this.readBool('PASSWORD_REQUIRE_UPPER', true);
    this.requireLower = this.readBool('PASSWORD_REQUIRE_LOWER', true);
    this.requireNumber = this.readBool('PASSWORD_REQUIRE_NUMBER', true);
    this.requireSpecial = this.readBool('PASSWORD_REQUIRE_SPECIAL', true);
    this.forbidWhitespace = this.readBool('PASSWORD_FORBID_WHITESPACE', true);

    const memoryCost = Number(this.config.get('HASH_MEMORY_COST', 19456)); // ~19MB
    const timeCost = Number(this.config.get('HASH_TIME_COST', 2));
    const parallelism = Number(this.config.get('HASH_PARALLELISM', 1));
    const typeRaw = String(this.config.get('HASH_TYPE', 'argon2id')).toLowerCase();

    this.argonOpts = {
      type: typeRaw === 'argon2i' ? argon2.argon2i
           : typeRaw === 'argon2d' ? argon2.argon2d
           : argon2.argon2id, // padrão recomendado
      memoryCost,
      timeCost,
      parallelism,
    };
  }

  private readBool(key: string, fallback: boolean): boolean {
    const v = this.config.get<string | boolean>(key, fallback);
    if (typeof v === 'boolean') return v;
    return /^(1|true|yes)$/i.test(String(v ?? ''));
  }

  private withPepper(plain: string) {
    return this.pepper ? `${plain}${this.pepper}` : plain;
  }

  checkStrength(plain: string): { valid: boolean; errors: string[] } {
    const s = String(plain ?? '');
    const errors: string[] = [];

    if (s.length < this.minLength) errors.push(`Mínimo de ${this.minLength} caracteres`);
    if (this.requireUpper && !/[A-Z]/.test(s)) errors.push('Pelo menos 1 letra maiúscula');
    if (this.requireLower && !/[a-z]/.test(s)) errors.push('Pelo menos 1 letra minúscula');
    if (this.requireNumber && !/[0-9]/.test(s)) errors.push('Pelo menos 1 número');
    if (this.requireSpecial && !/[^\w\s]/.test(s)) errors.push('Pelo menos 1 caractere especial');
    if (this.forbidWhitespace && /\s/.test(s)) errors.push('Não use espaços em branco');

    return { valid: errors.length === 0, errors };
  }

  assertStrong(plain: string) {
    const res = this.checkStrength(plain);
    if (!res.valid) {
      throw new BadRequestException(`Senha fraca: ${res.errors.join('; ')}`);
    }
  }

  async hash(plain: string): Promise<string> {
    if (!plain || typeof plain !== 'string') {
      throw new BadRequestException('Senha inválida');
    }
    return argon2.hash(this.withPepper(plain), this.argonOpts);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    if (!hash || !plain) return false;
    try {
      return await argon2.verify(hash, this.withPepper(plain), this.argonOpts);
    } catch {
      return false;
    }
  }

  async validateAndHash(plain: string): Promise<string> {
    this.assertStrong(plain);
    return this.hash(plain);
  }

  async hashSecret(secret: string): Promise<string> {
    if (!secret) throw new BadRequestException('Valor inválido');
    return argon2.hash(this.withPepper(secret), this.argonOpts);
  }

  async verifySecret(hash: string, secret: string): Promise<boolean> {
    if (!hash || !secret) return false;
    try {
      return await argon2.verify(hash, this.withPepper(secret), this.argonOpts);
    } catch {
      return false;
    }
  }
}
