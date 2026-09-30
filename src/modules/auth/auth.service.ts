import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AuthRepository } from './repo/auth.repository';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from '../../shared/password/password.service';

export type UserRole = 'admin' | 'customer';
export interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: UserRole;
  jti: string;
}
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}
export interface AuthResult {
  success: true;
  message: string;
  role: UserRole;
  name: string;
  redirect: string;
  tokens: AuthTokens;
}

type RequestMeta = { userAgent?: string; ip?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly issuer = this.config.get<string>('JWT_ISSUER', 'auth-service');
  private readonly audience = this.config.get<string>('JWT_AUDIENCE', 'api');
  private readonly accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '8h');
  private readonly refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
  private readonly enableRefresh = this.config.get<boolean>('JWT_REFRESH_ENABLED', true);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly repo: AuthRepository,
    private readonly pwd: PasswordService,
  ) {}

  private parseTimespanMs(span: string): number {
    const m = /^(\d+)([smhd])$/.exec(span);
    if (!m) return 0;
    const n = +m[1];
    const map = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 } as const;
    return n * map[m[2] as keyof typeof map];
  }

  private async signAccessToken(payload: JwtPayload) {
    return this.jwt.signAsync(payload, {
      expiresIn: this.accessTtl,
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  private async signRefreshToken(userId: string, jti: string) {
    if (!this.enableRefresh) return undefined;
    return this.jwt.signAsync(
      { sub: userId, jti },
      {
        expiresIn: this.refreshTtl,
        issuer: this.issuer,
        audience: `${this.audience}:refresh`,
      },
    );
  }

  private buildAuthResult(role: UserRole, name: string, tokens: AuthTokens): AuthResult {
    return {
      success: true,
      message: 'Login successful',
      role,
      name,
      redirect: role === 'admin' ? '/admin' : '/customer',
      tokens,
    };
  }

  private async createTokensAndSession(
    payload: Omit<JwtPayload, 'jti'>,
    meta?: RequestMeta,
  ): Promise<AuthTokens> {
    const jti = crypto.randomUUID();
    const fullPayload: JwtPayload = { ...payload, jti };

    const accessToken = await this.signAccessToken(fullPayload);
    const refreshToken = await this.signRefreshToken(payload.sub, jti);

    if (refreshToken) {
      const hashed = await this.pwd.hashSecret(refreshToken);
      const exp = new Date(Date.now() + this.parseTimespanMs(this.refreshTtl));
      await this.repo.createSession({
        userId: payload.sub,
        jti,
        hashedToken: hashed,
        expiresAt: exp,
        userAgent: meta?.userAgent,
        ip: meta?.ip,
      });
    }

    return { accessToken, refreshToken };
  }

  private async buildPrincipal(userId: string): Promise<Pick<JwtPayload, 'name' | 'email' | 'role'>> {
    const p = await this.repo.findPrincipalById(userId);
    if (!p) throw new UnauthorizedException('User not found');
    return p;
  }

  private async rotateRefresh(
    userId: string,
    presentedToken: string,
    presentedJti: string,
    meta?: RequestMeta,
  ): Promise<AuthTokens> {
    const rec = await this.repo.findSession(userId, presentedJti);
    if (!rec || rec.revokedAt) throw new UnauthorizedException('Invalid refresh token');

    if (rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now()) {
      await this.repo.revokeSession(userId, presentedJti);
      throw new UnauthorizedException('Refresh token expired');
    }

    const valid = await this.pwd.verifySecret(rec.hashedToken, presentedToken);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    await this.repo.touchSession(userId, presentedJti, meta);

    await this.repo.revokeSession(userId, presentedJti);

    const jti = crypto.randomUUID();
    const principal = await this.buildPrincipal(userId);

    const accessToken = await this.signAccessToken({
      sub: userId,
      jti,
      ...principal,
    });

    const refreshToken = await this.signRefreshToken(userId, jti);

    if (refreshToken) {
      const hashed = await this.pwd.hashSecret(refreshToken);
      const exp = new Date(Date.now() + this.parseTimespanMs(this.refreshTtl));
      await this.repo.createSession({
        userId,
        jti,
        hashedToken: hashed,
        expiresAt: exp,
        userAgent: meta?.userAgent,
        ip: meta?.ip,
      });
    }

    return { accessToken, refreshToken };
  }

  async adminLogin(email: string, password: string, meta?: RequestMeta): Promise<AuthResult> {
    if (!email || !password) throw new BadRequestException('Email and password are required');
    const admin = await this.repo.findAdminByEmail(email.toLowerCase().trim());
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const match = await this.pwd.verify(admin.passwordHash, password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const sub = admin.id ?? (admin as any)._id?.toString?.() ?? 'admin';

    const tokens = await this.createTokensAndSession(
      {
        sub,
        name: admin.name ?? 'Administrator',
        email: admin.email,
        role: 'admin',
      },
      meta,
    );
    return this.buildAuthResult('admin', admin.name ?? 'Administrator', tokens);
  }

  async login(email: string, password: string, meta?: RequestMeta): Promise<AuthResult> {
    if (!email || !password) throw new BadRequestException('Email and password are required');
    const normalized = email.toLowerCase().trim();

    try {
      const admin = await this.repo.findAdminByEmail(normalized);
      if (admin) {
        const ok = await this.pwd.verify(admin.passwordHash, password);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        const sub = admin.id ?? (admin as any)._id?.toString?.() ?? 'admin';

        const tokens = await this.createTokensAndSession(
          { sub, name: admin.name ?? 'Administrator', email: admin.email, role: 'admin' },
          meta,
        );
        return this.buildAuthResult('admin', admin.name ?? 'Administrator', tokens);
      }

      const customer = await this.repo.findCustomerByEmail(normalized);
      if (!customer) throw new UnauthorizedException('Invalid credentials');

      const ok = await this.pwd.verify(customer.passwordHash, password);
      if (!ok) throw new UnauthorizedException('Invalid credentials');

      const sub = customer.id ?? (customer as any)._id?.toString?.();

      const tokens = await this.createTokensAndSession(
        { sub, name: customer.name, email: customer.email, role: 'customer' },
        meta,
      );
      return this.buildAuthResult('customer', customer.name, tokens);
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) throw err;
      this.logger.error('Login failed', err as any);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  async register(dto: RegisterDto) {
    const name = dto.name?.trim();
    const email = dto.email?.toLowerCase().trim();
    const password = dto.password;
    if (!name || !email || !password) throw new BadRequestException('Name, email and password are required');

    try {
      if (await this.repo.existsCustomerByEmail(email)) {
        throw new ConflictException('Email already registered');
      }
      const passwordHash = await this.pwd.validateAndHash(password);

      const customerId = crypto.randomUUID();
      const data = await this.repo.insertCustomer({
        id: customerId,
        name,
        phone: dto.phone?.trim() || null,
        email,
        passwordHash,
        acceptTerms: dto.acceptTerms ?? true,
        acceptPromotions: false,
      });
      return { success: true, message: 'Users created successfully', customer: data };
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) throw err;
      this.logger.error('Register failed', err as any);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  async refreshByToken(
    presentedToken: string,
    meta?: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.enableRefresh) throw new UnauthorizedException('Refresh disabled');

    const payload = await this.jwt.verifyAsync<{ sub: string; jti: string }>(presentedToken, {
      secret: this.config.get<string>('JWT_SECRET', ''),
      issuer: this.issuer,
      audience: `${this.audience}:refresh`,
      ignoreExpiration: false,
    });

    return this.rotateRefresh(payload.sub, presentedToken, payload.jti, meta);
  }

  async logout(userId: string, opts: { all?: boolean; presentedRefresh?: string | null }) {
    if (opts.all) {
      await this.repo.revokeAllSessions(userId);
      return { success: true, message: 'All sessions revoked' };
    }

    const token = opts.presentedRefresh;
    if (!token) return { success: true, message: 'Ok' };

    const payload = await this.jwt.verifyAsync<{ sub: string; jti: string }>(token, {
      secret: this.config.get<string>('JWT_SECRET', ''),
      issuer: this.issuer,
      audience: `${this.audience}:refresh`,
      ignoreExpiration: false,
    });

    if (payload.sub !== userId) {
      throw new UnauthorizedException('Invalid token/user pair');
    }

    await this.repo.revokeSession(userId, payload.jti);
    return { success: true, message: 'Session revoked' };
  }

  listSessions(userId: string) {
    return this.repo.listSessions(userId);
  }
  async revokeSession(userId: string, jti: string) {
    await this.repo.revokeSession(userId, jti);
    return { success: true };
  }
  async revokeAll(userId: string) {
    await this.repo.revokeAllSessions(userId);
    return { success: true };
  }
}
