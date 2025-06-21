#!/bin/bash

# Deploy AI Processor to Fly.io
echo "Deploying FinanzerPro AI Processor to Fly.io..."

# Check if fly CLI is available
if ! command -v fly &> /dev/null; then
    echo "Error: Fly CLI not found. Please install it first:"
    echo "curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "Please login to Fly.io first:"
    echo "fly auth login"
    exit 1
fi

# Launch the app (creates fly.toml if it doesn't exist)
if [ ! -f "fly.toml" ]; then
    echo "Creating Fly.io app..."
    fly launch --no-deploy
fi

# Set the OpenAI API key secret
echo "Setting OpenAI API key..."
fly secrets set OPENAI_API_KEY="$(grep OPENAI_API_KEY .env | cut -d'=' -f2-)"

# Deploy the application
echo "Deploying application..."
fly deploy

# Show app status
echo "Deployment complete!"
echo "App URL: https://$(fly info | grep Hostname | awk '{print $2}')"
echo "Health check: https://$(fly info | grep Hostname | awk '{print $2}')/health"

echo ""
echo "Test the service:"
echo "curl -X POST https://$(fly info | grep Hostname | awk '{print $2}')/generate-financial-tip \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"summary\": \"Financial Summary: Monthly Income: \$5000, Monthly Expenses: \$3500, Net Balance: \$1500. Please provide personalized financial tips.\"}'"