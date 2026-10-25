import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, base, type Session } from './lib/api';
import { Pair } from './components/Pair';
import { Brand, BrandMark } from './components/Brand';
import { Icon } from './components/Icon';
import { Settings } from './pages/Settings';
import { Artifacts, ArtifactDetail } from './pages/Artifacts';
import { registerPWA } from './lib/pwa';
import { Threads, ThreadDetail } from './pages/Threads';
import { Approvals } from './pages/Approvals';
import { Ops } from './pages/Ops';
import { Inbox } from './pages/Inbox';
import './style.css';
const tabs = [
  ['/', 'layers', '产物', 'Workspace'],
  ['/threads', 'chat', '对话', 'Conversations'],
  ['/approvals', 'shield', '审批', 'Approvals'],
  ['/ops', 'activity', '运维', 'Operations'],
  ['/settings', 'settings', '设置', 'Preferences'],
];
registerPWA();
function Workspace({ session }: { session: Session }) {
  const location = useLocation(),
    navigate = useNavigate();
  const preferences = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api<{ theme: string }>('/api/settings'),
  });
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.data?.theme ?? 'system';
  }, [preferences.data?.theme]);
  function search() {
    if (location.pathname !== '/') navigate('/');
    setTimeout(
      () => document.querySelector<HTMLInputElement>('[data-global-search]')?.focus(),
      120,
    );
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const active = tabs.find(([path]) =>
    path === '/'
      ? location.pathname === '/' || location.pathname.startsWith('/artifacts')
      : location.pathname.startsWith(path),
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" aria-label="VelaDeck 首页">
          <Brand />
        </Link>
        <div className="workspace-id">
          <span className="workspace-avatar">P</span>
          <span>
            Personal workspace<small>自托管工作空间</small>
          </span>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="桌面主导航">
          {tabs.map(([path, icon, title, english]) => (
            <NavLink key={path} to={path} end={path === '/'}>
              <Icon name={icon} />
              <span>{title}</span>
              <small>{english}</small>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="connection">
            <span className="status-dot" />
            服务已连接
          </span>
          <span className="mono">VELADECK / PERSONAL</span>
          <a href="https://github.com/zuquanzhi/veladeck" target="_blank" rel="noreferrer">
            View on GitHub <Icon name="external" size={13} />
          </a>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <Link className="mobile-brand" to="/" aria-label="VelaDeck 首页">
            <Brand compact />
          </Link>
          <div className="breadcrumbs">
            <span>Personal</span>
            <span>/</span>
            <b>{active?.[3] ?? 'Inbox'}</b>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={search} aria-label="全局搜索">
              <Icon name="search" size={17} />
              <span>搜索工作台</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="device-avatar" title={session.name}>
              {session.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main-content">
          <Routes>
            <Route path="/" element={<Artifacts />} />
            <Route path="/artifacts/:id" element={<ArtifactDetail />} />
            <Route path="/threads" element={<Threads />} />
            <Route path="/threads/:id" element={<ThreadDetail />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/ops" element={<Ops />} />
            <Route path="/settings" element={<Settings session={session} />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/share" element={<Inbox />} />
          </Routes>
          <footer className="workspace-footer">
            <span>VelaDeck</span>
            <span>YOUR AGENTS. WITHIN REACH.</span>
            <span className="footer-lock">
              <Icon name="shield" size={12} />
              Private by design
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="手机主导航">
        {tabs.map(([path, icon, title]) => (
          <NavLink key={path} to={path} end={path === '/'}>
            <Icon name={icon} size={21} />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
function App() {
  const q = useQueryClient();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<Session>('/api/session'),
    retry: false,
  });
  if (session.isPending)
    return (
      <div className="boot-state">
        <BrandMark size={54} />
        <span className="mono">
          CONNECTING TO WORKSPACE<span className="loading-dots">...</span>
        </span>
      </div>
    );
  if (session.error)
    return session.error instanceof ApiError && session.error.status === 401 ? (
      <Pair done={() => void q.invalidateQueries()} />
    ) : (
      <div className="boot-state">
        <BrandMark size={54} />
        <h2>暂时无法连接</h2>
        <p className="muted">请检查服务地址与网络连接。</p>
        <button onClick={() => void session.refetch()}>
          <Icon name="refresh" size={16} />
          重新连接
        </button>
      </div>
    );
  return <Workspace session={session.data} />;
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter basename={base || '/'}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
