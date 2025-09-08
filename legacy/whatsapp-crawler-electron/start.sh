#!/bin/bash

# WhatsApp Data Collector Startup Script
# This script helps start the Electron application with proper environment

echo "🚀 Starting WhatsApp Data Collector..."
echo "📁 Current directory: $(pwd)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Set development environment
export NODE_ENV=development
export ELECTRON_IS_DEV=true

# Start the application
echo "🔥 Launching application..."
npm start

