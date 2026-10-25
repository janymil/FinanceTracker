import { log } from '../logger';
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Generate pre-recorded greeting audio files in all languages
export async function generateVoiceGreetings() {
  const greetings = {
    'en': "Tell me about your transaction. I need the amount, what you bought, when it happened, and if it was an expense or income.",
    'sk': "Povedzte mi o vašej transakcii. Potrebujem sumu, čo ste si kúpili, kedy sa to stalo, a či to bol výdavok alebo príjem.",
    'es': "Cuéntame sobre tu transacción. Necesito el monto, qué compraste, cuándo pasó, y si fue un gasto o ingreso."
  };

  const voices = {
    'en': 'alloy',
    'sk': 'alloy', 
    'es': 'alloy'
  };

  for (const [lang, text] of Object.entries(greetings)) {
    try {
      log.info(`🎙️ Generating ${lang} greeting audio...`);
      
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voices[lang as keyof typeof voices] as any,
        input: text,
        speed: 1.0,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      const audioPath = path.join(process.cwd(), 'public', 'audio', `voice-greeting-${lang}.mp3`);
      
      // Ensure directory exists
      const audioDir = path.dirname(audioPath);
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      
      fs.writeFileSync(audioPath, buffer);
      log.info(`✅ Generated ${lang} greeting: ${audioPath}`);
      
    } catch (error) {
      log.error(`❌ Failed to generate ${lang} greeting:`, error);
    }
  }
}

// Call this once to generate all greeting files
generateVoiceGreetings().then(() => {
  log.info('🎉 All voice greetings generated!');
}).catch(console.error);