import Database from 'better-sqlite3';
import { loadConfig } from '../server/src/config.js';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { mkdir, cp } from 'node:fs/promises';
const config = loadConfig();
const output = resolve(process.argv[2] ?? '');
const subpath = relative(config.DATA_DIR, output);
if (!process.argv[2] || !subpath || (!subpath.startsWith('..') && !isAbsolute(subpath)))
  throw Error('Choose a separate private backup directory.');
await mkdir(output, { recursive: true, mode: 0o700 });
const db = new Database(join(config.DATA_DIR, 'runotter.db'), { readonly: true });
await db.backup(join(output, 'runotter.db'));
db.close();
await cp(join(config.DATA_DIR, 'files'), join(output, 'files'), {
  recursive: true,
  force: false,
  errorOnExist: true,
});
console.log(
  'SQLite snapshot and artifact files copied. Treat the destination as private; it contains personal data. VAPID and runtime environment credentials are not copied.',
);
