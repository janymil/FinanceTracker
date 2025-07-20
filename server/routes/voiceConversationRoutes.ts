import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";

const conversationSchema = z.object({
  transcript: z.string().min(1),
  sessionId: z.string().min(1),
  transactionData: z.object({
    amount: z.number().nullable(),
    description: z.string().nullable(),
    type: z.enum(['income', 'expense']).nullable(),
    date: z.string().optional()
  })
});

export function registerVoiceConversationRoutes(app: Router) {
  const router = Router();

  // Process conversational voice input
  router.post('/conversation', requireAuth(), async (req: Request, res: Response) => {
    try {
      const { transcript, sessionId, transactionData } = conversationSchema.parse(req.body);
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('🎯 [VoiceConversation] Processing:', {
        userId: userId.substring(0, 8) + '...',
        transcript,
        sessionId,
        currentData: transactionData
      });

      // Extract new information from transcript
      const extractedData = extractTransactionInfo(transcript, transactionData);
      console.log('📊 [VoiceConversation] Extracted:', extractedData);

      // Determine what's still missing
      const missingFields = getMissingFields(extractedData);
      const nextField = missingFields[0] || null;
      const isComplete = missingFields.length === 0;

      console.log('✅ [VoiceConversation] Analysis:', {
        missingFields,
        nextField,
        isComplete
      });

      res.json({
        success: true,
        amount: extractedData.amount,
        description: extractedData.description,
        type: extractedData.type,
        date: extractedData.date,
        nextField,
        missingFields,
        isComplete,
        sessionId
      });

    } catch (error) {
      console.error('💥 [VoiceConversation] Error:', error);
      res.status(500).json({ 
        success: false,
        error: "Failed to process voice conversation",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.use('/api/voice', router);
}

// Extract transaction information from transcript
function extractTransactionInfo(transcript: string, existingData: any) {
  const lowerTranscript = transcript.toLowerCase();
  
  // Extract amount
  let amount = existingData.amount;
  const amountMatch = lowerTranscript.match(/\$?(\d+(?:\.\d{2})?)/);
  if (amountMatch && !existingData.amount) {
    amount = parseFloat(amountMatch[1]);
  }

  // Extract description
  let description = existingData.description;
  if (!existingData.description) {
    // Remove amount and common words to get description
    const cleanTranscript = transcript
      .replace(/\$?\d+(?:\.\d{2})?/g, '') // Remove amounts
      .replace(/\b(for|at|from|to|dollar|dollars)\b/gi, '') // Remove common words
      .trim();
    
    if (cleanTranscript && cleanTranscript.length > 2) {
      description = cleanTranscript;
    }
  }

  // Extract type
  let type = existingData.type;
  if (!existingData.type) {
    if (lowerTranscript.includes('income') || lowerTranscript.includes('salary') || 
        lowerTranscript.includes('wage') || lowerTranscript.includes('earn')) {
      type = 'income';
    } else if (lowerTranscript.includes('expense') || lowerTranscript.includes('spent') || 
               lowerTranscript.includes('bought') || lowerTranscript.includes('paid')) {
      type = 'expense';
    }
  }

  return {
    amount,
    description,
    type,
    date: existingData.date || new Date().toISOString().split('T')[0]
  };
}

// Get missing required fields
function getMissingFields(data: any): string[] {
  const missing: string[] = [];
  
  if (!data.amount) missing.push('amount');
  if (!data.description) missing.push('description');
  if (!data.type) missing.push('type');
  
  return missing;
}