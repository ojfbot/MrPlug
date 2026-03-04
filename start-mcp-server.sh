#!/bin/bash

# MrPlug MCP Server Startup Script
# This script starts the MCP server for Claude Code integration

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           Starting MrPlug MCP Server                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 20.18.1+ and try again"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="20.18.1"

echo "✓ Node.js version: $NODE_VERSION"

# Navigate to MCP server directory
cd "$(dirname "$0")/mrplug-mcp-server"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env file created"
    echo "   You can customize ports in .env if needed"
fi

echo ""
echo "🚀 Starting MCP server..."
echo ""

# Start the server in development mode
npm run dev
