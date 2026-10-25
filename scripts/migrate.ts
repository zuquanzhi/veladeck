import {buildApp} from '../server/src/app.js';
import {loadConfig} from '../server/src/config.js';
const app=await buildApp(loadConfig());await app.close();console.log('RunOtter database migrations applied.');
