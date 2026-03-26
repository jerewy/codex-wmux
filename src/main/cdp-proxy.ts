// src/main/cdp-proxy.ts
import http from 'http';
import { webContents } from 'electron';

const DEFAULT_PORT = 9222;
const MAX_PORT = 9230;

export class CDPProxy {
  private server: http.Server | null = null;
  private port = DEFAULT_PORT;
  private webContentsId: number | null = null;

  setWebContentsId(wcId: number | null): void {
    this.webContentsId = wcId;
  }

  private getPageInfo(): { title: string; url: string } {
    if (!this.webContentsId) return { title: '', url: '' };
    try {
      const wc = webContents.fromId(this.webContentsId);
      return { title: wc?.getTitle() || '', url: wc?.getURL() || '' };
    } catch {
      return { title: '', url: '' };
    }
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/json/version') {
        res.end(JSON.stringify({
          Browser: 'wmux/0.3.0',
          'Protocol-Version': '1.3',
          webSocketDebuggerUrl: `ws://localhost:${this.port}/devtools/page/1`,
        }));
        return;
      }

      if (req.url === '/json/list' || req.url === '/json') {
        const page = this.getPageInfo();
        res.end(JSON.stringify([{
          id: '1',
          type: 'page',
          title: page.title,
          url: page.url,
          webSocketDebuggerUrl: `ws://localhost:${this.port}/devtools/page/1`,
        }]));
        return;
      }

      res.statusCode = 404;
      res.end('{}');
    });

    // Try ports 9222-9230
    for (let p = DEFAULT_PORT; p <= MAX_PORT; p++) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.server!.once('error', reject);
          this.server!.listen(p, '127.0.0.1', () => {
            this.server!.removeAllListeners('error');
            this.port = p;
            resolve();
          });
        });
        console.log(`[wmux] CDP proxy listening on localhost:${p}`);
        return;
      } catch {
        continue;
      }
    }
    console.warn('[wmux] CDP proxy: all ports 9222-9230 busy');
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  getPort(): number {
    return this.port;
  }
}
