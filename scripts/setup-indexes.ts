import 'reflect-metadata';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoService } from '../src/common/mongo/mongo.service';

async function main() {
  ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' });
  const config = new ConfigService();
  const mongo = new MongoService(config);
  await mongo.onModuleInit();
  await mongo.collection('clientes').createIndex({ email: 1 }, { unique: true }).catch(() => undefined);
  await mongo.collection('produtos').createIndex({ id: 1 }, { unique: true }).catch(() => undefined);
  await mongo.collection('admins').createIndex({ email: 1 }, { unique: true }).catch(() => undefined);
  // eslint-disable-next-line no-console
  console.log('Índices criados/garantidos.');
  await mongo.onModuleDestroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
