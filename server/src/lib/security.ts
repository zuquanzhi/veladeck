import { randomBytes,scryptSync,timingSafeEqual,createHash,randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Store } from '../db/client.js';
import { fail } from './errors.js';
export const id=()=>randomUUID();
export const secret=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function hash(value:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(value,salt,32).toString('hex');}
export function check(value:string,stored:string){const [salt,key]=stored.split(':');if(!salt||!key)return false;const actual=scryptSync(value,salt,32);const expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function audit(store:Store,action:string,target:string,device:string|null=null,result='ok'){store.run('INSERT INTO audit(id,at,device_id,action,target,result) VALUES(?,?,?,?,?,?)',id(),Date.now(),device,action,target,result);}
export function internal(req:FastifyRequest,token:string){if(!token||req.headers.authorization!==`Bearer ${token}`||!['127.0.0.1','::1'].includes(req.ip)||req.headers['cf-connecting-ip']||req.headers['x-forwarded-for'])fail(403,'INTERNAL_ONLY','This endpoint accepts authenticated loopback requests only.');}
export class Limiter{
  buckets=new Map<string,{count:number;until:number}>();
  hit(key:string,max:number,period:number){const now=Date.now();if(this.buckets.size>10000)for(const [k,v] of this.buckets)if(v.until<now)this.buckets.delete(k);let b=this.buckets.get(key);if(!b||b.until<now){b={count:0,until:now+period};this.buckets.set(key,b);}if(++b.count>max)fail(429,'RATE_LIMITED','Too many attempts. Try again later.');}
}
