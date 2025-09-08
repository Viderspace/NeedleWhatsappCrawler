#!/bin/bash

# start.sh - Linux launcher for WhatsApp Data Collector

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting WhatsApp Data Collector..."
echo "📁 Running from: $SCRIPT_DIR"

# Start the Node.js server
./bin/node app/server.js &
SERVER_PID=$!

echo "📱 Server starting with port detection..."
echo "🔌 Process ID: $SERVER_PID"
echo ""
echo "🌐 Waiting for server to start and detect port..."
echo "Press Ctrl+C to stop the server"

# Wait for server to start and detect port
sleep 5

# Detect the port by checking common ports
PORT=3377
for port in {3000..3010}; do
    if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
        PORT=$port
        break
    fi
done

echo "🎯 Server detected on port $PORT"

# Try to open browser (Linux)
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT"
elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import webbrowser; webbrowser.open('http://localhost:$PORT')"
elif command -v python >/dev/null 2>&1; then
    python -c "import webbrowser; webbrowser.open('http://localhost:$PORT')"
else
    echo "⚠️  Please open http://localhost:$PORT manually in your browser"
fi

echo ""
echo "✅ WhatsApp Data Collector is running!"
echo "   Open: http://localhost:$PORT"
echo ""
echo "To stop the server, press Ctrl+C or close this terminal"

# Wait for the server process
wait $SERVER_PID


