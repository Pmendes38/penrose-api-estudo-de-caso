import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../auth/schemas/customer.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './repo/users.repository';
import { PasswordModule } from '../../shared/password/password.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PasswordModule,
    AuthModule,
    MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [],
})
export class UsersModule {}
