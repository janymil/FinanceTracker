import { Request, Response } from "express";

// Simple SSR HTML generator following proper patterns
const generateSSRHTML = (title: string, description: string, bodyContent: string) => `
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
    <meta property="og:image" content="https://finanzerpro.com/og-image.png">
    
    <!-- Google Analytics - Production Only -->
    <script>
      if (window.location.hostname === 'finanzerpro.com') {
        (function() {
          var script = document.createElement('script');
          script.async = true;
          script.src = 'https://www.googletagmanager.com/gtag/js?id=G-PRRBGDT20Q';
          document.head.appendChild(script);
          
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-PRRBGDT20Q');
          window.gtag = gtag;
        })();
      }
    </script>
    
    <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f9fafb; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h1 { color: #4f46e5; font-size: 2.5rem; margin-bottom: 1rem; }
        h2 { color: #374151; margin-top: 2rem; }
        h3 { color: #374151; }
        p { color: #6b7280; margin: 1rem 0; }
        .feature { margin: 1.5rem 0; padding: 1.5rem; background: #f9fafb; border-radius: 8px; border-left: 4px solid #4f46e5; }
        .price { font-size: 2rem; font-weight: bold; color: #4f46e5; margin: 0.5rem 0; }
        a { color: #4f46e5; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .btn { display: inline-block; padding: 0.75rem 1.5rem; background: #4f46e5; color: white; border-radius: 8px; text-decoration: none; margin: 0.5rem 0.5rem 0.5rem 0; }
        .btn:hover { background: #4338ca; color: white; text-decoration: none; }
        ul { color: #6b7280; padding-left: 1.5rem; }
        li { margin: 0.5rem 0; }
        footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; }
        footer a { color: #4f46e5; margin: 0 0.5rem; }
    </style>
</head>
<body>
    <div id="root">
        <div class="container">
            ${bodyContent}
            <footer>
                <p>&copy; 2025 FinanzerPro. All rights reserved.</p>
                <p>
                    <a href="/">Home</a> |
                    <a href="/pricing">Pricing</a> |
                    <a href="/help">Help</a> |
                    <a href="/contact">Contact</a> |
                    <a href="/privacy-policy">Privacy</a> |
                    <a href="/terms-of-service">Terms</a>
                </p>
            </footer>
        </div>
    </div>
</body>
</html>`;

// Landing Page SSR
export const landingPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro - Smart Personal Finance Management</h1>
        <p>Transform your financial life with AI-powered expense tracking, receipt OCR scanning, budgeting tools, and collaborative savings goals.</p>
        
        <h2>Key Features</h2>
        
        <div class="feature">
            <h3>🏦 Smart Expense Tracking</h3>
            <p>Automatically categorize expenses with AI-powered transaction analysis and receipt scanning.</p>
        </div>
        
        <div class="feature">
            <h3>📱 Receipt OCR Scanning</h3>
            <p>Scan receipts with your phone camera for instant expense recording with QR code upload support.</p>
        </div>
        
        <div class="feature">
            <h3>📊 Budget Management</h3>
            <p>Set budgets, track spending, and get alerts when you approach limits with visual progress indicators.</p>
        </div>
        
        <div class="feature">
            <h3>🎯 Collaborative Goals</h3>
            <p>Save together with family and friends for shared financial objectives and milestones.</p>
        </div>
        
        <div class="feature">
            <h3>🤖 AI Financial Insights</h3>
            <p>Get personalized recommendations, spending predictions, and financial health analysis.</p>
        </div>
        
        <h2>Start Managing Your Finances Today</h2>
        <p>Join thousands of users who have taken control of their financial future with FinanzerPro.</p>
        <p>
            <a href="/auth" class="btn">Get Started Free</a>
            <a href="/pricing" class="btn">View Pricing Plans</a>
        </p>
    `;
    
    const html = generateSSRHTML(
        "FinanzerPro - Smart Personal Finance Management",
        "Transform your financial life with AI-powered expense tracking, receipt OCR scanning, budgeting tools, and collaborative savings goals. Start free today!",
        content
    );
    
    res.send(html);
};

// Help Page SSR
export const helpPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Help & Documentation</h1>
        <p>Complete guide to using FinanzerPro's powerful financial management features.</p>
        
        <h2>Getting Started</h2>
        <p>FinanzerPro is a comprehensive personal finance management application that helps you track expenses, manage budgets, and achieve financial goals.</p>
        
        <h2>Key Features</h2>
        
        <div class="feature">
            <h3>Transaction Management</h3>
            <p>Record income and expenses with automatic AI categorization. Edit, delete, and organize your financial data with ease.</p>
        </div>
        
        <div class="feature">
            <h3>Receipt OCR Scanning</h3>
            <p>Use your phone camera to scan receipts. Our OCR technology extracts amount, vendor, and date information automatically.</p>
        </div>
        
        <div class="feature">
            <h3>Mobile QR Upload</h3>
            <p>Scan QR codes from your desktop to upload receipts directly from your phone camera.</p>
        </div>
        
        <div class="feature">
            <h3>Budget Tracking</h3>
            <p>Set monthly budgets for different categories and track your spending progress with visual indicators.</p>
        </div>
        
        <div class="feature">
            <h3>Financial Goals</h3>
            <p>Create savings goals for vacations, emergency funds, or major purchases. Track progress and collaborate with family.</p>
        </div>
        
        <div class="feature">
            <h3>AI Financial Assistant</h3>
            <p>Get personalized financial tips, expense predictions, and spending insights powered by artificial intelligence.</p>
        </div>
        
        <h2>Subscription Plans</h2>
        
        <div class="feature">
            <h3>Free Plan</h3>
            <p>Perfect for getting started with basic expense tracking up to 100 transactions.</p>
        </div>
        
        <div class="feature">
            <h3>Standard Plan - $4.99/month</h3>
            <p>Includes receipt OCR scanning, budgets, goals, AI categorization, and mobile QR upload.</p>
        </div>
        
        <div class="feature">
            <h3>Premium Plan - $9.99/month</h3>
            <p>Everything in Standard plus unlimited transactions, AI insights, cloud backup, and advanced analytics.</p>
        </div>
        
        <p>
            <a href="/contact" class="btn">Contact Support</a>
            <a href="/pricing" class="btn">View All Plans</a>
        </p>
    `;
    
    const html = generateSSRHTML(
        "FinanzerPro Help & Documentation",
        "Complete guide to using FinanzerPro's financial management features including receipt scanning, budgets, goals, and AI insights.",
        content
    );
    
    res.send(html);
};

