
import { createRoutedClient } from '../lib/aiProvider';

// Routed through lib/aiProvider (gpt-6-luna by default, DeepSeek/Groq fallbacks).
export const openai = createRoutedClient();
