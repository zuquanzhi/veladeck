import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import type { Auth } from '../services/auth.js';
import type { Sharing } from '../services/sharing.js';
import { Limiter, audit } from '../lib/security.js';
import { sendFile } from './artifacts.js';
const key = (p: unknown) => z.object({ id: z.string().uuid() }).parse(p).id;
const token = (p: unknown) =>
  z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(p).token;
export function sharingRoutes(app: FastifyInstance, auth: Auth, sharing: Sharing) {
  const limiter = new Limiter();
  app.post('/api/artifacts/:id/share', async (req) =>
    sharing.share(key(req.params), auth.device(req).id),
  );
  app.delete('/api/artifacts/:id/share', async (req) =>
    sharing.revoke(key(req.params), auth.device(req).id),
  );
  app.get('/s/:token', async (req, reply) => {
    const t = token(req.params);
    limiter.hit(req.ip + ':' + t, 60, 3600000);
    return reply.type('text/html').send(sharing.html(t));
  });
  app.get('/s/:token/content', async (req, reply) => {
    const t = token(req.params);
    limiter.hit(req.ip + ':' + t, 60, 3600000);
    const a = sharing.lookup(t);
    if (a.kind === 'html')
      return reply
        .type('text/html')
        .header(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
        )
        .send(readFileSync(sharing.artifacts.file(a.path), 'utf8'));
    return sendFile(req, reply, sharing.artifacts, a, true);
  });
  app.post('/api/inbox', async (req) => {
    const d = auth.device(req);
    const b = z
      .object({
        kind: z.enum(['text', 'url']).default('text'),
        content: z.string().max(32000).default(''),
        url: z
          .string()
          .url()
          .max(3000)
          .refine((s) => ['http:', 'https:'].includes(new URL(s).protocol))
          .optional(),
        idempotency_key: z.string().max(200).optional(),
      })
      .refine((b) => b.content.length > 0 || !!b.url)
      .parse(req.body);
    return sharing.inbox(b, d.id);
  });
  app.get('/api/inbox', async (req) => {
    auth.device(req);
    const q = z
      .object({ status: z.enum(['new', 'converted', 'archived', 'all']).default('new') })
      .parse(req.query);
    return auth.store.all(
      "SELECT * FROM inbox_items WHERE (?='all' OR status=?) ORDER BY created_at DESC LIMIT 100",
      q.status,
      q.status,
    );
  });
  app.post('/api/inbox/:id/to-thread', async (req) =>
    sharing.toThread(key(req.params), auth.device(req).id),
  );
  app.post('/api/inbox/:id/archive', async (req) => {
    const d = auth.device(req),
      k = key(req.params);
    auth.store.run('UPDATE inbox_items SET status=? WHERE id=?', 'archived', k);
    audit(auth.store, 'archive_inbox', k, d.id);
    return { ok: true };
  });
  app.get('/api/export/artifacts', async (req, reply) => {
    auth.device(req);
    return reply
      .header('Content-Disposition', 'attachment; filename="runotter-artifacts.json"')
      .send(
        auth.store.all(
          'SELECT id,project,kind,title,summary,bytes,sha256,version,lineage_key,tags,starred,read_later,retain_until,created_at,updated_at FROM artifacts',
        ),
      );
  });
}
