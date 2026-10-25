export const base=(document.querySelector('meta[name="runotter-base"]')?.getAttribute('content')??'').replace(/\/$/,'');
export class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
export async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{const r=await fetch(base+path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok){const b=await r.json().catch(()=>null) as {error?:{message?:string}}|null;throw new ApiError(r.status,b?.error?.message??`请求失败 (${r.status})`);}return r.json() as Promise<T>;}
export interface Session{id:string;name:string;passkey:boolean}
