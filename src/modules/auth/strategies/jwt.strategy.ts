import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export type JwtPayload = {
  sub: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  jti: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', ''),
      audience: config.get<string>('JWT_AUDIENCE', 'api'),
      issuer: config.get<string>('JWT_ISSUER', 'auth-service'),
    });
  }
  async validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException();
    return { ...payload, id: payload.sub };
  }
}
