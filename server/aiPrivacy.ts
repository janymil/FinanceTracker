
export const AI_PRIVACY_CONFIG = {
  // Enable data anonymization for all AI requests
  ANONYMIZE_DATA: true,
  
  // Log all AI requests for privacy auditing
  LOG_AI_REQUESTS: true,
  
  // Rate limit AI requests per user to prevent data mining
  MAX_AI_REQUESTS_PER_HOUR: 50,
  
  // Cache results to reduce external API calls
  CACHE_AI_RESULTS: true,
  
  // Optional: Use a dedicated OpenAI organization with DPAs
  OPENAI_ORGANIZATION: process.env.OPENAI_ORG_ID || undefined,
};

export function logAIRequest(userId: string, requestType: string, dataHash: string) {
  if (AI_PRIVACY_CONFIG.LOG_AI_REQUESTS) {
    console.log(`[AI_PRIVACY] User ${userId} - ${requestType} - Hash: ${dataHash.substring(0, 8)}`);
  }
}
