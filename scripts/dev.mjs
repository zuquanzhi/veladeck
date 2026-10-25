import {spawn} from 'node:child_process';
const options={stdio:'inherit',shell:false};
const server=spawn(process.execPath,['--env-file-if-exists=.env','--import','tsx','--watch','server/src/index.ts'],options);
const web=spawn(process.execPath,['node_modules/vite/bin/vite.js'],options);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.kill();web.kill();});
