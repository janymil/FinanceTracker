#!/bin/bash

# Quick redeploy script for Fly.io AI processor
echo "Redeploying AI processor to Fly.io..."

# Set the OpenAI API key as a secret
fly secrets set OPENAI_API_KEY="$OPENAI_API_KEY" --app finanserpro-ai-processor

# Deploy the application
fly deploy --app finanserpro-ai-processor

echo "Deployment complete. Testing endpoint..."
sleep 5

# Test the endpoint
curl -X POST https://finanserpro-ai-processor.fly.dev/generate-financial-tips \
  -H "Content-Type: application/json" \
  -d '{"financialData":{"totalIncome":4000,"totalExpenses":100,"transactionsByCategory":[],"recentTransactions":[]}}'