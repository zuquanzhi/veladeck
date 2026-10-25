import { z } from 'zod';
import { resolve } from 'node:path';
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8090),
  DATA_DIR: z.string().default('./data'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:8090'),
  TIMEZONE: z.string().default('Asia/Shanghai'),
  INGEST_TOKEN: z.string().default(''),
  PAIR_CODE_TTL_SEC: z.coerce.number().default(300),
  SESSION_DAYS: z.coerce.number().default(30),
  DSH_CMD: z.string().default('dsh'),
  DSH_ARGS: z.string().default('["--profile","headless"]'),
  DSH_TIMEOUT_SEC: z.coerce.number().default(900),
  DEFAULT_RETAIN_DAYS: z.coerce.number().default(90),
  DAILY_BUDGET_CNY: z.coerce.number().default(3),
});
const features = z.object({
  DEEPSEEK_API_KEY: z.string().default(''),
  DAILY_DIGEST_AT: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('08:30'),
  RETAIN_DAYS_LOG: z.coerce.number().int().positive().default(7),
  RETAIN_DAYS_IMAGE: z.coerce.number().int().positive().default(30),
  ARTIFACT_SCAN_DIRS: z.string().default(''),
  DISK_WARN_PCT: z.coerce.number().min(1).max(100).default(85),
  PUSH_DEGRADE_CHAIN: z
    .string()
    .regex(/^(webpush|email|wechat)(,(webpush|email|wechat))*$/)
    .default('webpush,email'),
  EMAIL_NOTIFY_BIN: z.string().default(''),
  WECHAT_NOTIFY_BIN: z.string().default(''),
});
export type Config = z.infer<typeof schema> & z.infer<typeof features>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = schema.parse(env);
  return { ...c, ...features.parse(env), DATA_DIR: resolve(c.DATA_DIR) };
}
