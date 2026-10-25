import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../services/auth.js';
import { audit, internal, Limiter } from '../lib/security.js';
const credential = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal('public-key'),
    clientExtensionResults: z.record(z.string(), z.unknown()),
    response: z.object({ clientDataJSON: z.string().min(1) }).passthrough(),
  })
  .passthrough();
export function authRoutes(app: FastifyInstance, auth: Auth) {
  const limiter = new Limiter();
  app.post('/api/pair/code', async (req) => {
    internal(req, auth.config.INGEST_TOKEN);
    return auth.pairCode();
  });
  app.post('/api/pair/claim', async (req, reply) => {
    limiter.hit(req.ip, 10, 600000);
    const b = z
      .object({ code: z.string().regex(/^\d{6}$/), device_name: z.string().min(1).max(80) })
      .parse(req.body);
    return auth.claim(b.code, b.device_name, reply);
  });
  app.get('/api/session', async (req) => {
    const d = auth.device(req);
    return { id: d.id, name: d.name, passkey: !!d.webauthn_cred_id };
  });
  app.get('/api/devices', async (req) => {
    auth.device(req);
    return auth.store.all(
      'SELECT id,name,created_at,last_seen_at,revoked_at,webauthn_cred_id IS NOT NULL AS passkey FROM devices',
    );
  });
  app.patch('/api/devices/:id', async (req) => {
    const d = auth.device(req),
      p = z.object({ id: z.string().uuid() }).parse(req.params),
      b = z.object({ name: z.string().min(1).max(80) }).parse(req.body);
    auth.store.run('UPDATE devices SET name=? WHERE id=?', b.name, p.id);
    audit(auth.store, 'rename_device', p.id, d.id);
    return { ok: true };
  });
  app.delete('/api/devices/:id', async (req) => {
    const d = auth.device(req),
      p = z.object({ id: z.string().uuid() }).parse(req.params);
    auth.store.run('UPDATE devices SET revoked_at=? WHERE id=?', Date.now(), p.id);
    auth.store.run('DELETE FROM push_subs WHERE device_id=?', p.id);
    audit(auth.store, 'revoke_device', p.id, d.id);
    return { ok: true };
  });
  app.post('/api/logout', async (req, reply) => {
    const d = auth.device(req);
    auth.store.run('UPDATE devices SET revoked_at=? WHERE id=?', Date.now(), d.id);
    auth.store.run('DELETE FROM push_subs WHERE device_id=?', d.id);
    audit(auth.store, 'logout', d.id, d.id);
    reply.clearCookie('ad_device', { path: '/' });
    return { ok: true };
  });
  app.post('/api/auth/webauthn/register/options', async (req) =>
    auth.registerOptions(auth.device(req)),
  );
  app.post('/api/auth/webauthn/register/verify', async (req) => {
    const d = auth.device(req);
    const b = z.object({ response: credential }).parse(req.body);
    return auth.register(d, b.response as unknown as Parameters<typeof auth.register>[1]);
  });
  app.post('/api/auth/webauthn/login/options', async (req) => {
    limiter.hit(req.ip, 10, 600000);
    const b = z.object({ scope: z.string().min(1).max(200) }).parse(req.body);
    return auth.loginOptions(auth.device(req), b.scope);
  });
  app.post('/api/auth/webauthn/login/verify', async (req) => {
    limiter.hit(req.ip, 10, 600000);
    const b = z.object({ response: credential }).parse(req.body);
    return auth.login(auth.device(req), b.response as unknown as Parameters<typeof auth.login>[1]);
  });
}
