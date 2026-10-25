import { spawn } from 'node:child_process';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const data=await mkdtemp(join(tmpdir(),'runotter-smoke-'));
const port=18090;
const child=spawn(process.execPath,['--import','tsx','server/src/index.ts'],{env:{...process.env,PORT:String(port),DATA_DIR:data},stdio:'ignore'});
try{let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);assert.equal(r.status,200);assert.equal((await r.json()).ok,true);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert(ready,'server health never became ready');console.log('SMOKE PASS: loopback HTTP health 200');}finally{child.kill();await new Promise(r=>child.once('exit',r));await rm(data,{recursive:true,force:true});}
