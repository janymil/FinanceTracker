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
  title = "Kaptia - Smart Spending Tracker with AI Insights",
  description = "Kaptia turns receipts, voice notes and statements into a clear picture of your spending. Snap a photo, speak a note, or import a file - AI organizes the rest. Start free today!",
  keywords = "spending tracker, expense tracker, budget planner, receipt scanner, voice expense input, AI categorization, savings goals, smart budgeting, expense tracking",
  canonical = "https://kaptia.app",
  ogImage = "https://kaptia.app/og-image.png",
  ogType = "website",
  twitterCard = "summary_large_image"
}: SEOProps) {
  const fullTitle = title.includes("Kaptia") ? title : `${title} | Kaptia`;

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
      <meta property="og:site_name" content="Kaptia" />

      {/* Twitter */}
      <meta property="twitter:card" content={twitterCard} />
      <meta property="twitter:url" content={canonical} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />
      <meta property="twitter:creator" content="@kaptia" />
    </Helmet>
  );
}