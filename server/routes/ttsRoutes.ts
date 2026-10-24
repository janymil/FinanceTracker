import { Router, Request, Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { aiGuard } from "../aiAccess";
import { anonymizeText } from "../../shared/aiAnonymizer";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-openai-api-key',
});

const ttsSchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),
  speed: z.number().min(0.25).max(4.0).default(1.0),
  language: z.string().optional() // Add language parameter for voice conversation
});

export function registerTTSRoutes(app: Router) {
  const router = Router();

  // Text-to-Speech endpoint
  // Uses the app's isAuthenticated middleware (401 JSON) instead of Clerk's
  // requireAuth(), which redirects unauthenticated browser requests to "/".
  router.post('/speak', isAuthenticated, aiGuard(), async (req: Request, res: Response) => {
    try {
      const { text, voice, speed, language } = ttsSchema.parse(req.body);
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('🔊 [TTS] Generating speech:', {
        userId: userId.substring(0, 8) + '...',
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        voice,
        speed,
        language: language || 'default'
      });

      // Generate speech using OpenAI TTS with language-specific voice selection
      let selectedVoice = voice;
      
      // Auto-select appropriate voice based on language for better pronunciation
      if (language) {
        if (language.startsWith('sk')) {
          selectedVoice = 'echo'; // Better for Slovak pronunciation
        } else if (language.startsWith('es')) {
          selectedVoice = 'nova'; // Better for Spanish pronunciation
        } else {
          selectedVoice = voice; // Use provided voice for English
        }
      }
      
      console.log('🎙️ [TTS] Using voice for language:', { language, selectedVoice });
      
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: selectedVoice as any,
        // Same boundary as every other AI call: no identifiers leave the server.
        input: anonymizeText(text).text,
        speed: speed,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      // Set appropriate headers for audio
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache'
      });

      console.log('✅ [TTS] Generated audio:', buffer.length, 'bytes');
      res.send(buffer);

    } catch (error) {
      console.error('💥 [TTS] Error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request parameters",
          details: error.errors
        });
      }

      res.status(500).json({ 
        error: "Failed to generate speech",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.use('/api/tts', router);
}