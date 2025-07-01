#!/bin/bash
# Claude CLI launcher with API key from Replit secrets
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
npx claude "$@"