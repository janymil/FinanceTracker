#!/bin/bash
# Claude CLI launcher with API key from Replit secrets
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

# Check if API key is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY not found in environment"
    exit 1
fi

echo "Using API key: ${ANTHROPIC_API_KEY:0:20}..."

# Run Claude CLI with the API key
npx claude "$@"