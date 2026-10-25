import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../services/auth.js';
import type { PushService } from '../services/pushService.js';
import type { Settings } from '../services/settings.js';
import { internal, id, audit } from '../lib/security.js';
const endpoint = z
  .string()
  .url()
  .max(3000)
  .refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(
        u.hostname,
      ) ||
        u.hostname.endsWith('.notify.windows.com'))
    );
  }, 'Unsupported push service');
export function pushRoutes(
  app: FastifyInstance,
  auth: Auth,
  push: PushService,
  settings: Settings,
) {
  app.get('/api/push/key', async (req) => {
    auth.device(req);
    return { publicKey: push.keys.publicKey };
  });
  app.post('/api/push/subscribe', async (req) => {
    const d = auth.device(req),
      b = z
        .object({
          endpoint,
          keys: z.object({ p256dh: z.string().min(1).max(300), auth: z.string().min(1).max(300) }),
        })
        .parse(req.body);
    auth.store.run(
      'INSERT INTO push_subs(id,device_id,endpoint,p256dh,auth,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET device_id=excluded.device_id,p256dh=excluded.p256dh,auth=excluded.auth',
      id(),
      d.id,
      b.endpoint,
      b.keys.p256dh,
      b.keys.auth,
      Date.now(),
    );
    audit(auth.store, 'subscribe_push', d.id, d.id);
    return { ok: true };
  });
  app.delete('/api/push/subscribe', async (req) => {
    const d = auth.device(req);
    auth.store.run('DELETE FROM push_subs WHERE device_id=?', d.id);
    audit(auth.store, 'unsubscribe_push', d.id, d.id);
    return { ok: true };
  });
  app.post('/api/notify', async (req) => {
    internal(req, auth.config.INGEST_TOKEN);
    const query = z.object({ dry_run: z.enum(['true', 'false']).optional() }).parse(req.query);
    return push.notify(req.body, query.dry_run === 'true');
  });
  app.get('/api/notify/events', async (req) => {
    auth.device(req);
    return auth.store.all(
      'SELECT id,type,priority,project,title,deep_link,delivered_via,created_at FROM events ORDER BY created_at DESC LIMIT 50',
    );
  });
  app.get('/api/settings', async (req) => {
    auth.device(req);
    return settings.get();
  });
  app.put('/api/settings', async (req) => settings.set(req.body, auth.device(req).id));
}
