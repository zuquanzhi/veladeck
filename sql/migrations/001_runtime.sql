-- Additive RunOtter runtime tables; apply once, forward only.
CREATE TABLE IF NOT EXISTS auth_challenges(device_id TEXT PRIMARY KEY, challenge TEXT NOT NULL, scope TEXT NOT NULL, expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS stepups(token_hash TEXT PRIMARY KEY,device_id TEXT NOT NULL,scope TEXT NOT NULL,expires_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS artifact_versions(artifact_id TEXT NOT NULL,version INTEGER NOT NULL,metadata TEXT NOT NULL,path TEXT NOT NULL,PRIMARY KEY(artifact_id,version));

CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS event_dedupe(key TEXT PRIMARY KEY,event_id TEXT NOT NULL,at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS thread_reads(device_id TEXT NOT NULL,thread_id TEXT NOT NULL,seq INTEGER NOT NULL,PRIMARY KEY(device_id,thread_id));

CREATE TABLE IF NOT EXISTS usage_entries(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE NOT NULL,day TEXT NOT NULL,project TEXT NOT NULL,input_tokens INTEGER NOT NULL,output_tokens INTEGER NOT NULL,cache_hit INTEGER NOT NULL,cost_cny REAL NOT NULL);CREATE TABLE IF NOT EXISTS budget_alerts(day TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS inbox_dedupe(key TEXT PRIMARY KEY,item_id TEXT NOT NULL,at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS scheduled_runs(name TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(name,day));
