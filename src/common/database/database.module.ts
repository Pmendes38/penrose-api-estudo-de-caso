import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { DatabaseHealthService } from './database.health';

@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): MongooseModuleOptions => {
        const uri = config.get<string>('MONGODB_URI');
        const dbName = config.get<string>('MONGODB_DB');
        if (!uri || !dbName) {
          throw new Error('MONGODB_URI and MONGODB_DB are required');
        }
        return {
          uri,
          dbName,
          autoIndex: config.get('MONGODB_AUTO_INDEX', 'true') === 'true',
          maxPoolSize: Number(config.get('MONGODB_MAX_POOL', 10)),
        };
      },
    }),
  ],
  providers: [DatabaseHealthService],
  exports: [DatabaseHealthService, MongooseModule],
})
export class DatabaseModule {}