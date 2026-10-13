// scripts/seed-admin.ts
import 'reflect-metadata';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { NestFactory } from '@nestjs/core';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DatabaseModule } from '../src/common/database/database.module';
import { Admin, AdminSchema, type AdminDocument } from '../src/modules/admins/schemas/admin.schema';

// ---- helpers de CLI/env ------------------------------------------------------
function arg(name: string, fallback?: string) {
  const flag = process.argv.find(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`) || a.startsWith(`${name}=`)
  );
  if (!flag) return process.env[`SEED_ADMIN_${name.toUpperCase()}`] ?? fallback;
  const [, v] = flag.split('=');
  return v ?? 'true';
}

const emailArg = arg('email', 'contato@example.com');
const passwordArg = arg('password'); // A senha local deve ser fornecida, nunca presumida.
const nameArg = arg('name', 'Administrador');
const force = process.argv.includes('--force') || process.argv.includes('-f');

// ---- módulo mínimo para subir o contexto do Nest -----------------------------
@Module({
  imports: [
    // lê variáveis de ambiente (MONGODB_URI, MONGODB_DB, HASH_*, JWT_*, etc.)
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env'] }),
    DatabaseModule, // conecta ao MongoDB
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
  ],
})
class SeedModule {}

// ---- script ------------------------------------------------------------------
async function run() {
  const logger = new Logger('seed-admin');

  const email = (emailArg || '').trim().toLowerCase();
  const password = String(passwordArg ?? '');
  const name = String(nameArg ?? 'Administrador').trim();

  if (!email || !password) {
    logger.error('Uso: --email=... --password=... [--name="..."] [--force]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const config = app.get(ConfigService);

    // Opções exatamente como no AuthService
    const pepper = config.get<string>('HASH_PEPPER') ?? '';
    const argonOptions: argon2.Options & { raw?: false } = {
      type: argon2.argon2id,
      memoryCost: Number(config.get('HASH_MEMORY_COST', 19_456)),
      timeCost: Number(config.get('HASH_TIME_COST', 2)),
      parallelism: Number(config.get('HASH_PARALLELISM', 1)),
    };

    const AdminModel = app.get<Model<AdminDocument>>(getModelToken(Admin.name));

    // garante coleção/índices (unique de email)
    await AdminModel.createCollection().catch(() => {});
    await AdminModel.syncIndexes().catch(() => {});

    const existing = await AdminModel.findOne({ email }).lean().exec();

    // IMPORTANTE: aplicar o mesmo "pepper" do serviço
    const toHash = pepper ? `${password}${pepper}` : password;
    const passwordHash = await argon2.hash(toHash, argonOptions);
    const now = new Date();

    if (existing) {
      if (!force) {
        logger.log(`Admin já existe (${email}). Nada a fazer. Use --force para atualizar senha/nome.`);
        await app.close();
        process.exit(0);
      }

      await AdminModel.updateOne(
        { email },
        {
          $set: {
            name,
            passwordHash,
            role: 'admin',
            updatedAt: now,
          },
        },
      ).exec();

      logger.log(`Admin atualizado: ${email}`);
    } else {
      await AdminModel.create({
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash,
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      } as any);

      logger.log(`Admin criado: ${email}`);
    }
  } catch (e: any) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();
