import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from './Icon';
export function Digest({ total }: { total?: number }) {
  const { data } = useQuery({
    queryKey: ['digest'],
    queryFn: () =>
      api<{ day: string; artifacts: number; pending_approvals: number; inbox: number }>(
        '/api/digest/today',
      ),
  });
  const stats = [
    {
      label: '产物总数',
      value: total,
      icon: 'layers',
      note: data ? `近 24 小时 +${data.artifacts}` : '等待同步',
      path: '/',
    },
    {
      label: '等待审批',
      value: data?.pending_approvals,
      icon: 'shield',
      note: '每个重要决定，由你掌握',
      path: '/approvals',
    },
    {
      label: 'Inbox',
      value: data?.inbox,
      icon: 'inbox',
      note: '灵感与链接，随时收集',
      path: '/inbox',
    },
  ];
  return (
    <div className="stats-grid">
      {stats.map((s, i) => (
        <Link className={'stat-card ' + (i === 0 ? 'stat-primary' : '')} to={s.path} key={s.label}>
          <div className="stat-top">
            <span>{s.label}</span>
            <Icon name={s.icon} size={18} />
          </div>
          <div className="stat-value">
            {s.value ?? '—'}
            <Icon name="external" size={16} />
          </div>
          <span className="stat-note">
            {i === 0 && <span className="status-dot" />}
            {s.note}
          </span>
        </Link>
      ))}
    </div>
  );
}
