import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function takeScreenshots() {
  console.log('Starting screenshot capture...');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, 'real_screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Login first
    console.log('Logging in...');
    await page.goto('http://localhost:5000/login', { waitUntil: 'networkidle0' });
    
    await page.type('input[name="username"]', 'jan.milata@gmail.com');
    await page.type('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Screenshots to take
    const screenshots = [
      {
        name: 'dashboard',
        url: 'http://localhost:5000/dashboard',
        title: 'Dashboard Overview'
      },
      {
        name: 'transactions',
        url: 'http://localhost:5000/transactions',
        title: 'Transaction Management'
      },
      {
        name: 'budgets',
        url: 'http://localhost:5000/budgets',
        title: 'Budget Tracking'
      },
      {
        name: 'reports',
        url: 'http://localhost:5000/reports',
        title: 'Analytics & Reports'
      },
      {
        name: 'trends',
        url: 'http://localhost:5000/trends',
        title: 'AI Trends & Predictions'
      },
      {
        name: 'calendar',
        url: 'http://localhost:5000/calendar',
        title: 'Calendar View'
      }
    ];

    for (const shot of screenshots) {
      try {
        console.log(`Capturing ${shot.name}...`);
        
        await page.goto(shot.url, { waitUntil: 'networkidle0' });
        await page.waitForTimeout(2000); // Wait for page to fully load

        const filename = `${shot.name}-screenshot.png`;
        const filepath = path.join(screenshotsDir, filename);
        
        await page.screenshot({
          path: filepath,
          fullPage: false,
          type: 'png'
        });

        console.log(`✓ Saved ${filename}`);
        
      } catch (error) {
        console.error(`Failed to capture ${shot.name}:`, error.message);
      }
    }

    console.log('Screenshots saved to real_screenshots/ directory');

  } catch (error) {
    console.error('Screenshot process failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

takeScreenshots();