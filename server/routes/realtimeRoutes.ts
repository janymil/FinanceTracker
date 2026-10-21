import type { Express } from "express";
import { addSSEClient, notifyDataChange } from "../realtime";
import { isAuthenticated, getUserId } from "../clerkAuth";

export function registerRealtimeRoutes(app: Express) {
  // Server-sent events for the signed-in user. Streams are keyed by userId so a
  // mutation in one tab refreshes the others.
  app.get('/api/events', isAuthenticated, (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).end();
    }
    addSSEClient(userId, res);
  });

  // Manual fan-out trigger, development only (no auth by design, never in prod).
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/notify', (req, res) => {
      const { userId, type } = req.body || {};
      if (!userId || !type) {
        return res.status(400).json({ success: false, error: 'userId and type are required' });
      }
      notifyDataChange(userId, type);
      return res.json({ success: true, message: 'Notification sent' });
    });
  }
}
