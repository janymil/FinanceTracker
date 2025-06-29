
#!/bin/bash

echo "=== DEPLOYING PDF PROCESSOR TO FLY.IO ==="

# Get the absolute path to the pdf-processor directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Working directory: $(pwd)"
echo "Files in directory:"
ls -la

# Verify required files exist
REQUIRED_FILES=("Dockerfile" "fly.toml" "package.json" "index.ts")
for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "Error: Required file '$file' not found in $(pwd)"
        exit 1
    fi
done

echo "✓ All required files found"

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "Error: flyctl is not installed. Please install Fly.io CLI first."
    echo "Visit: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

echo "✓ Fly.io CLI found"

# Check if logged in to Fly.io
if ! flyctl auth whoami &> /dev/null; then
    echo "Error: Not logged in to Fly.io. Please run 'flyctl auth login' first."
    exit 1
fi

echo "✓ Authenticated with Fly.io"

# Check if app exists, if not create it
if ! flyctl status &> /dev/null; then
    echo "App doesn't exist, launching new app..."
    flyctl launch --no-deploy --ha=false
fi

echo "Building and deploying PDF processor..."

# First try to build locally to test Dockerfile
echo "Testing Dockerfile build locally..."
if command -v docker &> /dev/null; then
    docker build -t test-pdf-processor . || echo "Local Docker build failed, but continuing with Fly.io deployment..."
fi

# Deploy to Fly.io with explicit options
echo "Deploying to Fly.io..."
flyctl deploy --ha=false --local-only --verbose

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Deployment successful!"
    echo ""
    echo "Next steps:"
    echo "• Check status: flyctl status"
    echo "• View logs: flyctl logs"
    echo "• Test health: curl https://finanzerpro-pdf.fly.dev/health"
else
    echo ""
    echo "✗ Deployment failed!"
    echo "Check the logs above for error details."
    exit 1
fi
