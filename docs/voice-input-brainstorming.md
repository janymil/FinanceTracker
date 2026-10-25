# Voice Input for Financial Transactions - Technical Brainstorming

## Overview
Implementation plan for intelligent voice input functionality that allows users to naturally speak transaction details instead of manually filling forms. The system will extract relevant information (amount, vendor, category, date) and handle ambiguities through conversational AI.

## Current Architecture Analysis

### Transaction Data Structure
- **Table**: `transactions` with fields for amount, description, date, type, categoryId, recurring options
- **OCR Integration**: Existing fields for receipt processing (ocrText, ocrVendor, ocrDetectedAmount)
- **Multi-language**: Built-in support for en-us, es-pe, sk-sk

### Existing AI Capabilities
- **Categorization**: `categorizeExpense` and `categorizeExpenseWithUserCategories` functions
- **Merchant Recognition**: Pattern matching for common vendors
- **Language Support**: AI responses adapt to user's preferred language
- **OpenAI Integration**: GPT-4o already configured

### Current Limitations
- No voice input infrastructure
- No speech-to-text capabilities
- No conversational UI patterns

## Speech-to-Text Options

### 1. Web Speech API (Browser-based)
**Pros:**
- Free, built into modern browsers
- Real-time transcription
- Multi-language support
- No external dependencies
- Immediate implementation possible

