import { Response } from 'express';

class SSEBroker {
  private clients = new Set<Response>();
  // Per-user connections for targeted delivery
  private userClients = new Map<number, Set<Response>>();

  connect(res: Response, userId?: number): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('event: connected\ndata: {}\n\n');

    this.clients.add(res);

    if (userId) {
      if (!this.userClients.has(userId)) this.userClients.set(userId, new Set());
      this.userClients.get(userId)!.add(res);
    }

    res.on('close', () => {
      this.clients.delete(res);
      if (userId) {
        const set = this.userClients.get(userId);
        if (set) { set.delete(res); if (!set.size) this.userClients.delete(userId); }
      }
    });
  }

  broadcast(data: Record<string, any>): void {
    const payload = `event: update\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try { client.write(payload); } catch { this.clients.delete(client); }
    }
  }

  sendToUser(userId: number, eventName: string, data: Record<string, any>): void {
    const set = this.userClients.get(userId);
    if (!set?.size) return;
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of set) {
      try { client.write(payload); } catch { set.delete(client); }
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
