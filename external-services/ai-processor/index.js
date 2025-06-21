const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

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

// OpenAI chat completions proxy endpoint
app.post('/api/openai-chat', async (req, res) => {
  try {
    const { model, messages, response_format, temperature, max_tokens } = req.body;

    // Validate required fields
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: model and messages array are required' 
      });
    }

    // Make OpenAI API call
    const response = await openai.chat.completions.create({
      model,
      messages,
      response_format,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1000
    });

    // Return the response
    res.json(response);

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // Handle specific OpenAI errors
    if (error.status) {
      return res.status(error.status).json({
        error: error.message || 'OpenAI API error',
        type: error.type || 'api_error'
      });
    }

    // Handle other errors
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor service running on port ${port}`);
});