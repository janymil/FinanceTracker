import { Request, Response } from "express";

// Static HTML content for public pages that crawlers can read
const generateStaticHTML = (title: string, description: string, content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://finanzerpro.com">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://finanzerpro.com">
    
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: #4f46e5; }
        h2 { color: #374151; margin-top: 2rem; }
        p { color: #6b7280; }
        .feature { margin: 1rem 0; padding: 1rem; background: #f9fafb; border-radius: 8px; }
        .price { font-size: 2rem; font-weight: bold; color: #4f46e5; }
        a { color: #4f46e5; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        ${content}
        <footer style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #e5e7eb; text-align: center;">
            <p>&copy; 2025 FinanzerPro. All rights reserved.</p>
            <p><a href="/">Home</a> | <a href="/pricing">Pricing</a> | <a href="/help">Help</a> | <a href="/contact">Contact</a> | <a href="/privacy-policy">Privacy</a></p>
        </footer>
    </div>
</body>
</html>`;

export const landingPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro - Smart Personal Finance Management</h1>
        <p>Transform your financial life with AI-powered expense tracking, receipt OCR scanning, budgeting tools, and collaborative savings goals.</p>
        
        <h2>Key Features</h2>
        <div class="feature">
            <h3>🏦 Smart Expense Tracking</h3>
            <p>Automatically categorize expenses with AI-powered transaction analysis.</p>
        </div>
        
        <div class="feature">
            <h3>📱 Receipt OCR Scanning</h3>
            <p>Scan receipts with your phone camera for instant expense recording.</p>
        </div>
        
        <div class="feature">
            <h3>📊 Budget Management</h3>
            <p>Set budgets, track spending, and get alerts when you approach limits.</p>
        </div>
        
        <div class="feature">
            <h3>🎯 Collaborative Goals</h3>
            <p>Save together with family and friends for shared financial objectives.</p>
        </div>
        
        <div class="feature">
            <h3>🤖 AI Financial Insights</h3>
            <p>Get personalized recommendations and spending predictions.</p>
        </div>
        
        <h2>Start Managing Your Finances Today</h2>
        <p>Join thousands of users who have taken control of their financial future with FinanzerPro.</p>
        <p><a href="/auth">Get Started Free</a> | <a href="/pricing">View Pricing Plans</a></p>
    `;
    
    const html = generateStaticHTML(
        "FinanzerPro - Smart Personal Finance Management",
        "Transform your financial life with AI-powered expense tracking, receipt OCR scanning, budgeting tools, and collaborative savings goals. Start free today!",
        content
    );
    
    res.send(html);
};

export const helpPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Help & Documentation</h1>
        <p>Complete guide to using FinanzerPro's powerful financial management features.</p>
        
        <h2>Getting Started</h2>
        <p>FinanzerPro is a comprehensive personal finance management application that helps you track expenses, manage budgets, and achieve financial goals.</p>
        
        <h2>Key Features</h2>
        
        <h3>Transaction Management</h3>
        <p>Record income and expenses with automatic AI categorization. Edit, delete, and organize your financial data with ease.</p>
        
        <h3>Receipt OCR Scanning</h3>
        <p>Use your phone camera to scan receipts. Our OCR technology extracts amount, vendor, and date information automatically.</p>
        
        <h3>Mobile QR Upload</h3>
        <p>Scan QR codes from your desktop to upload receipts directly from your phone camera.</p>
        
        <h3>Budget Tracking</h3>
        <p>Set monthly budgets for different categories and track your spending progress with visual indicators.</p>
        
        <h3>Financial Goals</h3>
        <p>Create savings goals for vacations, emergency funds, or major purchases. Track progress and collaborate with family.</p>
        
        <h3>AI Financial Assistant</h3>
        <p>Get personalized financial tips, expense predictions, and spending insights powered by artificial intelligence.</p>
        
        <h3>Reports & Analytics</h3>
        <p>View detailed spending reports, category breakdowns, and financial trends over time.</p>
        
        <h3>Data Management</h3>
        <p>Export your data in multiple formats, create cloud backups, and import from other financial apps.</p>
        
        <h2>Subscription Plans</h2>
        
        <h3>Free Plan</h3>
        <p>Perfect for getting started with basic expense tracking up to 100 transactions.</p>
        
        <h3>Standard Plan - $4.99/month</h3>
        <p>Includes receipt OCR scanning, budgets, goals, AI categorization, and mobile QR upload.</p>
        
        <h3>Premium Plan - $9.99/month</h3>
        <p>Everything in Standard plus unlimited transactions, AI insights, cloud backup, and advanced analytics.</p>
        
        <h2>Need More Help?</h2>
        <p>Contact our support team at <a href="/contact">our contact page</a> for personalized assistance.</p>
    `;
    
    const html = generateStaticHTML(
        "FinanzerPro Help & Documentation",
        "Complete guide to using FinanzerPro's financial management features including receipt scanning, budgets, goals, and AI insights.",
        content
    );
    
    res.send(html);
};

export const pricingPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Pricing Plans</h1>
        <p>Choose the perfect plan for your financial management needs.</p>
        
        <h2>Free Plan</h2>
        <div class="price">$0</div>
        <p>Perfect for getting started with personal finance tracking.</p>
        <ul>
            <li>Up to 100 transactions</li>
            <li>Basic expense tracking</li>
            <li>Simple financial health score</li>
            <li>Manual transaction entry</li>
        </ul>
        
        <h2>Standard Plan</h2>
        <div class="price">$4.99/month</div>
        <p>Enhanced features for serious budgeters and goal-setters.</p>
        <ul>
            <li>Up to 100 transactions</li>
            <li>Receipt OCR scanning</li>
            <li>Mobile QR code upload</li>
            <li>Budget management</li>
            <li>Savings goals</li>
            <li>AI expense categorization</li>
            <li>Transaction reminders</li>
            <li>Calendar view</li>
            <li>AI financial health assistant</li>
        </ul>
        
        <h2>Premium Plan</h2>
        <div class="price">$9.99/month</div>
        <p>Ultimate financial management with unlimited features.</p>
        <ul>
            <li>Unlimited transactions</li>
            <li>All Standard features</li>
            <li>Cloud receipt storage</li>
            <li>Advanced AI insights</li>
            <li>Expense predictions</li>
            <li>Daily recommendations</li>
            <li>Financial mascot</li>
            <li>Data export & import</li>
            <li>Cloud backup & restore</li>
            <li>Advanced analytics</li>
            <li>Trend predictions</li>
        </ul>
        
        <h2>Save with Annual Plans</h2>
        <p>Get 2 months free with yearly subscriptions:</p>
        <ul>
            <li>Standard: $49.90/year (save $9.98)</li>
            <li>Premium: $99.90/year (save $19.98)</li>
        </ul>
        
        <p><a href="/auth">Start Your Free Account</a> and upgrade anytime.</p>
    `;
    
    const html = generateStaticHTML(
        "FinanzerPro Pricing Plans - Free, Standard & Premium",
        "Choose from Free, Standard ($4.99/month), or Premium ($9.99/month) plans. Receipt scanning, AI categorization, cloud backup, and more.",
        content
    );
    
    res.send(html);
};

export const contactPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>Contact FinanzerPro</h1>
        <p>Get in touch with our support team for assistance with your personal finance management.</p>
        
        <h2>Support</h2>
        <p>For technical support, billing questions, or feature requests, please use our contact form.</p>
        
        <h2>Business Inquiries</h2>
        <p>For partnerships, press inquiries, or business development, contact our team.</p>
        
        <h2>Feedback</h2>
        <p>We value your feedback! Let us know how we can improve FinanzerPro to better serve your financial management needs.</p>
        
        <h2>Response Time</h2>
        <p>We typically respond to all inquiries within 24 hours during business days.</p>
        
        <p><a href="/contact">Visit our contact form</a> to send us a message directly.</p>
    `;
    
    const html = generateStaticHTML(
        "Contact FinanzerPro Support Team",
        "Get in touch with FinanzerPro support for technical assistance, billing questions, or feedback about our financial management platform.",
        content
    );
    
    res.send(html);
};

export const privacyPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Privacy Policy</h1>
        <p>Your privacy and financial data security are our top priorities.</p>
        
        <h2>Information We Collect</h2>
        <p>We collect information you provide when creating accounts, entering financial data, and using our features.</p>
        
        <h2>How We Use Your Information</h2>
        <p>Your financial data is used to provide personalized insights, categorization, and financial management features.</p>
        
        <h2>Data Security</h2>
        <p>We use industry-standard encryption and security measures to protect your sensitive financial information.</p>
        
        <h2>Data Sharing</h2>
        <p>We never sell your personal financial data. Limited data may be shared with trusted service providers for app functionality.</p>
        
        <h2>Your Rights</h2>
        <p>You can access, update, or delete your data at any time through your account settings.</p>
        
        <h2>Contact Us</h2>
        <p>Questions about privacy? Contact us at <a href="/contact">our contact page</a>.</p>
        
        <p>Last updated: June 2025</p>
    `;
    
    const html = generateStaticHTML(
        "FinanzerPro Privacy Policy - Data Security & Protection",
        "Learn how FinanzerPro protects your financial data with industry-standard security measures and transparent privacy practices.",
        content
    );
    
    res.send(html);
};