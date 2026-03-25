import { describe, it, expect, afterEach } from 'vitest';
import net from 'net';
import { PipeServer } from '../../src/main/pipe-server';

// Each test gets a unique pipe name to avoid reuse conflicts on Windows
let testCounter = 0;
function uniquePipe(): string {
  return `\\\\.\\pipe\\wmux-test-${process.pid}-${++testCounter}`;
}

function connectAndSend(pipePath: string, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.connect({ path: pipePath }, () => {
      client.write(message + '\n');
    });
    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        client.end();
        resolve(data.trim());
      }
    });
    client.on('error', reject);
    setTimeout(() => { client.end(); reject(new Error('timeout')); }, 3000);
  });
}

describe('PipeServer', () => {
  let server: PipeServer;

  afterEach(() => {
    server?.stop();
  });

  it('responds to V1 ping', async () => {
    const pipe = uniquePipe();
    server = new PipeServer(pipe);
    server.start();
    await new Promise(r => setTimeout(r, 200)); // wait for server to start

    const response = await connectAndSend(pipe, 'ping');
    expect(response).toBe('pong');
  });

  it('parses V1 commands', async () => {
    const pipe = uniquePipe();
    server = new PipeServer(pipe);
    const commands: any[] = [];
    server.on('v1', (cmd) => commands.push(cmd));
    server.start();
    await new Promise(r => setTimeout(r, 200));

    await connectAndSend(pipe, 'report_pwd surf-123 C:\\Users\\test');
    expect(commands.length).toBe(1);
    expect(commands[0].command).toBe('report_pwd');
    expect(commands[0].surfaceId).toBe('surf-123');
    expect(commands[0].args).toEqual(['C:\\Users\\test']);
  });

  it('handles V2 JSON-RPC', async () => {
    const pipe = uniquePipe();
    server = new PipeServer(pipe);
    server.on('v2', (req, respond) => {
      if (req.method === 'workspace.list') {
        respond({ workspaces: [] });
      }
    });
    server.start();
    await new Promise(r => setTimeout(r, 200));

    const response = await connectAndSend(pipe, JSON.stringify({
      method: 'workspace.list',
      params: {},
      id: 1,
    }));
    const parsed = JSON.parse(response);
    expect(parsed.result.workspaces).toEqual([]);
    expect(parsed.id).toBe(1);
  });

  it('returns error for unknown V2 method', async () => {
    const pipe = uniquePipe();
    server = new PipeServer(pipe);
    server.start();
    await new Promise(r => setTimeout(r, 200));

    const response = await connectAndSend(pipe, JSON.stringify({
      method: 'unknown.method',
      params: {},
      id: 2,
    }));
    const parsed = JSON.parse(response);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe(-32601);
  });
});
