import { loadConfig } from '../server/src/config.js';
const config = loadConfig();
if (!config.INGEST_TOKEN) throw new Error('Set INGEST_TOKEN in the server environment first.');
const r = await fetch(`http://127.0.0.1:${config.PORT}/api/pair/code`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${config.INGEST_TOKEN}` },
});
if (!r.ok) throw new Error(`Pairing request failed (${r.status})`);
const result = (await r.json()) as { code: string; expires_in: number };
console.log(`RunOtter pairing code: ${result.code} (valid for ${result.expires_in}s, single use)`);
