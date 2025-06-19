import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
}

export function SEO({
  title = "FinanzerPro - Smart Personal Finance Management",
  description = "Transform your financial life with FinanzerPro. AI-powered expense tracking, receipt OCR scanning, budgeting tools, and collaborative savings goals. Start free today!",
  keywords = "personal finance, expense tracker, budget app, financial management, receipt scanner, AI categorization, savings goals, financial health, money management, expense tracking",
  canonical = "https://finanzerpro.com",
  ogImage = "https://finanzerpro.com/og-image.png",
  ogType = "website",
  twitterCard = "summary_large_image"
}: SEOProps) {
  const fullTitle = title.includes("FinanzerPro") ? title : `${title} | FinanzerPro`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="FinanzerPro" />

      {/* Twitter */}
      <meta property="twitter:card" content={twitterCard} />
      <meta property="twitter:url" content={canonical} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />
      <meta property="twitter:creator" content="@finanzerpro" />
    </Helmet>
  );
}