import { Router } from 'express';

const router = Router();

// Screenshot capture endpoint for demo purposes
router.get('/api/demo-screenshots', async (req, res) => {
  try {
    // This would typically use puppeteer or similar to capture screenshots
    // For now, we'll serve existing screenshots from attached_assets
    const screenshots = [
      {
        id: 1,
        name: 'dashboard',
        path: '/attached_assets/image_1749938217408.png',
        title: 'Dashboard Overview'
      },
      {
        id: 2,
        name: 'transactions',
        path: '/attached_assets/image_1749911383114.png',
        title: 'Transaction Management'
      },
      {
        id: 3,
        name: 'budget',
        path: '/attached_assets/image_1749911403594.png',
        title: 'Budget Tracking'
      },
      {
        id: 4,
        name: 'reports',
        path: '/attached_assets/image_1749915441662.png',
        title: 'Analytics & Reports'
      },
      {
        id: 5,
        name: 'trends',
        path: '/attached_assets/image_1749915636089.png',
        title: 'AI Trends & Predictions'
      },
      {
        id: 6,
        name: 'calendar',
        path: '/attached_assets/image_1749915848462.png',
        title: 'Calendar View'
      }
    ];

    res.json({ screenshots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get screenshots' });
  }
});

export default router;