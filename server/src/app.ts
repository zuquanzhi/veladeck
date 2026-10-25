import Fastify from 'fastify';
import { ZodError } from 'zod';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type { Config } from './config.js';
import {Store} from './db/client.js';
import {Auth} from './services/auth.js';
import {authRoutes} from './routes/auth.js';
import {fail} from './lib/errors.js';
export async function buildApp(config:Config,logging=false){
  const app=Fastify({logger:logging?{level:'info',redact:['req.headers.cookie','req.headers.authorization','res.headers.set-cookie'],serializers:{req:r=>({method:r.method,url:String(r.url).split('?')[0].replace(/\/s\/[^/]+/g,'/s/[redacted]')})}}:false,bodyLimit:28*1024*1024,trustProxy:false});
  app.setErrorHandler((error,_req,reply)=>{const err=error as Error & {statusCode?:number;code?:string};const code=error instanceof ZodError?400:err.statusCode??500;reply.code(code).send({error:{code:error instanceof ZodError?'VALIDATION_ERROR':err.code??'INTERNAL_ERROR',message:code>=500?'The service could not complete this request.':err.message}});});
  app.get('/api/health',()=>({ok:true,version:'0.1.0',time:new Date().toISOString()}));
  const store=new Store(config.DATA_DIR),auth=new Auth(store,config);
  await app.register(cookie);
  const base=new URL(config.PUBLIC_BASE_URL).pathname.replace(/\/$/,'');
  app.addHook('onRequest',async(req)=>{if(base&&(req.url===base||req.url.startsWith(base+'/')))req.raw.url=req.url.slice(base.length)||'/';if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&req.headers.origin!==new URL(config.PUBLIC_BASE_URL).origin)fail(403,'ORIGIN_DENIED','Cross-origin writes are not accepted.');});
  app.addHook('onSend',async(_request,reply)=>{reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('Cache-Control','no-store').header('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");});
  authRoutes(app,auth);
  const web=resolve('dist/web');
  if(existsSync(web)){await app.register(staticFiles,{root:web,index:false});const index=()=>readFileSync(resolve(web,'index.html'),'utf8').replace('<head>',`<head><base href="${base}/"><meta name="runotter-base" content="${base}">`);app.get('/',async(_req,reply)=>reply.type('text/html').send(index()));app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api/')||req.url.includes('.')?reply.code(404).send({error:{code:'NOT_FOUND',message:'Not found'}}):reply.type('text/html').send(index()));}
  app.addHook('onClose',async()=>store.close());
  return app;
}
