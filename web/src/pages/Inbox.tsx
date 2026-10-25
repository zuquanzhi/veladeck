import { PageHeading } from '../components/PageHeading';
import { Icon } from '../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, base } from '../lib/api';
import { time } from '../lib/time';
interface Item {
  id: string;
  kind: string;
  content: string;
  url: string | null;
  status: string;
  created_at: number;
  thread_id: string | null;
}
export function Inbox() {
  const q = useQueryClient();
  const location = useLocation(),
    submitted = useRef(false);
  const [status, setStatus] = useState('new'),
    [text, setText] = useState(''),
    [error, setError] = useState('');
  const data = useQuery({
    queryKey: ['inbox', status],
    queryFn: () => api<Item[]>('/api/inbox?status=' + status),
  });
  useEffect(() => {
    if (location.pathname !== '/share' || submitted.current) return;
    const params = new URLSearchParams(location.search),
      content = [params.get('title'), params.get('text')].filter(Boolean).join('\n'),
      url = params.get('url') ?? undefined;
    if (!content && !url) return;
    submitted.current = true;
    void api('/api/inbox', 'POST', { kind: url ? 'url' : 'text', content, url })
      .then(() => {
        history.replaceState(null, '', base + '/inbox');
        void q.invalidateQueries({ queryKey: ['inbox'] });
      })
      .catch((e) => {
        setError(String(e));
        submitted.current = false;
      });
  }, [location, q]);
  return (
    <>
      <Link to="/" className="muted small">
        返回产物库
      </Link>
      <PageHeading
        eyebrow="WORKSPACE / INBOX"
        title="Inbox"
        description="收集链接与灵感，准备好时再交给智能体。"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void api('/api/inbox', 'POST', { content: text, kind: 'text' })
            .then(() => {
              setText('');
              return q.invalidateQueries({ queryKey: ['inbox'] });
            })
            .catch((e) => setError(String(e)));
        }}
      >
        <textarea
          rows={3}
          placeholder="记下一个想法，或粘贴链接…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <button>
          <Icon name="plus" size={15} />
          加入 Inbox
        </button>
      </form>
      <div className="filters">
        {[
          ['待处理', 'new'],
          ['全部', 'all'],
        ].map(([title, value]) => (
          <button
            key={value}
            className={'chip ' + (value === status ? 'selected' : '')}
            onClick={() => setStatus(value)}
          >
            {title}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {data.data?.map((item) => (
        <section key={item.id}>
          <p>{item.content}</p>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.url} ↗
            </a>
          )}
          <p className="muted small">
            {time(item.created_at)} · {item.status}
          </p>
          {item.status === 'new' ? (
            <div className="row">
              <button
                className="ghost"
                onClick={() =>
                  void api('/api/inbox/' + item.id + '/archive', 'POST', {}).then(() =>
                    q.invalidateQueries({ queryKey: ['inbox'] }),
                  )
                }
              >
                归档
              </button>
              <button
                onClick={() =>
                  void api<{ thread_id: string }>(
                    '/api/inbox/' + item.id + '/to-thread',
                    'POST',
                    {},
                  )
                    .then((t) => locationAssign(t.thread_id))
                    .catch((e) => setError(String(e)))
                }
              >
                转成任务
              </button>
            </div>
          ) : (
            item.thread_id && <Link to={'/threads/' + item.thread_id}>查看任务 ↗</Link>
          )}
        </section>
      ))}
      {data.data?.length === 0 && <div className="empty">Inbox 已清空。新的分享会出现在这里。</div>}
    </>
  );
}
function locationAssign(thread: string) {
  window.location.assign(base + '/threads/' + thread);
}
