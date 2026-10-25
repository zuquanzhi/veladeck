import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../services/auth.js';
import type { OpsBridge } from '../services/opsBridge.js';
import type { CostService } from '../services/costService.js';
import { internal } from '../lib/security.js';
export function opsRoutes(app: FastifyInstance, auth: Auth, ops: OpsBridge, cost: CostService) {
  app.get('/api/ops/status', async (req) => {
    auth.device(req);
    return ops.status();
  });
  app.get('/api/ops/tasks', async (req) => {
    auth.device(req);
    return ops.listTasks();
  });
  app.post('/api/ops/tasks/:name/run', async (req) => {
    const d = auth.device(req),
      p = z
        .object({ name: z.enum(['trendradar-push', 'stock-report-push', 'dsh-backup']) })
        .parse(req.params),
      b = z.object({ confirmed: z.literal(true), step_up_token: z.string() }).parse(req.body);
    auth.consume(d, 'run:' + p.name, b.step_up_token);
    return ops.run(p.name, d.id);
  });
  app.post('/api/cost/usage', async (req) => {
    internal(req, auth.config.INGEST_TOKEN);
    return cost.record(req.body);
  });
  app.get('/api/cost/summary', async (req) => {
    auth.device(req);
    return cost.summary();
  });
  app.get('/api/digest/today', async (req) => {
    auth.device(req);
    return {
      day: cost.day(),
      artifacts: auth.store.get<{ n: number }>(
        'SELECT count(*) AS n FROM artifacts WHERE created_at>?',
        Date.now() - 86400000,
      )!.n,
      pending_approvals: auth.store.get<{ n: number }>(
        "SELECT count(*) AS n FROM approvals WHERE status='pending'",
      )!.n,
      inbox: auth.store.get<{ n: number }>(
        "SELECT count(*) AS n FROM inbox_items WHERE status='new'",
      )!.n,
      today_plan: [],
    };
  });
}
