import { PageHeading } from '../components/PageHeading';
import { Icon } from '../components/Icon';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { stepUp } from '../lib/passkey';
import { time } from '../lib/time';
interface Node {
  node: string;
  available: boolean;
  reason?: string;
  memory_used?: number;
  memory_total?: number;
  disk_free?: number;
  disk_total?: number;
  uptime?: number;
  cpu_busy_since_boot_pct?: number;
  services?: Record<string, string>;
  at?: number;
  summary?: string;
}
interface Costs {
  day: string;
  budget_cny: number;
  today: { llm_cost_cny: number; llm_in_tokens: number; llm_out_tokens: number } | null;
  balance: {
    available: boolean;
    reason?: string;
    balance_infos?: { currency: string; total_balance: string }[];
  };
  email: { available: boolean; reason: string };
  disk: { bytes: number; artifacts: number; releasable: number };
  history: { day: string; llm_cost_cny: number }[];
  projects: { project: string; cost_cny: number }[];
}
interface Event {
  id: string;
  title: string;
  priority: string;
  delivered_via: string;
  created_at: number;
}
const gb = (n: number) => (n / 1024 ** 3).toFixed(1) + ' GB';
export function Ops() {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const status = useQuery({
    queryKey: ['ops'],
    queryFn: () => api<{ nodes: Node[] }>('/api/ops/status'),
    refetchInterval: 300000,
  });
  const cost = useQuery({ queryKey: ['cost'], queryFn: () => api<Costs>('/api/cost/summary') });
  const tasks = useQuery({
    queryKey: ['tasks'],
    queryFn: () =>
      api<{
        available: boolean;
        reason?: string;
        items: { name: string; ActiveState?: string; Result?: string }[];
      }>('/api/ops/tasks'),
  });
  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => api<Event[]>('/api/notify/events'),
  });
  async function run(name: string) {
    if (!confirm('确认执行此任务？执行可能消耗资源，需设备验证。')) return;
    setBusy(true);
    try {
      const step_up_token = await stepUp('run:' + name);
      await api('/api/ops/tasks/' + name + '/run', 'POST', { confirmed: true, step_up_token });
      await tasks.refetch();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const c = cost.data;
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / OPERATIONS"
        title="运行概览"
        description="节点、任务与成本，一目了然。"
      />
      {error && <div className="error">{error}</div>}
      {status.error && <div className="error">{String(status.error)}</div>}
      <div className="grid">
        {status.data?.nodes.map((n) => (
          <section key={n.node}>
            <div className="row">
              <h2>{n.node}</h2>
              <span className="pill">
                {n.available && <span className="status-dot" />}
                {n.available ? '已连接' : '未连接'}
              </span>
            </div>
            {n.available ? (
              <>
                <p className="muted small">{n.at ? time(n.at) : ''}</p>
                {n.memory_total && (
                  <>
                    <p>
                      内存 · {gb(n.memory_used!)} / {gb(n.memory_total)}
                    </p>
                    <progress max={n.memory_total} value={n.memory_used} />
                    <p>
                      磁盘可用 · {gb(n.disk_free!)} / {gb(n.disk_total!)}
                    </p>
                    <progress max={n.disk_total} value={n.disk_total! - n.disk_free!} />
                    <p className="muted small">
                      运行时长 {(n.uptime! / 3600).toFixed(1)} 小时 · CPU 开机累计忙碌占比{' '}
                      {n.cpu_busy_since_boot_pct}%
                    </p>
                  </>
                )}
                {n.summary && <pre>{n.summary}</pre>}
                {Object.entries(n.services ?? {}).map(([name, value]) => (
                  <div className="row small" key={name}>
                    <span>{name}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </>
            ) : (
              <p className="muted">{n.reason}</p>
            )}
          </section>
        ))}
      </div>
      {c && (
        <section>
          <div className="row">
            <h2>
              <Icon name="activity" size={17} /> 今日成本与配额
            </h2>
            <span className="muted small">{c.day}</span>
          </div>
          <strong className="cost">
            {c.today ? '¥' + c.today.llm_cost_cny.toFixed(2) : '暂无用量'}
          </strong>
          <p className="muted small">每日预算 ¥{c.budget_cny} · 仅统计已上报用量</p>
          <progress max={c.budget_cny} value={c.today?.llm_cost_cny ?? 0} />
          <p className="small">
            输入 {c.today?.llm_in_tokens ?? '—'} / 输出 {c.today?.llm_out_tokens ?? '—'} tokens
          </p>
          <p>
            余额 ·{' '}
            {c.balance.available
              ? c.balance.balance_infos?.map((b) => b.total_balance + ' ' + b.currency).join(' / ')
              : c.balance.reason}
          </p>
          <p className="muted small">邮箱 · {c.email.reason}</p>
          <p>
            产物 {c.disk.artifacts} 份 · {gb(c.disk.bytes)} · 可清理 {gb(c.disk.releasable)}
          </p>
          <h2>近 14 个有记录的日期</h2>
          {c.history.length ? (
            c.history.map((d) => (
              <div className="row small" key={d.day}>
                <span>{d.day}</span>
                <meter
                  min={0}
                  max={Math.max(c.budget_cny, ...c.history.map((d) => d.llm_cost_cny))}
                  value={d.llm_cost_cny}
                />
                <span>¥{d.llm_cost_cny.toFixed(2)}</span>
              </div>
            ))
          ) : (
            <p className="muted small">任务上报用量后展示趋势。</p>
          )}
          {c.projects.map((p) => (
            <div key={p.project} className="row small">
              <span>{p.project}</span>
              <span>¥{p.cost_cny.toFixed(2)}</span>
            </div>
          ))}
        </section>
      )}
      <section>
        <h2>定时任务</h2>
        {!tasks.data?.available ? (
          <p className="muted">{tasks.data?.reason ?? '正在读取…'}</p>
        ) : (
          tasks.data.items.map((t) => (
            <div className="row" key={t.name}>
              <div>
                <b>{t.name}</b>
                <p className="muted small">
                  {t.ActiveState} · {t.Result}
                </p>
              </div>
              <button className="ghost" disabled={busy} onClick={() => void run(t.name)}>
                重跑
              </button>
            </div>
          ))
        )}
      </section>
      <section>
        <h2>最近进展</h2>
        {events.data?.map((e) => (
          <div className="row" key={e.id}>
            <div>
              <span className="pill">{e.priority}</span> {e.title}
              <p className="muted small">{time(e.created_at)}</p>
            </div>
            <span className="muted small">
              {e.delivered_via === 'none' ? '未推送' : e.delivered_via}
            </span>
          </div>
        ))}
        {events.data?.length === 0 && <p className="muted">暂无通知事件。</p>}
      </section>
    </>
  );
}
