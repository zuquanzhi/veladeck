import { Icon } from './Icon';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { enablePush } from '../lib/pwa';
interface Preferences {
  notifications: boolean;
  projects: Record<string, boolean>;
  dnd_start: string;
  dnd_end: string;
  lockscreen_hide: boolean;
  theme: 'system' | 'dark' | 'light';
  retain_days: number;
}
export function Preferences() {
  const q = useQueryClient();
  const data = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api<Preferences>('/api/settings'),
  });
  const [error, setError] = useState('');
  useEffect(() => {
    document.documentElement.dataset.theme = data.data?.theme ?? 'system';
  }, [data.data?.theme]);
  async function set(patch: Partial<Preferences>) {
    try {
      await api('/api/settings', 'PUT', { ...data.data, ...patch });
      await q.invalidateQueries({ queryKey: ['preferences'] });
    } catch (e) {
      setError(String(e));
    }
  }
  if (!data.data) return null;
  const p = data.data;
  return (
    <>
      <section>
        <h2>
          <Icon name="moon" size={17} /> 通知与专注
        </h2>
        {error && <p className="error">{error}</p>}
        <label className="row">
          接收任务通知
          <input
            type="checkbox"
            checked={p.notifications}
            onChange={(e) => void set({ notifications: e.target.checked })}
          />
        </label>
        <label className="row">
          锁屏隐藏内容
          <input
            type="checkbox"
            checked={p.lockscreen_hide}
            onChange={(e) => void set({ lockscreen_hide: e.target.checked })}
          />
        </label>
        <div className="row">
          <label>
            免打扰开始
            <input
              type="time"
              value={p.dnd_start}
              onChange={(e) => void set({ dnd_start: e.target.value })}
            />
          </label>
          <label>
            结束
            <input
              type="time"
              value={p.dnd_end}
              onChange={(e) => void set({ dnd_end: e.target.value })}
            />
          </label>
        </div>
        <button
          onClick={() =>
            void enablePush()
              .then(() => setError('通知订阅已保存，请使用实际任务测试送达。'))
              .catch((e) => setError(String(e)))
          }
        >
          开启推送通知
        </button>
        <p className="muted small">Android Chrome 支持后台通知。iOS 请先添加到主屏幕。</p>
      </section>
      <section>
        <h2>
          <Icon name="settings" size={17} /> 外观与保留
        </h2>
        <label>
          主题
          <select
            aria-label="主题"
            value={p.theme}
            onChange={(e) => void set({ theme: e.target.value as Preferences['theme'] })}
          >
            <option value="system">跟随系统</option>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </label>
        <label>
          默认保留天数
          <input
            type="number"
            min={1}
            max={36500}
            value={p.retain_days}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) void set({ retain_days: n });
            }}
          />
        </label>
      </section>
    </>
  );
}
