import { test, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

async function setup(script: string) {
  const directory = await mkdtemp(join(tmpdir(), 'veladeck-flow-'));
  const config = loadConfig({
    DATA_DIR: directory,
    INGEST_TOKEN: 'fixture-ingress-only',
    DSH_CMD: process.execPath,
    DSH_ARGS: JSON.stringify(['-e', script]),
  });
  const app = await buildApp(config);
  const code = (
    await app.inject({
      method: 'POST',
      url: '/api/pair/code',
      headers: { authorization: 'Bearer ' + config.INGEST_TOKEN },
    })
  ).json().code;
  const claim = await app.inject({
    method: 'POST',
    url: '/api/pair/claim',
    payload: { code, device_name: 'Workflow test' },
  });
  const cookie = String(claim.headers['set-cookie']).split(';')[0];
  const thread = (
    await app.inject({
      method: 'POST',
      url: '/api/threads',
      headers: { cookie },
      payload: { title: 'Workflow fixture' },
    })
  ).json().id as string;
  return {
    app,
    thread,
    cookie,
    cleanup: async () => {
      await app.inject({
        method: 'POST',
        url: '/api/threads/' + thread + '/cancel',
        headers: { cookie },
        payload: {},
      });
      await app.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('approval rejection reaches the waiting subprocess and cannot be decided twice', async () => {
  const script = `const rl=require('readline').createInterface({input:process.stdin});let waiting=false;rl.on('line',line=>{if(!waiting){waiting=true;console.log(JSON.stringify({type:'approval_required',approval:{title:'Summarize a report',risk:'normal',command_digest:'Summarize the selected report'}}));}else{const decision=JSON.parse(line);console.log(JSON.stringify({type:'token',text:decision.decision}));console.log(JSON.stringify({type:'done'}));}});`;
  const f = await setup(script);
  try {
    const stream = f.app.inject({
      method: 'POST',
      url: '/api/threads/' + f.thread + '/messages',
      headers: { cookie: f.cookie },
      payload: { text: 'Please summarize' },
    });
    let approval: { id: string } | undefined;
    for (let i = 0; i < 30; i++) {
      const list = (
        await f.app.inject({ url: '/api/approvals', headers: { cookie: f.cookie } })
      ).json() as { id: string }[];
      if (list.length) {
        approval = list[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(approval).toBeDefined();
    expect(
      (
        await f.app.inject({
          method: 'POST',
          url: '/api/approvals/' + approval!.id + '/reject',
          headers: { cookie: f.cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(200);
    const response = await stream;
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('rejected');
    expect(
      (
        await f.app.inject({
          method: 'POST',
          url: '/api/approvals/' + approval!.id + '/approve',
          headers: { cookie: f.cookie },
          payload: { confirmed: true },
        })
      ).statusCode,
    ).toBe(409);
    const replay = await f.app.inject({
      url: '/api/threads/' + f.thread + '/events?after_seq=0',
      headers: { cookie: f.cookie },
    });
    expect(replay.body).toContain('rejected');
    const seqs = [...replay.body.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  } finally {
    await f.cleanup();
  }
});

test('cancel terminates the live adapter and closes the SSE stream', async () => {
  const f = await setup(
    `process.stdin.once('data',()=>{console.log(JSON.stringify({type:'token',text:'started'}));setInterval(()=>{},1000)});`,
  );
  try {
    const stream = f.app.inject({
      method: 'POST',
      url: '/api/threads/' + f.thread + '/messages',
      headers: { cookie: f.cookie },
      payload: { text: 'Wait for cancellation' },
    });
    for (let i = 0; i < 30; i++) {
      const messages = (
        await f.app.inject({
          url: '/api/threads/' + f.thread + '/messages',
          headers: { cookie: f.cookie },
        })
      ).json() as { type: string }[];
      if (messages.some((m) => m.type === 'token')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const start = performance.now();
    await f.app.inject({
      method: 'POST',
      url: '/api/threads/' + f.thread + '/cancel',
      headers: { cookie: f.cookie },
      payload: {},
    });
    const response = await stream;
    expect(response.body).toContain('error');
    expect(performance.now() - start).toBeLessThan(1000);
  } finally {
    await f.cleanup();
  }
});
