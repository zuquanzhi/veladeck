import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../services/auth.js';
import type { AgentBridge, AgentEvent } from '../services/agentBridge.js';
import { audit, Limiter } from '../lib/security.js';
const key = (p: unknown) => z.object({ id: z.string().uuid() }).parse(p).id;
function stream(
  req: FastifyRequest,
  reply: FastifyReply,
  bridge: AgentBridge,
  thread: string,
  after: number,
) {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  let last = after,
    closed = false,
    replaying = true;
  const send = (event: AgentEvent) => {
    if (!closed && (event.seq ?? 0) > last) {
      last = event.seq!;
      reply.raw.write(`id: ${last}\ndata: ${JSON.stringify(event)}\n\n`);
    }
    if (!replaying && (event.type === 'done' || event.type === 'error')) reply.raw.end();
  };
  bridge.events.on(thread, send);
  while (true) {
    const batch = bridge.history(thread, last, 1000);
    for (const event of batch) send(event);
    if (batch.length < 1000) break;
  }
  replaying = false;
  const timer = setInterval(() => {
    if (!closed) reply.raw.write(': keepalive\n\n');
  }, 15000);
  reply.raw.once('close', () => {
    closed = true;
    clearInterval(timer);
    bridge.events.off(thread, send);
  });
  if (!bridge.running.has(thread)) reply.raw.end();
  void req;
}
export function threadRoutes(app: FastifyInstance, auth: Auth, bridge: AgentBridge) {
  const limiter = new Limiter();
  app.get('/api/threads', async (req) => {
    auth.device(req);
    const q = z.object({ q: z.string().max(200).default('') }).parse(req.query);
    return auth.store.all(
      'SELECT id,title,project,backend,pinned,last_seq,updated_at FROM threads WHERE title LIKE ? ORDER BY pinned DESC,updated_at DESC LIMIT 100',
      '%' + q.q + '%',
    );
  });
  app.post('/api/threads', async (req) => {
    const d = auth.device(req),
      b = z
        .object({
          title: z.string().min(1).max(150).default('新的对话'),
          project: z.string().max(64).nullable().default(null),
          backend: z.string().default('dsh'),
        })
        .parse(req.body);
    const t = bridge.create(b.title, b.project, b.backend);
    audit(auth.store, 'create_thread', t.id, d.id);
    return t;
  });
  app.patch('/api/threads/:id', async (req) => {
    const d = auth.device(req),
      k = key(req.params),
      b = z
        .object({ title: z.string().min(1).max(150).optional(), pinned: z.boolean().optional() })
        .parse(req.body);
    const t = bridge.thread(k);
    auth.store.run(
      'UPDATE threads SET title=?,pinned=? WHERE id=?',
      b.title ?? t.title,
      b.pinned === undefined ? t.pinned : Number(b.pinned),
      k,
    );
    audit(auth.store, 'update_thread', k, d.id);
    return bridge.thread(k);
  });
  app.get('/api/threads/:id/messages', async (req) => {
    auth.device(req);
    const q = z.object({ after_seq: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    return bridge.history(key(req.params), q.after_seq);
  });
  app.post('/api/threads/:id/messages', async (req, reply) => {
    const d = auth.device(req);
    limiter.hit(d.id, 30, 60000);
    const k = key(req.params),
      result = bridge.send(k, req.body, d.id);
    stream(req, reply, bridge, k, result.after_seq);
  });
  app.get('/api/threads/:id/events', async (req, reply) => {
    auth.device(req);
    const k = key(req.params),
      q = z.object({ after_seq: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    bridge.thread(k);
    stream(req, reply, bridge, k, q.after_seq);
  });
  app.post('/api/threads/:id/cancel', async (req) =>
    bridge.cancel(key(req.params), auth.device(req).id),
  );
}
