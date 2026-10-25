import { test, expect } from 'vitest';
import { fixture } from './helper.js';
import { Store } from '../src/db/client.js';
test('usage accounting is idempotent, grouped by project and alerts only once per day', async () => {
  const f = await fixture();
  const store = new Store(f.config.DATA_DIR);
  try {
    const cookie = await f.pair();
    const payload = {
      idempotency_key: 'usage:1',
      project: 'research',
      input_tokens: 100,
      output_tokens: 50,
      cost_cny: 4,
    };
    for (let i = 0; i < 2; i++)
      expect(
        (
          await f.app.inject({
            method: 'POST',
            url: '/api/cost/usage',
            headers: f.internal,
            payload,
          })
        ).statusCode,
      ).toBe(200);
    await f.app.inject({
      method: 'POST',
      url: '/api/cost/usage',
      headers: f.internal,
      payload: { ...payload, idempotency_key: 'usage:2', cost_cny: 1 },
    });
    const result = await f.app.inject({ url: '/api/cost/summary', headers: { cookie } });
    expect(result.json().today.llm_cost_cny).toBe(5);
    expect(result.json().projects[0]).toMatchObject({ project: 'research', cost_cny: 5 });
    expect(store.get<{ n: number }>('SELECT count(*) AS n FROM budget_alerts')?.n).toBe(1);
    expect(
      (
        await f.app.inject({
          method: 'POST',
          url: '/api/ops/tasks/arbitrary-shell/run',
          headers: { cookie },
          payload: { confirmed: true, step_up_token: 'x' },
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    store.close();
    await f.cleanup();
  }
});
