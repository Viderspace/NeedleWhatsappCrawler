#!/bin/bash
echo "🚀 Starting WhatsApp Data Collector..."
./whatsapp-collector-darwin-arm64 &
PID=$!
echo "📱 Server running at http://localhost:3377"
echo "🔌 Process ID: $PID"
echo "Press Ctrl+C to stop"

# Open browser after a short delay
sleep 2 && open "http://localhost:3377" 2>/dev/null &

# Wait for process
wait $PID


