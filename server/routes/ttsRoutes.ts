import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ttsSchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),
  speed: z.number().min(0.25).max(4.0).default(1.0)
});

export function registerTTSRoutes(app: Router) {
  const router = Router();

  // Text-to-Speech endpoint
  router.post('/speak', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { text, voice, speed } = ttsSchema.parse(req.body);
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('🔊 [TTS] Generating speech:', {
        userId: userId.substring(0, 8) + '...',
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        voice,
        speed
      });

      // Generate speech using OpenAI TTS
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice as any,
        input: text,
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