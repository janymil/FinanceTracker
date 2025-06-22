import type { Express } from "express";
import { addSSEClient, notifyDataChange } from "../realtime";

export function registerRealtimeRoutes(app: Express) {
  // SSE endpoint for real-time updates
  app.get('/api/events', (req, res) => {
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Add client to SSE clients list
    const clientId = Date.now().toString();
    addSSEClient(clientId, res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`SSE client ${clientId} disconnected`);
    });
  });

  // Endpoint to trigger notifications (for testing)
  app.post('/api/notify', (req, res) => {
    const { type, data } = req.body;
    notifyDataChange(type, data);
    res.json({ success: true, message: 'Notification sent' });
  });
}