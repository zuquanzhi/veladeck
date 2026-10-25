import {test,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../src/db/client.js';
import {loadConfig} from '../src/config.js';
import {AgentBridge} from '../src/services/agentBridge.js';
test('server event sequence persists independently of disconnected clients',async()=>{const directory=await mkdtemp(join(tmpdir(),'runotter-bridge-'));const store=new Store(directory);store.tables(['audit']);const bridge=new AgentBridge(store,loadConfig({DATA_DIR:directory,DSH_CMD:process.execPath,DSH_ARGS:JSON.stringify(['-e',`process.stdin.once('data',()=>{console.log(JSON.stringify({type:'token',text:'hello'}));setTimeout(()=>{console.log(JSON.stringify({type:'token',text:' world'}));process.exit(0)},50)});`])}));try{const t=bridge.create('Sequence test',null);bridge.send(t.id,{text:'Hello'},'test');await new Promise<void>(resolve=>{bridge.events.on(t.id,event=>{if(event.type==='done'||event.type==='error')resolve();});});const all=bridge.history(t.id);expect(all.map(e=>e.seq)).toEqual([1,2,3,4]);expect(bridge.history(t.id,2).map(e=>e.text).join('')).toContain(' world');expect(bridge.running.size).toBe(0);}finally{bridge.close();store.close();await rm(directory,{recursive:true,force:true});}});
