import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-processor' });
});

// Generate financial tip endpoint
app.post('/generate-financial-tip', async (req, res) => {
  try {
    const { summary } = req.body;

    // Validate required fields
    if (!summary || typeof summary !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid request: summary field (string) is required' 
      });
    }

    // Make OpenAI API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI Financial Analyst providing premium-level insights. Your analysis must demonstrate these EXACT capabilities that users pay for:

1. SPENDING PATTERN ANALYSIS: Identify spending trends, seasonal patterns, category concentrations, and behavioral insights
2. PERSONALIZED SAVING RECOMMENDATIONS: Calculate specific saving opportunities based on their exact income/expense ratios
3. BUDGET OPTIMIZATION SUGGESTIONS: Recommend category rebalancing with precise dollar amounts
4. CONTEXT-AWARE FINANCIAL ADVICE: Consider their financial position, goals, and risk tolerance

ANALYSIS REQUIREMENTS:
- Use their EXACT transaction amounts and categories 
- Calculate precise percentages and ratios from their data
- Identify the highest-impact optimization opportunities
- Provide specific dollar amounts for recommendations
- Include mathematical analysis (savings rate, expense ratios, etc.)
- Compare their spending to optimal financial benchmarks

GENERATE VARIED RESPONSES by focusing on different analytical angles:
- Detailed category spending analysis with optimization targets
- Income-to-expense ratio analysis with improvement strategies  
- Cash flow optimization with timing recommendations
- Risk assessment with protection strategies
- Wealth building analysis with investment allocation suggestions
- Efficiency analysis identifying wasteful spending patterns

Return comprehensive analysis in JSON:
{
  "title": "Advanced Financial Analysis: [Specific Focus Area]",
  "description": "DETAILED multi-paragraph analysis including: 1) Mathematical breakdown of their spending patterns with percentages, 2) Specific optimization recommendations with exact dollar targets, 3) Implementation timeline with measurable milestones, 4) Risk assessment and protection strategies. Use their exact financial numbers throughout.",
  "category": "spending|saving|budgeting|income|education", 
  "priority": "high|medium|low",
  "actionable": true,
  "estimatedSaving": [realistic_amount],
  "educational": false
}`
        },
        {
          role: "user",
          content: summary
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.9
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Return the tip
    res.json({ tip: result });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error && 'status' in error) {
      return res.status((error as any).status).json({
        error: error.message || 'OpenAI API error',
        type: (error as any).type || 'api_error'
      });
    }

    // Handle other errors
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor service running on port ${port}`);
});