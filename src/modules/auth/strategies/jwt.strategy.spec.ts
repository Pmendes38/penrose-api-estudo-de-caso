import { JwtStrategy } from './jwt.strategy';

it('maps the signed subject to the customer id used by payments and orders', async () => {
  const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
  const payload = { sub: 'customer-123', name: 'Demo', email: 'contato@example.com', role: 'customer' as const, jti: 'session' };
  expect(await strategy.validate(payload)).toEqual({ ...payload, id: payload.sub });
  await expect(strategy.validate({ ...payload, sub: '' })).rejects.toThrow();
});