// Pricing Page SSR
export const pricingPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Pricing Plans</h1>
        <p>Choose the perfect plan for your financial management needs.</p>
        
        <div class="feature">
            <h2>Free Plan</h2>
            <div class="price">$0</div>
            <p>Perfect for getting started with personal finance tracking.</p>
            <ul>
                <li>Up to 100 transactions</li>
                <li>Basic expense tracking</li>
                <li>Simple financial health score</li>
                <li>Manual transaction entry</li>
            </ul>
        </div>
        
        <div class="feature">
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
        </div>
        
        <div class="feature">
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
        </div>
        
        <h2>Save with Annual Plans</h2>
        <p>Get 2 months free with yearly subscriptions:</p>
        <ul>
            <li>Standard: $49.90/year (save $9.98)</li>
            <li>Premium: $99.90/year (save $19.98)</li>
        </ul>
        
        <p><a href="/auth" class="btn">Start Your Free Account</a></p>
    `;
    
    const html = generateSSRHTML(
        "FinanzerPro Pricing Plans - Free, Standard & Premium", 
        "Choose from Free, Standard ($4.99/month), or Premium ($9.99/month) plans. Receipt scanning, AI categorization, cloud backup, and more.",
        content
    );
    
    res.send(html);
};

// Contact Page SSR
export const contactPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>Contact FinanzerPro</h1>
        <p>Get in touch with our support team for assistance with your personal finance management.</p>
        
        <div class="feature">
            <h3>Support</h3>
            <p>For technical support, billing questions, or feature requests, please use our contact form.</p>
        </div>
        
        <div class="feature">
            <h3>Business Inquiries</h3>
            <p>For partnerships, press inquiries, or business development, contact our team.</p>
        </div>
        
        <div class="feature">
            <h3>Feedback</h3>
            <p>We value your feedback! Let us know how we can improve FinanzerPro to better serve your financial management needs.</p>
        </div>
        
        <div class="feature">
            <h3>Response Time</h3>
            <p>We typically respond to all inquiries within 24 hours during business days.</p>
        </div>
        
        <p><a href="/contact" class="btn">Visit Contact Form</a></p>
    `;
    
    const html = generateSSRHTML(
        "Contact FinanzerPro Support Team",
        "Get in touch with FinanzerPro support for technical assistance, billing questions, or feedback about our financial management platform.",
        content
    );
    
    res.send(html);
};

