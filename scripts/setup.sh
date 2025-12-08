#!/bin/bash

# MrPlug Setup Script
# Automates initial setup for development

set -e

echo "🚀 Setting up MrPlug development environment..."

# Check for fnm
if ! command -v fnm &> /dev/null; then
    echo "⚠️  fnm not found. Installing fnm..."
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)"
fi

# Use correct Node.js version
echo "📦 Installing Node.js from .nvmrc..."
fnm use

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@8.15.0
fi

# Install dependencies
echo "📦 Installing project dependencies..."
pnpm install

# Generate placeholder icons
echo "🎨 Generating placeholder icons..."
node scripts/generate-icons.js

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from example..."
    cp .env.example .env.local
    echo "⚠️  Remember to add your API keys to .env.local"
fi

# Build the extension
echo "🔨 Building extension..."
pnpm build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your API keys to .env.local (optional for development)"
echo "2. Load the extension in your browser:"
echo "   - Chrome: chrome://extensions/ → Load unpacked → select 'dist' folder"
echo "   - Firefox: about:debugging → Load Temporary Add-on → select any file in 'dist'"
echo "3. Configure your API keys in the extension options page"
echo "4. Start development: pnpm dev"
echo ""
