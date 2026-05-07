import { Response } from 'express';

class SSEBroker {
  private clients = new Set<Response>();

  connect(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('event: connected\ndata: {}\n\n');

    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(data: Record<string, any>): void {
    const payload = `event: update\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try { client.write(payload); } catch { this.clients.delete(client); }
    }
  }

  startHeartbeat(): void {
    setInterval(() => {
      for (const client of this.clients) {
        try { client.write(': ping\n\n'); } catch { this.clients.delete(client); }
      }
    }, 25_000);
  }
}

export const sseBroker = new SSEBroker();
sseBroker.startHeartbeat();
