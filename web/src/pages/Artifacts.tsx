import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, base } from '../lib/api';
import { time } from '../lib/time';
import { stepUp } from '../lib/passkey';
import { Digest } from '../components/Digest';
import { Icon } from '../components/Icon';
export interface Artifact {
  id: string;
  title: string;
  summary: string;
  project: string;
  kind: string;
  bytes: number;
  created_at: number;
  updated_at: number;
  starred: number;
  read_later: number;
  version: number;
  read_progress: number;
}
export function Artifacts() {
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState(''),
    [project, setProject] = useState(''),
    [view, setView] = useState('grid'),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false);
  const navigate = useNavigate(),
    q = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const data = useInfiniteQuery({
    queryKey: ['artifacts', query, filter, project],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<{ items: Artifact[]; total: number; page: number; size: number }>(
        `/api/artifacts?page=${pageParam}&q=${encodeURIComponent(query)}${filter}&project=${encodeURIComponent(project)}`,
      ),
    getNextPageParam: (last) => (last.page * last.size < last.total ? last.page + 1 : undefined),
  });
  async function create() {
    setCreating(true);
    try {
      const thread = await api<{ id: string }>('/api/threads', 'POST', { title: '新的对话' });
      await q.invalidateQueries({ queryKey: ['threads'] });
      navigate('/threads/' + thread.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }
  const total = data.data?.pages[0].total;
  const kinds: Record<string, string> = {
    markdown: 'file',
    html: 'code',
    csv: 'table',
    image: 'image',
    json: 'code',
    log: 'terminal',
    diff: 'code',
    pdf: 'file',
  };
  const filters = [
    ['全部文件', '', 'layers'],
    ['星标', '&starred=true', 'star'],
    ['稍后读', '&read_later=true', 'clock'],
    ['报告', '&kind=markdown', 'file'],
    ['数据', '&kind=csv', 'table'],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE / OVERVIEW</p>
          <h1>
            工作台<span className="heading-dot">.</span>
          </h1>
          <p className="muted">从一条指令，到每一次完成。</p>
        </div>
        <div className="page-actions">
          <Link to="/inbox" className="button secondary">
            <Icon name="inbox" size={15} />
            Inbox
          </Link>
          <button onClick={() => void create()} disabled={creating}>
            <Icon name="plus" size={15} />
            <span>{creating ? '正在创建…' : '新对话'}</span>
          </button>
        </div>
      </div>
      <Digest total={total} />
      <div className="library-toolbar">
        <div className="search-field">
          <Icon name="search" size={17} />
          <input
            data-global-search
            aria-label="搜索产物"
            placeholder="搜索产物、项目或关键词…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="project-field">
          <input
            aria-label="项目筛选"
            placeholder="按项目筛选"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
        </div>
        <div className="view-toggle">
          <button
            className={'icon-button ' + (view === 'grid' ? 'active' : '')}
            aria-label="卡片视图"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
          >
            <Icon name="layers" size={16} />
          </button>
          <button
            className={'icon-button ' + (view === 'list' ? 'active' : '')}
            aria-label="列表视图"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <Icon name="file" size={16} />
          </button>
        </div>
      </div>
      <div className="filters">
        {filters.map(([name, value, icon]) => (
          <button
            key={name}
            className={'chip ' + (filter === value ? 'selected' : '')}
            onClick={() => setFilter(value)}
          >
            <Icon name={icon} size={14} />
            {name}
          </button>
        ))}
      </div>
      <div className="library-heading">
        <h2>最近产物</h2>
        <div className="library-sort">
          <span>
            {total === undefined ? 'SYNCING' : String(total).padStart(2, '0') + ' FILES'} / LATEST
            FIRST
          </span>
          <button className="icon-button" aria-label="刷新产物" onClick={() => void data.refetch()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>
      {(data.error || error) && <div className="error">{error || String(data.error)}</div>}
      <div className={'artifact-grid ' + (view === 'list' ? 'list-view' : '')}>
        {data.data?.pages
          .flatMap((p) => p.items)
          .map((a) => (
            <Link to={'/artifacts/' + a.id} className="artifact" key={a.id}>
              <div className="artifact-head">
                <span className={'artifact-type kind-' + a.kind}>
                  <Icon name={kinds[a.kind] ?? 'file'} size={21} />
                </span>
                <div className="artifact-badges">
                  {!!a.starred && <Icon name="star" size={13} />}
                  <span className="artifact-version">v{a.version}</span>
                </div>
              </div>
              <h2>{a.title}</h2>
              <p className="artifact-summary">{a.summary || '查看产物详情与内容。'}</p>
              <div className="artifact-metadata">
                <span>{a.kind.toUpperCase()}</span>
                <i>/</i>
                <span>{a.bytes < 1024 ? a.bytes + ' B' : (a.bytes / 1024).toFixed(1) + ' KB'}</span>
                <i>/</i>
                <span>{a.id.slice(0, 7)}</span>
              </div>
              <div className="artifact-footer">
                <span className="artifact-project">
                  <Icon name="folder" size={12} />
                  {a.project}
                </span>
                <time>{time(a.updated_at)}</time>
                <Icon name="external" size={13} />
              </div>
            </Link>
          ))}
      </div>
      {!data.isPending && !data.data?.pages[0].items.length && (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="layers" size={26} />
          </div>
          <h2>等待第一份产物</h2>
          <p>报告、网页和数据，会在这里有序汇集。</p>
        </div>
      )}
      {data.hasNextPage && (
        <button className="ghost load-more" onClick={() => void data.fetchNextPage()}>
          加载更多
          <Icon name="chevron" size={15} />
        </button>
      )}
    </>
  );
}

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function Preview({ artifact, text }: { artifact: Artifact; text: string }) {
  const [page, setPage] = useState(0);
  if (artifact.kind === 'html')
    return (
      <iframe
        title={artifact.title}
        sandbox="allow-same-origin allow-popups"
        src={base + '/api/artifacts/' + artifact.id + '/preview'}
      />
    );
  if (artifact.kind === 'image')
    return (
      <img
        className="preview-image"
        alt={artifact.title}
        src={base + '/api/artifacts/' + artifact.id + '/content'}
      />
    );
  if (artifact.kind === 'pdf')
    return (
      <a className="button" href={base + '/api/artifacts/' + artifact.id + '/download'}>
        下载并使用 PDF 阅读器打开 ↗
      </a>
    );
  if (artifact.kind === 'markdown')
    return (
      <div className="prose">
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      </div>
    );
  if (artifact.kind === 'csv') {
    const rows = csvRows(text);
    return (
      <>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {rows[0]?.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1 + page * 100, 101 + page * 100).map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <button className="ghost" disabled={!page} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil((rows.length - 1) / 100))}
          </span>
          <button
            className="ghost"
            disabled={(page + 1) * 100 >= rows.length - 1}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      </>
    );
  }
  return <pre>{text}</pre>;
}
export function ArtifactDetail() {
  const { id } = useParams(),
    q = useQueryClient();
  const [error, setError] = useState(''),
    [diff, setDiff] = useState(''),
    [share, setShare] = useState('');
  const started = useRef(false);
  const data = useQuery({
    queryKey: ['artifact', id],
    queryFn: () => api<Artifact>('/api/artifacts/' + id),
  });
  const content = useQuery({
    queryKey: ['content', id, data.data?.version],
    queryFn: async () => {
      const r = await fetch(base + '/api/artifacts/' + id + '/content');
      if (!r.ok) throw Error('无法读取产物');
      return r.text();
    },
    enabled: !!data.data && !['image', 'pdf', 'zip'].includes(data.data.kind),
  });
  useEffect(() => {
    if (data.data && !started.current) {
      started.current = true;
      requestAnimationFrame(() =>
        window.scrollTo(
          0,
          data.data!.read_progress *
            Math.max(0, document.documentElement.scrollHeight - innerHeight),
        ),
      );
    }
  }, [data.data]);
  useEffect(() => {
    const onScroll = () => {
      const progress = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
      void api('/api/artifacts/' + id + '/progress', 'POST', {
        value: Math.min(1, Math.max(0, progress)),
      }).catch(() => {});
    };
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(onScroll, 1000);
    };
    window.addEventListener('scroll', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handler);
    };
  }, [id]);
  async function action(name: string, body: unknown) {
    try {
      await api('/api/artifacts/' + id + '/' + name, 'POST', body);
      await q.invalidateQueries();
    } catch (e) {
      setError(String(e));
    }
  }
  if (data.error) return <div className="error">{String(data.error)}</div>;
  if (!data.data) return <div className="empty">正在读取…</div>;
  const a = data.data;
  return (
    <>
      <Link to="/" className="muted small">
        返回产物库
      </Link>
      <h1>{a.title}</h1>
      <p className="muted">
        {a.project} · {time(a.updated_at)} · v{a.version}
      </p>
      <div className="filters">
        <button className="chip" onClick={() => void action('star', { value: !a.starred })}>
          <Icon name="star" size={14} />
          {a.starred ? '已星标' : '星标'}
        </button>
        <button
          className="chip"
          onClick={() => void action('read-later', { value: !a.read_later })}
        >
          <Icon name="clock" size={14} />
          {a.read_later ? '已加入稍后读' : '稍后读'}
        </button>
        <a className="chip" href={base + '/api/artifacts/' + id + '/download'}>
          下载
        </a>
        <button
          className="chip"
          onClick={() =>
            void api<{ url: string }>('/api/artifacts/' + id + '/share', 'POST', {})
              .then((r) => setShare(r.url))
              .catch((e) => setError(String(e)))
          }
        >
          分享
        </button>
        {a.version > 1 && (
          <button
            className="chip"
            onClick={() =>
              void api<{ diff: string }>('/api/artifacts/' + id + '/diff?vs=' + (a.version - 1))
                .then((r) => setDiff(r.diff))
                .catch((e) => setError(String(e)))
            }
          >
            版本对比
          </button>
        )}
        <button
          className="chip"
          onClick={() => {
            if (confirm('删除此产物及历史版本？需设备验证。'))
              void stepUp('delete:' + id)
                .then((step_up_token) => api('/api/artifacts/' + id, 'DELETE', { step_up_token }))
                .then(() => location.assign(base + '/'))
                .catch((e) => setError(String(e)));
          }}
        >
          删除
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {share && (
        <section>
          <p>只读分享链接（7 天有效）</p>
          <a href={share}>{share}</a>
          <button
            className="ghost"
            onClick={() =>
              void api('/api/artifacts/' + id + '/share', 'DELETE').then(() => setShare(''))
            }
          >
            撤销
          </button>
        </section>
      )}
      {diff && (
        <section>
          <pre>{diff}</pre>
          <button onClick={() => setDiff('')}>关闭对比</button>
        </section>
      )}
      <section>
        <Preview artifact={a} text={content.data ?? ''} />
      </section>
    </>
  );
}
