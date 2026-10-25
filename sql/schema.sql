-- Agent Dock schema v1 (SQLite, WAL)
-- 单一 schema 来源；迁移文件放 sql/migrations/NNN_*.sql，编号递增，只前滚不修改历史。

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ---------- 设备与会话 ----------
CREATE TABLE IF NOT EXISTS devices (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  token_hash        TEXT NOT NULL UNIQUE,          -- scrypt(token)
  webauthn_cred_id  TEXT,                          -- base64url，可空
  webauthn_pubkey   TEXT,
  counter           INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  last_seen_at      INTEGER,
  revoked_at        INTEGER
);

CREATE TABLE IF NOT EXISTS pair_codes (
  code_hash   TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

-- ---------- 产物 ----------
CREATE TABLE IF NOT EXISTS artifacts (
  id               TEXT PRIMARY KEY,
  project          TEXT NOT NULL,
  kind             TEXT NOT NULL,                  -- markdown|html|pdf|csv|image|log|json|diff|zip
  title            TEXT NOT NULL,
  summary          TEXT,
  path             TEXT NOT NULL,                  -- 相对 DATA_DIR 的文件路径
  bytes            INTEGER NOT NULL DEFAULT 0,
  sha256           TEXT,
  version          INTEGER NOT NULL DEFAULT 1,
  lineage_key      TEXT,                           -- 同源产物版本线
  idempotency_key  TEXT NOT NULL UNIQUE,
  tags             TEXT,                           -- JSON array
  starred          INTEGER NOT NULL DEFAULT 0,
  read_later       INTEGER NOT NULL DEFAULT 0,
  read_progress    REAL NOT NULL DEFAULT 0,        -- 0..1 阅读进度
  retain_until     INTEGER,                        -- NULL + starred=0 时按全局默认
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artifacts_time   ON artifacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_proj   ON artifacts(project, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_kind   ON artifacts(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_lineage ON artifacts(lineage_key, version);

-- 全文检索：title/summary/正文前 64KB（去标签后的纯文本）
CREATE VIRTUAL TABLE IF NOT EXISTS artifact_search USING fts5(
  artifact_id UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- ---------- 对话 ----------
CREATE TABLE IF NOT EXISTS threads (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  project      TEXT,
  backend      TEXT NOT NULL DEFAULT 'dsh',
  pinned       INTEGER NOT NULL DEFAULT 0,
  last_seq     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  role        TEXT NOT NULL,                -- user|agent|tool|system
  content     TEXT NOT NULL,
  meta        TEXT,                         -- JSON：工具名/参数摘要/耗时/token
  created_at  INTEGER NOT NULL,
  UNIQUE (thread_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, seq);

CREATE TABLE IF NOT EXISTS attachments (
  id           TEXT PRIMARY KEY,
  message_id   TEXT REFERENCES messages(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  path         TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

-- ---------- 审批 ----------
CREATE TABLE IF NOT EXISTS approvals (
  id               TEXT PRIMARY KEY,
  thread_id        TEXT REFERENCES threads(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  command_digest   TEXT,                   -- 脱敏后的命令/参数摘要
  risk             TEXT NOT NULL DEFAULT 'normal',  -- normal|danger
  status           TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected|expired
  expires_at       INTEGER,
  decided_by       TEXT,                   -- device id
  decided_at       INTEGER,
  decided_via      TEXT,                   -- webauthn|device_token
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);

-- ---------- 推送 ----------
CREATE TABLE IF NOT EXISTS push_subs (
  id          TEXT PRIMARY KEY,
  device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  ua          TEXT,
  created_at  INTEGER NOT NULL,
  last_ok_at  INTEGER,
  failed_at   INTEGER
);

CREATE TABLE IF NOT EXISTS events (
  id               TEXT PRIMARY KEY,
  type             TEXT NOT NULL,          -- task.done|task.failed|agent.reply|agent.approval|digest
  priority         TEXT NOT NULL,          -- P0..P3
  project          TEXT,
  title            TEXT NOT NULL,
  body             TEXT,
  deep_link        TEXT,
  artifact_id      TEXT,
  thread_id        TEXT,
  actions          TEXT,                   -- JSON array
  idempotency_key  TEXT NOT NULL UNIQUE,
  delivered_via    TEXT,                   -- webpush|wechat|email|none
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_proj ON events(project, created_at DESC);

-- ---------- 分享投递 ----------
CREATE TABLE IF NOT EXISTS inbox_items (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,               -- text|url|image|file
  content     TEXT,
  url         TEXT,
  file_path   TEXT,
  status      TEXT NOT NULL DEFAULT 'new', -- new|converted|archived
  thread_id   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status, created_at DESC);

-- ---------- 只读分享链接 ----------
CREATE TABLE IF NOT EXISTS share_links (
  token       TEXT PRIMARY KEY,            -- 随机 32B base64url
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER,
  hits        INTEGER NOT NULL DEFAULT 0
);

-- ---------- 审计 ----------
CREATE TABLE IF NOT EXISTS audit (
  id         TEXT PRIMARY KEY,
  at         INTEGER NOT NULL,
  device_id  TEXT,
  action     TEXT NOT NULL,                -- approve|reject|rerun|delete|revoke_device|retain|share
  target     TEXT,
  result     TEXT,
  ip         TEXT,
  detail     TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit(at DESC);

-- ---------- 成本与配额 ----------
CREATE TABLE IF NOT EXISTS cost_daily (
  day             TEXT PRIMARY KEY,        -- YYYY-MM-DD（按 TIMEZONE）
  llm_in_tokens   INTEGER NOT NULL DEFAULT 0,
  llm_out_tokens  INTEGER NOT NULL DEFAULT 0,
  llm_cache_hit   INTEGER NOT NULL DEFAULT 0,
  llm_cost_cny    REAL    NOT NULL DEFAULT 0,
  email_sent      INTEGER NOT NULL DEFAULT 0,
  artifacts_bytes INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL
);

-- ---------- 运维快照 ----------
CREATE TABLE IF NOT EXISTS ops_snapshots (
  id          TEXT PRIMARY KEY,
  node        TEXT NOT NULL,               -- gz|sv
  captured_at INTEGER NOT NULL,
  payload     TEXT NOT NULL                -- JSON：cpu/mem/disk/swap/services
);
CREATE INDEX IF NOT EXISTS idx_ops_node ON ops_snapshots(node, captured_at DESC);

-- ---------- 迁移版本 ----------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
