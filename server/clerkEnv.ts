export const clerkApiKey = process.env.CLERK_ENV === 'production'
  ? process.env.CLERK_PROD_API_KEY || ''
  : process.env.CLERK_SECRET_KEY || '';