import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'PDF Processor',
    timestamp: new Date().toISOString()
  });
});

// Basic PDF generation endpoint (to be implemented)
app.post('/generate-pdf', async (req, res) => {
  try {
    res.json({ 
      message: 'PDF processor is ready for implementation',
      received: Object.keys(req.body)
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`PDF Processor running on port ${port}`);
});