/**
 * OpenAI Cost Calculator
 * 
 * Calculates the cost of OpenAI API calls based on current pricing.
 * Updated pricing as of December 2024.
 */

// Current OpenAI pricing (per 1,000 tokens unless specified)
const MODEL_PRICING = {
  'gpt-4o': {
    input: 0.005,    // $0.005 per 1K input tokens
    output: 0.015,   // $0.015 per 1K output tokens
  },
  'gpt-4o-mini': {
    input: 0.00015,  // $0.00015 per 1K input tokens
    output: 0.0006,  // $0.0006 per 1K output tokens
  },
  'gpt-4': {
    input: 0.03,     // $0.03 per 1K input tokens
    output: 0.06,    // $0.06 per 1K output tokens
  },
  'gpt-3.5-turbo': {
    input: 0.001,    // $0.001 per 1K input tokens
    output: 0.002,   // $0.002 per 1K output tokens
  },
  'dall-e-3': {
    '1024x1024': 0.04,     // $0.04 per image (standard quality)
    '1024x1792': 0.08,     // $0.08 per image (HD)
    '1792x1024': 0.08,     // $0.08 per image (HD)
  },
  'dall-e-2': {
    '1024x1024': 0.02,     // $0.02 per image
    '512x512': 0.018,      // $0.018 per image
    '256x256': 0.016,      // $0.016 per image
  }
} as const;

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ImageGeneration {
  model: 'dall-e-3' | 'dall-e-2';
  size: '1024x1024' | '1024x1792' | '1792x1024' | '512x512' | '256x256';
  quality?: 'standard' | 'hd';
  count: number;
}

/**
 * Calculate cost for text generation models (GPT family)
 */
export function calculateTextCost(
  usage: TokenUsage, 
  model: keyof typeof MODEL_PRICING
): number {
  if (model.startsWith('dall-e')) {
    throw new Error('Use calculateImageCost for DALL-E models');
  }

  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  if (!pricing || typeof pricing === 'object' && !('input' in pricing)) {
    console.warn(`Unknown model pricing: ${model}`);
    return 0;
  }

  if (!usage || typeof usage !== 'object') {
    return 0;
  }

  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;

  const inputCost = (inputTokens / 1000) * (pricing as {input: number, output: number}).input;
  const outputCost = (outputTokens / 1000) * (pricing as {input: number, output: number}).output;

  return inputCost + outputCost;
}

/**
 * Calculate cost for image generation models (DALL-E family)
 */
export function calculateImageCost(
  generation: ImageGeneration
): number {
  const model = generation.model;
  const size = generation.size;
  const count = generation.count || 1;

  if (!MODEL_PRICING[model]) {
    console.warn(`Unknown image model: ${model}`);
    return 0;
  }

  const pricing = MODEL_PRICING[model];
  
  // For DALL-E-3, adjust pricing based on quality
  if (model === 'dall-e-3' && generation.quality === 'hd' && size !== '1024x1024') {
    // HD quality for non-standard sizes
    return (pricing['1024x1792'] || pricing['1792x1024'] || 0.08) * count;
  }

  const costPerImage = pricing[size as keyof typeof pricing] as number;
  if (typeof costPerImage !== 'number') {
    console.warn(`Unknown size ${size} for model ${model}`);
    return 0;
  }

  return costPerImage * count;
}

/**
 * Generic cost calculation function that determines the appropriate method
 */
export function calculateCost(
  data: TokenUsage | ImageGeneration, 
  model: string
): number {
  try {
    // Check if it's an image generation request
    if (model.startsWith('dall-e') && 'size' in data) {
      return calculateImageCost(data as ImageGeneration);
    }
    
    // Otherwise treat as text generation
    return calculateTextCost(data as TokenUsage, model as keyof typeof MODEL_PRICING);
  } catch (error) {
    console.error('Error calculating AI cost:', error);
    return 0;
  }
}

/**
 * Get model pricing information for admin display
 */
export function getModelPricing() {
  return MODEL_PRICING;
}

/**
 * Estimate cost before making a request (for budgeting)
 */
export function estimateTextCost(
  inputText: string,
  model: keyof typeof MODEL_PRICING,
  estimatedOutputTokens: number = 100
): number {
  if (model.startsWith('dall-e')) {
    throw new Error('Use estimateImageCost for DALL-E models');
  }

  // Rough estimation: ~4 characters per token for English text
  const estimatedInputTokens = Math.ceil(inputText.length / 4);
  
  const usage: TokenUsage = {
    prompt_tokens: estimatedInputTokens,
    completion_tokens: estimatedOutputTokens,
    total_tokens: estimatedInputTokens + estimatedOutputTokens
  };

  return calculateTextCost(usage, model);
}

/**
 * Format cost for display (e.g., "$0.0023")
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

/**
 * Get cost breakdown for admin analytics
 */
export function getCostBreakdown(
  usage: TokenUsage,
  model: string
): { inputCost: number; outputCost: number; total: number } {
  if (model.startsWith('dall-e')) {
    const total = calculateCost(usage as any, model);
    return { inputCost: 0, outputCost: total, total };
  }

  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  if (!pricing || typeof pricing !== 'object' || !('input' in pricing)) {
    return { inputCost: 0, outputCost: 0, total: 0 };
  }

  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;

  const inputCost = (inputTokens / 1000) * (pricing as {input: number}).input;
  const outputCost = (outputTokens / 1000) * (pricing as {output: number}).output;

  return {
    inputCost,
    outputCost,
    total: inputCost + outputCost
  };
}