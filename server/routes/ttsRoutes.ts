import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage } from "../categoryTranslations";
import { TTSService, type TTSRequest } from "../ttsService";

export function registerTTSRoutes(app: Express) {
  // Generate speech audio from text
  app.post('/api/tts/speak', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      
      // Require standard+ plan for TTS features
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ 
          message: "Text-to-speech requires Standard or Premium subscription" 
        });
      }

      const { text, voice, speed } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }

      if (text.length > 4096) {
        return res.status(400).json({ 
          message: "Text too long. Maximum 4096 characters allowed." 
        });
      }

      // SECURITY: Only allow transaction-related TTS
      const isTransactionRelated = TTSService.isTransactionRelated(text);
      if (!isTransactionRelated) {
        console.log('❌ [TTS] Text rejected - not transaction-related:', {
          text: text.substring(0, 100),
          userId: userId.substring(0, 8)
        });
        return res.status(400).json({ 
          message: "TTS is restricted to transaction-related content only." 
        });
      }

      // Get user language
      const language = getUserLanguage(req);

      const ttsRequest: TTSRequest = {
        text: text.trim(),
        language,
        voice,
        speed: speed || 1.0
      };

      // Generate speech audio
      const audioBuffer = await TTSService.generateSpeech(ttsRequest);

      // Set response headers for audio
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-TTS-Cost': TTSService.estimateCost(text.length).toFixed(4),
        'X-TTS-Text-Length': text.length
      });

      return res.send(audioBuffer);
    } catch (error) {
      console.error("Error generating TTS audio:", error);
      return res.status(500).json({ message: "Failed to generate speech audio" });
    }
  });

  // Generate contextual question for missing transaction field
  app.post('/api/tts/question', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      
      // Require standard+ plan for TTS features
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ 
          message: "TTS questions require Standard or Premium subscription" 
        });
      }

      const { field, extractedData, generateAudio = true, sessionId } = req.body;

      if (!field) {
        return res.status(400).json({ message: "Field parameter is required" });
      }

      // SECURITY: Validate transaction field and session
      const allowedFields = ['amount', 'vendor', 'category', 'date', 'type'];
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ 
          message: `Invalid field. Only transaction fields allowed: ${allowedFields.join(', ')}` 
        });
      }

      // Validate session context if provided
      if (sessionId && extractedData && !TTSService.isValidTransactionSession(sessionId, extractedData)) {
        return res.status(400).json({ 
          message: "Invalid transaction session context." 
        });
      }

      // Get user language
      const language = getUserLanguage(req);

      // Generate contextual question
      const questionText = await TTSService.generateQuestionForMissingField(
        field, 
        extractedData || {}, 
        language
      );

      const response: any = {
        question: questionText,
        field,
        language,
        estimatedCost: TTSService.estimateCost(questionText.length)
      };

      // Generate audio if requested
      if (generateAudio) {
        try {
          const audioBuffer = await TTSService.generateSpeech({
            text: questionText,
            language
          });

          // Return audio as base64 for easy handling in frontend
          response.audioData = audioBuffer.toString('base64');
          response.audioFormat = 'mp3';
        } catch (audioError) {
          console.warn('Failed to generate audio for question:', audioError);
          // Still return the text question even if audio fails
        }
      }

      return res.json(response);
    } catch (error) {
      console.error("Error generating TTS question:", error);
      return res.status(500).json({ message: "Failed to generate question" });
    }
  });

  // Generate confirmation message
  app.post('/api/tts/confirm', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      
      // Require standard+ plan for TTS features
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ 
          message: "TTS confirmation requires Standard or Premium subscription" 
        });
      }

      const { transactionData, generateAudio = true } = req.body;

      if (!transactionData) {
        return res.status(400).json({ message: "Transaction data is required" });
      }

      // Get user language
      const language = getUserLanguage(req);

      // Generate confirmation message
      const confirmationText = TTSService.generateConfirmationMessage(
        transactionData, 
        language
      );

      const response: any = {
        confirmation: confirmationText,
        language,
        estimatedCost: TTSService.estimateCost(confirmationText.length)
      };

      // Generate audio if requested
      if (generateAudio) {
        try {
          const audioBuffer = await TTSService.generateSpeech({
            text: confirmationText,
            language
          });

          response.audioData = audioBuffer.toString('base64');
          response.audioFormat = 'mp3';
        } catch (audioError) {
          console.warn('Failed to generate confirmation audio:', audioError);
        }
      }

      return res.json(response);
    } catch (error) {
      console.error("Error generating TTS confirmation:", error);
      return res.status(500).json({ message: "Failed to generate confirmation" });
    }
  });

  // Get TTS usage statistics for user
  app.get('/api/tts/usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // For now, return basic usage info
      // TODO: Implement usage tracking in database
      const usage = {
        currentMonth: {
          requests: 0,
          characters: 0,
          estimatedCost: 0
        },
        limits: {
          free: { characters: 0, cost: 0 },
          standard: { characters: 50000, cost: 0.75 }, // ~$0.75/month
          premium: { characters: 200000, cost: 3.00 }   // ~$3.00/month
        }
      };

      return res.json(usage);
    } catch (error) {
      console.error("Error fetching TTS usage:", error);
      return res.status(500).json({ message: "Failed to fetch usage" });
    }
  });
}