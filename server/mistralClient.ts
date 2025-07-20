import fetch from 'node-fetch';
import { getLanguageLabel, normalizeLanguageCode } from "../lib/languageUtils";

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

class MistralClient {
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
   * Create chat completion using Mistral Small 3.2
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

  /**
   * Process voice input for transaction extraction using Mistral Small 3.2
   */
  async processVoiceInput(
    transcript: string,
    userCategories: Array<{id: number, name: string, type: string}>,
    language: string = 'en-us',
    timezone: string = 'UTC',
    sessionContext?: any
  ): Promise<any> {
    const normalizedLanguage = normalizeLanguageCode(language);
    const languageLabel = getLanguageLabel(normalizedLanguage);

    // Build comprehensive prompt for transaction extraction
    const systemPrompt = `CRITICAL: You MUST respond exclusively in ${languageLabel}. ${languageLabel !== 'English' ? 'Never use English words.' : ''} ALL text content must be in ${languageLabel}.

You are an expert financial data extraction system specialized in voice input processing. Your task is to extract structured transaction data from natural speech input.

USER'S AVAILABLE CATEGORIES:
${userCategories.map(cat => `- ${cat.name} (ID: ${cat.id}, Type: ${cat.type})`).join('\n')}

EXTRACTION RULES:
1. Extract amount, vendor, category, date, type from voice input
2. Parse natural language numbers: "fifty dollars" → 50.00
3. Parse relative dates: "yesterday" → calculate actual date
4. Match vendors to appropriate categories using business type
5. Determine if income or expense from context
6. Use categoryId from user's available categories when possible
7. If uncertain about category (confidence < 0.7), set categoryId: null

LANGUAGE CONTEXT:
- User Language: ${languageLabel}
- Current Date: ${new Date().toISOString().split('T')[0]}
- Timezone: ${timezone}

${sessionContext ? `
SESSION CONTEXT:
${JSON.stringify(sessionContext, null, 2)}
` : ''}

RESPONSE FORMAT (JSON):
{
  "amount": number | null,
  "currency": "USD" | "EUR" | "PEN" | null,
  "vendor": string | null,
  "description": string | null,
  "categoryId": number | null,
  "categoryName": string | null,
  "date": "YYYY-MM-DD" | null,
  "type": "income" | "expense" | null,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation in ${languageLabel}",
  "sessionId": string | null
}

IMPORTANT: Respond with valid JSON only. No markdown, no explanations outside JSON.`;

    const userPrompt = `Voice input to process: "${transcript}"

Extract transaction data following the rules above. Be accurate with numbers, dates, and category matching.`;

    const response = await this.createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Mistral');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('❌ [Mistral] JSON parse error:', parseError);
      console.error('Raw response:', content);
      throw new Error('Invalid JSON response from Mistral');
    }
  }

  /**
   * Process conversational voice input (multi-turn)
   */
  async processConversationalInput(
    transcript: string,
    sessionId: string,
    existingData: any,
    missingFields: string[],
    language: string = 'en-us'
  ): Promise<any> {
    const normalizedLanguage = normalizeLanguageCode(language);
    const languageLabel = getLanguageLabel(normalizedLanguage);

    const systemPrompt = `CRITICAL: You MUST respond exclusively in ${languageLabel}. ${languageLabel !== 'English' ? 'Never use English words.' : ''} ALL text content must be in ${languageLabel}.

You are processing a conversational voice input for transaction completion. The user is providing missing information for a transaction in progress.

EXISTING TRANSACTION DATA:
${JSON.stringify(existingData, null, 2)}

MISSING FIELDS: ${missingFields.join(', ')}

TASK: Update the transaction data with new information from user input.

CONVERSATION RULES:
1. If user provides missing information, update corresponding fields
2. If user corrects existing information, replace old values
3. Keep existing data that wasn't mentioned
4. Parse natural language: "five dollars" → 5.00, "yesterday" → date
5. Return complete updated transaction object

RESPONSE FORMAT (JSON):
{
  "amount": number | null,
  "vendor": string | null,
  "description": string | null,
  "categoryId": number | null,
  "categoryName": string | null,
  "date": "YYYY-MM-DD" | null,
  "type": "income" | "expense" | null,
  "confidence": 0.0-1.0,
  "missingFields": ["field1", "field2"],
  "reasoning": "Brief explanation in ${languageLabel}",
  "sessionId": "${sessionId}"
}

IMPORTANT: Respond with valid JSON only.`;

    const userPrompt = `Previous context: ${JSON.stringify(existingData, null, 2)}
New user input: "${transcript}"

Update the transaction data with this new information.`;

    const response = await this.createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Mistral');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('❌ [Mistral] Conversational JSON parse error:', parseError);
      console.error('Raw response:', content);
      throw new Error('Invalid JSON response from Mistral');
    }
  }

  /**
   * Check if Mistral API is available
   */
  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await this.createChatCompletion({
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 10
      });
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      console.error('❌ [Mistral] Health check failed:', error);
      return false;
    }
  }

  /**
   * Calculate estimated cost for a request
   */
  calculateCost(promptTokens: number, completionTokens: number): number {
    const inputCost = (promptTokens / 1_000_000) * 0.10; // $0.10 per 1M input tokens
    const outputCost = (completionTokens / 1_000_000) * 0.30; // $0.30 per 1M output tokens
    return inputCost + outputCost;
  }
}

export const mistralClient = new MistralClient();