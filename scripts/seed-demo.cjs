const mongoose = require('mongoose');
const argon2 = require('argon2');
const { randomUUID } = require('node:crypto');

async function main() {
  if (process.env.COMMERCE_MODE !== 'demo') return;
  if (process.env.MONGODB_DB !== 'penrose_demo') throw new Error('Demo database required');
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password) return;
  if (password.length < 16) throw new Error('Strong demo password required');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'penrose_demo' });
  try {
    const admins = mongoose.connection.collection('admins');
    const email = 'demo.admin@penrose.example';
    const passwordHash = await argon2.hash(password + (process.env.HASH_PEPPER || ''), { type: argon2.argon2id, memoryCost: Number(process.env.HASH_MEMORY_COST || 19456), timeCost: Number(process.env.HASH_TIME_COST || 2), parallelism: Number(process.env.HASH_PARALLELISM || 1) });
    await admins.updateOne({ email }, { $setOnInsert: { id: randomUUID(), email, name: 'Administrador Demo', role: 'admin', passwordHash, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
    await mongoose.connection.collection('customers').updateOne({ email: 'demo.cliente@penrose.example' }, { $setOnInsert: { id: randomUUID(), email: 'demo.cliente@penrose.example', name: 'Cliente Demonstração', passwordHash, addresses: [], preferences: { newsletterOptIn: false }, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
    console.log('Isolated demo administrator ready');
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error('Demo administrator initialization failed'); process.exitCode = 1; });
