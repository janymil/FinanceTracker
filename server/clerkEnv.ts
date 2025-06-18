export const clerkApiKey = process.env.CLERK_ENV === 'production'
  ? process.env.CLERK_PROD_API_KEY || ''
  : process.env.CLERK_SECRET_KEY || '';

export const clerkPublishableKey = process.env.CLERK_ENV === 'production'
  ? process.env.CLERK_PROD_FRONTEND_API || ''
  : process.env.VITE_CLERK_PUBLISHABLE_KEY || '';