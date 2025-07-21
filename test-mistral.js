// Test if Mistral API is working
import { MistralClient } from './server/mistralClient.js';

async function testMistral() {
  console.log('🧪 Testing Mistral API connection...');
  
  const client = new MistralClient();
  
  try {
    const response = await client.createChatCompletion({
      messages: [
        { role: 'system', content: 'You are a financial transaction parser. Respond with JSON.' },
        { role: 'user', content: 'Parse this: "trabajo salario 2500 soles hoy"' }
      ],
      model: 'mistral-small-2506',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    
    console.log('✅ Mistral API working! Response:', response.choices[0].message.content);
    
  } catch (error) {
    console.error('❌ Mistral API failed:', error.message);
  }
}

testMistral();