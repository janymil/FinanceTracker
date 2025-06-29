
#!/bin/bash

echo "=== DEPLOYING PDF PROCESSOR TO FLY.IO ==="

# Navigate to pdf-processor directory
cd "$(dirname "$0")"

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "Error: flyctl is not installed. Please install Fly.io CLI first."
    exit 1
fi

# Check if logged in to Fly.io
if ! flyctl auth whoami &> /dev/null; then
    echo "Error: Not logged in to Fly.io. Please run 'flyctl auth login' first."
    exit 1
fi

echo "Building and deploying PDF processor..."

# Deploy to Fly.io
flyctl deploy --ha=false

echo "Deployment complete!"
echo "You can check the status with: flyctl status"
echo "View logs with: flyctl logs"
