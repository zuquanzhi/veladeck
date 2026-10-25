import { buildApp } from './app.js';
import { loadConfig } from './config.js';
const config=loadConfig();
const app=await buildApp(config,true);
await app.listen({host:'127.0.0.1',port:config.PORT});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
