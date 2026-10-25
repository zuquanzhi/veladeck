import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startRegistration } from '@simplewebauthn/browser';
import { api, type Session } from '../lib/api';
import { Preferences } from '../components/Preferences';
interface Device {
  id: string;
  name: string;
  revoked_at: number | null;
  last_seen_at: number | null;
}
export function Settings({ session }: { session: Session }) {
  const query = useQueryClient();
  const [error, setError] = useState('');
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api<Device[]>('/api/devices') });
  async function passkey() {
    try {
      const options = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>(
        '/api/auth/webauthn/register/options',
        'POST',
      );
      const response = await startRegistration({ optionsJSON: options });
      await api('/api/auth/webauthn/register/verify', 'POST', { response });
      await query.invalidateQueries({ queryKey: ['session'] });
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      <h1>设置</h1>
      <p className="muted">让工作台适合你的节奏。</p>
      {error && <div className="error">{error}</div>}
      <Preferences />
      <section>
        <h2>安全与设备</h2>
        <p>当前设备 · {session.name}</p>
        <button onClick={() => void passkey()}>
          {session.passkey ? '重新注册通行密钥' : '注册通行密钥'}
        </button>
        <p className="muted">危险操作需要指纹、面容或设备 PIN 验证。</p>
        {devices.data
          ?.filter((d) => !d.revoked_at)
          .map((d) => (
            <div className="row" key={d.id}>
              <span>{d.name}</span>
              <button
                className="ghost"
                onClick={() => {
                  if (confirm('撤销此设备？'))
                    void api('/api/devices/' + d.id, 'DELETE').then(() =>
                      query.invalidateQueries(),
                    );
                }}
              >
                撤销
              </button>
            </div>
          ))}
      </section>
      <button
        className="ghost"
        onClick={() => void api('/api/logout', 'POST').then(() => location.reload())}
      >
        退出登录
      </button>
    </>
  );
}
