import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Store } from '../db/client.js';
import type { Config } from '../config.js';
import type { ArtifactStore } from './artifactStore.js';
import type { AgentBridge } from './agentBridge.js';
import { secret, digest, id, audit } from '../lib/security.js';
import { fail } from '../lib/errors.js';
export const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
interface Link {
  artifact_id: string;
  expires_at: number;
  revoked_at: number | null;
}
interface Inbox {
  id: string;
  kind: string;
  content: string | null;
  url: string | null;
  status: string;
  thread_id: string | null;
}
export class Sharing {
  constructor(
    public store: Store,
    public config: Config,
    public artifacts: ArtifactStore,
    public bridge: AgentBridge,
  ) {
    store.tables(['share_links', 'inbox_items']);
  }
  share(artifact: string, device: string) {
    this.artifacts.get(artifact);
    const token = secret();
    this.store.run(
      'INSERT INTO share_links(token,artifact_id,created_at,expires_at) VALUES(?,?,?,?)',
      digest(token),
      artifact,
      Date.now(),
      Date.now() + 7 * 86400000,
    );
    audit(this.store, 'share', artifact, device);
    return {
      url: this.config.PUBLIC_BASE_URL.replace(/\/$/, '') + '/s/' + token,
      expires_at: Date.now() + 7 * 86400000,
    };
  }
  lookup(token: string) {
    const row = this.store.get<Link>('SELECT * FROM share_links WHERE token=?', digest(token));
    if (!row || row.revoked_at || row.expires_at < Date.now())
      fail(404, 'NOT_FOUND', '分享链接不存在或已失效。');
    this.store.run('UPDATE share_links SET hits=hits+1 WHERE token=?', digest(token));
    return this.artifacts.get(row.artifact_id);
  }
  revoke(artifact: string, device: string) {
    this.store.run('UPDATE share_links SET revoked_at=? WHERE artifact_id=?', Date.now(), artifact);
    audit(this.store, 'revoke_share', artifact, device);
    return { ok: true };
  }
  html(token: string) {
    const a = this.lookup(token);
    const url = this.config.PUBLIC_BASE_URL.replace(/\/$/, '') + '/s/' + token + '/content';
    let content = '';
    if (a.kind === 'html')
      content = `<iframe sandbox title="${escape(a.title)}" src="${escape(url)}"></iframe>`;
    else if (a.kind === 'image') content = `<img alt="${escape(a.title)}" src="${escape(url)}">`;
    else if (a.kind === 'pdf' || a.kind === 'zip')
      content = `<a href="${escape(url)}">下载文件</a>`;
    else {
      const text = readFileSync(this.artifacts.file(a.path), 'utf8');
      content =
        a.kind === 'markdown'
          ? renderToStaticMarkup(
              React.createElement(Markdown, { remarkPlugins: [remarkGfm] }, text),
            )
          : '<pre>' + escape(text) + '</pre>';
    }
    return (
      '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      escape(a.title) +
      ' · RunOtter</title><link rel="stylesheet" href="' +
      escape(this.config.PUBLIC_BASE_URL.replace(/\/$/, '') + '/share.css') +
      '"></head><body><main><p>🦦 RunOtter · 只读分享</p><h1>' +
      escape(a.title) +
      '</h1>' +
      content +
      '</main></body></html>'
    );
  }
  inbox(
    value: { kind: 'text' | 'url'; content: string; url?: string; idempotency_key?: string },
    device: string,
  ) {
    const key = digest(device + ':' + (value.idempotency_key ?? JSON.stringify(value)));
    const old = this.store.get<{ item_id: string; at: number }>(
      'SELECT * FROM inbox_dedupe WHERE key=?',
      key,
    );
    if (old && Date.now() - old.at < 21600000) return { id: old.item_id, deduped: true };
    const item = id();
    this.store.run(
      'INSERT INTO inbox_items(id,kind,content,url,status,created_at) VALUES(?,?,?,?,?,?)',
      item,
      value.kind,
      value.content,
      value.url ?? null,
      'new',
      Date.now(),
    );
    this.store.run('INSERT OR REPLACE INTO inbox_dedupe VALUES(?,?,?)', key, item, Date.now());
    audit(this.store, 'inbox_create', item, device);
    return { id: item, deduped: false };
  }
  toThread(key: string, device: string) {
    const item =
      this.store.get<Inbox>('SELECT * FROM inbox_items WHERE id=?', key) ??
      fail(404, 'NOT_FOUND', 'Inbox 条目不存在。');
    if (item.thread_id) return { thread_id: item.thread_id };
    if (item.status !== 'new') fail(409, 'ALREADY_PROCESSED', '此条目已经处理。');
    const thread = this.store.db.transaction(() => {
      const thread = this.bridge.create(
        (item.content ?? item.url ?? 'Inbox 任务').slice(0, 80),
        null,
      );
      this.store.run(
        'UPDATE inbox_items SET status=?,thread_id=? WHERE id=?',
        'converted',
        thread.id,
        key,
      );
      audit(this.store, 'inbox_to_thread', key, device);
      return thread;
    })();
    this.bridge.send(
      thread.id,
      { text: [item.content, item.url].filter(Boolean).join('\n') },
      device,
    );
    return { thread_id: thread.id };
  }
}
