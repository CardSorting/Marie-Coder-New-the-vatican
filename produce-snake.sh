#!/bin/bash

# Ensure tsx is available or use npx tsx
echo "🐍 Running Snake Game Production Demo..."

# Check if OPENROUTER_API_KEY is set
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "⚠️  Warning: OPENROUTER_API_KEY is not set in environment."
    echo "Attempting to use key from ~/.engine/config.json..."
fi

npx tsx src/test/produce-snake.ts
