import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import type { Auth } from '../services/auth.js';
import type { ArtifactStore, Artifact } from '../services/artifactStore.js';
import { internal } from '../lib/security.js';
import { fail } from '../lib/errors.js';
const params = (value: unknown) => z.object({ id: z.string().uuid() }).parse(value).id;
export function sendFile(
  req: FastifyRequest,
  reply: FastifyReply,
  artifacts: ArtifactStore,
  a: Artifact,
  download = false,
) {
  const bytes = readFileSync(artifacts.file(a.path));
  const mime: Record<string, string> = {
    pdf: 'application/pdf',
    zip: 'application/zip',
    image: bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : 'image/webp',
  };
  reply.type(mime[a.kind] ?? 'text/plain; charset=utf-8').header('Accept-Ranges', 'bytes');
  if (download) reply.header('Content-Disposition', `attachment; filename="${a.id}.${a.kind}"`);
  if (req.headers.range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!m) return reply.code(416).header('Content-Range', `bytes */${bytes.length}`).send();
    const start = Number(m[1]),
      end = m[2] ? Number(m[2]) : bytes.length - 1;
    if (start > end || start >= bytes.length || end >= bytes.length)
      return reply.code(416).header('Content-Range', `bytes */${bytes.length}`).send();
    return reply
      .code(206)
      .header('Content-Range', `bytes ${start}-${end}/${bytes.length}`)
      .send(bytes.subarray(start, end + 1));
  }
  return reply.send(bytes);
}
export function artifactRoutes(app: FastifyInstance, auth: Auth, artifacts: ArtifactStore) {
  app.post('/api/artifacts', async (req) => {
    internal(req, auth.config.INGEST_TOKEN);
    return artifacts.ingest(req.body);
  });
  app.get('/api/artifacts', async (req) => {
    auth.device(req);
    return artifacts.list(req.query);
  });
  app.get('/api/artifacts/:id', async (req) => {
    auth.device(req);
    return artifacts.get(params(req.params));
  });
  app.get('/api/artifacts/:id/content', async (req, reply) => {
    auth.device(req);
    return sendFile(req, reply, artifacts, artifacts.get(params(req.params)));
  });
  app.get('/api/artifacts/:id/download', async (req, reply) => {
    auth.device(req);
    return sendFile(req, reply, artifacts, artifacts.get(params(req.params)), true);
  });
  app.get('/api/artifacts/:id/versions', async (req) => {
    auth.device(req);
    return artifacts
      .versions(params(req.params))
      .map((a) => ({ id: a.id, version: a.version, created_at: a.updated_at, title: a.title }));
  });
  app.get('/api/artifacts/:id/diff', async (req) => {
    auth.device(req);
    const q = z.object({ vs: z.coerce.number().int().min(1) }).parse(req.query);
    return { diff: artifacts.diff(params(req.params), q.vs) };
  });
  for (const [action, field] of [
    ['star', 'starred'],
    ['read-later', 'read_later'],
  ] as const)
    app.post(`/api/artifacts/:id/${action}`, async (req) => {
      const d = auth.device(req),
        b = z.object({ value: z.boolean() }).parse(req.body);
      return artifacts.change(params(req.params), field, Number(b.value), d.id);
    });
  app.post('/api/artifacts/:id/progress', async (req) => {
    const d = auth.device(req),
      b = z.object({ value: z.number().min(0).max(1) }).parse(req.body);
    return artifacts.change(params(req.params), 'read_progress', b.value, d.id);
  });
  app.post('/api/artifacts/:id/retain', async (req) => {
    const d = auth.device(req),
      b = z.object({ days: z.number().int().min(1).max(36500) }).parse(req.body);
    return artifacts.change(
      params(req.params),
      'retain_until',
      Date.now() + b.days * 86400000,
      d.id,
    );
  });
  app.delete('/api/artifacts/:id', async (req) => {
    const d = auth.device(req);
    const b = z.object({ step_up_token: z.string() }).parse(req.body);
    const key = params(req.params);
    auth.consume(d, 'delete:' + key, b.step_up_token);
    return artifacts.remove(key, d.id);
  });
  app.get('/api/artifacts/:id/preview', async (req, reply) => {
    auth.device(req);
    const a = artifacts.get(params(req.params));
    if (a.kind !== 'html') fail(400, 'UNSUPPORTED', 'HTML only');
    return reply
      .type('text/html')
      .header(
        'Content-Security-Policy',
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
      )
      .send(readFileSync(artifacts.file(a.path), 'utf8'));
  });
}
