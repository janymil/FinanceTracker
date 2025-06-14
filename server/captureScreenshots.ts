import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface ScreenshotConfig {
  name: string;
  url: string;
  title: string;
  description: string;
  waitFor?: string;
  actions?: Array<{
    type: 'click' | 'type' | 'wait';
    selector?: string;
    value?: string;
    delay?: number;
  }>;
}

const screenshots: ScreenshotConfig[] = [
  {
    name: 'dashboard',
    url: 'http://localhost:5000/dashboard',
    title: 'Dashboard Overview',
    description: 'Complete financial overview with income, expenses, and recent transactions',
    waitFor: '[data-testid="financial-summary"]'
  },
  {
    name: 'transactions',
    url: 'http://localhost:5000/transactions',
    title: 'Transaction Management',
    description: 'Easy transaction tracking with AI-powered categorization',
    waitFor: '[data-testid="transaction-list"]'
  },
  {
    name: 'budgets',
    url: 'http://localhost:5000/budgets',
    title: 'Budget Tracking',
    description: 'Set and monitor spending limits by category',
    waitFor: '[data-testid="budget-list"]'
  },
  {
    name: 'reports',
    url: 'http://localhost:5000/reports',
    title: 'Analytics & Reports',
    description: 'Detailed insights into your spending patterns',
    waitFor: '[data-testid="reports-content"]'
  },
  {
    name: 'trends',
    url: 'http://localhost:5000/trends',
    title: 'AI Trends & Predictions',
    description: 'AI-powered financial forecasting and recommendations',
    waitFor: '[data-testid="trends-content"]'
  },
  {
    name: 'calendar',
    url: 'http://localhost:5000/calendar',
    title: 'Calendar View',
    description: 'Monthly view of all your financial activities',
    waitFor: '[data-testid="calendar-grid"]'
  }
];

export async function captureScreenshots() {
  console.log('Starting screenshot capture...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    executablePath: '/usr/bin/chromium-browser'
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  // Create screenshots directory
  try {
    mkdirSync(join(process.cwd(), 'demo_screenshots'), { recursive: true });
  } catch (err) {
    // Directory already exists
  }

  const results: Array<{
    name: string;
    title: string;
    description: string;
    filename: string;
    success: boolean;
    error?: string;
  }> = [];

  // First, login to the application
  try {
    console.log('Logging in...');
    await page.goto('http://localhost:5000/login', { waitUntil: 'networkidle0' });
    
    // Login with test credentials
    await page.type('input[name="username"]', 'jan.milata@gmail.com');
    await page.type('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('Successfully logged in');
  } catch (error) {
    console.error('Login failed:', error);
    await browser.close();
    return;
  }

  for (const config of screenshots) {
    try {
      console.log(`Capturing ${config.name}...`);
      
      await page.goto(config.url, { waitUntil: 'networkidle0' });
      
      // Wait for specific element if specified
      if (config.waitFor) {
        try {
          await page.waitForSelector(config.waitFor, { timeout: 5000 });
        } catch (err) {
          console.log(`Wait selector failed for ${config.name}, continuing anyway`);
        }
      }

      // Perform any specified actions
      if (config.actions) {
        for (const action of config.actions) {
          switch (action.type) {
            case 'click':
              if (action.selector) {
                await page.click(action.selector);
              }
              break;
            case 'type':
              if (action.selector && action.value) {
                await page.type(action.selector, action.value);
              }
              break;
            case 'wait':
              await new Promise(resolve => setTimeout(resolve, action.delay || 1000));
              break;
          }
        }
      }

      // Take screenshot
      const filename = `${config.name}-${Date.now()}.png`;
      const filepath = join(process.cwd(), 'demo_screenshots', filename);
      
      await page.screenshot({
        path: filepath as `${string}.png`,
        fullPage: false,
        type: 'png'
      });

      results.push({
        name: config.name,
        title: config.title,
        description: config.description,
        filename,
        success: true
      });

      console.log(`✓ Captured ${config.name}`);
      
    } catch (error) {
      console.error(`Failed to capture ${config.name}:`, error);
      results.push({
        name: config.name,
        title: config.title,
        description: config.description,
        filename: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  await browser.close();
  
  // Save results metadata
  writeFileSync(
    join(process.cwd(), 'demo_screenshots', 'metadata.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('Screenshot capture complete!');
  console.log('Results:', results);
  
  return results;
}

// Allow running this file directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  captureScreenshots().catch(console.error);
}