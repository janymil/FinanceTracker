import fetch from 'node-fetch';
import { getLanguageLabel, normalizeLanguageCode } from "../lib/languageUtils.js";

export interface MistralRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  response_format?: {
    type: 'json_object';
  };
}

export interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MistralClient {
  private apiKey: string;
  private baseUrl = 'https://api.mistral.ai/v1';
  private defaultModel = 'mistral-small-2506';

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ [Mistral] API key not found in environment variables');
    }
  }

  /**
   * Create chat completion using Mistral Small 2506
   */
  async createChatCompletion(request: MistralRequest): Promise<MistralResponse> {
    if (!this.apiKey) {
      throw new Error('Mistral API key not configured');
    }

    const payload = {
      model: request.model || this.defaultModel,
      messages: request.messages,
      temperature: request.temperature || 0.1,
      max_tokens: request.max_tokens || 1000,
      top_p: request.top_p || 1.0,
      stream: false,
      ...request.response_format && { response_format: request.response_format }
    };

    console.log('🤖 [Mistral] Creating chat completion:', {
      model: payload.model,
      messages: payload.messages.length,
      temperature: payload.temperature,
      hasResponseFormat: !!request.response_format
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Mistral] API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as MistralResponse;
      
      console.log('✅ [Mistral] Completion successful:', {
        model: result.model,
        promptTokens: result.usage?.prompt_tokens || 0,
        completionTokens: result.usage?.completion_tokens || 0,
        totalTokens: result.usage?.total_tokens || 0,
        finishReason: result.choices[0]?.finish_reason
      });

      return result;
    } catch (error) {
      console.error('❌ [Mistral] Request failed:', error);
      throw error;
    }
  }
}