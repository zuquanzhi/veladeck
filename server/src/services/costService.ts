import { z } from 'zod';
import type { Store } from '../db/client.js';
import type { Config } from '../config.js';
import type { PushService } from './pushService.js';
import { id, audit } from '../lib/security.js';
export const usageInput = z.object({
  idempotency_key: z.string().min(1).max(200),
  project: z.string().min(1).max(64),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_hit: z.number().int().nonnegative().default(0),
  cost_cny: z.number().finite().nonnegative(),
});
export class CostService {
  balanceCache: { at: number; value: unknown } | null = null;
  constructor(
    public store: Store,
    public config: Config,
    public push: PushService,
  ) {
    store.tables(['cost_daily']);
  }
  day() {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.config.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
  async record(value: unknown) {
    const b = usageInput.parse(value),
      day = this.day();
    if (this.store.get('SELECT id FROM usage_entries WHERE idempotency_key=?', b.idempotency_key))
      return { deduped: true };
    this.store.db.transaction(() => {
      this.store.run(
        'INSERT INTO usage_entries VALUES(?,?,?,?,?,?,?,?)',
        id(),
        b.idempotency_key,
        day,
        b.project,
        b.input_tokens,
        b.output_tokens,
        b.cache_hit,
        b.cost_cny,
      );
      this.store.run(
        'INSERT INTO cost_daily(day,llm_in_tokens,llm_out_tokens,llm_cache_hit,llm_cost_cny,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET llm_in_tokens=llm_in_tokens+excluded.llm_in_tokens,llm_out_tokens=llm_out_tokens+excluded.llm_out_tokens,llm_cache_hit=llm_cache_hit+excluded.llm_cache_hit,llm_cost_cny=llm_cost_cny+excluded.llm_cost_cny,updated_at=excluded.updated_at',
        day,
        b.input_tokens,
        b.output_tokens,
        b.cache_hit,
        b.cost_cny,
        Date.now(),
      );
      audit(this.store, 'record_usage', b.idempotency_key);
    })();
    const total = this.store.get<{ cost: number }>(
      'SELECT llm_cost_cny AS cost FROM cost_daily WHERE day=?',
      day,
    )!.cost;
    if (
      total > this.config.DAILY_BUDGET_CNY &&
      this.store.run('INSERT OR IGNORE INTO budget_alerts VALUES(?)', day).changes
    )
      await this.push.notify({
        type: 'budget.exceeded',
        priority: 'P1',
        title: '今日预算已超出',
        body: '请打开成本面板查看。',
        deep_link: '/ops',
        idempotency_key: 'budget:' + day,
      });
    return { deduped: false };
  }
  async balance() {
    if (!this.config.DEEPSEEK_API_KEY)
      return { available: false, reason: '未配置 DeepSeek API key', value: null };
    if (this.balanceCache && Date.now() - this.balanceCache.at < 1800000)
      return this.balanceCache.value;
    try {
      const response = await fetch('https://api.deepseek.com/user/balance', {
        headers: { Authorization: 'Bearer ' + this.config.DEEPSEEK_API_KEY },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error();
      const parsed = z
        .object({
          is_available: z.boolean(),
          balance_infos: z.array(z.object({ currency: z.string(), total_balance: z.string() })),
        })
        .parse(await response.json());
      const value = { available: true, ...parsed };
      this.balanceCache = { at: Date.now(), value };
      return value;
    } catch {
      return { available: false, reason: '余额查询失败', value: null };
    }
  }
  async summary() {
    const day = this.day();
    return {
      day,
      budget_cny: this.config.DAILY_BUDGET_CNY,
      today: this.store.get('SELECT * FROM cost_daily WHERE day=?', day) ?? null,
      history: this.store.all('SELECT day,llm_cost_cny FROM cost_daily ORDER BY day DESC LIMIT 14'),
      projects: this.store.all(
        'SELECT project,sum(cost_cny) AS cost_cny FROM usage_entries WHERE day=? GROUP BY project ORDER BY cost_cny DESC LIMIT 5',
        day,
      ),
      disk: this.store.get(
        'SELECT count(*) AS artifacts,coalesce(sum(bytes),0) AS bytes,coalesce(sum(CASE WHEN starred=0 AND retain_until<? THEN bytes ELSE 0 END),0) AS releasable FROM artifacts',
        Date.now(),
      ),
      balance: await this.balance(),
      email: { available: false, reason: '邮箱配额适配器尚未连接', used: null, limit: null },
    };
  }
}
