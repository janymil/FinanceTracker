import { Response } from 'express';

// Store all connected SSE clients
const clients: Map<string, Response> = new Map();

export function addSSEClient(userId: string, res: Response) {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection confirmation
  res.write(`data: {"type":"connected"}\n\n`);

  // Store client
  clients.set(userId, res);

  // Clean up on disconnect
  res.on('close', () => {
    clients.delete(userId);
  });
}

export function notifyDataChange(userId: string, changeType: 'transaction' | 'budget' | 'goal') {
  const client = clients.get(userId);
  if (client) {
    const message = JSON.stringify({
      type: 'dataChange',
      changeType,
      timestamp: new Date().toISOString()
    });
    client.write(`data: ${message}\n\n`);
  }
}

export function notifyAllClients(changeType: 'transaction' | 'budget' | 'goal') {
  const message = JSON.stringify({
    type: 'dataChange',
    changeType,
    timestamp: new Date().toISOString()
  });
  
  clients.forEach((client) => {
    client.write(`data: ${message}\n\n`);
  });
}