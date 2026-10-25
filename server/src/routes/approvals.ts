import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import type {Auth} from '../services/auth.js';
import type {Approvals} from '../services/approvals.js';
export function approvalRoutes(app:FastifyInstance,auth:Auth,approvals:Approvals){
  app.get('/api/approvals',async(req)=>{auth.device(req);approvals.expire();const q=z.object({status:z.enum(['pending','approved','rejected','expired','all']).default('pending')}).parse(req.query);return auth.store.all('SELECT * FROM approvals WHERE (?=\'all\' OR status=?) ORDER BY CASE WHEN risk=\'danger\' THEN 0 ELSE 1 END,created_at DESC LIMIT 100',q.status,q.status);});
  for(const [action,decision] of [['approve','approved'],['reject','rejected']] as const)app.post(`/api/approvals/:id/${action}`,async(req)=>{const d=auth.device(req),p=z.object({id:z.string().uuid()}).parse(req.params),b=z.object({step_up_token:z.string().max(200).optional(),confirmed:z.boolean().default(false)}).parse(req.body??{});return approvals.decide(p.id,decision,d,b.step_up_token,b.confirmed);});
}
