import { PageHeading } from '../components/PageHeading';
import { Icon } from '../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, base } from '../lib/api';
import { readEvents } from '../lib/sse';
import { time } from '../lib/time';
interface Thread {
  id: string;
  title: string;
  project: string | null;
  updated_at: number;
  pinned: number;
}
interface Event {
  type: string;
  text?: string;
  seq: number;
  approval_id?: string;
}
export function Threads() {
  const q = useQueryClient();
  const [search, setSearch] = useState(''),
    [error, setError] = useState('');
  const threads = useQuery({
    queryKey: ['threads', search],
    queryFn: () => api<Thread[]>('/api/threads?q=' + encodeURIComponent(search)),
  });
  async function create() {
    try {
      const t = await api<Thread>('/api/threads', 'POST', { title: '新的对话' });
      await q.invalidateQueries({ queryKey: ['threads'] });
      location.assign(base + '/threads/' + t.id);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / CONVERSATIONS"
        title="对话"
        description="把任务交给智能体，随时接续进展。"
      >
        <button onClick={() => void create()}>
          <Icon name="plus" size={15} />
          新对话
        </button>
      </PageHeading>
      <input placeholder="搜索会话…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <div className="error">{error}</div>}
      {threads.data?.map((t) => (
        <div key={t.id} className="card thread-card">
          <Link to={'/threads/' + t.id}>
            <div className="row">
              <h2>
                {t.pinned && <Icon name="star" size={13} />}
                {t.title}
              </h2>
              <span className="muted small">{time(t.updated_at)}</span>
            </div>
            <p className="muted small">{t.project ?? '通用'} · DSH</p>
          </Link>
          <button
            className="chip"
            onClick={() =>
              void api('/api/threads/' + t.id, 'PATCH', { pinned: !t.pinned }).then(() =>
                q.invalidateQueries({ queryKey: ['threads'] }),
              )
            }
          >
            {t.pinned ? '取消置顶' : '置顶'}
          </button>
          <button
            className="chip"
            onClick={() => {
              const name = prompt('会话名称', t.title);
              if (name)
                void api('/api/threads/' + t.id, 'PATCH', { title: name }).then(() =>
                  q.invalidateQueries({ queryKey: ['threads'] }),
                );
            }}
          >
            重命名
          </button>
        </div>
      ))}
      {threads.data?.length === 0 && (
        <div className="empty">暂无会话。发起一个任务，开始与智能体协作。</div>
      )}
    </>
  );
}
export function ThreadDetail() {
  const { id } = useParams();
  const [events, setEvents] = useState<Event[]>([]),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>([]);
  const last = useRef(0),
    connection = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  function receive(event: Event) {
    if (event.seq <= last.current) return;
    last.current = event.seq;
    setEvents((old) => [...old, event]);
    if (event.type === 'done' || event.type === 'error') setBusy(false);
    if (event.type === 'error') setError(event.text ?? '智能体执行失败');
  }
  useEffect(() => {
    let active = true;
    async function connect() {
      try {
        const history: Event[] = [];
        while (true) {
          const batch = await api<Event[]>(
            '/api/threads/' + id + '/messages?after_seq=' + (history.at(-1)?.seq ?? 0),
          );
          history.push(...batch);
          if (batch.length < 1000) break;
        }
        if (!active) return;
        setEvents(history);
        last.current = history.at(-1)?.seq ?? 0;
        setBusy(!!history.length && !['done', 'error'].includes(history.at(-1)!.type));
        const controller = new AbortController();
        connection.current = controller;
        const response = await fetch(
          base + '/api/threads/' + id + '/events?after_seq=' + last.current,
          { signal: controller.signal },
        );
        await readEvents<Event>(response, receive);
      } catch (e) {
        if (active) setError(String(e));
      }
    }
    void connect();
    const reconnect = () => void connect();
    window.addEventListener('online', reconnect);
    return () => {
      active = false;
      connection.current?.abort();
      window.removeEventListener('online', reconnect);
    };
  }, [id]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [events]);
  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    const prompt = text;
    setText('');
    try {
      connection.current?.abort();
      const response = await fetch(base + '/api/threads/' + id + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt, attachments, after_seq: last.current }),
      });
      setAttachments([]);
      await readEvents<Event>(response, receive);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const groups = events.reduce<Event[]>((all, event) => {
    const previous = all.at(-1);
    if (event.type === 'token' && previous?.type === 'token') {
      previous.text = (previous.text ?? '') + (event.text ?? '');
      previous.seq = event.seq;
    } else all.push({ ...event });
    return all;
  }, []);
  return (
    <>
      <Link to="/threads" className="muted small">
        返回对话
      </Link>
      <PageHeading
        eyebrow="CONVERSATIONS / THREAD"
        title="对话"
        description="持久记录每一次交流与执行。"
      />
      <div className="messages">
        {groups
          .filter((e) => !['done'].includes(e.type))
          .map((e) => (
            <div className={'message ' + e.type} key={e.seq}>
              {e.type === 'approval_required' ? (
                <Link to="/approvals">待审批 · 打开审批页处理 →</Link>
              ) : e.type === 'tool_call' || e.type === 'tool_result' ? (
                <details>
                  <summary>{e.type === 'tool_call' ? '工具调用' : '工具结果'}</summary>
                  <pre>{e.text}</pre>
                </details>
              ) : (
                <Markdown remarkPlugins={[remarkGfm]}>{e.text ?? ''}</Markdown>
              )}
            </div>
          ))}
        <div ref={bottom} />
      </div>
      {error && <div className="error">{error}</div>}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          placeholder="给智能体一个任务…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          required
        />
        <div className="row">
          <label className="chip">
            附件
            <input
              className="file-input"
              type="file"
              accept="image/png,image/jpeg,application/pdf,text/plain,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 20 * 1024 * 1024) {
                  setError('附件不能超过 20 MB');
                  return;
                }
                const reader = new FileReader();
                reader.onload = () =>
                  setAttachments([
                    {
                      name: f.name,
                      type: f.type || 'text/plain',
                      data: String(reader.result).split(',')[1],
                    },
                  ]);
                reader.readAsDataURL(f);
              }}
            />
          </label>
          <span className="muted small">{attachments[0]?.name ?? '可使用键盘语音输入'}</span>
          {busy ? (
            <button
              type="button"
              onClick={() =>
                void api('/api/threads/' + id + '/cancel', 'POST', {}).catch((e) =>
                  setError(String(e)),
                )
              }
            >
              停止
            </button>
          ) : (
            <button>发送</button>
          )}
        </div>
      </form>
    </>
  );
}
