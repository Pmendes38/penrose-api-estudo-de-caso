import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './repo/auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Admin, AdminSchema } from '../admins/schemas/admin.schema';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';
import { PasswordModule } from '../../shared/password/password.module';

@Module({
  imports: [
    ConfigModule,
    PasswordModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', ''),
        signOptions: {
          issuer: cfg.get<string>('JWT_ISSUER', 'auth-service'),
          audience: cfg.get<string>('JWT_AUDIENCE', 'api'),
        },
      }),
    }),
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
