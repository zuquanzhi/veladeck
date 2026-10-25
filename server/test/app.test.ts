import { expect,test } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
test('health exposes version and UTC time',async()=>{const app=await buildApp(loadConfig({}));const r=await app.inject('/api/health');expect(r.statusCode).toBe(200);expect(r.json()).toMatchObject({ok:true,version:'0.1.0'});await app.close();});
