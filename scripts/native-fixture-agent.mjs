// Synthetic CI-only subprocess. It never invokes a real agent or external service.
import { createInterface } from 'node:readline';
const readline = createInterface({ input: process.stdin });
let waiting = false;
const event = (value) => process.stdout.write(JSON.stringify(value) + '\n');
readline.on('line', (line) => {
  if (waiting) {
    const decision = JSON.parse(line);
    event({ type: 'token', text: '审批结果：' + decision.decision });
    event({ type: 'done' });
    setTimeout(() => process.exit(0), 40);
  } else if (line.includes('approval_test')) {
    waiting = true;
    event({
      type: 'approval_required',
      approval: {
        title: '原生审批 · 演示',
        risk: 'normal',
        command_digest: 'Summarize the synthetic report; no external action.',
      },
    });
  } else {
    event({ type: 'token', text: '原生流式响应：' });
    setTimeout(() => {
      event({ type: 'token', text: '已收到你的指令。' });
      event({ type: 'done' });
      setTimeout(() => process.exit(0), 40);
    }, 150);
  }
});
