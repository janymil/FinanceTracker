export const clerkFrontendApi = import.meta.env.VITE_CLERK_ENV === 'production'
  ? import.meta.env.VITE_CLERK_PROD_FRONTEND_API || ''
  : import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';