**Cons:**
- Browser compatibility issues
- Variable accuracy
- Privacy concerns (uses browser's speech service)
- No conversation flow control

### 2. OpenAI Whisper
**Pros:**
- High accuracy transcription
- Supports 99+ languages
- Integrates with existing OpenAI setup
- Can handle accents and noise

**Cons:**
- Costs ~$0.006/minute
- Requires audio file upload (latency)
- Not real-time streaming

### 3. Mistral Voxtral
**Pros:**
- New speech-to-text model from Mistral
- Potentially lower cost than Whisper
- European data privacy compliance
- Good multilingual support

**Cons:**
- Newer service (less proven)
- Requires new API integration
- Limited documentation
- May have regional availability

### 4. Google Cloud Speech-to-Text
**Pros:**
- Enterprise-grade accuracy
- Real-time streaming
- 120+ language support
- Enhanced phone call model

**Cons:**
- Costs ~$0.009/minute
- Complex Google Cloud setup
- Another service dependency

### 5. Deepgram
**Pros:**
- Real-time streaming
- Low latency (~300ms)
- Cost-effective ($0.0125/minute)
- Good accuracy

**Cons:**
- Another API to integrate
- Less language coverage than others

## Recommended Implementation Approach

### Phase 1: MVP with Web Speech API
1. **Frontend Voice Component**
   ```typescript
   interface VoiceInputProps {
     onTranscript: (text: string) => void;
     language: string;
   }
   ```

2. **Basic Extraction**
   - Use Web Speech API for free transcription
   - Send transcript to GPT-4 for parsing
   - Extract: amount, vendor, category hint, date

3. **Simple UI Flow**
   - Microphone button on transaction pages
   - Show real-time transcript
   - Display extracted fields
   - Allow user to confirm/edit

### Phase 2: Enhanced with Whisper/Voxtral
1. **Fallback Mechanism**
   ```typescript
   const transcribeAudio = async (audioBlob: Blob) => {
     try {
       // Try Web Speech API first
       return await webSpeechTranscribe(audioBlob);
     } catch (error) {
       // Fallback to Whisper or Voxtral
       return await whisperTranscribe(audioBlob);
     }
   };
   ```

2. **Improved Accuracy**
   - Use Whisper/Voxtral for noisy environments
   - Better handling of accents
   - Support for more languages

### Phase 3: Conversational AI
1. **Multi-turn Dialogue**
   ```typescript
   interface ConversationState {
     sessionId: string;
     transcript: string[];
     extractedData: Partial<Transaction>;
     missingFields: string[];
     context: any;
   }
   ```

2. **Interactive Flow**
   - System asks for missing information
   - Handles clarifications
   - Remembers context within session

## Natural Language Processing Pipeline

### 1. Transcript Processing
```typescript
interface VoiceProcessingRequest {
  transcript: string;
  userLanguage: string;
  userTimezone: string;
  userId: string;
  conversationContext?: ConversationState;
}
```

### 2. GPT-4 Extraction Prompt
```typescript
const extractionPrompt = `
Extract financial transaction details from: "${transcript}"

Context:
- User language: ${userLanguage}
- Current date: ${currentDate}
- User timezone: ${userTimezone}

Extract and return as JSON:
{
  "amount": number | null,
  "currency": "USD" | "EUR" | "PEN" | null,
  "vendor": string | null,
  "description": string | null,
  "category_hint": string | null,
  "date_reference": string | null,
  "type": "income" | "expense" | null,
  "recurring_hint": boolean | null,
  "confidence": 0.0-1.0,
  "ambiguities": string[],
  "follow_up_questions": string[]
}

Examples:
- "I spent fifty two dollars at Walmart" → {amount: 52, vendor: "Walmart", type: "expense"}
- "Got paid three thousand yesterday" → {amount: 3000, type: "income", date_reference: "yesterday"}
- "Coffee this morning" → {category_hint: "dining", date_reference: "this morning", ambiguities: ["amount"]}
`;
```

### 3. Date Intelligence
```typescript
const parseDateReference = (reference: string, timezone: string): Date => {
  const today = new Date();
  const references = {
    'today': () => today,
    'yesterday': () => subDays(today, 1),
    'this morning': () => setHours(today, 9),
    'last week': () => subWeeks(today, 1),
    'last friday': () => previousFriday(today),
    // Add more patterns
  };
  
  return references[reference.toLowerCase()]?.() || today;
};
```

### 4. Category Enhancement
- Leverage existing `categorizeExpenseWithUserCategories`
- Add voice-specific patterns:
  ```typescript
  const voiceCategoryHints = {
    'groceries': 'Food & Dining',
    'coffee': 'Food & Dining',
    'uber': 'Transportation',
    'salary': 'Income',
    'rent': 'Housing',
    // Extend based on common voice inputs
  };
  ```

## UI/UX Design

### 1. Voice Button Placement
- Floating action button on dashboard
- Inline button in transaction forms
- Quick access from expense/income pages

### 2. Recording Interface
```typescript
interface VoiceRecordingUI {
  status: 'idle' | 'recording' | 'processing' | 'confirming';
  transcript: string;
  extractedData: Partial<Transaction>;
  confidence: number;
  error?: string;
}
```

### 3. Visual Feedback
- Microphone animation while recording
- Real-time transcript display
- Processing spinner
- Extracted fields preview
- Confidence indicators

### 4. Confirmation Flow
- Show extracted data before saving
- Highlight low-confidence fields
- Allow inline editing
- Option to re-record

## Backend Architecture

### 1. New API Endpoints
```typescript
// POST /api/voice/process
interface VoiceProcessEndpoint {
  audio?: Blob;  // Optional if using Web Speech API
  transcript?: string;  // Direct transcript
  language: string;
  sessionId?: string;  // For conversations
}

// POST /api/voice/conversation
interface ConversationEndpoint {
  sessionId: string;
  message: string;
  context: ConversationState;
}
```

### 2. Processing Service
```typescript
class VoiceTransactionService {
  async processVoiceInput(input: VoiceInput): Promise<ProcessedTransaction> {
    // 1. Transcribe if audio provided
    const transcript = input.audio 
      ? await this.transcribe(input.audio)
      : input.transcript;
    
    // 2. Extract transaction data
    const extracted = await this.extractWithAI(transcript);
    
    // 3. Enhance with categorization
    if (extracted.vendor || extracted.description) {
      extracted.category = await this.categorizeExpense(extracted);
    }
    
    // 4. Parse date references
    if (extracted.date_reference) {
      extracted.date = this.parseDateReference(extracted.date_reference);
    }
    
    // 5. Validate and return
    return this.validateTransaction(extracted);
  }
}
```

### 3. Database Updates
```sql
-- Add voice tracking fields
ALTER TABLE transactions ADD COLUMN voice_created BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN voice_transcript TEXT;
ALTER TABLE transactions ADD COLUMN voice_confidence DECIMAL(3,2);

-- Voice usage analytics
CREATE TABLE voice_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  transcript TEXT,
  extracted_data JSONB,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Multi-language Considerations

### 1. Language Detection
```typescript
// Auto-detect from user settings
const getUserVoiceLanguage = (user: User): string => {
  const langMap = {
    'en-us': 'en-US',
    'es-pe': 'es-PE',
    'sk-sk': 'sk-SK'
  };
  return langMap[user.language] || 'en-US';
};
```

### 2. Localized Responses
- Translate follow-up questions
- Use language-appropriate number formats
- Handle currency mentions (dollars, euros, soles)

### 3. Cultural Adaptations
- Date formats (MM/DD vs DD/MM)
- Currency assumptions
- Common vendor names by region

## Security & Privacy

### 1. Audio Handling
- Process audio client-side when possible
- Don't store raw audio files
- Encrypt transcripts at rest
- Auto-delete after processing

### 2. Data Protection
- Anonymize transcripts for AI processing
- Strip personal information
- Use existing encryption patterns
- Implement audit logging

### 3. User Consent
- Add voice permissions to settings
- Opt-in for voice features
- Clear data retention policy
- GDPR compliance for EU users

## Cost Analysis

### Monthly Estimates (1000 transactions)

#### Option 1: Web Speech API Only
- Transcription: $0
- AI Processing: $10-30 (GPT-4)
- **Total: $10-30/month**

#### Option 2: Web Speech + Whisper Fallback
- Transcription: $5-10 (20% fallback rate)
- AI Processing: $10-30
- **Total: $15-40/month**

#### Option 3: Whisper/Voxtral Primary
- Transcription: $15-25
- AI Processing: $10-30
- **Total: $25-55/month**

#### Option 4: Enterprise (Google/Azure)
- Transcription: $20-30
- AI Processing: $10-30
- Additional features: $10-20
- **Total: $40-80/month**

## Implementation Roadmap

### Week 1-2: Basic Voice Input
- [ ] Create voice button component
- [ ] Implement Web Speech API
- [ ] Basic transcript display
- [ ] Simple GPT-4 extraction

### Week 3-4: Smart Processing
- [ ] Integrate with existing categorization
- [ ] Add date parsing
- [ ] Implement confirmation UI
- [ ] Multi-language support

### Week 5-6: Enhanced Features
- [ ] Add Whisper/Voxtral fallback
- [ ] Conversation memory
- [ ] Voice analytics
- [ ] Error handling

### Week 7-8: Polish & Launch
- [ ] User testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Feature flags for rollout

## Alternative Approaches

### 1. Voice Commands System
Instead of natural language, use structured commands:
- "Add expense fifty dollars Walmart food"
- "Income three thousand salary"
- "Quick expense twenty uber"

### 2. Voice Shortcuts
Pre-defined voice macros for common transactions:
- "Morning coffee" → $5 at usual cafe
- "Lunch" → $15 food expense
- "Payday" → Regular salary amount

### 3. Voice Review
Use voice to review/confirm existing transactions:
- "Read today's expenses"
- "Confirm pending transactions"
- "Categorize uncategorized"

## Success Metrics

### Technical Metrics
- Transcription accuracy: >95%
- Processing time: <3 seconds
- Extraction accuracy: >90%
- Fallback rate: <20%

### User Metrics
- Voice adoption rate: 30% of users
- Transaction creation time: 50% reduction
- Error rate: <10%
- User satisfaction: >4.5/5

## Conclusion

The recommended approach is to start with Web Speech API for free transcription, enhanced by GPT-4 for intelligent extraction. This provides immediate value with minimal cost increase. As usage grows, add Whisper or Voxtral for better accuracy and implement conversational features for a more natural experience.

The existing AI categorization and multi-language support provide a strong foundation for building an intelligent voice input system that can understand natural speech and accurately create financial transactions.