import { useState } from 'react';
import { api } from '../lib/api';
import { Brand, BrandMark } from './Brand';
import { Icon } from './Icon';
export function Pair({ done }: { done: () => void }) {
  const [code, setCode] = useState(''),
    [name, setName] = useState('我的手机'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="pair-layout">
      <div className="pair-top">
        <Brand />
        <span className="mono">PERSONAL AGENT WORKSPACE</span>
      </div>
      <div className="pair-stage">
        <div className="pair-story">
          <span className="eyebrow">
            <span className="status-dot" />
            SELF-HOSTED. ALWAYS YOURS.
          </span>
          <h1>
            Your agents.
            <br />
            <span>Within reach.</span>
          </h1>
          <p>
            少一点来回切换。
            <br />
            多一点，尽在掌握。
          </p>
          <div className="pair-features">
            <span>
              <Icon name="layers" />
              接收成果
            </span>
            <span>
              <Icon name="chat" />
              随时对话
            </span>
            <span>
              <Icon name="shield" />
              掌握决定
            </span>
          </div>
          <div className="pair-terminal">
            <div className="terminal-dots">
              <i />
              <i />
              <i />
              <span>workspace / connect</span>
            </div>
            <code>
              <span>~</span> npm run pair
              <br />
              <b>→</b> Waiting for a trusted device
              <span className="terminal-cursor" />
            </code>
          </div>
        </div>
        <section className="pair-card">
          <div className="pair-icon">
            <BrandMark size={64} />
          </div>
          <span className="eyebrow">WELCOME TO VELADECK</span>
          <h2>连接你的工作台</h2>
          <p className="muted">一个配对码，让进展触手可及。</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              void api('/api/pair/claim', 'POST', { code, device_name: name })
                .then(done)
                .catch((e) => setError(String(e)))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              设备名称
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                autoComplete="off"
              />
            </label>
            <label>
              一次性配对码
              <input
                className="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                maxLength={6}
                required
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="pair-submit" disabled={busy}>
              {busy ? '正在安全连接…' : '连接工作台'}
              <Icon name="arrow" size={17} />
            </button>
          </form>
          <div className="pair-note">
            <Icon name="key" size={16} />
            <span>
              在服务器运行 <code>npm run pair</code>
              <br />
              配对码 5 分钟有效，仅可使用一次。
            </span>
          </div>
          <div className="pair-security">
            <Icon name="shield" size={14} />
            <span>设备认证 · 安全连接 · 由你掌控</span>
          </div>
        </section>
      </div>
      <div className="pair-bottom">
        <span>Built for a little more peace of mind.</span>
        <span>OPEN SOURCE · MIT LICENSE</span>
      </div>
    </div>
  );
}
