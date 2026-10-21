import { Response } from 'express';

// One user can have several tabs open, so each user maps to a set of streams.
const clients: Map<string, Set<Response>> = new Map();

export function addSSEClient(userId: string, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: {"type":"connected"}\n\n`);

  const streams = clients.get(userId) ?? new Set<Response>();
  streams.add(res);
  clients.set(userId, streams);

  // Keep proxies from closing an idle stream.
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      // stream already gone; the close handler below cleans up
    }
  }, 25_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    const current = clients.get(userId);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) clients.delete(userId);
  });
}

export function notifyDataChange(userId: string, changeType: 'transaction' | 'budget' | 'goal') {
  const streams = clients.get(userId);
  if (!streams || streams.size === 0) return;

  const message = `data: ${JSON.stringify({
    type: 'dataChange',
    changeType,
    timestamp: new Date().toISOString(),
  })}\n\n`;

  for (const stream of Array.from(streams)) {
    try {
      stream.write(message);
    } catch {
      streams.delete(stream);
    }
  }
}

export function notifyAllClients(changeType: 'transaction' | 'budget' | 'goal') {
  for (const userId of Array.from(clients.keys())) {
    notifyDataChange(userId, changeType);
  }
}

export function getConnectedUserCount(): number {
  return clients.size;
}
