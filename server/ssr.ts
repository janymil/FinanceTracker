import React from 'react';
import { renderToString } from 'react-dom/server';

// Simple SSR for crawlers - generates static HTML with proper meta tags
export function renderPageForCrawler(route: string): string {
  const getPageData = (path: string) => {
    switch (path) {
      case '/':
        return {
          title: 'FinanzerPro - Smart Personal Finance Management',
          description: 'Take control of your finances with FinanzerPro. Track expenses, set budgets, achieve goals, and get AI-powered insights for better financial decisions.',
          keywords: 'personal finance, expense tracking, budgeting, financial goals, money management'
        };
      case '/pricing':
        return {
          title: 'FinanzerPro Pricing Plans - Free, Standard & Premium',
          description: 'Choose the perfect FinanzerPro plan for your needs. Free plan with basic tracking, Standard with budgets and AI, Premium with unlimited features.',
          keywords: 'pricing, subscription, plans, free, standard, premium, financial software'
        };
      case '/help':
        return {
          title: 'FinanzerPro Help & Documentation',
          description: 'Complete guide to using FinanzerPro. Learn about expense tracking, budgeting, goals, AI features, and mobile receipt scanning.',
          keywords: 'help, documentation, guide, tutorial, support, features'
        };
      case '/contact':
        return {
          title: 'Contact FinanzerPro Support Team',
          description: 'Get help with FinanzerPro. Contact our support team for questions about features, billing, or technical assistance.',
          keywords: 'contact, support, help, customer service, technical assistance'
        };
      default:
        return {
          title: 'FinanzerPro - Smart Personal Finance Management',
          description: 'Professional financial management application for tracking expenses, budgets, and goals.',
          keywords: 'finance, budgeting, expense tracking'
        };
    }
  };

  const pageData = getPageData(route);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageData.title}</title>
    <meta name="description" content="${pageData.description}">
    <meta name="keywords" content="${pageData.keywords}">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://finanzerpro.com${route}">
    <meta property="og:title" content="${pageData.title}">
    <meta property="og:description" content="${pageData.description}">
    <meta property="og:image" content="https://finanzerpro.com/og-image.png">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://finanzerpro.com${route}">
    <meta property="twitter:title" content="${pageData.title}">
    <meta property="twitter:description" content="${pageData.description}">
    <meta property="twitter:image" content="https://finanzerpro.com/og-image.png">

    <!-- Canonical URL -->
    <link rel="canonical" href="https://finanzerpro.com${route}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.svg">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
    <div id="root">
        <header>
            <h1>FinanzerPro</h1>
            <nav>
                <a href="/">Home</a>
                <a href="/pricing">Pricing</a>
                <a href="/help">Help</a>
                <a href="/contact">Contact</a>
            </nav>
        </header>
        <main>
            ${getPageContent(route)}
        </main>
        <footer>
            <p>&copy; 2025 FinanzerPro. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;
}

function getPageContent(route: string): string {
  switch (route) {
    case '/':
      return `
        <section>
            <h1>Smart Personal Finance Management</h1>
            <p>Take control of your finances with FinanzerPro's comprehensive expense tracking, budgeting tools, and AI-powered insights.</p>
            
            <h2>Key Features</h2>
            <ul>
                <li>Expense and Income Tracking</li>
                <li>Budget Management</li>
                <li>Financial Goals</li>
                <li>AI-Powered Categorization</li>
                <li>Receipt OCR Scanning</li>
                <li>Mobile QR Code Upload</li>
                <li>Cloud Backup & Export</li>
                <li>Financial Health Analysis</li>
            </ul>
            
            <h2>Subscription Plans</h2>
            <div>
                <h3>Free Plan</h3>
                <p>Basic expense tracking with up to 100 transactions</p>
                
                <h3>Standard Plan - $4.99/month</h3>
                <p>Enhanced features including budgets, goals, AI categorization, and receipt scanning</p>
                
                <h3>Premium Plan - $9.99/month</h3>
                <p>Unlimited transactions, advanced analytics, AI insights, and cloud backup</p>
            </div>
        </section>
      `;
    
    case '/pricing':
      return `
        <section>
            <h1>Pricing Plans</h1>
            <p>Choose the perfect plan for your financial management needs</p>
            
            <div>
                <h2>Free Plan - $0/month</h2>
                <ul>
                    <li>Up to 100 transactions</li>
                    <li>Basic expense tracking</li>
                    <li>Income management</li>
                    <li>Simple categories</li>
                </ul>
                
                <h2>Standard Plan - $4.99/month</h2>
                <ul>
                    <li>Up to 100 transactions</li>
                    <li>Budget management</li>
                    <li>Financial goals</li>
                    <li>AI expense categorization</li>
                    <li>Receipt OCR scanning</li>
                    <li>Mobile QR code upload</li>
                    <li>Transaction reminders</li>
                </ul>
                
                <h2>Premium Plan - $9.99/month</h2>
                <ul>
                    <li>Unlimited transactions</li>
                    <li>Advanced analytics</li>
                    <li>AI financial insights</li>
                    <li>Expense predictions</li>
                    <li>Daily recommendations</li>
                    <li>Cloud backup & restore</li>
                    <li>Data export (PDF, Excel)</li>
                    <li>Financial health analysis</li>
                </ul>
            </div>
        </section>
      `;
    
    case '/help':
      return `
        <section>
            <h1>Help & Documentation</h1>
            <p>Complete guide to using FinanzerPro effectively</p>
            
            <h2>Getting Started</h2>
            <p>Learn how to set up your account and start tracking your finances</p>
            
            <h2>Features Guide</h2>
            <ul>
                <li>Expense and Income Tracking</li>
                <li>Budget Management</li>
                <li>Goal Setting</li>
                <li>Receipt Scanning with OCR</li>
                <li>Mobile QR Code Upload</li>
                <li>AI-Powered Features</li>
                <li>Reports and Analytics</li>
                <li>Data Management</li>
            </ul>
            
            <h2>Mobile Features</h2>
            <p>Use your phone to scan receipts and upload them via QR codes for seamless expense tracking</p>
            
            <h2>AI Assistant</h2>
            <p>Get personalized financial tips and automatic expense categorization with our AI-powered features</p>
            
            <h2>Support</h2>
            <p>Need help? Contact our support team or browse our FAQ section</p>
        </section>
      `;
    
    case '/contact':
      return `
        <section>
            <h1>Contact Support</h1>
            <p>Get help with FinanzerPro features, billing, or technical issues</p>
            
            <h2>Support Options</h2>
            <ul>
                <li>Email Support: info@finanzerpro.com</li>
                <li>Documentation: Browse our help section</li>
                <li>FAQ: Common questions and answers</li>
            </ul>
            
            <h2>Business Inquiries</h2>
            <p>For business partnerships or enterprise solutions, contact our team</p>
            
            <h2>Technical Support</h2>
            <p>Having technical issues? Our support team can help with:</p>
            <ul>
                <li>Account setup and login issues</li>
                <li>Feature usage and guidance</li>
                <li>Billing and subscription questions</li>
                <li>Data import/export assistance</li>
            </ul>
        </section>
      `;
    
    default:
      return `
        <section>
            <h1>FinanzerPro</h1>
            <p>Smart Personal Finance Management</p>
        </section>
      `;
  }
}