// Privacy Policy SSR
export const privacyPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Privacy Policy</h1>
        <p>Your privacy and financial data security are our top priorities.</p>
        
        <div class="feature">
            <h3>Information We Collect</h3>
            <p>We collect information you provide when creating accounts, entering financial data, and using our features.</p>
        </div>
        
        <div class="feature">
            <h3>How We Use Your Information</h3>
            <p>Your financial data is used to provide personalized insights, categorization, and financial management features.</p>
        </div>
        
        <div class="feature">
            <h3>Data Security</h3>
            <p>We use industry-standard encryption and security measures to protect your sensitive financial information.</p>
        </div>
        
        <div class="feature">
            <h3>Data Sharing</h3>
            <p>We never sell your personal financial data. Limited data may be shared with trusted service providers for app functionality.</p>
        </div>
        
        <div class="feature">
            <h3>Your Rights</h3>
            <p>You can access, update, or delete your data at any time through your account settings.</p>
        </div>
        
        <p>Last updated: June 2025</p>
        <p><a href="/contact" class="btn">Contact Us</a></p>
    `;
    
    const html = generateSSRHTML(
        "FinanzerPro Privacy Policy - Data Security & Protection",
        "Learn how FinanzerPro protects your financial data with industry-standard security measures and transparent privacy practices.",
        content
    );
    
    res.send(html);
};

// Terms of Service SSR
export const termsPageSSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Terms of Service</h1>
        <p>These terms govern your use of FinanzerPro's financial management services.</p>
        
        <div class="feature">
            <h3>Acceptance of Terms</h3>
            <p>By using FinanzerPro, you agree to these terms and conditions.</p>
        </div>
        
        <div class="feature">
            <h3>Service Description</h3>
            <p>FinanzerPro provides personal finance management tools including expense tracking, budgeting, receipt scanning, and AI-powered insights.</p>
        </div>
        
        <div class="feature">
            <h3>User Responsibilities</h3>
            <p>You are responsible for maintaining the accuracy of your financial data and keeping your account secure.</p>
        </div>
        
        <div class="feature">
            <h3>Subscription Terms</h3>
            <p>Paid plans are billed monthly or yearly. You can cancel anytime from your account settings.</p>
        </div>
        
        <div class="feature">
            <h3>Data Ownership</h3>
            <p>You retain ownership of all financial data you input into FinanzerPro.</p>
        </div>
        
        <div class="feature">
            <h3>Limitation of Liability</h3>
            <p>FinanzerPro provides financial tracking tools but is not responsible for financial decisions made based on the platform.</p>
        </div>
        
        <p>Last updated: June 2025</p>
        <p><a href="/contact" class="btn">Contact Support</a></p>
    `;
    
    const html = generateSSRHTML(
        "FinanzerPro Terms of Service - User Agreement",
        "Terms and conditions for using FinanzerPro's personal finance management platform including subscription terms and user responsibilities.",
        content
    );
    
    res.send(html);
};

// Cookie Policy SSR
export const cookiePolicySSR = (req: Request, res: Response) => {
    const content = `
        <h1>FinanzerPro Cookie Policy</h1>
        <p>This policy explains how we use cookies and similar technologies on FinanzerPro.</p>
        
        <div class="feature">
            <h3>What Are Cookies</h3>
            <p>Cookies are small data files stored on your device when you visit our website. They help us provide a better user experience.</p>
        </div>
        
        <div class="feature">
            <h3>Essential Cookies</h3>
            <p>These cookies are necessary for the website to function properly, including authentication and security features.</p>
        </div>
        
        <div class="feature">
            <h3>Functional Cookies</h3>
            <p>These cookies remember your preferences and settings to enhance your experience with FinanzerPro.</p>
        </div>
        
        <div class="feature">
            <h3>Analytics Cookies</h3>
            <p>We use Google Analytics to understand how users interact with our site and improve our services.</p>
        </div>
        
        <div class="feature">
            <h3>Managing Cookies</h3>
            <p>You can control cookie preferences through our cookie banner or your browser settings.</p>
        </div>
        
        <div class="feature">
            <h3>Third-Party Cookies</h3>
            <p>Some features may use third-party services like Clerk for authentication, which may set their own cookies.</p>
        </div>
        
        <p>Last updated: June 2025</p>
        <p><a href="/contact" class="btn">Contact Us</a></p>
    `;
    
    const html = generateSSRHTML(
        "FinanzerPro Cookie Policy - Privacy & Data Collection",
        "Learn about how FinanzerPro uses cookies for essential functionality, user preferences, and analytics to improve your experience.",
        content
    );
    
    res.send(html);
};