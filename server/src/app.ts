import Fastify from 'fastify';
import { ZodError } from 'zod';
import type { Config } from './config.js';
export async function buildApp(_config:Config,logging=false){
  const app=Fastify({logger:logging?{level:'info',redact:['req.headers.cookie','req.headers.authorization','res.headers.set-cookie'],serializers:{req:r=>({method:r.method,url:String(r.url).split('?')[0].replace(/\/s\/[^/]+/g,'/s/[redacted]')})}}:false,bodyLimit:28*1024*1024,trustProxy:false});
  app.setErrorHandler((error,_req,reply)=>{const err=error as Error & {statusCode?:number;code?:string};const code=error instanceof ZodError?400:err.statusCode??500;reply.code(code).send({error:{code:error instanceof ZodError?'VALIDATION_ERROR':err.code??'INTERNAL_ERROR',message:code>=500?'The service could not complete this request.':err.message}});});
  app.get('/api/health',()=>({ok:true,version:'0.1.0',time:new Date().toISOString()}));
  app.addHook('onSend',async(_request,reply)=>{reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer');});
  return app;
}
