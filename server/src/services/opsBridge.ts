import { cpus, totalmem, freemem, uptime, platform, homedir } from 'node:os';
import { statfsSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Store } from '../db/client.js';
import type { Config } from '../config.js';
import { id, audit } from '../lib/security.js';
import { fail } from '../lib/errors.js';
const execute = promisify(execFile);
export const tasks = {
  'trendradar-push': 'trendradar-push.service',
  'stock-report-push': 'stock-report-push.service',
  'dsh-backup': 'dsh-backup.service',
} as const;
export class OpsBridge {
  constructor(
    public store: Store,
    public config: Config,
  ) {
    store.tables(['ops_snapshots']);
  }
  async status() {
    const disk = statfsSync(this.config.DATA_DIR),
      processors = cpus();
    const total = processors.reduce(
        (n, c) => n + Object.values(c.times).reduce((s, v) => s + v, 0),
        0,
      ),
      idle = processors.reduce((n, c) => n + c.times.idle, 0);
    let services: Record<string, string> = {};
    if (platform() === 'linux') {
      const entries = await Promise.all(
        ['veladeck.service', 'caddy.service', 'dsh.service'].map(async (name) => {
          try {
            const r = await execute('systemctl', ['is-active', name], { timeout: 3000 });
            return [name, r.stdout.trim()];
          } catch {
            return [name, 'inactive-or-unavailable'];
          }
        }),
      );
      services = Object.fromEntries(entries);
    }
    const local = {
      node: platform() === 'linux' ? '广州 / 本机' : '本机开发环境',
      available: true,
      os: platform(),
      cpu_busy_since_boot_pct: total ? Number(((1 - idle / total) * 100).toFixed(1)) : null,
      memory_total: totalmem(),
      memory_used: totalmem() - freemem(),
      disk_total: Number(disk.blocks) * disk.bsize,
      disk_free: Number(disk.bavail) * disk.bsize,
      uptime: uptime(),
      services,
      at: Date.now(),
    };
    this.store.run(
      'INSERT INTO ops_snapshots VALUES(?,?,?,?)',
      id(),
      'local',
      Date.now(),
      JSON.stringify(local),
    );
    this.store.run('DELETE FROM ops_snapshots WHERE captured_at<?', Date.now() - 86400000);
    const command = join(homedir(), 'ops', 'sv');
    let remote: Record<string, unknown> = {
      node: '硅谷',
      available: false,
      reason: '尚未配置远端状态适配器',
    };
    if (platform() === 'linux' && existsSync(command)) {
      try {
        const result = await execute(command, ['status'], { timeout: 10000, maxBuffer: 64000 });
        remote = {
          node: '硅谷',
          available: true,
          summary: result.stdout
            .replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]+/g, '[redacted]')
            .slice(0, 200),
          at: Date.now(),
        };
      } catch {
        remote = { node: '硅谷', available: false, reason: '远端探测失败' };
      }
    }
    return { nodes: [local, remote] };
  }
  async listTasks() {
    if (platform() !== 'linux')
      return { available: false, items: [], reason: '定时任务需要 Linux systemd 环境' };
    return {
      available: true,
      items: await Promise.all(
        Object.entries(tasks).map(async ([name, unit]) => {
          try {
            const r = await execute(
              'systemctl',
              [
                'show',
                unit,
                '--property=ActiveState,Result,ExecMainStartTimestamp,ExecMainExitTimestamp',
              ],
              { timeout: 3000 },
            );
            const fields = Object.fromEntries(
              r.stdout
                .trim()
                .split('\n')
                .map((line) => line.split('=')),
            );
            return { name, ...fields };
          } catch {
            return { name, available: false };
          }
        }),
      ),
    };
  }
  async run(name: string, device: string) {
    if (!(name in tasks)) fail(403, 'NOT_ALLOWLISTED', '此动作不在白名单中。');
    if (platform() !== 'linux') fail(503, 'UNAVAILABLE', '任务执行需要已配置的 Linux 服务。');
    audit(this.store, 'rerun_requested', name, device);
    try {
      await execute('systemctl', ['start', tasks[name as keyof typeof tasks]], {
        timeout: 20000,
        maxBuffer: 4096,
      });
      audit(this.store, 'rerun', name, device);
      return { ok: true, status: 'start_requested' };
    } catch {
      audit(this.store, 'rerun', name, device, 'failed');
      fail(502, 'TASK_FAILED', '启动失败，请检查服务配置与运行权限。');
    }
  }
}
