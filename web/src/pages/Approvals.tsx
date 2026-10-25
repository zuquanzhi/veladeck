import { PageHeading } from '../components/PageHeading';
import { Icon } from '../components/Icon';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { time } from '../lib/time';
import { stepUp } from '../lib/passkey';
interface Approval {
  id: string;
  title: string;
  thread_id: string;
  risk: 'normal' | 'danger';
  status: string;
  command_digest: string;
  expires_at: number;
  created_at: number;
}
export function Approvals() {
  const q = useQueryClient();
  const [status, setStatus] = useState('pending'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const data = useQuery({
    queryKey: ['approvals', status],
    queryFn: () => api<Approval[]>('/api/approvals?status=' + status),
    refetchInterval: 15000,
  });
  async function decide(a: Approval, decision: 'approve' | 'reject', batch = false) {
    if (
      !batch &&
      !confirm(decision === 'reject' ? '拒绝此操作？' : '确认允许此操作？请核对参数摘要。')
    )
      return;
    setBusy(a.id);
    setError('');
    try {
      const proof =
        decision === 'approve' && a.risk === 'danger' ? await stepUp('approve:' + a.id) : undefined;
      await api('/api/approvals/' + a.id + '/' + decision, 'POST', {
        confirmed: true,
        step_up_token: proof,
      });
      await q.invalidateQueries();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy('');
    }
  }
  async function batch() {
    const normal = data.data?.filter((a) => a.risk === 'normal' && a.status === 'pending') ?? [];
    if (!normal.length || !confirm(`批准这 ${normal.length} 项常规操作？`)) return;
    for (const a of normal) await decide(a, 'approve', true);
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / APPROVALS"
        title="审批"
        description="重要的决定，始终留在你手中。"
      />
      <div className="filters">
        {[
          ['待处理', 'pending'],
          ['全部历史', 'all'],
        ].map(([name, key]) => (
          <button
            className={'chip ' + (status === key ? 'selected' : '')}
            key={key}
            onClick={() => setStatus(key)}
          >
            {name}
          </button>
        ))}
        {status === 'pending' && (
          <button className="chip" onClick={() => void batch()}>
            批准全部常规项
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {data.error && <div className="error">{String(data.error)}</div>}
      {data.data?.map((a) => (
        <section key={a.id} className={a.risk === 'danger' ? 'danger' : ''}>
          <div className="row">
            <span className="pill">
              <Icon name="shield" size={12} />
              {a.risk === 'danger' ? '危险操作' : '常规操作'}
            </span>
            <span className="muted small">{a.status}</span>
          </div>
          <h2>{a.title}</h2>
          <pre>{a.command_digest}</pre>
          <p className="muted small">
            {time(a.created_at)} · 有效至 {time(a.expires_at)}
          </p>
          <Link className="small" to={'/threads/' + a.thread_id}>
            查看来源对话 ↗
          </Link>
          {a.status === 'pending' && (
            <div className="row">
              <button className="ghost" disabled={!!busy} onClick={() => void decide(a, 'reject')}>
                拒绝
              </button>
              <button disabled={!!busy} onClick={() => void decide(a, 'approve')}>
                {busy === a.id ? '正在处理…' : a.risk === 'danger' ? '验证并批准' : '同意执行'}
              </button>
            </div>
          )}
        </section>
      ))}
      {data.data?.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="shield" size={27} />
          </div>
          <h2>暂无待处理审批</h2>
          <p>新的审批请求会自动出现在这里。</p>
        </div>
      )}
    </>
  );
}
