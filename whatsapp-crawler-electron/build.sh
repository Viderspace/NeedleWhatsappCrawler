#!/bin/bash

# WhatsApp Data Collector Build Script
# This script builds distributable packages for the Electron application

echo "🛠️ Building WhatsApp Data Collector distributables..."

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Install electron-builder if not already installed
echo "🔧 Ensuring electron-builder is installed..."
npm install --save-dev electron-builder

# Create dist directory if it doesn't exist
mkdir -p dist

# Build for current platform
echo "🚀 Building for current platform..."
npm run build

echo "✅ Build complete! Check the 'dist' folder for your distributable."
echo ""
echo "Available commands:"
echo "  npm run build-win    # Build for Windows"
echo "  npm run build-mac    # Build for macOS"  
echo "  npm run build-linux  # Build for Linux"
echo ""
echo "📂 Distributable files will be in the 'dist' directory."

